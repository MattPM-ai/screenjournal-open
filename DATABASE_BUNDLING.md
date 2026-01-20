# Database Bundling Implementation

This document describes how MongoDB and InfluxDB are bundled into the ScreenJournal application.

## Overview

Both MongoDB and InfluxDB are bundled as platform-specific binaries that are:
- Downloaded during the build process
- Extracted and placed in Tauri resources
- Started automatically when the app launches
- Managed by the service manager

## Implementation

### Service Manager

The `services/manager.rs` module includes:

1. **`start_mongodb()`**: Starts MongoDB with embedded-friendly settings
2. **`start_influxdb()`**: Starts InfluxDB with initialization support
3. **`wait_for_mongodb()`**: Waits for MongoDB to be ready
4. **`wait_for_influxdb()`**: Waits for InfluxDB to be ready
5. **Health checks**: TCP connection checks for MongoDB, HTTP health endpoint for InfluxDB

### Database Configuration

#### MongoDB
- **Port**: 27017
- **Bind IP**: 127.0.0.1 (localhost only)
- **Data Directory**: `$APPDATA/mongodb/data`
- **Settings**:
  - `--nojournal`: Faster startup, less disk I/O
  - `--smallfiles`: Better for embedded use
  - `--noprealloc`: Don't preallocate files
  - `--quiet`: Less logging

#### InfluxDB
- **Port**: 8086
- **Bind Address**: 127.0.0.1:8086
- **Data Directory**: `$APPDATA/influxdb/data`
- **Initialization**:
  - Auto-initializes on first run
  - Default org: `screenjournal-org`
  - Default bucket: `screenjournal-metrics`
  - Default admin token: `screenjournal-admin-token`
  - Default credentials: admin/admin123

### Build Process

1. **Download Script** (`scripts/prepare-databases.sh`):
   - Detects platform (macOS/Linux) and architecture (ARM/Intel)
   - Downloads MongoDB and InfluxDB binaries
   - Extracts and places them in `resources/databases/`

2. **Build Script** (`build-bundled.sh`):
   - Calls `prepare-databases.sh` if databases aren't already prepared
   - Copies database binaries to Tauri resources
   - Bundles everything into the app

### Resource Structure

```
resources/
└── databases/
    ├── mongodb/
    │   ├── darwin/
    │   │   ├── aarch64/
    │   │   │   └── mongod
    │   │   └── x86_64/
    │   │       └── mongod
    │   └── linux/
    │       └── x86_64/
    │           └── mongod
    └── influxdb/
        ├── darwin/
        │   ├── aarch64/
        │   │   └── influxd
        │   └── x86_64/
        │       └── influxd
        └── linux/
            └── x86_64/
                └── influxd
```

### Service Startup Order

1. **Databases first** (MongoDB, InfluxDB)
2. **Wait for databases** to be ready
3. **Application services** (Collector, Report Service, Chat Agent)

This ensures databases are available before services try to connect.

### Data Persistence

All database data is stored in the app's data directory:
- **MongoDB**: `$APPDATA/mongodb/data/`
- **InfluxDB**: `$APPDATA/influxdb/data/`

Data persists across app restarts and is isolated per user.

### Platform Support

Currently supported:
- **macOS**: ARM64 (Apple Silicon) and x86_64 (Intel)
- **Linux**: x86_64

Windows support can be added by:
1. Adding Windows download URLs to `prepare-databases.sh`
2. Adding Windows platform detection
3. Handling `.exe` extensions

### Binary Sizes

- **MongoDB**: ~100-200MB per platform
- **InfluxDB**: ~50-100MB per platform
- **Total**: ~150-300MB added to app size per platform

### Notes

1. **InfluxDB Initialization**: The first run auto-initializes with default settings. Users can change these later if needed.

2. **MongoDB Authentication**: Currently runs without authentication (localhost only). Can be added if needed.

3. **Performance**: Embedded settings are optimized for single-user, local use rather than production server workloads.

4. **Updates**: Database binaries are bundled at build time. To update, rebuild the app with new versions.

## Usage

### Building with Databases

```bash
./build-bundled.sh
```

This will:
1. Download database binaries (if not already present)
2. Build all services
3. Bundle everything into the Tauri app
4. Create DMG installer

### Manual Database Preparation

If you need to prepare databases separately:

```bash
./scripts/prepare-databases.sh
```

### Testing

After building, the app will:
1. Start MongoDB and InfluxDB on launch
2. Wait for them to be ready
3. Start all application services
4. All services connect to local databases automatically

## Troubleshooting

### Databases Not Starting

- Check that binaries exist in `resources/databases/`
- Check app logs for error messages
- Verify data directories are writable
- Check if ports 27017 and 8086 are already in use

### Database Connection Issues

- Ensure databases are started before application services
- Check health status via `get_all_services_status()` command
- Verify database initialization completed successfully

### Large App Size

- Database binaries add significant size
- Consider platform-specific builds (only include binaries for target platform)
- Or use lighter embedded alternatives (SQLite, etc.)




