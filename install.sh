#!/usr/bin/env bash
# One-shot installer. Equivalent to: sudo ./bin/x403f-fp install
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${ROOT}/bin/x403f-fp" install "$@"
