# ScreenJournal Open - Unified System

This repository contains the complete Matt Productivity Tracker system, including:
- **matt-collector**: Backend service that receives productivity data and stores it in InfluxDB
- **matt-tracker-report**: Backend service that processes data into AI-generated reports using MongoDB
- **matt-tracker-frontend**: Next.js frontend web application
- **mattpm**: Desktop application built with Tauri that collects productivity data

## Quick Start

To launch the entire system with a single command:

```bash
./start.sh
```

This will start:
- MongoDB (port 27017)
- InfluxDB (port 8086)
- matt-collector API (port 8080)
- matt-tracker-report API (port 8085)
- Frontend web app (port 3030)
- Desktop app

See [LAUNCH.md](./LAUNCH.md) for detailed setup instructions.

## Architecture

```
┌─────────────┐
│  Desktop    │  Collects productivity data
│  App        │  ──────────────────┐
│  (Tauri)    │                    │
└─────────────┘                    │
                                   ▼
                          ┌─────────────────┐
                          │  matt-collector │
                          │  (Port 8080)     │
                          └─────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
            ┌───────────┐  ┌───────────┐  ┌───────────┐
            │ InfluxDB  │  │  Local    │  │  Frontend │
            │ (Port     │  │  Storage  │  │  (Port    │
            │  8086)    │  │  (Files)  │  │  3030)    │
            └───────────┘  └───────────┘  └───────────┘
                    │
                    ▼
            ┌─────────────────┐
            │ matt-tracker-    │
            │ report           │
            │ (Port 8085)      │
            └─────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
  ┌─────────┐  ┌─────────┐  ┌─────────┐
  │ MongoDB │  │  OpenAI  │  │  Email  │
  │ (Port   │  │  API     │  │ Service │
  │ 27017)  │  │          │  │         │
  └─────────┘  └─────────┘  └─────────┘
```

## Components

### matt-collector
- Receives time-series data via WebSocket
- Stores data in InfluxDB
- Handles screenshot uploads (now using local storage instead of S3)
- Provides REST API for data access

### matt-tracker-report
- Queries InfluxDB for productivity data
- Generates AI-powered reports using OpenAI
- Caches reports in MongoDB
- Provides REST API for report generation

### matt-tracker-frontend
- Next.js web application
- User interface for viewing reports and managing settings
- Connects to both collector and report APIs

### mattpm (Desktop App)
- Tauri-based desktop application
- Collects productivity metrics from the local machine
- Sends data to matt-collector backend

## Local Storage

Screenshots and files are now stored locally in `matt-collector/storage/` instead of using Amazon S3. Files are served via HTTP at `http://localhost:8080/storage/`.

## Development

### Prerequisites
- Docker & docker-compose
- Go 1.21+
- Node.js 18+
- OpenAI API key (for report generation)

### Environment Setup

Each service has its own `.env` file. The launch script will create default `.env` files if they don't exist. See [LAUNCH.md](./LAUNCH.md) for configuration details.

### Manual Service Start

If you prefer to start services individually:

```bash
# Start databases
docker-compose up -d

# Start collector (terminal 1)
cd matt-collector && go run ./cmd/server

# Start report service (terminal 2)
cd matt-tracker-report && go run ./cmd/server

# Start frontend (terminal 3)
cd matt-tracker-frontend && npm run dev

# Start desktop app (terminal 4)
cd mattpm/apps/desktop && npm run desktop
```

## Documentation

- [LAUNCH.md](./LAUNCH.md) - Detailed launch and setup instructions
- [matt-collector/README.md](./matt-collector/README.md) - Collector service documentation
- [matt-tracker-report/README.md](./matt-tracker-report/README.md) - Report service documentation

## License

[Add your license here]

