#!/bin/sh
# Installs files uploaded to /tmp/panel-update (by push_update.ps1) and restarts the panel.
# The reviewers' decisions (data/review.db) and accounts (data/users.db) are never touched.
set -eu
SRC=/tmp/panel-update
APP=/opt/fraud-panel
[ -d "$SRC" ] || { echo "Nothing to install in $SRC"; exit 1; }

for f in server.py accounts.py requirements.txt; do
    if [ -f "$SRC/$f" ]; then install -o panel -g panel -m 644 "$SRC/$f" "$APP/$f"; fi
done
if [ -d "$SRC/web" ]; then
    cp -r "$SRC/web/." "$APP/web/"
    chown -R panel:panel "$APP/web"
fi
for f in activity.db dashboard.json; do
    if [ -f "$SRC/$f" ]; then install -o panel -g panel -m 640 "$SRC/$f" "$APP/data/$f"; fi
done
sudo -u panel "$APP/venv/bin/pip" install --quiet -r "$APP/requirements.txt"
rm -rf "$SRC"
systemctl restart fraud-panel
echo "Panel updated"
