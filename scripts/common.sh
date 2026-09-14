# Shared helpers for the ASUS VivoBook X403F fingerprint installer.
# shellcheck shell=bash

set -euo pipefail

_HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -d "${_HERE}/../patches" ]]; then
  ROOT="$(cd "${_HERE}/.." && pwd)"
elif [[ -d "${_HERE}/patches" ]]; then
  ROOT="${_HERE}"
else
  ROOT="${X403F_ROOT:-/opt/asus-x403f-fp/share/x403f-fp}"
fi
PREFIX="${X403F_PREFIX:-/opt/asus-x403f-fp}"
LIBDIR="${PREFIX}/lib"
PINNED_COMMIT="07306bbc9256942595e31fb0f407b364ffa24d07"
LIBFPRINT_REPO="${LIBFPRINT_REPO:-https://github.com/goodix-fp-linux-dev/libfprint.git}"
BUILD_DIR="${X403F_BUILD_DIR:-${ROOT}/.build/libfprint}"

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }

need_root() {
  if [[ ${EUID} -ne 0 ]]; then
    red "This command needs root. Re-run with sudo."
    exit 1
  fi
}

have() { command -v "$1" >/dev/null 2>&1; }

detect_spi_acpi() {
  local d
  shopt -s nullglob
  for d in /sys/bus/spi/devices/*; do
    local name
    name="$(basename "$d")"
    case "$name" in
      *ELAN7001*|*ELAN7002*|*ELAN70A1*)
        printf '%s\n' "$name"
        return 0
        ;;
    esac
  done
  return 1
}

list_elan_hid_pids() {
  local uevent hid
  shopt -s nullglob
  for uevent in /sys/bus/hid/devices/*/uevent; do
    hid="$(grep -E '^HID_ID=' "$uevent" 2>/dev/null || true)"
    if [[ "$hid" =~ 000004[Ff]3: ]]; then
      printf '%s\n' "${hid#HID_ID=}"
    fi
  done
}

detect_goodix_usb() {
  lsusb 2>/dev/null | grep -i '27c6:' || true
}

detect_elan_usb() {
  lsusb 2>/dev/null | grep -i '04f3:' || true
}

spidev_nodes() {
  shopt -s nullglob
  local n
  for n in /dev/spidev*; do
    printf '%s\n' "$n"
  done
}

bind_spidev() {
  modprobe spidev 2>/dev/null || true
  local d name
  shopt -s nullglob
  for d in /sys/bus/spi/devices/*; do
    name="$(basename "$d")"
    case "$name" in
      *ELAN7001*|*ELAN7002*|*ELAN70A1*)
        if [[ -e "$d/driver" ]]; then
          local current
          current="$(basename "$(readlink -f "$d/driver")" || true)"
          if [[ "$current" == "spidev" ]]; then
            continue
          fi
          echo "$name" > "$d/driver/unbind" 2>/dev/null || true
        fi
        echo spidev > "$d/driver_override" 2>/dev/null || true
        echo "$name" > /sys/bus/spi/drivers/spidev/bind 2>/dev/null || true
        ;;
    esac
  done
}

load_spi_modules() {
  local m
  for m in intel-lpss intel-lpss-pci spi-pxa2xx-platform spi-pxa2xx spidev hid-generic i2c-hid i2c-hid-acpi; do
    modprobe "$m" 2>/dev/null || true
  done
}

os_pretty() {
  if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    printf '%s\n' "${PRETTY_NAME:-${ID:-unknown}}"
  else
    echo unknown
  fi
}

install_deps() {
  if have pacman; then
    pacman_install_deps
  elif have apt-get; then
    apt_install_deps
  else
    red "Need pacman (CachyOS / Arch) or apt (Ubuntu / Debian)."
    exit 1
  fi
}

pacman_lock_holders() {
  if have fuser; then
    fuser /var/lib/pacman/db.lck 2>/dev/null || true
  elif have lsof; then
    lsof -t /var/lib/pacman/db.lck 2>/dev/null || true
  fi
}

wait_for_pacman_lock() {
  local i pids
  for i in $(seq 1 45); do
    if [[ ! -e /var/lib/pacman/db.lck ]]; then
      return 0
    fi
    pids="$(pacman_lock_holders | tr -s '[:space:]' ' ' | sed 's/^ *//;s/ *$//')"
    if [[ -z "$pids" ]]; then
      yellow "Removing stale pacman lock (/var/lib/pacman/db.lck)"
      rm -f /var/lib/pacman/db.lck
      return 0
    fi
    yellow "pacman is busy (pid ${pids}). Close Pamac / CachyOS Hello / another pacman window. Waiting..."
    sleep 2
  done
  red "pacman database is still locked."
  echo "Close every package manager window, then either wait or run:"
  echo "  sudo rm -f /var/lib/pacman/db.lck"
  echo "  sudo ./install.sh"
  exit 1
}

