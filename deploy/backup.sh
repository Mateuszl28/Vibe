#!/usr/bin/env bash
#
# Kopia zapasowa bazy Vibe -> katalog backups/ (rotacja: usuwa starsze niz 14 dni).
# Reczne: bash deploy/backup.sh
# Automatyczne (codziennie 3:00) - dodaj do crontab root:
#   0 3 * * * /bin/bash /opt/vibe-sklep/deploy/backup.sh >> /var/log/vibe-backup.log 2>&1
#
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$DIR/backups"
mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_DIR/vibe-$TS.db"

if command -v sqlite3 >/dev/null 2>&1; then
  # .backup jest bezpieczny nawet przy dzialajacym serwerze (tryb WAL)
  sqlite3 "$DIR/data/vibe.db" ".backup '$DEST'"
else
  # awaryjnie: zwykla kopia (zalecane: apt-get install -y sqlite3)
  cp "$DIR/data/vibe.db" "$DEST"
fi

# usun kopie starsze niz 14 dni
find "$BACKUP_DIR" -name 'vibe-*.db' -mtime +14 -delete 2>/dev/null || true
echo "Backup zapisany: $DEST"
