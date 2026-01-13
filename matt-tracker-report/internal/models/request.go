package models

// UserRequest represents a user in the report generation request
type UserRequest struct {
	Name string `json:"name" binding:"required"`
	ID   int    `json:"id"` // Optional, defaults to 0
}

// GenerateReportRequest represents the request to generate a report
type GenerateReportRequest struct {
	AccountID int           `json:"accountId"` // Optional, defaults to 0
	Users     []UserRequest `json:"users" binding:"required,min=1"`
	Org       string        `json:"org" binding:"required"`
	OrgID     int           `json:"orgId"` // Optional, defaults to 0
	StartDate string        `json:"startDate" binding:"required"` // YYYY-MM-DD
	EndDate   string        `json:"endDate" binding:"required"`   // YYYY-MM-DD
}

// TaskResponse represents the response when creating a task
type TaskResponse struct {
	TaskID string `json:"taskId"`
	Status string `json:"status"` // "pending", "processing", "completed", "failed"
}

// GenerateWeeklyReportRequest represents the request to generate a weekly report
type GenerateWeeklyReportRequest struct {
	AccountID int           `json:"accountId"` // Optional, defaults to 0
	Users     []UserRequest `json:"users" binding:"required,min=1"`
	Org       string        `json:"org" binding:"required"`
	OrgID     int           `json:"orgId"` // Optional, defaults to 0
	WeekStartDate string    `json:"weekStartDate" binding:"required"` // YYYY-MM-DD - Monday of the week (or start date if custom period)
	// Optional: Custom start/end dates for exact period (overrides Monday-Sunday calculation)
	CustomStartDate *string `json:"customStartDate,omitempty"` // ISO 8601 datetime (e.g., "2025-12-01T16:30:00Z")
	CustomEndDate   *string `json:"customEndDate,omitempty"`   // ISO 8601 datetime (e.g., "2025-12-08T16:30:00Z")
}

// StatusResponse represents the response when checking task status
type StatusResponse struct {
	TaskID string      `json:"taskId"`
	Status string      `json:"status"` // "processing", "completed", "failed"
	Report interface{} `json:"report,omitempty"`
	Error  string      `json:"error,omitempty"`
}

// OptInWeeklyReportsRequest represents the request to opt into weekly email reports
type OptInWeeklyReportsRequest struct {
	AccountID      int           `json:"accountId" binding:"required"`
	OrgID          int           `json:"orgId" binding:"required"`
	OrgName        string        `json:"orgName" binding:"required"`
	Email          string        `json:"email" binding:"required,email"`
	Users          []UserRequest `json:"users" binding:"required,min=1"`
	NextTriggerTime *string      `json:"nextTriggerTime,omitempty"` // Optional ISO 8601 datetime override for testing (e.g., "2025-01-15T14:30:00Z")
}

// OptOutWeeklyReportsRequest represents the request to opt out of weekly email reports
type OptOutWeeklyReportsRequest struct {
	AccountID int `json:"accountId" binding:"required"`
	OrgID     int `json:"orgId" binding:"required"`
}

// SendWeeklyReportEmailRequest represents the request to manually send a weekly report email
type SendWeeklyReportEmailRequest struct {
	AccountID    int           `json:"accountId" binding:"required"`
	OrgID        int           `json:"orgId" binding:"required"`
	OrgName      string        `json:"orgName" binding:"required"`
	Email        string        `json:"email" binding:"required,email"`
	Users        []UserRequest `json:"users" binding:"required,min=1"`
	WeekStartDate string       `json:"weekStartDate" binding:"required"` // YYYY-MM-DD - Monday of the week
}

