#!/bin/bash

# Build script for ScreenJournal Productivity Tracker system
# This script builds all components into production-ready executables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${GREEN}🔨 Building ScreenJournal Productivity Tracker System${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command_exists go; then
    echo -e "${RED}❌ Go is not installed. Please install Go first.${NC}"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3 first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Create build directory
BUILD_DIR="$SCRIPT_DIR/dist"
echo -e "${YELLOW}📁 Creating build directory: $BUILD_DIR${NC}"
mkdir -p "$BUILD_DIR"
echo -e "${GREEN}✅ Build directory created${NC}"
echo ""

# Build sj-collector
echo -e "${BLUE}🔧 Building sj-collector backend...${NC}"
cd sj-collector
go build -o "$BUILD_DIR/sj-collector" ./cmd/server
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ sj-collector built successfully${NC}"
    echo -e "   Output: $BUILD_DIR/sj-collector${NC}"
else
    echo -e "${RED}❌ Failed to build sj-collector${NC}"
    exit 1
fi
cd ..
echo ""

# Build sj-tracker-report
echo -e "${BLUE}🔧 Building sj-tracker-report backend...${NC}"
cd sj-tracker-report
go build -o "$BUILD_DIR/sj-tracker-report" ./cmd/server
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ sj-tracker-report built successfully${NC}"
    echo -e "   Output: $BUILD_DIR/sj-tracker-report${NC}"
else
    echo -e "${RED}❌ Failed to build sj-tracker-report${NC}"
    exit 1
fi
cd ..
echo ""

# Build sj-tracker-frontend
echo -e "${BLUE}🌐 Building sj-tracker-frontend...${NC}"
cd sj-tracker-frontend
if [ ! -d node_modules ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    npm install
fi
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ sj-tracker-frontend built successfully${NC}"
    echo -e "   Output: $BUILD_DIR/sj-tracker-frontend (symlinked)${NC}"
    # Create a symlink or copy the .next directory for easier access
    if [ -d ".next" ]; then
        echo -e "${GREEN}   Build artifacts in: sj-tracker-frontend/.next${NC}"
    fi
else
    echo -e "${RED}❌ Failed to build sj-tracker-frontend${NC}"
    exit 1
fi
cd ..
echo ""

# Build desktop app
echo -e "${BLUE}🖥️  Building desktop app...${NC}"
cd screenjournal/apps/desktop
if [ ! -d node_modules ]; then
    echo -e "${YELLOW}📦 Installing desktop app dependencies...${NC}"
    npm install
fi
# Build Next.js first
npm run build
# Then build Tauri app
npm run tauri:build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Desktop app built successfully${NC}"
    # Tauri build output location varies by OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "   Output: screenjournal/apps/desktop/src-tauri/target/release/bundle/${NC}"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo -e "   Output: screenjournal/apps/desktop/src-tauri/target/release/bundle/${NC}"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo -e "   Output: screenjournal/apps/desktop/src-tauri/target/release/bundle/${NC}"
    fi
else
    echo -e "${RED}❌ Failed to build desktop app${NC}"
    exit 1
fi
cd ../../..
echo ""

# Package Python chat agent
echo -e "${BLUE}🤖 Packaging Python chat agent...${NC}"
cd sj-tracker-chat-agent

# Create a dedicated build virtual environment
if [ -d "venv-build" ]; then
    echo -e "${YELLOW}📦 Removing existing build venv...${NC}"
    rm -rf venv-build
fi

echo -e "${YELLOW}📦 Creating build virtual environment...${NC}"
python3 -m venv venv-build

echo -e "${YELLOW}📦 Installing dependencies...${NC}"
source venv-build/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
deactivate

# Copy the build venv to dist
echo -e "${YELLOW}📦 Copying Python environment to dist...${NC}"
cp -r venv-build "$BUILD_DIR/sj-tracker-chat-agent-venv"

# Copy Python source files
mkdir -p "$BUILD_DIR/sj-tracker-chat-agent"
cp server.py "$BUILD_DIR/sj-tracker-chat-agent/"
cp main.py "$BUILD_DIR/sj-tracker-chat-agent/"
cp backend_client.py "$BUILD_DIR/sj-tracker-chat-agent/"

# Create a wrapper script to run the chat agent
cat > "$BUILD_DIR/sj-tracker-chat-agent/run.sh" << 'EOF'
#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV_DIR="$SCRIPT_DIR/../sj-tracker-chat-agent-venv"
source "$VENV_DIR/bin/activate"
cd "$SCRIPT_DIR"
python3 server.py
EOF
chmod +x "$BUILD_DIR/sj-tracker-chat-agent/run.sh"

echo -e "${GREEN}✅ Python chat agent packaged successfully${NC}"
echo -e "   Output: $BUILD_DIR/sj-tracker-chat-agent/${NC}"
cd ..
echo ""

# Copy necessary configuration and data files
echo -e "${YELLOW}📁 Copying configuration files...${NC}"

# Copy .env.example files if they don't exist in dist
if [ -f "sj-collector/.env.example" ]; then
    cp sj-collector/.env.example "$BUILD_DIR/sj-collector.env.example"
fi
if [ -f "sj-tracker-report/.env.example" ]; then
    cp sj-tracker-report/.env.example "$BUILD_DIR/sj-tracker-report.env.example"
fi

# Create storage directories structure
mkdir -p "$BUILD_DIR/storage"
mkdir -p "$BUILD_DIR/data"

echo -e "${GREEN}✅ Configuration files copied${NC}"
echo ""

# Create a README for the build
cat > "$BUILD_DIR/README.md" << EOF
# ScreenJournal Productivity Tracker - Built Distribution

This directory contains the built executables and assets for the ScreenJournal system.

## Contents

- \`sj-collector\` - Go backend for data collection
- \`sj-tracker-report\` - Go backend for report generation
- \`sj-tracker-frontend/\` - Next.js frontend (run from sj-tracker-frontend directory)
- \`sj-tracker-chat-agent/\` - Python chat agent with virtual environment
- \`storage/\` - Storage directory for uploaded files
- \`data/\` - Data directory for local databases

## Running the Built System

Use the \`run-built.sh\` script from the project root to start all services.

## Manual Execution

1. Start Docker services: \`docker-compose up -d\`
2. Configure environment variables (copy .env.example files)
3. Run each service:
   - \`./sj-collector\`
   - \`./sj-tracker-report\`
   - \`cd sj-tracker-frontend && npm start\`
   - \`cd sj-tracker-chat-agent && ./run.sh\`

## Notes

- The frontend build artifacts remain in \`sj-tracker-frontend/.next\`
- The desktop app build artifacts are in \`screenjournal/apps/desktop/src-tauri/target/release/bundle/\`
- Python dependencies are bundled in \`sj-tracker-chat-agent-venv/\`
EOF

echo -e "${GREEN}✨ Build completed successfully!${NC}"
echo ""
echo -e "${GREEN}📍 Build Output:${NC}"
echo -e "  - Build directory: $BUILD_DIR${NC}"
echo -e "  - sj-collector: $BUILD_DIR/sj-collector${NC}"
echo -e "  - sj-tracker-report: $BUILD_DIR/sj-tracker-report${NC}"
echo -e "  - Frontend: sj-tracker-frontend/.next${NC}"
echo -e "  - Chat Agent: $BUILD_DIR/sj-tracker-chat-agent/${NC}"
echo ""
echo -e "${YELLOW}💡 Next step: Run \`./run-built.sh\` to start the built system${NC}"

