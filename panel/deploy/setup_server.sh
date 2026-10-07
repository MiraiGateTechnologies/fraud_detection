#!/usr/bin/env bash
# One-time setup of the review panel on a fresh Ubuntu 22.04 / 24.04 server.
# Copy the whole panel folder to the server first, then run:
#
#   sudo bash ~/panel/deploy/setup_server.sh panel.example.com you@example.com [s3-bucket]
#
# The email is for the free HTTPS certificate. Leave it out (or pass -) when a load balancer or CDN
# in front of the server already serves HTTPS for the domain.
#
# Safe to run again: it refreshes code and config and never touches the reviewers' decisions
# (data/review.db) or their accounts (data/users.db).
set -euo pipefail

DOMAIN="${1:?Usage: setup_server.sh <domain> [email] [s3-bucket]}"
EMAIL="${2:-}"
[ "$EMAIL" = "-" ] && EMAIL=""
BUCKET="${3:-}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP=/opt/fraud-panel
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }

step() { echo; echo "== $*"; }

step "System packages and automatic security updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq python3-venv nginx certbot python3-certbot-nginx sqlite3 unattended-upgrades curl
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' > /etc/apt/apt.conf.d/20auto-upgrades
timedatectl set-timezone Asia/Kolkata

step "Swap (2 GB)"
if ! swapon --show | grep -q '/swapfile'; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

step "Panel files in $APP"
id panel >/dev/null 2>&1 || useradd --system --home-dir "$APP" --shell /usr/sbin/nologin panel
mkdir -p "$APP/data" "$APP/web"
install -m 644 "$SRC/server.py" "$SRC/accounts.py" "$SRC/requirements.txt" "$APP/"
cp -r "$SRC/web/." "$APP/web/"
for f in activity.db dashboard.json; do
    if [ -f "$SRC/data/$f" ]; then install -m 640 "$SRC/data/$f" "$APP/data/$f"; fi
done
chown -R panel:panel "$APP"
chmod 750 "$APP" "$APP/data"
install -m 755 "$SRC/deploy/install_update.sh" /usr/local/bin/fraud-panel-install-update
install -m 755 "$SRC/deploy/fraud-panel-users.sh" /usr/local/bin/fraud-panel-users

step "Python environment"
[ -x "$APP/venv/bin/python" ] || sudo -u panel python3 -m venv "$APP/venv"
sudo -u panel "$APP/venv/bin/pip" install --quiet --upgrade pip
sudo -u panel "$APP/venv/bin/pip" install --quiet -r "$APP/requirements.txt"

step "Panel service"
install -m 644 "$SRC/deploy/fraud-panel.service" /etc/systemd/system/fraud-panel.service
systemctl daemon-reload
systemctl enable fraud-panel
systemctl restart fraud-panel
sleep 3
if curl -fsS -o /dev/null http://127.0.0.1:8080/login; then
    echo "Panel is running on 127.0.0.1:8080"
else
    echo "The panel did not start. Check: journalctl -u fraud-panel -n 50"
fi
for f in activity.db dashboard.json; do
    [ -f "$APP/data/$f" ] || echo "Missing $APP/data/$f. Send the data with push_update.ps1."
done

step "Nginx for $DOMAIN"
rm -f /etc/nginx/.panel_users   # browser login of earlier versions; the panel has its own sign-in page now
sed "s/__DOMAIN__/$DOMAIN/g" "$SRC/deploy/nginx-review-panel.conf" > /etc/nginx/sites-available/review-panel
ln -sf /etc/nginx/sites-available/review-panel /etc/nginx/sites-enabled/review-panel
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [ -n "$EMAIL" ] || [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    step "HTTPS certificate for $DOMAIN"
    if ! certbot --nginx -d "$DOMAIN" ${EMAIL:+-m "$EMAIL"} --agree-tos --no-eff-email --redirect --non-interactive; then
        echo "Certificate failed. Check that $DOMAIN points to this server and port 80 is open, then run this script again."
        exit 1
    fi
else
    echo "No email given, so no certificate was requested. That is right when a load balancer or CDN"
    echo "in front of this server serves https://$DOMAIN. Otherwise run this script again with an email."
fi

if [ -n "$BUCKET" ]; then
    step "Daily backup of review.db to s3://$BUCKET"
    command -v aws >/dev/null || snap install aws-cli --classic
    install -m 755 "$SRC/deploy/backup-review-db.sh" /usr/local/bin/backup-review-db
    echo "BUCKET=$BUCKET" > /etc/review-panel-backup.conf
    echo "30 23 * * * root /usr/local/bin/backup-review-db" > /etc/cron.d/review-panel-backup
fi

step "Reviewer accounts"
/usr/local/bin/fraud-panel-users list

echo
echo "Done. Open https://$DOMAIN"
echo "Add reviewers:      sudo fraud-panel-users add <name> [<name> ...]"
echo "Change a password:  sudo fraud-panel-users passwd <name>"
echo "Remove a reviewer:  sudo fraud-panel-users remove <name>"
