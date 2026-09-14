#!/usr/bin/env bash
# Offline checks: syntax + that the libfprint patch still applies.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail=0
for f in "${ROOT}/bin/x403f-fp" "${ROOT}/install.sh" "${ROOT}/uninstall.sh" "${ROOT}/scripts/common.sh"; do
  if bash -n "$f"; then
    echo "syntax ok  $f"
  else
    echo "syntax FAIL $f"
    fail=1
  fi
done

if [[ "${1:-}" == "--apply" ]]; then
  tmp="$(mktemp -d)"
  git init "$tmp" >/dev/null
  git -C "$tmp" remote add origin https://github.com/goodix-fp-linux-dev/libfprint.git
  git -C "$tmp" fetch --depth 1 origin 07306bbc9256942595e31fb0f407b364ffa24d07
  git -C "$tmp" checkout --force FETCH_HEAD >/dev/null
  git -C "$tmp" apply --check "${ROOT}/patches/elanspi-x403f.patch"
  git -C "$tmp" apply "${ROOT}/patches/elanspi-x403f.patch"
  git -C "$tmp" apply --check "${ROOT}/patches/sigfm-opencv5.patch"
  git -C "$tmp" apply "${ROOT}/patches/sigfm-opencv5.patch"
  grep -q '0x3128' "$tmp/libfprint/drivers/elanspi.h"
  grep -q 'FPI_DEVICE_ALGO_SIGFM' "$tmp/libfprint/drivers/elanspi.c"
  grep -q 'entry->hid_id.pid == 0' "$tmp/libfprint/fp-context.c"
  grep -q "dependency('opencv5'" "$tmp/libfprint/sigfm/meson.build"
  grep -q 'x403f-waitup: draining after press' "$tmp/libfprint/drivers/elanspi.c"
  grep -q 'x403f: SIGFM match threshold' "$tmp/libfprint/drivers/elanspi.c"
  grep -q 'bz3_threshold = 5' "$tmp/libfprint/drivers/elanspi.c"
  echo "patch applies on pinned libfprint commit"
  rm -rf "$tmp"
fi

exit "$fail"
