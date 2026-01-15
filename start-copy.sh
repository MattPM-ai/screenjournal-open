#!/bin/bash

# ============================================================================
# START SCRIPT - Launches all services for the ScreenJournal application
# ============================================================================

# Note: We don't use 'set -e' here because we need to handle Docker daemon checks gracefully

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting ScreenJournal services...${NC}\n"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Load environment variables from .env if it exists
if [ -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${GREEN}Loading environment variables from .env...${NC}"
    export $(cat "$SCRIPT_DIR/.env" | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}Warning: .env file not found. Using environment variables from shell.${NC}"
fi

# Function to check if Docker daemon is running
check_docker_daemon() {
    if docker info > /dev/null 2>&1; then
        return 0  # Docker is running
    else
        return 1  # Docker is not running
    fi
}

# Function to start Docker daemon (macOS)
start_docker_daemon() {
    echo -e "${YELLOW}Docker daemon is not running. Attempting to start...${NC}"
    
    # Check if we're on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # Try to open Docker Desktop
        if [ -d "/Applications/Docker.app" ]; then
            echo -e "${YELLOW}Starting Docker Desktop...${NC}"
            open -a Docker
        else
            echo -e "${RED}Error: Docker Desktop not found. Please install Docker Desktop or start Docker manually.${NC}"
            return 1
        fi
    else
        # Linux - try to start Docker service
        if command -v systemctl > /dev/null 2>&1; then
            echo -e "${YELLOW}Starting Docker service...${NC}"
            sudo systemctl start docker
        elif command -v service > /dev/null 2>&1; then
            echo -e "${YELLOW}Starting Docker service...${NC}"
            sudo service docker start
        else
            echo -e "${RED}Error: Cannot start Docker. Please start Docker manually.${NC}"
            return 1
        fi
    fi
    
    # Wait for Docker to be ready
    echo -e "${YELLOW}Waiting for Docker daemon to be ready...${NC}"
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if check_docker_daemon; then
            echo -e "${GREEN}✓ Docker daemon is ready${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    echo -e "${RED}Error: Docker daemon did not start within 60 seconds${NC}"
    return 1
}

# Check and start Docker daemon
echo -e "${GREEN}[0/4] Checking Docker daemon...${NC}"
if ! check_docker_daemon; then
    if ! start_docker_daemon; then
        echo -e "${RED}Failed to start Docker daemon. Exiting.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Docker daemon is running${NC}\n"
fi

# Start Docker services (MongoDB, InfluxDB)
echo -e "${GREEN}[1/4] Starting Docker services (MongoDB, InfluxDB)...${NC}"
cd "$SCRIPT_DIR"
if ! docker-compose up -d; then
    echo -e "${RED}Error: Failed to start Docker services${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker services started${NC}\n"

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 5

# Start Go backend (sj-tracker-report)
echo -e "${GREEN}[2/4] Starting Go backend (sj-tracker-report)...${NC}"
cd "$SCRIPT_DIR/sj-tracker-report"
if [ ! -f "go.mod" ]; then
    echo -e "${RED}Error: sj-tracker-report/go.mod not found${NC}"
    exit 1
fi

# Run in background
nohup go run cmd/server/main.go > "$SCRIPT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$SCRIPT_DIR/logs/backend.pid"
echo -e "${GREEN}✓ Go backend started (PID: $BACKEND_PID)${NC}\n"

# Wait for backend to be ready
echo -e "${YELLOW}Waiting for backend to be ready...${NC}"
sleep 3

# Start Python chat agent
echo -e "${GREEN}[3/4] Starting Python chat agent...${NC}"
cd "$SCRIPT_DIR/sj-tracker-chat-agent"

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
source venv/bin/activate
pip install -q -r requirements.txt

# Note: OPENAI_API_KEY is no longer required at startup
# Users will provide their API key through the frontend interface
echo -e "${GREEN}Note: Users will provide OpenAI API key through the frontend interface${NC}"

# Set default backend URL if not set
if [ -z "$BACKEND_URL" ]; then
    export BACKEND_URL="http://localhost:8085"
fi

# Run Python agent in background
nohup python server.py > "$SCRIPT_DIR/logs/chat-agent.log" 2>&1 &
AGENT_PID=$!
echo $AGENT_PID > "$SCRIPT_DIR/logs/chat-agent.pid"
echo -e "${GREEN}✓ Python chat agent started (PID: $AGENT_PID)${NC}\n"

# Start Next.js frontend
echo -e "${GREEN}[4/5] Starting Next.js frontend...${NC}"
cd "$SCRIPT_DIR/sj-tracker-frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
fi

# Run in background on port 3030 (Tauri desktop app uses 3000)
PORT=3030 nohup npm run dev > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$SCRIPT_DIR/logs/frontend.pid"
echo -e "${GREEN}✓ Next.js frontend started on port 3030 (PID: $FRONTEND_PID)${NC}\n"

# Start desktop app
echo -e "${GREEN}[5/5] Starting desktop app...${NC}"
cd "$SCRIPT_DIR/screenjournal/apps/desktop"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing desktop app dependencies...${NC}"
    cd "$SCRIPT_DIR/screenjournal"
    npm install
    cd "$SCRIPT_DIR/screenjournal/apps/desktop"
fi

# Set environment variable for service management
export SCREENJOURNAL_ROOT="$SCRIPT_DIR"

# Run desktop app in foreground (this will block until app closes)
echo -e "${GREEN}✓ Desktop app starting...${NC}"
echo -e "${YELLOW}Note: Closing the desktop app will stop all services automatically.${NC}\n"

# Run the desktop app (this blocks until the app closes)
npm run tauri:dev

# When desktop app exits, stop all services
echo -e "\n${YELLOW}Desktop app closed. Stopping all services...${NC}\n"

# Stop frontend
if [ -f "$SCRIPT_DIR/logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$SCRIPT_DIR/logs/frontend.pid")
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping frontend (PID: $FRONTEND_PID)...${NC}"
        kill $FRONTEND_PID 2>/dev/null || true
        rm "$SCRIPT_DIR/logs/frontend.pid"
        echo -e "${GREEN}✓ Frontend stopped${NC}"
    fi
fi

# Stop chat agent
if [ -f "$SCRIPT_DIR/logs/chat-agent.pid" ]; then
    AGENT_PID=$(cat "$SCRIPT_DIR/logs/chat-agent.pid")
    if ps -p $AGENT_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping chat agent (PID: $AGENT_PID)...${NC}"
        kill $AGENT_PID 2>/dev/null || true
        rm "$SCRIPT_DIR/logs/chat-agent.pid"
        echo -e "${GREEN}✓ Chat agent stopped${NC}"
    fi
fi

# Stop backend
if [ -f "$SCRIPT_DIR/logs/backend.pid" ]; then
    BACKEND_PID=$(cat "$SCRIPT_DIR/logs/backend.pid")
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping backend (PID: $BACKEND_PID)...${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        rm "$SCRIPT_DIR/logs/backend.pid"
        echo -e "${GREEN}✓ Backend stopped${NC}"
    fi
fi

# Stop Docker services
echo -e "${YELLOW}Stopping Docker services...${NC}"
cd "$SCRIPT_DIR"
docker-compose down 2>/dev/null || true
echo -e "${GREEN}✓ Docker services stopped${NC}\n"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}All services stopped.${NC}"
echo -e "${GREEN}========================================${NC}\n"
