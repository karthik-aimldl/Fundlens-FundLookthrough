#!/bin/sh
cd "$(dirname "$0")" || exit 1
if command -v open >/dev/null 2>&1; then open index.html; else xdg-open index.html; fi
