#!/usr/bin/env bash
# Build the VS Code extension into dist-vscode/project-scaffold-<version>.vsix (web build included).
# Install it with: code --install-extension dist-vscode/project-scaffold-<version>.vsix
# In Docker instead: docker buildx bake vscode
set -euo pipefail
cd "$(dirname "$0")/.."

# Install when missing or older than the lockfile (dependencies added since the last install).
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci
fi

rm -rf dist-vscode
npm run vscode:build # web build + extension + vsce package

ls -lh dist-vscode/*.vsix
