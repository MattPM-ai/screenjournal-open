# Bundled Application Architecture

This document describes the bundled ScreenJournal application that contains all services in a single DMG installer.

## Overview

The bundled app is a Tauri application that:
- Contains all backend services (Go binaries, Python agent)
- Automatically starts all services on app launch
- Manages service lifecycle (start/stop)
- Can be distributed as a single DMG file for macOS

## Architecture

### Service Manager

The `services` module in the Tauri app manages all backend services:

- **sj-collector**: Go backend for data collection (port 8080)
- **sj-tracker-report**: Go backend for report generation (port 8085)
- **Python Chat Agent**: Python service for AI chat (port 8087)

### Resource Bundling

All resources are bundled in the Tauri app's `resources` directory:

```
resources/
├── binaries/
│   ├── sj-collector          # Go binary
│   └── sj-tracker-report    # Go binary
├── python/
│   ├── sj-tracker-chat-agent-venv/  # Python virtual environment
│   └── sj-tracker-chat-agent/        # Python source files
├── activitywatch/           # ActivityWatch resources (existing)
└── ffmpeg/                  # FFmpeg resources (existing)
```

### Service Lifecycle

1. **On App Launch**:
   - All backend services are automatically started
   - Services run in the background
   - Frontend connects to local services

2. **On App Exit**:
   - All services are gracefully stopped
   - Processes are terminated
   - Resources are cleaned up

## Database Considerations

**Current Status**: The services expect MongoDB and InfluxDB to be running.

**Options for Bundled App**:

### Option 1: Bundle Database Servers
- Bundle MongoDB and InfluxDB binaries
- Start them as part of the service manager
- More complex but maintains full functionality

### Option 2: Embedded Databases (Recommended)
- **MongoDB → SQLite**: Use SQLite for report storage
- **InfluxDB → SQLite or embedded InfluxDB**: Use SQLite for time-series or bundle embedded InfluxDB
- Simpler distribution, but requires code changes

### Option 3: Hybrid Approach
- Use embedded SQLite for development/simple use cases
- Allow users to connect to external MongoDB/InfluxDB for advanced features
- Best of both worlds

## Building the Bundled App

### Prerequisites

- Go
- Node.js
- Python 3
- Rust (for Tauri)
- macOS (for DMG creation)

### Build Process

Run the bundled build script:

```bash
./build-bundled.sh
```

This script:
1. Builds Go backends
2. Packages Python environment
3. Builds frontend
4. Copies all resources to Tauri app
5. Builds Tauri app with DMG

### Output

The build creates:
- **DMG file**: `screenjournal/apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg`
- **App bundle**: `screenjournal/apps/desktop/src-tauri/target/release/bundle/macos/*.app`

## Distribution

The DMG file can be:
- Distributed directly to users
- Installed by dragging to Applications folder
- Code-signed for distribution (requires Apple Developer account)

## Service Management API

The Tauri app exposes commands for service management:

- `get_all_services_status()`: Get status of all services
- Services auto-start on app launch
- Services auto-stop on app exit

## Configuration

Service configuration is stored in the app's data directory:
- `$APPDATA/collector.env`: Collector configuration
- `$APPDATA/report.env`: Report service configuration
- `$APPDATA/storage/`: File storage
- `$APPDATA/data/`: Database files

## Next Steps

1. **Database Integration**: Implement embedded database solution
2. **Frontend Integration**: Update frontend to use bundled services
3. **Testing**: Test bundled app on clean macOS systems
4. **Code Signing**: Set up code signing for distribution
5. **Auto-updates**: Implement update mechanism using Tauri updater

## Notes

- The bundled app is currently configured for macOS
- Linux and Windows builds can be added similarly
- All services run locally - no external dependencies required
- The app is self-contained and can run offline




