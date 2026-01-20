# Build and Run Guide

This document explains how to build and run the ScreenJournal Productivity Tracker system using pre-built executables.

## Overview

The system consists of two main scripts:

1. **`build.sh`** - Builds all components into production-ready executables
2. **`run-built.sh`** - Runs the system using the built executables

## Building the System

### Prerequisites

Before building, ensure you have:
- Go (for backend services)
- Node.js and npm (for frontend and desktop app)
- Python 3 (for chat agent)
- Docker and Docker Compose (for databases)

### Build Process

Run the build script:

```bash
./build.sh
```

This script will:

1. **Build Go Backends:**
   - `sj-collector` → `dist/sj-collector`
   - `sj-tracker-report` → `dist/sj-tracker-report`

2. **Build Frontend:**
   - `sj-tracker-frontend` → Production build in `sj-tracker-frontend/.next`

3. **Build Desktop App:**
   - `screenjournal/apps/desktop` → Tauri bundle in `src-tauri/target/release/bundle/`

4. **Package Python Chat Agent:**
   - Creates a virtual environment with all dependencies
   - Copies Python source files to `dist/sj-tracker-chat-agent/`
   - Creates a wrapper script for easy execution

5. **Create Build Artifacts:**
   - All built components are placed in `dist/` directory
   - Configuration templates are copied
   - Storage directories are created

### Build Output

After building, you'll have:

```
dist/
├── sj-collector                    # Go binary
├── sj-tracker-report               # Go binary
├── sj-tracker-chat-agent/         # Python source files
│   ├── server.py
│   ├── main.py
│   ├── backend_client.py
│   └── run.sh                      # Wrapper script
├── sj-tracker-chat-agent-venv/    # Python virtual environment
├── storage/                        # Storage directory
├── data/                          # Data directory
└── README.md                      # Build documentation
```

## Running the Built System

### Quick Start

After building, run:

```bash
./run-built.sh
```

This script will:

1. **Check Prerequisites:**
   - Verify Docker is running
   - Verify all built components exist
   - Check for required dependencies

2. **Start Databases:**
   - MongoDB (via Docker)
   - InfluxDB (via Docker)

3. **Start Services:**
   - `sj-collector` on port 8080
   - `sj-tracker-report` on port 8085
   - Python chat agent on port 8087
   - Frontend on port 3030

4. **Desktop App:**
   - The desktop app is built as a standalone application
   - Launch it manually from the bundle directory

### Service URLs

Once running, access services at:

- **Frontend:** http://localhost:3030
- **Collector API:** http://localhost:8080
- **Report API:** http://localhost:8085
- **Chat Agent:** http://localhost:8087
- **MongoDB:** mongodb://localhost:27017
- **InfluxDB:** http://localhost:8086

### Stopping Services

Press `Ctrl+C` to stop all services. The script will:
- Stop all running processes
- Shut down Docker containers
- Clean up resources

## Configuration

### Environment Variables

Both Go services look for `.env` files in their source directories:

- `sj-collector/.env` - Collector configuration
- `sj-tracker-report/.env` - Report service configuration

The run script will create these files from templates if they don't exist.

### Python Chat Agent

The chat agent uses environment variables:
- `BACKEND_URL` - URL of the report API (default: http://localhost:8085)
- `CHAT_AGENT_PORT` - Port to run on (default: 8087)
- `GEMINI_MODEL` - Gemini model to use (default: gemini-2.5-flash)

## Differences from Development Mode

The built system differs from `start-new.sh` in several ways:

1. **Go Services:** Uses compiled binaries instead of `go run`
2. **Frontend:** Uses `npm start` (production mode) instead of `npm run dev`
3. **Python Agent:** Uses a pre-built virtual environment
4. **Desktop App:** Must be launched manually from the bundle

## Troubleshooting

### Build Issues

**Problem:** Build fails with "command not found"
- **Solution:** Ensure all prerequisites are installed and in PATH

**Problem:** Go build fails
- **Solution:** Run `go mod download` in the respective directories

**Problem:** Frontend build fails
- **Solution:** Run `npm install` in `sj-tracker-frontend/`

**Problem:** Desktop app build fails
- **Solution:** Ensure Tauri prerequisites are installed (see Tauri docs)

### Runtime Issues

**Problem:** Services can't find `.env` files
- **Solution:** The run script creates these automatically, but ensure you're running from the project root

**Problem:** Port already in use
- **Solution:** Stop the conflicting service or change the port in `.env`

**Problem:** Docker containers won't start
- **Solution:** Ensure Docker is running and check `docker-compose logs`

**Problem:** Python agent fails to start
- **Solution:** Check that the virtual environment was created correctly in `dist/sj-tracker-chat-agent-venv/`

## Manual Execution

If you prefer to run services manually:

1. **Start Databases:**
   ```bash
   docker-compose up -d
   ```

2. **Run Collector:**
   ```bash
   cd sj-collector
   ../dist/sj-collector
   ```

3. **Run Report Service:**
   ```bash
   cd sj-tracker-report
   ../dist/sj-tracker-report
   ```

4. **Run Chat Agent:**
   ```bash
   cd dist/sj-tracker-chat-agent
   ../sj-tracker-chat-agent-venv/bin/python3 server.py
   ```

5. **Run Frontend:**
   ```bash
   cd sj-tracker-frontend
   npm start
   ```

## Distribution

To distribute the built system:

1. Run `./build.sh` to create all artifacts
2. Copy the `dist/` directory to the target system
3. Ensure the target system has:
   - Docker (for databases)
   - Node.js (for frontend)
4. Run `./run-built.sh` on the target system

Note: The desktop app bundle is platform-specific and should be distributed separately.




