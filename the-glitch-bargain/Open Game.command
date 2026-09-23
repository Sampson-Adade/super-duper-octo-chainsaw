#!/bin/zsh
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is needed once to run this game. Install Node.js 20.9 or newer from https://nodejs.org, then double-click Open Game.command again."
  read "?Press Return to close this window."
  exit 1
fi
if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 9) ? 0 : 1)'; then
  echo "This game needs Node.js 20.9 or newer. Update Node.js at https://nodejs.org, then double-click Open Game.command again."
  read "?Press Return to close this window."
  exit 1
fi

if [[ ! -f .env ]]; then cp .env.example .env; fi
if [[ ! -d node_modules ]]; then
  echo "One-time setup: downloading the game packages…"
  GLITCH_NPM_CACHE="${TMPDIR:-/tmp}/the-glitch-bargain-npm-cache"
  if ! npm install --cache "$GLITCH_NPM_CACHE"; then
    echo "Package setup failed. Check the error above and your internet connection."
    read "?Press Return to close this window."
    exit 1
  fi
fi

echo "Preparing the game…"
if ! npm run build; then
  echo "The game could not finish preparing. Read the error above, then try again."
  read "?Press Return to close this window."
  exit 1
fi

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [[ -n "$LAN_IP" ]]; then
  export CLIENT_URL='*'
  echo "On this Mac: http://localhost:3000"
  echo "On phones on the same Wi-Fi: http://${LAN_IP}:3000"
else
  echo "Open this game on this Mac: http://localhost:3000"
  echo "No Wi-Fi address was found for phone access."
fi

echo "Keep this Terminal window open while you play. Press Control-C to stop the game."
npm start &
GAME_PID=$!
cleanup() {
  kill -TERM "$GAME_PID" 2>/dev/null || true
  wait "$GAME_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
for i in {1..120}; do
  if curl -fsS -o /dev/null http://localhost:3000 2>/dev/null; then
    open http://localhost:3000
    break
  fi
  if ! kill -0 "$GAME_PID" 2>/dev/null; then
    echo "The game stopped during startup. Read the error above."
    read "?Press Return to close this window."
    exit 1
  fi
  sleep 1
done
wait "$DEV_PID"
