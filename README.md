# ASUS VivoBook X403F fingerprint on CachyOS (and Ubuntu)

The fingerprint reader on the **ASUS VivoBook 14 X403F / X403FA / X403FAC**
works on Windows and is ignored or broken on Linux. This repo makes it work
on **CachyOS** (Arch) and Ubuntu.

It is **not a USB device**. `lsusb` will not show it. The chip is an Elan SPI
sensor (`ACPI ELAN7001` / `ELAN7002`) sitting in the corner of the touchpad,
paired with HID `04F3:3128` (`ELAN1301`). Distro `libfprint` either:

- never binds `spidev` to the ACPI node,
- does not list product ID `0x3128`,
- times out during OTP / VCOM init (`timed out waiting for vcom detection`),
- treats HID reset failure as fatal (this SKU uses **GPIO** reset in the ASUS
  Windows INF),
- or enrolls prints that never verify, because NBIS cannot match the narrow
  swipe strips these sensors produce.

This installer builds a patched `libfprint` (elanspi + SIGFM matcher), installs
it under `/opt/asus-x403f-fp` so the distro library stays untouched, and points
**only** `fprintd` at it.

## On the laptop (CachyOS)

```bash
sudo pacman -Sy --needed --noconfirm git
git clone https://github.com/ShwetankDhyani/fingerprint.git
cd fingerprint
sudo ./install.sh
x403f-fp enroll
x403f-fp verify
```

Already cloned?

```bash
cd ~/fingerprint
git pull
sudo ./install.sh
sudo systemctl restart fprintd
./bin/x403f-fp enroll
```

`install.sh` needs network (to fetch libfprint), a compiler, and a few minutes.

CachyOS / Arch ship **OpenCV 5**, which provides `opencv5.pc` and no longer
`opencv4.pc`. The installer patches SIGFM’s Meson file to accept either name.
If meson stops on `Dependency "opencv4" not found`, `git pull` and re-run
`sudo ./install.sh`.

### SPI buffer (`Permission denied` on bufsiz)

CachyOS ships `spidev.bufsiz` as a **read-only** sysfs file. This always fails,
even as root:

```bash
echo 32768 | sudo tee /sys/module/spidev/parameters/bufsiz
# tee: .../bufsiz: Permission denied
```

Do not fight sysfs. `sudo ./bin/x403f-fp prepare` unbinds the Elan SPI device,
reloads `spidev` with `bufsiz=32768`, rebinds `/dev/spidev1.0`, and restarts
fprintd. `sudo ./bin/x403f-fp enroll` does that automatically first.

KDE Plasma: **System Settings → Users → Fingerprint**.
GNOME: **Settings → Users → Fingerprint Login**.

Password login stays available. Fingerprint login only works after
`./bin/x403f-fp enroll` lists a saved finger **and** `./bin/x403f-fp verify`
prints `verify-match`. The Settings app can show a finger as enrolled without
writing `/var/lib/fprint`.

## Press the corner pad

On Windows this reader is a tap/press sensor. The Linux driver still talks to
it as a strip, but on the X403FA a **firm press** on the corner pad (usually
top-right of the touchpad), hold about a second, then lift, is what completes
a stage. A long swipe across the touchpad often stalls after the first pass.

Close **System Settings → Users → Fingerprint** while using the CLI. Two
clients claiming the reader at once produces `Device was already claimed`
and `enroll-disconnected`.

If you see one `enroll-stage-passed` and then `enroll-disconnected` with
`Device disabled to prevent overheating` in the journal: the old driver kept
capturing after the first swipe until libfprint’s 3-minute cutoff. Pull and
reinstall, restart fprintd, then enroll as your user:

```bash
cd ~/fingerprint
git pull
sudo ./install.sh
sudo systemctl restart fprintd
./bin/x403f-fp enroll
```

## If verify never matches

```bash
sudo x403f-fp rotate 2    # 180°
fprintd-delete "$USER"
x403f-fp enroll
x403f-fp verify

sudo x403f-fp rotate 1    # 90° left
sudo x403f-fp rotate 3    # 90° right
```

## Commands

| Command | What it does |
| --- | --- |
| `x403f-fp probe` | ACPI SPI node, HID PID, `/dev/spidev*`, USB IDs |
| `sudo x403f-fp install` | deps, patch, build, udev, PAM |
| `x403f-fp status` | probe + whether the patched library is loaded |
| `x403f-fp enroll [finger]` | default `right-index-finger` |
| `x403f-fp verify` | test a match |
| `sudo x403f-fp rotate N` | `0..3`, then re-enroll |
| `sudo x403f-fp prepare` | reload `spidev` at 32K and restart fprintd |
| `x403f-fp logs` | `journalctl -u fprintd` |
| `sudo x403f-fp uninstall` | remove `/opt` driver and udev rules |

## What the patch changes

Against [goodix-fp-linux-dev/libfprint](https://github.com/goodix-fp-linux-dev/libfprint)
commit `07306bbc` (libfprint 1.94.5 + SIGFM):

- Adds Elan SPI PIDs from upstream / the ASUS INF (`0x3128`, `0x30C6` on
  X403FA, and others), plus ACPI `ELAN7002`.
- Treats HID PID `0x0000` as “any Elan companion” so a slightly different
  touchpad still matches.
- HID reset failure is a warning, not a hard error (ASUS `ResetType=GPIO`).
- OTP / VCOM timeout 12 ms → 2 s (the Fedora X403F failure mode).
- Longer capture timeouts; 8 enroll stages.
- After a swipe, drain leftover SPI lines for up to 0.8 s, then force
  finger-off so the next enroll stage can start. Skipping wait-up left
  the sensor mid-frame and froze enroll after the first stage.
- Treat UNKNOWN frames as empty during wait-up; looser empty/movement thresholds.
- Disable the software thermal model (`temp_hot_seconds = -1`).
- SIGFM matcher + Gaussian denoise; drop 2× upscale and `FPI_IMAGE_PARTIAL`
  (those made verification useless on this class of sensor).
- `ELANSPI_ROTATE` so rotation can be changed without rebuilding.

udev binds `ELAN7001` / `ELAN7002` / `ELAN70A1` to `spidev` and raises
`spidev.bufsiz` to 32768.

The official ASUS Windows package (`Fingerprint_F_ELAN_Win10_64_VER45100110601`,
INF in `vendor/windows/`) is SPI-only. There is no Linux-loadable `elanfw.bin`;
firmware is in the sensor OTP. We do not install the Windows DLLs.

## Dual-boot

A cold power-off after Windows is more reliable than a warm reboot. Windows
Hello prints are not reused; enroll again on Linux.

## Uninstall

```bash
sudo ./uninstall.sh
```

## Credits

- [mincrmatt12/elan-spi-fingerprint](https://github.com/mincrmatt12/elan-spi-fingerprint) — original elanspi protocol
- [libfprint](https://gitlab.freedesktop.org/libfprint/libfprint) — upstream driver
- [goodix-fp-linux-dev SIGFM](https://github.com/goodix-fp-linux-dev/libfprint) — matcher that actually discriminates these strips
- [r4nd3l/elan-3104-fingerprint-linux](https://github.com/r4nd3l/elan-3104-fingerprint-linux) — capture/matcher fixes we adapted
- ASUS / ELAN `WbfSpiDriver.inf` 4.5.1001.10601 — ACPI IDs, GPIO reset, PID rotation hints
