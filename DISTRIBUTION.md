# Distribution Guide

This guide explains how to distribute the Matt Productivity Tracker without requiring Docker.

## Distribution Options

### Option 1: Embedded Mode (Recommended for Distribution)

**Best for**: Single-user or small-team deployments, standalone applications

The system can run without Docker using embedded SQLite databases. This requires implementing SQLite replacements for MongoDB and InfluxDB.

**Pros:**
- ✅ No Docker required
- ✅ Single binary or simple file structure
- ✅ Easy to distribute
- ✅ Portable (all data in local files)

**Cons:**
- ⚠️ Requires code changes to implement SQLite backends
- ⚠️ May have performance limitations for very large datasets

**Implementation Status**: ⚠️ **Not yet implemented** - This requires:
1. SQLite implementation for MongoDB (report caching)
2. SQLite time-series implementation for InfluxDB (metrics storage)

### Option 2: Bundle Database Binaries

**Best for**: When you need full database features without Docker

Bundle MongoDB and InfluxDB binaries with your application and start them as subprocesses.

**Pros:**
- ✅ Full database features
- ✅ No Docker required
- ✅ Better performance than embedded SQLite

**Cons:**
- ⚠️ Larger distribution size
- ⚠️ Platform-specific binaries needed
- ⚠️ More complex startup process

**Implementation Steps:**
1. Download MongoDB and InfluxDB binaries for target platforms
2. Include them in your distribution package
3. Modify startup script to launch them as processes
4. Configure them to use local data directories

### Option 3: Cloud/Remote Databases

**Best for**: Multi-user deployments, SaaS applications

Use cloud-hosted MongoDB and InfluxDB instances.

**Pros:**
- ✅ No local database setup
- ✅ Scalable
- ✅ Easy to distribute (just point to cloud instances)

**Cons:**
- ⚠️ Requires internet connection
- ⚠️ Ongoing costs
- ⚠️ Data stored remotely

**Implementation**: Update `.env` files to point to cloud database URLs.

### Option 4: Docker (Current Default - Recommended for Releases)

**Best for**: Development, production releases, users with Docker

Current Docker-based setup with automatic database initialization.

**Pros:**
- ✅ Already implemented
- ✅ Isolated environment
- ✅ Easy to update
- ✅ Automatic database setup (MongoDB + InfluxDB)
- ✅ Data persistence via Docker volumes
- ✅ Production-ready configuration

**Cons:**
- ⚠️ Requires Docker installation
- ⚠️ Users need Docker Desktop or Docker Engine

**Setup**: The `start.sh` script automatically:
1. Detects and starts Docker if needed
2. Starts MongoDB and InfluxDB containers
3. Initializes databases with default configuration
4. Verifies database health before starting services

See `RELEASE_SETUP.md` for detailed setup instructions.

## Recommended Approach for Distribution

For distributing to end users who don't have Docker:

1. **Short-term**: Implement embedded SQLite mode (Option 1)
   - Replace MongoDB with SQLite for report caching
   - Replace InfluxDB with SQLite time-series storage
   - Update start script to use embedded mode by default when Docker isn't available

2. **Long-term**: Consider bundling binaries (Option 2) if you need full database features

## Implementation Priority

If you want to implement embedded mode, the work involves:

1. **MongoDB → SQLite** (Easier)
   - Create SQLite schema for report caching
   - Implement same interface as MongoDB client
   - Estimated: 1-2 days

2. **InfluxDB → SQLite** (More Complex)
   - Design time-series schema in SQLite
   - Implement query interface compatible with current InfluxDB queries
   - Estimated: 3-5 days

## Current Status

The start script now:
- ✅ Detects if Docker is available
- ✅ Falls back gracefully when Docker is not available
- ⚠️ Still requires Docker for full functionality (embedded mode not yet implemented)

To implement embedded mode, you would need to create SQLite implementations of the database clients.

## Quick Start for Embedded Mode (When Implemented)

Once embedded mode is implemented, users can simply run:

```bash
./start.sh
```

The script will automatically detect if Docker is available and use embedded mode if not.

To force embedded mode:
```bash
USE_EMBEDDED_DB=true ./start.sh
```