pacman_install_deps() {
  wait_for_pacman_lock
  # Avoid -Sy: it needs the db lock longer and can conflict with CachyOS Hello / Pamac.
  if ! pacman -S --needed --noconfirm \
    git meson ninja gcc pkgconf base-devel \
    glib2 libgusb libgudev pixman nss polkit \
    opencv doctest \
    fprintd \
    usbutils pciutils kmod; then
    wait_for_pacman_lock
    pacman -Sy --needed --noconfirm \
      git meson ninja gcc pkgconf base-devel \
      glib2 libgusb libgudev pixman nss polkit \
      opencv doctest \
      fprintd \
      usbutils pciutils kmod
  fi
}

apt_install_deps() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  local extra=()
  if apt-cache show doctest-dev >/dev/null 2>&1; then
    extra+=(doctest-dev)
  else
    extra+=(libdoctest-dev)
  fi
  apt-get install -y --no-install-recommends \
    git meson ninja-build build-essential pkg-config ca-certificates \
    g++ \
    libglib2.0-dev libgusb-dev libgudev-1.0-dev libpixman-1-dev \
    libnss3-dev libpolkit-gobject-1-dev libsystemd-dev \
    libopencv-dev \
    fprintd libpam-fprintd \
    usbutils pciutils udev systemd kmod \
    "${extra[@]}"
}

clone_libfprint() {
  mkdir -p "$(dirname "$BUILD_DIR")"
  rm -rf "$BUILD_DIR"
  mkdir -p "$BUILD_DIR"
  git init "$BUILD_DIR"
  git -C "$BUILD_DIR" remote add origin "$LIBFPRINT_REPO"
  git -C "$BUILD_DIR" fetch --depth 1 origin "$PINNED_COMMIT"
  git -C "$BUILD_DIR" checkout --force FETCH_HEAD
}

apply_patch() {
  git -C "$BUILD_DIR" apply --check "${ROOT}/patches/elanspi-x403f.patch"
  git -C "$BUILD_DIR" apply "${ROOT}/patches/elanspi-x403f.patch"
  git -C "$BUILD_DIR" apply --check "${ROOT}/patches/sigfm-opencv5.patch"
  git -C "$BUILD_DIR" apply "${ROOT}/patches/sigfm-opencv5.patch"
}

ensure_doctest_pkgconfig() {
  if pkg-config --exists doctest; then
    return 0
  fi
  local inc=""
  if [[ -f /usr/include/doctest/doctest.h ]]; then
    inc=/usr/include
  elif [[ -f /usr/include/doctest.h ]]; then
    inc=/usr/include
  else
    red "doctest headers missing (install doctest-dev or libdoctest-dev)."
    exit 1
  fi
  mkdir -p "${BUILD_DIR}/.pc"
  cat > "${BUILD_DIR}/.pc/doctest.pc" <<EOF
prefix=/usr
includedir=${inc}
Name: doctest
Description: C++ testing framework
Version: 2.4.11
Cflags: -I\${includedir}
EOF
  export PKG_CONFIG_PATH="${BUILD_DIR}/.pc${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
}

build_libfprint() {
  if ! pkg-config --exists opencv5 && ! pkg-config --exists opencv4 && ! pkg-config --exists opencv; then
    red "OpenCV pkg-config file not found (looked for opencv5, opencv4, opencv)."
    echo "Installed opencv-related pkg-config modules:"
    pkg-config --list-all 2>/dev/null | grep -i opencv || echo "  (none)"
    exit 1
  fi
  ensure_doctest_pkgconfig
  rm -rf "${BUILD_DIR}/build"
  # Keep libdir as "lib" so LD_LIBRARY_PATH is a single directory.
  # Force GCC: some images have clang as c++ without libstdc++.
  # OpenCV 5 requires C++17.
  CC="${CC:-gcc}" CXX="${CXX:-g++}" meson setup "${BUILD_DIR}/build" "$BUILD_DIR" \
    --prefix="$PREFIX" \
    --libdir=lib \
    -Dcpp_std=c++17 \
    -Ddrivers=elanspi \
    -Dudev_rules=disabled \
    -Dudev_hwdb=disabled \
    -Ddoc=false \
    -Dintrospection=false \
    -Dgtk-examples=false
  ninja -C "${BUILD_DIR}/build"
}

