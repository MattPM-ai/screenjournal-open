#!/bin/bash

# Build script for creating a single bundled ScreenJournal application
# This creates a DMG installer containing all services and the desktop app

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

echo -e "${GREEN}🔨 Building Bundled ScreenJournal Application${NC}"
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

# Create temporary build directory
BUILD_DIR="$SCRIPT_DIR/dist-bundled"
echo -e "${YELLOW}📁 Creating build directory: $BUILD_DIR${NC}"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/binaries"
mkdir -p "$BUILD_DIR/python"
echo -e "${GREEN}✅ Build directory created${NC}"
echo ""

# Build sj-collector
echo -e "${BLUE}🔧 Building sj-collector backend...${NC}"
cd sj-collector
go build -o "$BUILD_DIR/binaries/sj-collector" ./cmd/server
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ sj-collector built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build sj-collector${NC}"
    exit 1
fi
cd ..
echo ""

# Build sj-tracker-report
echo -e "${BLUE}🔧 Building sj-tracker-report backend...${NC}"
cd sj-tracker-report
go build -o "$BUILD_DIR/binaries/sj-tracker-report" ./cmd/server
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ sj-tracker-report built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build sj-tracker-report${NC}"
    exit 1
fi
cd ..
echo ""

# Package Python chat agent using PyInstaller (creates standalone executable)
echo -e "${BLUE}🤖 Packaging Python chat agent with PyInstaller...${NC}"
cd sj-tracker-chat-agent

# Create a dedicated build virtual environment
if [ -d "venv-build" ]; then
    echo -e "${YELLOW}📦 Removing existing build venv...${NC}"
    rm -rf venv-build
fi

echo -e "${YELLOW}📦 Creating build virtual environment...${NC}"
python3 -m venv venv-build

echo -e "${YELLOW}📦 Installing dependencies including PyInstaller...${NC}"
source venv-build/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
python3 -m pip install pyinstaller
deactivate

# Create PyInstaller spec file for the chat agent server
cat > chat-agent.spec << 'EOF'
# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

# Collect all langchain.agents submodules to ensure all imports work
langchain_agents_submodules = collect_submodules('langchain.agents')

a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('main.py', '.'),
        ('backend_client.py', '.'),
    ],
    hiddenimports=[
        'flask',
        'flask_cors',
        'langchain',
        'langchain.agents',
        'langchain.agents.agent',  # AgentExecutor is here
        'langchain.agents.tool_calling_agent',  # create_tool_calling_agent package
        'langchain.agents.tool_calling_agent.base',  # create_tool_calling_agent function
        'langchain_google_genai',
        'langchain_google_genai.chat_models',
        'langchain_core',
        'langchain_core.messages',
        'langchain_core.tools',
        'langchain_core.prompts',
        'langchain_community',
        'requests',
        'dotenv',
        'pydantic',
        'pydantic.fields',
        'main',
        'backend_client',
    ] + langchain_agents_submodules,  # Add all collected submodules
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='sj-chat-agent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
EOF

# Build standalone executable with PyInstaller
echo -e "${YELLOW}📦 Building standalone executable with PyInstaller...${NC}"
source venv-build/bin/activate
pyinstaller --clean --noconfirm chat-agent.spec
deactivate

# Determine the executable name based on platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    CHAT_AGENT_EXE="dist/sj-chat-agent"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    CHAT_AGENT_EXE="dist/sj-chat-agent.exe"
else
    CHAT_AGENT_EXE="dist/sj-chat-agent"
fi

if [ ! -f "$CHAT_AGENT_EXE" ]; then
    echo -e "${RED}❌ Failed to build chat agent executable${NC}"
    exit 1
fi

