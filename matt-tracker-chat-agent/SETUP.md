# LangChain Chat Agent - Setup Guide

## Overview

This is a Python-based LangChain agent that connects to the Go backend to query InfluxDB and generate productivity reports.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────┐
│  Python Agent   │────────▶│   Go Backend     │────────▶│   InfluxDB   │
│  (LangChain)    │  HTTP   │  (Port 8085)     │  Flux   │              │
└─────────────────┘         └──────────────────┘         └──────────────┘
```

## Prerequisites

1. **Go Backend Running**: The `matt-tracker-report` service must be running on port 8085
2. **Python 3.8+**: Required for LangChain
3. **OpenAI API Key**: For the LLM

## Installation

1. **Install Python dependencies**:
```bash
cd matt-tracker-chat-agent
pip install -r requirements.txt
```

2. **Set environment variables**:
```bash
export OPENAI_API_KEY="sk-..."
export BACKEND_URL="http://localhost:8085"
export OPENAI_MODEL="gpt-4o-mini"  # Optional
```

Or use a `.env` file (create it manually):
```
OPENAI_API_KEY=sk-...
BACKEND_URL=http://localhost:8085
OPENAI_MODEL=gpt-4o-mini
```

## Running

1. **Start the Go backend** (in `matt-tracker-report`):
```bash
cd matt-tracker-report
go run cmd/server/main.go
```

2. **Start the Python agent** (in `matt-tracker-chat-agent`):
```bash
python main.py
```

## Usage Examples

Once running, you can ask questions like:

- "What was my active time yesterday?"
- "Show me app usage for the past week"
- "Generate a productivity report for last month"
- "What apps did I use most on Monday?"

The agent will automatically:
1. Determine which tools to use
2. Call the Go backend API
3. Process the results
4. Format the response (including graphs if applicable)

## API Endpoints

The Go backend exposes these endpoints:

- `GET /api/chat/tools` - List all available tools
- `POST /api/chat/tools/execute` - Execute a tool

## Troubleshooting

### "Could not fetch tools from backend"
- Make sure the Go backend is running
- Check that `BACKEND_URL` is correct
- Verify the backend is accessible: `curl http://localhost:8085/health`

### "No tools available"
- Check backend logs for errors
- Verify InfluxDB connection in backend
- Ensure `chatTools` is initialized in `main.go`

### Tool execution errors
- Check backend logs
- Verify InfluxDB is running and accessible
- Check that date formats are RFC3339 (e.g., `2025-11-17T00:00:00Z`)

## Development

### Adding New Tools

1. Add tool definition in `matt-tracker-report/internal/services/chat_tools.go`
2. Restart Go backend
3. Python agent will automatically pick up new tools

### Modifying System Prompt

Edit the `build_system_prompt()` function in `main.py`

### Debugging

Set `verbose=True` in `AgentExecutor` (already set) to see tool calls and reasoning.

