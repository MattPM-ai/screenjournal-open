/**
 * ============================================================================
 * CHAT AGENT TOOLS
 * ============================================================================
 *
 * PURPOSE: Tool definitions for LangChain AI agent integration
 *
 * DESCRIPTION:
 * This module provides tool implementations for the chat agent that allow
 * the AI to query InfluxDB data and generate productivity reports. All tools
 * use hardcoded IDs (account_id=0, org_id=0, user_id=0) as per requirements.
 *
 * TOOLS IMPLEMENTED:
 * 1. get_afk_status - Query AFK status data
 * 2. get_app_usage - Query app usage data
 * 3. get_daily_metrics - Query daily metrics data
 * 4. get_window_activity - Query window activity data
 * 5. get_screen_timeline - Query screen timeline data
 * 6. execute_flux_query - Execute arbitrary Flux queries
 * 7. generate_productivity_report - Generate productivity report
 *
 * DEPENDENCIES:
 * - internal/database/influxdb.go: InfluxDB client
 * - internal/services/report_service.go: Report generation service
 * - internal/models: Data models
 *
 * ============================================================================
 */

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"matt-tracker-report/internal/database"
	"matt-tracker-report/internal/models"
	"strings"
	"time"
)

// Hardcoded filter values for all queries
const (
	DefaultAccountID = 0
	DefaultOrgID     = 0
	DefaultUserID    = 0
	InfluxBucket     = "matt-metrics-dev"
)

// Tool represents a function that can be called by the AI agent
type Tool struct {
	Name        string
	Description string
	Parameters  map[string]interface{} // JSON schema for OpenAI function calling
	Execute     func(params map[string]interface{}) (string, error)
}

// ChatTools holds dependencies for tool execution
type ChatTools struct {
	influxClient  *database.InfluxDBClient
	reportService *ReportService
}

// NewChatTools creates a new ChatTools instance
func NewChatTools(influxClient *database.InfluxDBClient, reportService *ReportService) *ChatTools {
	return &ChatTools{
		influxClient:  influxClient,
		reportService: reportService,
	}
}

// GetAllTools returns all available tools for the agent
func (ct *ChatTools) GetAllTools() []Tool {
	return []Tool{
		ct.buildAFKStatusTool(),
		ct.buildAppUsageTool(),
		ct.buildDailyMetricsTool(),
		ct.buildWindowActivityTool(),
		ct.buildScreenTimelineTool(),
		ct.buildFluxQueryTool(),
		ct.buildReportGenerationTool(),
	}
}

// buildInfluxQuery builds a Flux query for a given measurement and date range
func (ct *ChatTools) buildInfluxQuery(measurement, dateStart, dateEnd string) string {
	return fmt.Sprintf(`from(bucket: "%s")
  |> range(start: %s, stop: %s)
  |> filter(fn: (r) => r["_measurement"] == "%s")
  |> filter(fn: (r) => r["account_id"] == "%d")
  |> filter(fn: (r) => r["org_id"] == "%d")
  |> filter(fn: (r) => r["user_id"] == "%d")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"])`,
		InfluxBucket, dateStart, dateEnd, measurement,
		DefaultAccountID, DefaultOrgID, DefaultUserID)
}

// parseDateRange validates and parses date range parameters
// Accepts both RFC3339 format (e.g., "2025-01-12T00:00:00Z") and date-only format (e.g., "2025-01-12")
// For date-only format, start date defaults to 00:00:00 and end date defaults to 23:59:59
func (ct *ChatTools) parseDateRange(params map[string]interface{}) (time.Time, time.Time, error) {
	dateStartStr, ok := params["date_start"].(string)
	if !ok {
		return time.Time{}, time.Time{}, fmt.Errorf("date_start must be a string")
	}

	dateEndStr, ok := params["date_end"].(string)
	if !ok {
		return time.Time{}, time.Time{}, fmt.Errorf("date_end must be a string")
	}

	var dateStart, dateEnd time.Time
	var err error

	// Try RFC3339 format first
	dateStart, err = time.Parse(time.RFC3339, dateStartStr)
	if err != nil {
		// If RFC3339 fails, try date-only format (YYYY-MM-DD)
		dateStart, err = time.Parse("2006-01-02", dateStartStr)
		if err != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("invalid date_start format (expected RFC3339 like '2025-01-12T00:00:00Z' or date-only like '2025-01-12'): %w", err)
		}
		// Set to start of day (00:00:00 UTC)
		dateStart = time.Date(dateStart.Year(), dateStart.Month(), dateStart.Day(), 0, 0, 0, 0, time.UTC)
	}

	// Try RFC3339 format first
	dateEnd, err = time.Parse(time.RFC3339, dateEndStr)
	if err != nil {
		// If RFC3339 fails, try date-only format (YYYY-MM-DD)
		dateEnd, err = time.Parse("2006-01-02", dateEndStr)
		if err != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("invalid date_end format (expected RFC3339 like '2025-01-12T23:59:59Z' or date-only like '2025-01-12'): %w", err)
		}
		// Set to end of day (23:59:59 UTC)
		dateEnd = time.Date(dateEnd.Year(), dateEnd.Month(), dateEnd.Day(), 23, 59, 59, 999999999, time.UTC)
	}

	return dateStart, dateEnd, nil
}

