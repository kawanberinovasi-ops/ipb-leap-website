#!/bin/zsh
set -e
cd -- "${0:A:h}"
python3 tools/build.py
PYTHONDONTWRITEBYTECODE=1 python3 local/server.py --port 8765
