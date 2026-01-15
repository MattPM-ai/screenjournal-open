# Chat Agent Implementation Guide

## Overview

This document describes the implementation of 7 tools for the LangChain AI agent that can query InfluxDB data and generate productivity reports.

## Tool Definitions

All tools are defined in `internal/services/chat_tools.go` and use hardcoded IDs:
- `account_id = 0`
- `org_id = 0`
- `user_id = 0`

### Tool List

1. **get_afk_status** - Query AFK (away from keyboard) status data
2. **get_app_usage** - Query application usage data
3. **get_daily_metrics** - Query daily aggregated metrics
4. **get_window_activity** - Query window activity data
5. **get_screen_timeline** - Query screen timeline events
6. **execute_flux_query** - Execute arbitrary Flux queries (advanced)
7. **generate_productivity_report** - Generate comprehensive productivity report

## Tool Structure

Each tool follows this pattern:

```go
type Tool struct {
    Name        string
    Description string
    Parameters  map[string]interface{} // JSON schema for OpenAI function calling
    Execute     func(params map[string]interface{}) (string, error)
}
```

## Usage with LangChain

### 1. Initialize ChatTools

```go
import (
    "sj-tracker-report/internal/database"
    "sj-tracker-report/internal/services"
)

// Initialize dependencies
influxClient := database.NewInfluxDBClient(url, token, org, bucket)
reportService := services.NewReportService(dataService, aiService, mongoClient)

// Create ChatTools instance
chatTools := services.NewChatTools(influxClient, reportService)

// Get all tools
tools := chatTools.GetAllTools()
```

### 2. Convert Tools to LangChain Format

The tools are already in a format compatible with OpenAI function calling. For LangChain integration, you'll need to:

1. **Extract tool schemas** - Each tool's `Parameters` field contains the JSON schema
2. **Create tool execution functions** - Each tool's `Execute` function can be wrapped for LangChain

### Example: Tool Schema Extraction

```go
// Convert Go Tool to LangChain-compatible format
func toolToLangChain(tool services.Tool) map[string]interface{} {
    return map[string]interface{}{
        "name":        tool.Name,
        "description": tool.Description,
        "parameters":  tool.Parameters,
    }
}

// Create execution wrapper
func createToolExecutor(tool services.Tool) func(map[string]interface{}) (string, error) {
    return func(params map[string]interface{}) (string, error) {
        return tool.Execute(params)
    }
}
```

### 3. Tool Parameter Formats

#### Date Range Tools (Tools 1-5)

All require:
- `date_start`: RFC3339 format string (e.g., `"2025-11-17T00:00:00Z"`)
- `date_end`: RFC3339 format string (e.g., `"2025-11-18T23:59:59Z"`)

#### Advanced Flux Query Tool (Tool 6)

Requires:
- `query`: Complete Flux query string
- **Must include**: `|> filter(fn: (r) => r["account_id"] == "0")`

#### Report Generation Tool (Tool 7)

Requires:
- `orgId`: number (organization ID)
- `orgName`: string (organization name)
- `users`: array of `{id: number, name: string}`
- `startDate`: string in `YYYY-MM-DD` format
- `endDate`: string in `YYYY-MM-DD` format

## Integration Points

### Backend Service Integration

The tools are designed to be called from:
1. **LangChain Python service** - Via HTTP API endpoints
2. **LangChain.js service** - Via HTTP API endpoints  
3. **Direct Go integration** - If using Go-based agent

### HTTP API Endpoint (Recommended)

Create an API endpoint that LangChain can call:

```go
// internal/api/chat_handler.go

func (h *Handlers) ExecuteToolHandler(c *gin.Context) {
    var req struct {
        ToolName string                 `json:"tool_name"`
        Params   map[string]interface{} `json:"params"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // Get tool
    tools := h.chatTools.GetAllTools()
    var tool *services.Tool
    for i := range tools {
        if tools[i].Name == req.ToolName {
            tool = &tools[i]
            break
        }
    }
    
    if tool == nil {
        c.JSON(404, gin.H{"error": "tool not found"})
        return
    }
    
    // Execute tool
    result, err := tool.Execute(req.Params)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{"result": result})
}
```

### LangChain Python Integration Example

```python
from langchain.tools import Tool
import requests

def create_influx_tool(tool_name: str, description: str, api_url: str):
    def execute_tool(date_start: str, date_end: str) -> str:
        response = requests.post(
            f"{api_url}/api/chat/tools/execute",
            json={
                "tool_name": tool_name,
                "params": {
                    "date_start": date_start,
                    "date_end": date_end
                }
            }
        )
        return response.json()["result"]
    
    return Tool(
        name=tool_name,
        func=execute_tool,
        description=description
    )

# Create all tools
tools = [
    create_influx_tool("get_afk_status", "...", "http://localhost:8085"),
    create_influx_tool("get_app_usage", "...", "http://localhost:8085"),
    # ... etc
]
```

## Response Formats

### InfluxDB Query Tools (1-5)

Return JSON arrays of data objects:

```json
[
  {
    "_time": "2025-11-17T09:00:00Z",
    "duration": 3600,
    "app_name": "Chrome",
    ...
  }
]
```

### Flux Query Tool (6)

Returns raw query results as JSON array of maps.

### Report Generation Tool (7)

Returns complete `Report` object (see `internal/models/report.go`):

```json
{
  "organizations": [...],
  "generatedAt": "2025-11-17T12:00:00Z",
  "periodAnalyzed": {
    "startDate": "2025-11-17",
    "endDate": "2025-11-18"
  }
}
```

## Error Handling

All tools return errors in a consistent format:
- **Validation errors**: Parameter format issues
- **Query errors**: InfluxDB connection/query failures
- **Execution errors**: Tool-specific failures

Errors are returned as strings that can be passed back to the AI agent.

## Testing

### Unit Tests

Test each tool independently:

```go
func TestGetAFKStatus(t *testing.T) {
    tools := NewChatTools(mockInfluxClient, mockReportService)
    allTools := tools.GetAllTools()
    
    afkTool := allTools[0] // get_afk_status
    
    params := map[string]interface{}{
        "date_start": "2025-11-17T00:00:00Z",
        "date_end":   "2025-11-18T23:59:59Z",
    }
    
    result, err := afkTool.Execute(params)
    assert.NoError(t, err)
    assert.NotEmpty(t, result)
}
```

### Integration Tests

Test with real InfluxDB connection and verify data format.

## Next Steps

1. **Create API endpoints** for tool execution
2. **Integrate with LangChain** (Python/JS service)
3. **Add authentication** - Verify user has access to tools
4. **Add rate limiting** - Prevent abuse
5. **Add logging** - Track tool usage
6. **Add caching** - Cache frequent queries

## File Structure

```
sj-tracker-report/
├── internal/
│   ├── services/
│   │   └── chat_tools.go          # Tool definitions
│   ├── database/
│   │   └── influxdb.go            # QueryFluxRaw method added
│   └── api/
│       └── chat_handler.go        # HTTP endpoints (to be created)
└── CHAT_AGENT_IMPLEMENTATION.md   # This file
```

