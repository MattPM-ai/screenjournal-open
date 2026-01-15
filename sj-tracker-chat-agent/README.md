# Chat Agent Service

LangChain-based AI agent for querying productivity data from InfluxDB.

## Overview

This service provides two modes:
- **Interactive CLI** (`main.py`) - For testing and development
- **HTTP Server** (`server.py`) - For production use with the frontend

## Setup

### Automatic (via start.sh)
The `start.sh` script in the root directory will automatically:
- Create a Python virtual environment
- Install dependencies
- Start the HTTP server

### Manual Setup

1. Create virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set environment variables:
```bash
export OPENAI_API_KEY="your-openai-api-key"
export BACKEND_URL="http://localhost:8085"  # Go backend URL
export OPENAI_MODEL="gpt-4o-mini"  # Optional
export CHAT_AGENT_PORT="8087"  # Optional, defaults to 8087
```

Or create a `.env` file in the root directory:
```
OPENAI_API_KEY=your-openai-api-key
BACKEND_URL=http://localhost:8085
OPENAI_MODEL=gpt-4o-mini
CHAT_AGENT_PORT=8087
```

## Running

### HTTP Server (Production)
```bash
python server.py
```

The server will start on `http://localhost:8087` (or configured port).

### Interactive CLI (Development)
```bash
python main.py
```

## API Endpoints

### POST `/api/chat`
Process a chat message and return agent response.

**Request:**
```json
{
  "chatInput": "What was my active time yesterday?",
  "sessionId": "session-123"
}
```

**Response:**
```json
{
  "response": "Based on the data..."
}
```

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "agent_ready": true
}
```

### DELETE `/api/chat/session/<session_id>`
Clear chat history for a session.

## Tools Available

The agent has access to 7 tools:
1. `get_afk_status` - Query AFK status data
2. `get_app_usage` - Query app usage data
3. `get_daily_metrics` - Query daily metrics
4. `get_window_activity` - Query window activity
5. `get_screen_timeline` - Query screen timeline
6. `execute_flux_query` - Execute arbitrary Flux queries
7. `generate_productivity_report` - Generate productivity reports

## Integration

This service:
- Connects to Go backend on port 8085 for tool execution
- Receives requests from Next.js frontend on port 8087
- Uses OpenAI API for LLM processing

Make sure the Go backend is running before starting the chat agent.

