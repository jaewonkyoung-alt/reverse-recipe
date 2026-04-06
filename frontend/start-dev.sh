#!/bin/bash
export PATH="/usr/local/bin:$PATH"
cd "$(dirname "$0")"
/usr/local/bin/npx vite --port 3000
