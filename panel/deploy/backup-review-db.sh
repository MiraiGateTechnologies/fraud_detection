#!/bin/sh
# Daily copy of the reviewers' decisions (review.db) to S3.
# The bucket name comes from /etc/review-panel-backup.conf (BUCKET=...).
set -eu
PATH=/usr/local/bin:/usr/bin:/bin:/snap/bin
. /etc/review-panel-backup.conf

DB=/opt/fraud-panel/data/review.db
[ -f "$DB" ] || exit 0
STAMP=$(date +%Y%m%d_%H%M)
TMP="/tmp/review_$STAMP.db"
sqlite3 "$DB" ".backup '$TMP'"
aws s3 cp "$TMP" "s3://$BUCKET/review-db/review_$STAMP.db" --only-show-errors
rm -f "$TMP"
