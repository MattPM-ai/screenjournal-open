# Release Setup Guide

This guide explains how to set up the Matt Productivity Tracker for production releases, including database initialization.

## Prerequisites

- Docker and Docker Compose installed
- Go 1.21+ installed
- Node.js 18+ installed

## Quick Start

1. **Start the system:**
   ```bash
   ./start.sh
   ```

   This will automatically:
   - Start Docker (if installed but not running)
   - Start MongoDB and InfluxDB containers
   - Initialize InfluxDB with default org, bucket, and token
   - Start all backend services
   - Start the frontend
   - Start the desktop app

## Database Setup

### Automatic Setup (Recommended)

The `start.sh` script automatically sets up both databases:

- **MongoDB**: Automatically initialized with:
  - Username: `admin`
  - Password: `admin123`
  - Database: `reports`
  - Port: `27017`

- **InfluxDB**: Automatically initialized with:
  - Username: `admin`
  - Password: `admin123`
  - Organization: `matt-org`
  - Bucket: `matt-metrics`
  - Admin Token: `matt-admin-token-change-in-production`
  - Port: `8086`

### Manual Setup (If Needed)

If you need to manually configure InfluxDB:

1. **Access InfluxDB UI:**
   ```bash
   open http://localhost:8086
   ```

2. **Complete setup:**
   - Username: `admin`
   - Password: `admin123`
   - Organization: `matt-org`
   - Bucket: `matt-metrics`

3. **Get Admin Token:**
   - After setup, go to Data > Tokens
   - Copy the admin token
   - Update `.env` files with the token

### Production Configuration

For production releases, **change the default passwords and tokens**:

1. **Update `docker-compose.yml`:**
   ```yaml
   environment:
     MONGO_INITDB_ROOT_PASSWORD: <your-secure-password>
     DOCKER_INFLUXDB_INIT_PASSWORD: <your-secure-password>
     DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: <your-secure-token>
   ```

2. **Update `.env` files:**
   - `matt-collector/.env`
   - `matt-tracker-report/.env`

3. **Restart services:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

## Service URLs

After starting, services are available at:

- **Frontend**: http://localhost:3030
- **Collector API**: http://localhost:8080
- **Report API**: http://localhost:8085
- **MongoDB**: mongodb://localhost:27017
- **InfluxDB**: http://localhost:8086

## Data Persistence

Database data is stored in Docker volumes:

- **MongoDB data**: `mongodb_data` volume
- **InfluxDB data**: `influxdb_data` volume

To backup data:

```bash
# Backup MongoDB
docker exec matt-mongodb mongodump --out /backup
docker cp matt-mongodb:/backup ./mongodb-backup

# Backup InfluxDB
docker exec matt-influxdb influx backup /backup
docker cp matt-influxdb:/backup ./influxdb-backup
```

## Troubleshooting

### Docker Not Starting

If Docker is installed but not running:

1. **macOS**: Open Docker Desktop application
2. **Linux**: Start Docker service:
   ```bash
   sudo systemctl start docker
   ```

### Databases Not Ready

Check container logs:

```bash
docker logs matt-mongodb
docker logs matt-influxdb
```

### Port Conflicts

If ports 27017 or 8086 are already in use:

1. Stop conflicting services
2. Or update `docker-compose.yml` to use different ports

## Production Deployment

For production deployments:

1. **Use environment variables** for sensitive data
2. **Enable SSL/TLS** for database connections
3. **Set up regular backups**
4. **Monitor database health**
5. **Use strong passwords and tokens**
6. **Restrict network access** to databases

## Embedded Mode (Alternative)

If Docker is not available, you can use embedded mode (limited functionality):

```bash
export USE_EMBEDDED_DB=true
./start.sh
```

**Note**: InfluxDB will not be available in embedded mode, so time-series data will not be persisted.