// buildAFKStatusTool creates the AFK status query tool
func (ct *ChatTools) buildAFKStatusTool() Tool {
	return Tool{
		Name:        "get_afk_status",
		Description: "Get AFK status data for a date range. Returns information about when users were away from keyboard (account_id=0, org_id=0, user_id=0).",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"date_start": map[string]interface{}{
					"type":        "string",
					"description": "Start timestamp in RFC3339 format (e.g., '2025-11-17T00:00:00Z')",
				},
				"date_end": map[string]interface{}{
					"type":        "string",
					"description": "End timestamp in RFC3339 format (e.g., '2025-11-18T23:59:59Z')",
				},
			},
			"required": []string{"date_start", "date_end"},
		},
		Execute: func(params map[string]interface{}) (string, error) {
			dateStart, dateEnd, err := ct.parseDateRange(params)
			if err != nil {
				return "", err
			}

			data, err := ct.influxClient.QueryAFKStatus(DefaultAccountID, DefaultOrgID, DefaultUserID, dateStart, dateEnd)
			if err != nil {
				return "", fmt.Errorf("failed to query AFK status: %w", err)
			}

			jsonData, err := json.Marshal(data)
			if err != nil {
				return "", fmt.Errorf("failed to marshal AFK status data: %w", err)
			}

			return string(jsonData), nil
		},
	}
}

// buildAppUsageTool creates the app usage query tool
func (ct *ChatTools) buildAppUsageTool() Tool {
	return Tool{
		Name:        "get_app_usage",
		Description: "Get app usage data for a date range. Returns information about which applications were used and for how long (account_id=0, org_id=0, user_id=0).",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"date_start": map[string]interface{}{
					"type":        "string",
					"description": "Start timestamp in RFC3339 format (e.g., '2025-11-17T00:00:00Z')",
				},
				"date_end": map[string]interface{}{
					"type":        "string",
					"description": "End timestamp in RFC3339 format (e.g., '2025-11-18T23:59:59Z')",
				},
			},
			"required": []string{"date_start", "date_end"},
		},
		Execute: func(params map[string]interface{}) (string, error) {
			dateStart, dateEnd, err := ct.parseDateRange(params)
			if err != nil {
				return "", err
			}

			data, err := ct.influxClient.QueryAppUsage(DefaultAccountID, DefaultOrgID, DefaultUserID, dateStart, dateEnd)
			if err != nil {
				return "", fmt.Errorf("failed to query app usage: %w", err)
			}

			jsonData, err := json.Marshal(data)
			if err != nil {
				return "", fmt.Errorf("failed to marshal app usage data: %w", err)
			}

			return string(jsonData), nil
		},
	}
}

// buildDailyMetricsTool creates the daily metrics query tool
func (ct *ChatTools) buildDailyMetricsTool() Tool {
	return Tool{
		Name:        "get_daily_metrics",
		Description: "Get daily metrics data for a date range. Returns aggregated daily productivity metrics including active time, AFK time, and app switches (account_id=0, org_id=0, user_id=0).",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"date_start": map[string]interface{}{
					"type":        "string",
					"description": "Start timestamp in RFC3339 format (e.g., '2025-11-17T00:00:00Z')",
				},
				"date_end": map[string]interface{}{
					"type":        "string",
					"description": "End timestamp in RFC3339 format (e.g., '2025-11-18T23:59:59Z')",
				},
			},
			"required": []string{"date_start", "date_end"},
		},
		Execute: func(params map[string]interface{}) (string, error) {
			dateStart, dateEnd, err := ct.parseDateRange(params)
			if err != nil {
				return "", err
			}

			data, err := ct.influxClient.QueryDailyMetrics(DefaultAccountID, DefaultOrgID, DefaultUserID, dateStart, dateEnd)
			if err != nil {
				return "", fmt.Errorf("failed to query daily metrics: %w", err)
			}

			jsonData, err := json.Marshal(data)
			if err != nil {
				return "", fmt.Errorf("failed to marshal daily metrics data: %w", err)
			}

			return string(jsonData), nil
		},
	}
}

