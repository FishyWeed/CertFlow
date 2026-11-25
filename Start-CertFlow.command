#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "========================================"
echo "  Starting CertFlow..."
echo "========================================"
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Desktop is not installed yet."
  echo "Opening https://www.docker.com/products/docker-desktop/ ..."
  open "https://www.docker.com/products/docker-desktop/" 2>/dev/null || true
  echo "Install and start Docker Desktop, then double-click Start-CertFlow.command again."
  read -r -p "Press Enter to close..."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker Desktop is not running yet."
  echo "Open Docker Desktop, wait until it is running, then double-click Start-CertFlow.command again."
  read -r -p "Press Enter to close..."
  exit 1
fi

echo "Starting CertFlow containers (first launch may take 1-2 minutes)..."
docker compose up -d

echo "Waiting for CertFlow to become ready on http://localhost:3000 ..."
for _ in $(seq 1 45); do
  if curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "Opening CertFlow in your browser..."
open "http://localhost:3000" 2>/dev/null || xdg-open "http://localhost:3000" 2>/dev/null || true

echo
echo "CertFlow is running at http://localhost:3000"
echo "You can close this window safely. To stop CertFlow later, run: docker compose down"
read -r -p "Press Enter to close..."
