#!/bin/sh
set -euf

: "${PGHOST:?PGHOST is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required}"

retention_days="${BACKUP_RETENTION_DAYS:-14}"
backup_dir="${BACKUP_DIR:-/backups}"
case "$retention_days" in
  ''|*[!0-9]*) echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2; exit 2 ;;
esac
[ "$retention_days" -ge 1 ] || { echo "BACKUP_RETENTION_DAYS must be at least 1" >&2; exit 2; }

umask 077
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
base="${PGDATABASE}-${stamp}.dump.age"
tmp="${backup_dir}/.${base}.tmp"
final="${backup_dir}/${base}"
mkdir -p "$backup_dir"

pg_dump --format=custom --no-owner --no-acl \
  | age --recipient "$BACKUP_AGE_RECIPIENT" --output "$tmp"
mv "$tmp" "$final"
find "$backup_dir" -maxdepth 1 -type f -name "${PGDATABASE}-*.dump.age" -mtime "+${retention_days}" -delete
printf 'Encrypted database backup created: %s\n' "$final"
