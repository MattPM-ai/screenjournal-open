# Unified Launch System

This document describes how to launch the entire Matt Productivity Tracker system with a single command.

## Quick Start

Simply run:

```bash
./start.sh
```

This will:
1. Start MongoDB and InfluxDB in Docker
2. Start the matt-collector backend (port 8080)
3. Start the matt-tracker-report backend (port 8085)
4. Start the frontend Next.js app (port 3030)
5. Launch the desktop app (Tauri)

## Prerequisites

- **Docker** and **docker-compose** - For running MongoDB and InfluxDB
- **Go 1.21+** - For the backend services
- **Node.js 18+** - For the frontend and desktop app
- **OpenAI API Key** - For report generation (optional, but required for reports)

## First Time Setup

### 1. Environment Configuration

The launch script will automatically create `.env` files if they don't exist. However, you should configure them properly:

#### matt-collector/.env
```bash
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
JWT_SECRET=your-secret-key-change-in-production
INFLUXDB2_URL=http://localhost:8086
INFLUXDB2_TOKEN=matt-admin-token-change-in-production
INFLUXDB2_ORG=matt-org
INFLUXDB2_BUCKET=matt-metrics
STORAGE_BASE_PATH=./storage
STORAGE_BASE_URL=http://localhost:8080/storage
```

#### matt-tracker-report/.env
```bash
PORT=8085
HOST=0.0.0.0
INFLUXDB2_URL=http://localhost:8086
INFLUXDB2_TOKEN=matt-admin-token-change-in-production
INFLUXDB2_ORG=matt-org
INFLUXDB2_BUCKET=matt-metrics
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DATABASE=reports
MONGODB_USERNAME=admin
MONGODB_PASSWORD=admin123
MONGODB_AUTH_SOURCE=admin
OPENAI_API_KEY=your-openai-api-key-here
```

### 2. Install Dependencies

The script will automatically install dependencies, but you can also do it manually:

```bash
# Frontend
cd matt-tracker-frontend
npm install

# Desktop app
cd mattpm/apps/desktop
npm install
```

## Service URLs

Once started, the services will be available at:

- **Frontend**: http://localhost:3030
- **Collector API**: http://localhost:8080
- **Report API**: http://localhost:8085
- **MongoDB**: mongodb://localhost:27017
- **InfluxDB UI**: http://localhost:8086

## Stopping Services

Press `Ctrl+C` in the terminal where you ran `./start.sh` to stop all services gracefully.

Alternatively, you can stop Docker services separately:

```bash
docker-compose down
```

## Local Storage

Screenshots and files are now stored locally in the `matt-collector/storage` directory instead of using S3. Files are served via the `/storage` endpoint on the collector API.

## Troubleshooting

### Port Already in Use

If you get port conflicts, you can:
1. Stop the conflicting service
2. Change the port in the respective `.env` file
3. Update any service that depends on that port

### Docker Services Not Starting

Check Docker is running:
```bash
docker ps
```

View logs:
```bash
docker-compose logs
```

### Database Connection Issues

Ensure the databases are ready:
```bash
# Check MongoDB
docker exec matt-mongodb mongosh --eval "db.adminCommand('ping')"

# Check InfluxDB
curl http://localhost:8086/health
```

### InfluxDB Token Issues

The default token is set in `docker-compose.yml`. If you change it, update all `.env` files that reference `INFLUXDB2_TOKEN`.

## Manual Service Start (Alternative)

If you prefer to start services manually:

```bash
# 1. Start databases
docker-compose up -d

# 2. Start collector
cd matt-collector
go run ./cmd/server

# 3. Start report service (in another terminal)
cd matt-tracker-report
go run ./cmd/server

# 4. Start frontend (in another terminal)
cd matt-tracker-frontend
npm run dev

# 5. Start desktop app (in another terminal)
cd mattpm/apps/desktop
npm run desktop
```

