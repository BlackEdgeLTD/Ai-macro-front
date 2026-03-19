#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "Missing .env.local — copy .env.example to .env.local and fill in the values." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting dev server at http://localhost:3000"
exec npm run dev
