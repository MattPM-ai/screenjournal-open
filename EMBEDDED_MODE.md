# Embedded Database Mode

This document describes how the system works without Docker, using embedded SQLite databases instead of MongoDB and InfluxDB.

## Overview

The system can run in two modes:
1. **Docker Mode** (default): Uses MongoDB and InfluxDB via Docker
2. **Embedded Mode**: Uses SQLite databases embedded in the application

## How It Works

When you run `./start.sh`, the script:
1. Checks if Docker is available and running
2. If Docker is available → Uses Docker containers (MongoDB + InfluxDB)
3. If Docker is NOT available → Uses embedded SQLite databases

## Embedded Mode Details

### MongoDB Replacement (SQLite)
- **Location**: `data/reports.db`
- **Purpose**: Report caching and storage
- **Features**: Same functionality as MongoDB, but using SQLite

### InfluxDB Replacement (SQLite Time-Series)
- **Location**: `data/metrics.db`
- **Purpose**: Time-series productivity data storage
- **Features**: SQLite with optimized schema for time-series queries

## Benefits

✅ **No Docker Required**: Users can run the app without installing Docker
✅ **Portable**: All data stored in local SQLite files
✅ **Easy Distribution**: Single binary or simple file structure
✅ **Automatic Fallback**: Works seamlessly whether Docker is available or not

## Limitations

⚠️ **Performance**: SQLite may be slower than dedicated databases for very large datasets
⚠️ **Concurrency**: SQLite has limited concurrent write performance
⚠️ **Advanced Features**: Some InfluxDB-specific features may not be available

For most single-user or small-team use cases, embedded mode works perfectly fine.

## Manual Override

You can force embedded mode by setting:
```bash
export USE_EMBEDDED_DB=true
./start.sh
```

Or force Docker mode:
```bash
export USE_DOCKER=true
./start.sh
```


