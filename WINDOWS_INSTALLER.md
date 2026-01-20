# Windows Installer Guide

This document explains how to build a Windows installer (.exe) for ScreenJournal Tracker.

## Overview

The Windows installer is built using Tauri's NSIS (Nullsoft Scriptable Install System) bundler, which creates a single `.exe` installer file that users can run to install the application.

## Prerequisites

To build the Windows installer, you need:

### On Any Platform (for cross-compilation):
1. **Rust** - Install from [rustup.rs](https://rustup.rs/)
2. **Node.js** (v20+) - Install from [nodejs.org](https://nodejs.org/)
3. **Go** - Install from [golang.org](https://golang.org/)
4. **Python 3** - Install from [python.org](https://www.python.org/)

### On Windows (for best results):
5. **Visual Studio Build Tools** - Required for building Rust on Windows
   - Install "Desktop development with C++" workload
   - Or install Visual Studio Community with C++ support

### For Cross-Compilation from macOS/Linux:
6. **Windows Rust Target** - Install with: `rustup target add x86_64-pc-windows-msvc`
7. **Windows Linker** - May need to install `mingw-w64` or use Wine for some tools

## Windows-Specific Components

### Startup Script

The Windows version uses `start-bundled.bat` instead of `start-bundled.sh`. This batch script:
- Starts all services (MongoDB, InfluxDB, Go backends, Python chat agent, Next.js frontend)
- Uses Windows-native commands (`tasklist`, `taskkill`, `netstat`)
- Uses PowerShell for HTTP health checks
- Outputs structured progress messages for the Rust service manager

### Binary Extensions

All executables on Windows require the `.exe` extension:
- `sj-collector.exe`
- `sj-tracker-report.exe`
- `sj-chat-agent.exe`
- `mongod.exe`
- `influxd.exe`

The build script automatically adds `.exe` extensions when building on Windows.

## Building the Windows Installer

### Cross-Platform Building

You can build the Windows installer from **any platform** (macOS, Linux, or Windows) using the dedicated Windows build script:

```bash
./build-bundled-windows.sh
```

This script will:
1. Cross-compile Go backends for Windows (`sj-collector.exe`, `sj-tracker-report.exe`)
2. Attempt to package Python chat agent with PyInstaller (`sj-chat-agent.exe`)
   - **Note**: PyInstaller works best on Windows. Cross-compilation may not work perfectly.
3. Build Next.js frontend with standalone mode
4. Copy all resources to Tauri app
5. Cross-compile Tauri desktop app for Windows
6. Generate Windows NSIS installer (works best on Windows)

### Building on Windows

For best results, especially for NSIS installer generation, build directly on Windows:

```bash
./build-bundled-windows.sh
```

### Building from macOS/Linux

You can build Windows binaries from macOS or Linux, but note:

- **Go binaries**: Cross-compilation works perfectly using `GOOS=windows GOARCH=amd64`
- **Python executable**: PyInstaller cross-compilation may not work. Consider building this component on Windows or using CI.
- **Tauri app**: Cross-compilation works with the Windows toolchain (`x86_64-pc-windows-msvc`)
- **NSIS installer**: Generation typically requires Windows, but the app binary will be built

The script will automatically:
- Download Windows database binaries if needed
- Use cross-compilation for Go and Rust
- Attempt PyInstaller build (with warnings if it fails)
- Provide clear instructions if any step requires Windows

### Step 3: Find the Installer

After the build completes, the installer will be located at:

```
screenjournal/apps/desktop/src-tauri/target/release/bundle/nsis/ScreenJournal Tracker_0.1.0_x64-setup.exe
```

The exact filename may vary based on the version number.

## Installer Features

The NSIS installer includes:

- **All bundled services**: MongoDB, InfluxDB, Go backends, Python chat agent, Next.js frontend
- **Automatic service startup**: Services start automatically when the app launches
- **InfluxDB auto-setup**: InfluxDB is automatically configured on first run
- **User-friendly installation**: Standard Windows installer interface
- **Uninstaller**: Users can uninstall via Windows Settings or Control Panel

## Distribution

The generated `.exe` file is a complete installer that can be distributed to Windows users. Users simply:

1. Download the `.exe` file
2. Run it (may need to allow it through Windows Defender)
3. Follow the installation wizard
4. Launch the app from the Start menu or desktop shortcut

## Testing

After building, test the installer by:

1. Running the installer on a clean Windows machine (or VM)
2. Verifying all services start correctly
3. Checking that the app is accessible
4. Testing that services can be stopped and restarted
5. Verifying uninstallation works correctly

## Troubleshooting

### Build Fails with "link.exe not found"

Install Visual Studio Build Tools with C++ support, or add the Visual Studio tools to your PATH.

### Services Don't Start

Check the logs in:
```
%APPDATA%\com.screenjournal.tracker\
```

Look for:
- `mongodb.log`
- `influxdb.log`
- `collector.log`
- `report.log`
- `chat-agent.log`
- `frontend.log`

### InfluxDB Redirects to Onboarding

The Windows batch script should automatically set up InfluxDB. If it doesn't, check:
1. InfluxDB is running (check `influxdb.log`)
2. The setup API call succeeded (check script output)
3. The `influxdb.bolt` file exists in the data directory

### Frontend Not Accessible

Ensure Node.js is installed on the target machine. The frontend requires Node.js to run, even in standalone mode.

## Code Signing (Optional)

For production distribution, you should code-sign the installer. This requires:

1. A code signing certificate (purchased from a Certificate Authority)
2. Update `tauri.conf.json` with your certificate thumbprint:

```json
"windows": {
  "certificateThumbprint": "YOUR_CERTIFICATE_THUMBPRINT",
  "digestAlgorithm": "sha256",
  "timestampUrl": ""
}
```

3. The certificate must be installed in the Windows certificate store

## Notes

- The Windows installer is significantly larger than the macOS DMG due to bundled dependencies
- First launch may take longer as services initialize
- Windows Defender may flag the installer initially (this is normal for unsigned installers)
- All services run as background processes and are managed by the Rust service manager