# Copy the standalone executable to bundled resources
echo -e "${YELLOW}📦 Copying standalone executable to bundled resources...${NC}"
mkdir -p "$BUILD_DIR/python/sj-tracker-chat-agent"
cp "$CHAT_AGENT_EXE" "$BUILD_DIR/python/sj-tracker-chat-agent/sj-chat-agent"
chmod +x "$BUILD_DIR/python/sj-tracker-chat-agent/sj-chat-agent"

# Clean up build artifacts
rm -rf build dist chat-agent.spec

echo -e "${GREEN}✅ Python chat agent packaged as standalone executable${NC}"
cd ..
echo ""

# Build frontend (needed for desktop app and report frontend)
echo -e "${BLUE}🌐 Building frontend for desktop app and report frontend...${NC}"
cd sj-tracker-frontend
if [ ! -d node_modules ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    npm install
fi

# Check if standalone mode is enabled in next.config.js
if grep -q "output.*standalone" next.config.js 2>/dev/null || grep -q "'standalone'" next.config.js 2>/dev/null; then
    echo -e "${YELLOW}📦 Building with standalone mode (for bundled app)...${NC}"
else
    echo -e "${YELLOW}⚠️  Standalone mode not enabled - frontend may not work in bundled app${NC}"
fi

npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend built successfully${NC}"
    # Verify standalone build exists
    if [ -d ".next/standalone" ]; then
        echo -e "${GREEN}✅ Standalone build created${NC}"
    else
        echo -e "${YELLOW}⚠️  Standalone build not found - frontend may require full node_modules${NC}"
    fi
else
    echo -e "${RED}❌ Failed to build frontend${NC}"
    exit 1
fi
cd ..
echo ""

# Prepare database binaries if not already done
echo -e "${YELLOW}📦 Preparing database binaries...${NC}"
TAURI_RESOURCES_DIR="screenjournal/apps/desktop/src-tauri/resources"
if [ ! -d "$TAURI_RESOURCES_DIR/databases" ] || [ -z "$(ls -A $TAURI_RESOURCES_DIR/databases 2>/dev/null)" ]; then
    ./scripts/prepare-databases.sh
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to prepare database binaries${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Database binaries already prepared${NC}"
fi
echo ""

# Copy binaries and Python environment to Tauri resources
echo -e "${YELLOW}📦 Copying resources to Tauri app...${NC}"

# Create resources directories
mkdir -p "$TAURI_RESOURCES_DIR/binaries"
mkdir -p "$TAURI_RESOURCES_DIR/python"

# Copy Go binaries
cp "$BUILD_DIR/binaries/sj-collector" "$TAURI_RESOURCES_DIR/binaries/"
cp "$BUILD_DIR/binaries/sj-tracker-report" "$TAURI_RESOURCES_DIR/binaries/"

# Copy Python standalone executable (created by PyInstaller)
cp -r "$BUILD_DIR/python/sj-tracker-chat-agent" "$TAURI_RESOURCES_DIR/python/"

echo -e "${GREEN}✅ Resources copied to Tauri app${NC}"
echo ""

# Build desktop app with Tauri
echo -e "${BLUE}🖥️  Building bundled desktop app...${NC}"

# Build UI package first (needed by desktop app)
echo -e "${YELLOW}📦 Building UI package...${NC}"
cd screenjournal
npm run build --workspace=@repo/ui
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to build UI package${NC}"
    exit 1
fi
cd ..

cd screenjournal/apps/desktop

if [ ! -d node_modules ]; then
    echo -e "${YELLOW}📦 Installing desktop app dependencies...${NC}"
    npm install
fi

# Build Next.js first
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to build Next.js${NC}"
    exit 1
fi

# Copy frontend BEFORE Tauri build (so it's included in the initial bundle)
# This avoids needing to re-sign and re-notarize
echo -e "${YELLOW}📦 Copying frontend to Tauri resources (before build)...${NC}"
cd "$SCRIPT_DIR"
mkdir -p "$TAURI_RESOURCES_DIR/frontend"
# Use rsync or cp with -L to follow symlinks and ensure complete copy
if command -v rsync >/dev/null 2>&1; then
    rsync -a --copy-links "$SCRIPT_DIR/sj-tracker-frontend/" "$TAURI_RESOURCES_DIR/frontend/sj-tracker-frontend/"
else
    # Use cp with -L to follow symlinks
    cp -RL "$SCRIPT_DIR/sj-tracker-frontend" "$TAURI_RESOURCES_DIR/frontend/"
fi
echo -e "${GREEN}✅ Frontend copied to Tauri app${NC}"

# Build Tauri app (this will bundle resources, sign, and notarize once)
# Note: Tauri will create a DMG, but we'll recreate it after notarization
cd screenjournal/apps/desktop
npm run tauri:build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Bundled desktop app built, signed, and notarized${NC}"
    
    # Recreate DMG after notarization to ensure it contains the final notarized app
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${YELLOW}📦 Recreating DMG with notarized app bundle...${NC}"
        
        APP_BUNDLE_PATH="src-tauri/target/release/bundle/macos/ScreenJournal Tracker.app"
        DMG_DIR="src-tauri/target/release/bundle/dmg"
        DMG_NAME="ScreenJournal Tracker_0.1.0_aarch64.dmg"
        DMG_PATH="$DMG_DIR/$DMG_NAME"
        
        # Remove old DMG if it exists
        if [ -f "$DMG_PATH" ]; then
            rm -f "$DMG_PATH"
        fi
        
        # Create DMG using hdiutil
        mkdir -p "$DMG_DIR"
        
        # Create a temporary directory for DMG contents
        TEMP_DMG_DIR=$(mktemp -d)
        cp -R "$APP_BUNDLE_PATH" "$TEMP_DMG_DIR/"
        
        # Create DMG
        hdiutil create -volname "ScreenJournal Tracker" -srcfolder "$TEMP_DMG_DIR" -ov -format UDZO "$DMG_PATH"
        
        # Clean up temp directory
        rm -rf "$TEMP_DMG_DIR"
        
        # Sign the DMG (if signing identity is available)
        if [ -n "$APPLE_SIGNING_IDENTITY" ]; then
            echo -e "${YELLOW}🔏 Signing DMG...${NC}"
            codesign --force --sign "$APPLE_SIGNING_IDENTITY" --timestamp "$DMG_PATH"
            echo -e "${GREEN}   ✅ DMG signed${NC}"
        else
            echo -e "${YELLOW}   ⚠️  APPLE_SIGNING_IDENTITY not set, skipping DMG signing${NC}"
        fi
        
        if [ -f "$DMG_PATH" ]; then
            echo -e "${GREEN}   ✅ DMG recreated: $DMG_PATH${NC}"
            echo -e "${GREEN}   You can now distribute this DMG file${NC}"
        else
            echo -e "${YELLOW}   ⚠️  Failed to recreate DMG, using original${NC}"
            DMG_PATH=$(find "$DMG_DIR" -name "*.dmg" 2>/dev/null | head -1)
        fi
    fi
else
    echo -e "${RED}❌ Failed to build desktop app${NC}"
    exit 1
fi
cd ../../..
echo ""

echo -e "${GREEN}✨ Bundled application build completed successfully!${NC}"
echo ""
echo -e "${GREEN}📍 Build Output:${NC}"
echo -e "  - Go binaries: $BUILD_DIR/binaries/${NC}"
echo -e "  - Python environment: $BUILD_DIR/python/${NC}"
echo -e "  - Tauri app bundle: screenjournal/apps/desktop/src-tauri/target/release/bundle/${NC}"
if [[ "$OSTYPE" == "darwin"* ]] && [ -n "$DMG_PATH" ]; then
    echo -e "  - DMG installer: $DMG_PATH${NC}"
fi
echo ""
echo -e "${YELLOW}💡 The bundled app contains all services and can be distributed as a single DMG file${NC}"