// buildWindowActivityTool creates the window activity query tool
func (ct *ChatTools) buildWindowActivityTool() Tool {
	return Tool{
		Name:        "get_window_activity",
		Description: "Get window activity data for a date range. Returns information about active windows, applications, and their titles (account_id=0, org_id=0, user_id=0).",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"date_start": map[string]interface{}{
					"type":        "string",
					"description": "Start timestamp in RFC3339 format (e.g., '2025-11-17T00:00:00Z')",
				},
				"date_end": map[string]interface{}{
					"type":        "string",
					"description": "End timestamp in RFC3339 format (e.g., '2025-11-18T23:59:59Z')",
				},
			},
			"required": []string{"date_start", "date_end"},
		},
		Execute: func(params map[string]interface{}) (string, error) {
			dateStart, dateEnd, err := ct.parseDateRange(params)
			if err != nil {
				return "", err
			}

			data, err := ct.influxClient.QueryWindowActivity(DefaultAccountID, DefaultOrgID, DefaultUserID, dateStart, dateEnd)
			if err != nil {
				return "", fmt.Errorf("failed to query window activity: %w", err)
			}

			jsonData, err := json.Marshal(data)
			if err != nil {
				return "", fmt.Errorf("failed to marshal window activity data: %w", err)
			}

			return string(jsonData), nil
		},
	}
}

// buildScreenTimelineTool creates the screen timeline query tool
func (ct *ChatTools) buildScreenTimelineTool() Tool {
	return Tool{
		Name:        "get_screen_timeline",
		Description: "Get screen timeline data for a date range. Returns detailed timeline events with productivity scores and descriptions (account_id=0, org_id=0, user_id=0).",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"date_start": map[string]interface{}{
					"type":        "string",
					"description": "Start timestamp in RFC3339 format (e.g., '2025-11-17T00:00:00Z')",
				},
				"date_end": map[string]interface{}{
					"type":        "string",
					"description": "End timestamp in RFC3339 format (e.g., '2025-11-18T23:59:59Z')",
				},
			},
			"required": []string{"date_start", "date_end"},
		},
		Execute: func(params map[string]interface{}) (string, error) {
			dateStart, dateEnd, err := ct.parseDateRange(params)
			if err != nil {
				return "", err
			}

			data, err := ct.influxClient.QueryScreenTimeline(DefaultAccountID, DefaultOrgID, DefaultUserID, dateStart, dateEnd)
			if err != nil {
				return "", fmt.Errorf("failed to query screen timeline: %w", err)
			}

			jsonData, err := json.Marshal(data)
			if err != nil {
				return "", fmt.Errorf("failed to marshal screen timeline data: %w", err)
			}

			return string(jsonData), nil
		},
	}
}

// buildFluxQueryTool creates the advanced Flux query tool
func (ct *ChatTools) buildFluxQueryTool() Tool {
	return Tool{
		Name:        "execute_flux_query",
		Description: "Execute an arbitrary Flux query against InfluxDB. This should only be used when other tools cannot satisfy the request. The query MUST include the filter: |> filter(fn: (r) => r[\"account_id\"] == \"0\")",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"query": map[string]interface{}{
					"type":        "string",
					"description": "Complete Flux query string. Must include account_id filter: |> filter(fn: (r) => r[\"account_id\"] == \"0\")",
				},
			},
			"required": []string{"query"},
		},
		Execute: func(params map[string]interface{}) (string, error) {
			query, ok := params["query"].(string)
			if !ok {
				return "", fmt.Errorf("query must be a string")
			}

			// Validate that account_id filter is present
			if !containsAccountIDFilter(query) {
				return "", fmt.Errorf("query must include account_id filter: |> filter(fn: (r) => r[\"account_id\"] == \"0\")")
			}

			// Execute raw Flux query
			rows, err := ct.influxClient.QueryFluxRaw(context.Background(), query)
			if err != nil {
				return "", fmt.Errorf("failed to execute Flux query: %w", err)
			}

			jsonData, err := json.Marshal(rows)
			if err != nil {
				return "", fmt.Errorf("failed to marshal query results: %w", err)
			}

			return string(jsonData), nil
		},
	}
}

