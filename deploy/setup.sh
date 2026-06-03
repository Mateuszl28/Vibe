#!/usr/bin/env bash
#
# Vibe sklep - instalacja na serwerze (Ubuntu/Debian).
# Uruchom JAKO ROOT z katalogu repozytorium:
#   sudo bash deploy/setup.sh
#
set -euo pipefail

PORT="${PORT:-8080}"
SERVICE_NAME="vibe-sklep"
# Katalog repo = dwa poziomy wyzej niz ten skrypt (deploy/..)
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Vibe sklep - instalacja"
echo "    Katalog repo: $REPO_DIR"
echo "    Port:         $PORT"

if [[ $EUID -ne 0 ]]; then
  echo "!! Uruchom jako root (sudo bash deploy/setup.sh)"; exit 1
fi

# --- 1. Node.js (wymagany >= 22 dla wbudowanego node:sqlite) ---
NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
fi
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "==> Instaluje Node.js 22 LTS (potrzebny do bazy SQLite)... obecnie: ${NODE_MAJOR:-brak}"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  echo "==> Node.js OK: $(node -v)"
fi
NODE_BIN="$(command -v node)"

# --- 2. Uprawnienia katalogu (serwis dziala jako www-data) ---
echo "==> Ustawiam wlasciciela katalogu na www-data..."
chown -R www-data:www-data "$REPO_DIR"

# --- 3. Plik uslugi systemd (generowany pod realny katalog i node) ---
echo "==> Tworze usluge systemd: $SERVICE_NAME"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Vibe sklep (Node.js) - bluzy i koszulki
After=network.target

[Service]
Type=simple
WorkingDirectory=${REPO_DIR}
Environment=PORT=${PORT}
Environment=HOST=0.0.0.0
# Adres bazowy do SEO (canonical, Open Graph, sitemap). Zmien na domene gdy bedzie.
Environment=SITE_URL=http://85.215.197.199:${PORT}
# Konto administratora (login: admin). ZMIEN HASLO ponizej na wlasne!
Environment=ADMIN_USER=admin
Environment=ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}
# Flaga --experimental-sqlite wymagana dla wbudowanej bazy SQLite (Node 22)
ExecStart=${NODE_BIN} --experimental-sqlite server.js
Restart=always
RestartSec=3
User=www-data
Group=www-data
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# --- 4. Firewall (jesli ufw aktywny) ---
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  echo "==> Otwieram port ${PORT} w ufw..."
  ufw allow "${PORT}/tcp" || true
fi

# --- 5. Start uslugi ---
echo "==> Wlaczam i startuje usluge..."
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

sleep 2
echo ""
echo "==> Status:"
systemctl --no-pager --full status "${SERVICE_NAME}" | head -n 12 || true

IP="$(hostname -I | awk '{print $1}')"
echo ""
echo "============================================================"
echo "  GOTOWE. Sklep dziala pod:  http://${IP}:${PORT}"
echo "  Logi:        journalctl -u ${SERVICE_NAME} -f"
echo "  Restart:     systemctl restart ${SERVICE_NAME}"
echo "  Aktualizacja: cd ${REPO_DIR} && git pull && systemctl restart ${SERVICE_NAME}"
echo "============================================================"
