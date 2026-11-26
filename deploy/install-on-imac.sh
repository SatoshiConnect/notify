#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CADDY_DIR="/usr/local/etc/satoshicore"
CADDY_ALL="$CADDY_DIR/Caddyfile.all"
CADDY_SITE="$CADDY_DIR/Caddyfile.notify"
CADDY_IMPORT="import Caddyfile.notify"
LABEL="com.satoshicore.notify"
DOMAIN="gui/$(id -u)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs"

if [[ ! -f "$ROOT/.env.production" ]]; then
  echo "Missing $ROOT/.env.production. Configure the production environment first." >&2
  exit 1
fi
if ! grep -Eq '^GOOGLE_CLIENT_ID=.+\.apps\.googleusercontent\.com$' "$ROOT/.env.production"; then
  echo "GOOGLE_CLIENT_ID is missing or invalid in .env.production." >&2
  exit 1
fi
if ! grep -Eq '^JWT_SECRET=.{32,}$' "$ROOT/.env.production"; then
  echo "JWT_SECRET must contain at least 32 characters." >&2
  exit 1
fi
if ! grep -Eq '^VAPID_PUBLIC_KEY=.{20,}$' "$ROOT/.env.production" || ! grep -Eq '^VAPID_PRIVATE_KEY=.{20,}$' "$ROOT/.env.production"; then
  echo "VAPID keys are required for background push notifications." >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR" "$ROOT/.data"
chmod 600 "$ROOT/.env.production"
chmod 700 "$ROOT/.data"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$(command -v node)</string><string>$ROOT/src/server.js</string></array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ProcessType</key><string>Background</string>
  <key>EnvironmentVariables</key><dict>
    <key>NODE_ENV</key><string>production</string>
    <key>PORT</key><string>3002</string>
    <key>TRUST_PROXY</key><string>true</string>
    <key>DATA_DIR</key><string>$ROOT/.data</string>
    <key>DOTENV_CONFIG_PATH</key><string>$ROOT/.env.production</string>
    <key>MHTALK_API_BASE</key><string>https://chat.satoshicore.org/api/</string>
  </dict>
  <key>StandardOutPath</key><string>$LOG_DIR/satoshicore-notify.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/satoshicore-notify.log</string>
</dict></plist>
PLIST
plutil -lint "$PLIST"

if [[ ! -e "$CADDY_ALL" ]]; then
  echo "Caddy configuration not found: $CADDY_ALL" >&2
  exit 1
fi
timestamp="$(date +%Y%m%d-%H%M%S)"
sudo cp -p "$CADDY_ALL" "$CADDY_ALL.bak-notify-$timestamp"
sudo install -o root -g wheel -m 0644 "$ROOT/deploy/Caddyfile.notify" "$CADDY_SITE"
if ! sudo grep -Fqx "$CADDY_IMPORT" "$CADDY_ALL"; then
  printf '\n%s\n' "$CADDY_IMPORT" | sudo tee -a "$CADDY_ALL" >/dev/null
fi
if ! sudo /opt/homebrew/bin/caddy validate --config "$CADDY_ALL" --adapter caddyfile; then
  echo "Caddy validation failed. Backup: $CADDY_ALL.bak-notify-$timestamp" >&2
  exit 1
fi

launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl kickstart -k "$DOMAIN/$LABEL"
if launchctl print "$DOMAIN/org.satoshicore.caddy" >/dev/null 2>&1; then
  launchctl kickstart -k "$DOMAIN/org.satoshicore.caddy"
fi
if sudo launchctl print system/com.satoshicore.caddy-standard-ports >/dev/null 2>&1; then
  sudo launchctl kickstart -k system/com.satoshicore.caddy-standard-ports
fi

for _ in {1..30}; do
  if curl -fsS --max-time 2 http://127.0.0.1:3002/health >/dev/null; then break; fi
  sleep 1
done
curl -fsS --max-time 5 http://127.0.0.1:3002/health
echo
echo "Notify is running on 127.0.0.1:3002. Caddy serves notify.satoshicore.org."