// buildReportGenerationTool creates the productivity report generation tool
func (ct *ChatTools) buildReportGenerationTool() Tool {
	return Tool{
		Name:        "generate_productivity_report",
		Description: "Generates a comprehensive productivity report for a given period and returns the raw data. This includes detailed analysis, hourly breakdowns, and discrepancy detection.",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"orgId": map[string]interface{}{
					"type":        "number",
					"description": "ID of the organization the users are under",
				},
				"orgName": map[string]interface{}{
					"type":        "string",
					"description": "Name of the organization the users are under",
				},
				"users": map[string]interface{}{
					"type":        "array",
					"description": "Array of users to generate report for. Format: [{\"id\": number, \"name\": \"string\"}]",
					"items": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"id": map[string]interface{}{
								"type": "number",
							},
							"name": map[string]interface{}{
								"type": "string",
							},
						},
						"required": []string{"id", "name"},
					},
				},
				"startDate": map[string]interface{}{
					"type":        "string",
					"description": "Start date in YYYY-MM-DD format (e.g., '2025-11-17')",
				},
				"endDate": map[string]interface{}{
					"type":        "string",
					"description": "End date in YYYY-MM-DD format (e.g., '2025-11-18')",
				},
			},
			"required": []string{"orgId", "orgName", "users", "startDate", "endDate"},
		},
		Execute: func(params map[string]interface{}) (string, error) {
			// Parse orgId
			orgIdFloat, ok := params["orgId"].(float64)
			if !ok {
				return "", fmt.Errorf("orgId must be a number")
			}
			orgId := int(orgIdFloat)

			// Parse orgName
			orgName, ok := params["orgName"].(string)
			if !ok {
				return "", fmt.Errorf("orgName must be a string")
			}

			// Parse users array
			usersInterface, ok := params["users"].([]interface{})
			if !ok {
				return "", fmt.Errorf("users must be an array")
			}

			var users []models.UserRequest
			for _, userInterface := range usersInterface {
				userMap, ok := userInterface.(map[string]interface{})
				if !ok {
					return "", fmt.Errorf("each user must be an object with 'id' and 'name'")
				}

				userIdFloat, ok := userMap["id"].(float64)
				if !ok {
					return "", fmt.Errorf("user id must be a number")
				}

				userName, ok := userMap["name"].(string)
				if !ok {
					return "", fmt.Errorf("user name must be a string")
				}

				users = append(users, models.UserRequest{
					ID:   int(userIdFloat),
					Name: userName,
				})
			}

			if len(users) == 0 {
				return "", fmt.Errorf("at least one user is required")
			}

			// Parse dates
			startDate, ok := params["startDate"].(string)
			if !ok {
				return "", fmt.Errorf("startDate must be a string in YYYY-MM-DD format")
			}

			endDate, ok := params["endDate"].(string)
			if !ok {
				return "", fmt.Errorf("endDate must be a string in YYYY-MM-DD format")
			}

			// Build request
			request := models.GenerateReportRequest{
				AccountID: DefaultAccountID,
				OrgID:     orgId,
				Org:       orgName,
				Users:     users,
				StartDate: startDate,
				EndDate:   endDate,
			}

			// Generate report directly (no HTTP call)
			report, err := ct.reportService.GenerateReport(request)
			if err != nil {
				return "", fmt.Errorf("failed to generate report: %w", err)
			}

			// Return JSON string
			jsonData, err := json.Marshal(report)
			if err != nil {
				return "", fmt.Errorf("failed to marshal report: %w", err)
			}

			return string(jsonData), nil
		},
	}
}

// containsAccountIDFilter checks if a Flux query contains the required account_id filter
func containsAccountIDFilter(query string) bool {
	// Check for various forms of the account_id filter
	patterns := []string{
		`account_id"] == "0"`,
		`account_id"] == '0'`,
		`account_id"] == 0`,
		`account_id"] == \"0\"`,
		`account_id"] == '0'`,
		`account_id == "0"`,
		`account_id == 0`,
	}

	for _, pattern := range patterns {
		if strings.Contains(query, pattern) {
			return true
		}
	}

	return false
}