install_libfprint() {
  ninja -C "${BUILD_DIR}/build" install
  ldconfig || true
}

install_system_files() {
  install -d /etc/udev/rules.d /etc/modprobe.d /etc/modules-load.d \
    /etc/systemd/system/fprintd.service.d "$PREFIX/bin" \
    "${PREFIX}/share/x403f-fp/scripts" "${PREFIX}/share/x403f-fp/patches" \
    "${PREFIX}/share/x403f-fp/system"

  install -m 0644 "${ROOT}/system/99-elan-spi-x403f.rules" /etc/udev/rules.d/
  install -m 0644 "${ROOT}/system/99-fingerprint-perms.rules" /etc/udev/rules.d/
  install -m 0644 "${ROOT}/system/spidev-bufsiz.conf" /etc/modprobe.d/spidev-x403f.conf
  install -m 0644 "${ROOT}/system/modules-load-x403f.conf" /etc/modules-load.d/x403f-fingerprint.conf
  install -m 0644 "${ROOT}/system/fprintd-x403f.conf" /etc/systemd/system/fprintd.service.d/x403f.conf
  install -m 0755 "${ROOT}/bin/x403f-fp" "$PREFIX/bin/x403f-fp"
  install -m 0644 "${ROOT}/scripts/common.sh" "${PREFIX}/share/x403f-fp/scripts/common.sh"
  install -m 0644 "${ROOT}/patches/elanspi-x403f.patch" "${PREFIX}/share/x403f-fp/patches/"
  install -m 0644 "${ROOT}/patches/sigfm-opencv5.patch" "${PREFIX}/share/x403f-fp/patches/"
  cp -a "${ROOT}/system/." "${PREFIX}/share/x403f-fp/system/"
  ln -sfn "$PREFIX/bin/x403f-fp" /usr/local/bin/x403f-fp
  ln -sfn "$PREFIX/bin/x403f-fp" /usr/bin/x403f-fp

  # Ensure current kernel module picks up bufsiz without a reboot.
  if [[ -e /sys/module/spidev/parameters/bufsiz ]]; then
    echo 32768 > /sys/module/spidev/parameters/bufsiz 2>/dev/null || true
  fi
}

reload_services() {
  udevadm control --reload-rules || true
  udevadm trigger --subsystem-match=spi --action=add || true
  udevadm trigger --subsystem-match=hidraw --action=add || true
  systemctl daemon-reload
  systemctl restart fprintd.service 2>/dev/null \
    || systemctl restart fprintd 2>/dev/null \
    || true
}

ensure_pam_fprintd_line() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  if grep -q 'pam_fprintd\.so' "$file"; then
    return 0
  fi
  cp -a "$file" "${file}.x403f.bak"
  local tmp
  tmp="$(mktemp)"
  awk '
    BEGIN { done = 0 }
    /^auth[ \t]/ && !done {
      print "auth      sufficient      pam_fprintd.so"
      done = 1
    }
    { print }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
  green "Enabled pam_fprintd in ${file} (backup: ${file}.x403f.bak)"
}

enable_pam() {
  if have pam-auth-update; then
    pam-auth-update --enable fprintd --package || true
    return
  fi
  # Arch / CachyOS: do not touch system-auth (too broad). Local login +
  # display manager only, password still works because pam_unix stays.
  ensure_pam_fprintd_line /etc/pam.d/system-local-login
  ensure_pam_fprintd_line /etc/pam.d/sddm
  ensure_pam_fprintd_line /etc/pam.d/gdm-password
  ensure_pam_fprintd_line /etc/pam.d/kde
}

set_rotation() {
  local n="$1"
  if [[ ! "$n" =~ ^[0-3]$ ]]; then
    red "Rotation must be 0, 1, 2 or 3 (none / 90 left / 180 / 90 right)."
    exit 1
  fi
  mkdir -p /etc/systemd/system/fprintd.service.d
  cat > /etc/systemd/system/fprintd.service.d/x403f.conf <<EOF
[Service]
Environment=LD_LIBRARY_PATH=${LIBDIR}
Environment=ELANSPI_ROTATE=${n}
EOF
  systemctl daemon-reload
  systemctl restart fprintd.service 2>/dev/null || systemctl restart fprintd || true
  green "Rotation set to ${n}. Re-enroll after changing rotation:"
  echo "  fprintd-delete \"\$USER\""
  echo "  x403f-fp enroll"
}
