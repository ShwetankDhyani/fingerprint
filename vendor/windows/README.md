# ASUS / ELAN Windows driver (X403FA)

Source package:

`https://dlcdnets.asus.com/pub/ASUS/nb/DriversForWin10/Fingerprint/Fingerprint_F_ELAN_Win10_64_VER45100110601.zip`

Version `4.5.1001.10601` — the official ASUS VivoBook 14 X403FA fingerprint driver.

`WbfSpiDriver.inf` is kept here because it is the hardware contract:

- ACPI IDs: `ELAN7001` (clamshell) and `ELAN7002` (2-in-1)
- Device type is **SPI**, not USB (so `lsusb` will never show it)
- Reset type on this SKU is **GPIO** (`ResetType=2`), not touchpad-PTP
- Companion touchpad vendor is `04F3`; several PIDs get a 90° left hint
- Linux does not load `WbfSpiDriver.dll`. Firmware lives in sensor OTP. The
  patched `elanspi` driver talks SPI directly.

Do not install the `.dll` / `.exe` files on Linux.
