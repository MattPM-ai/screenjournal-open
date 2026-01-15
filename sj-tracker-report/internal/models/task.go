package models

import "time"

// TaskStatus represents the status of a task
type TaskStatus string

const (
	TaskStatusPending    TaskStatus = "pending"
	TaskStatusProcessing TaskStatus = "processing"
	TaskStatusCompleted  TaskStatus = "completed"
	TaskStatusFailed     TaskStatus = "failed"
)

// Task represents an async report generation task
type Task struct {
	ID        string                `json:"id"`
	Status    TaskStatus            `json:"status"`
	Request   GenerateReportRequest `json:"request"`
	CreatedAt time.Time             `json:"createdAt"`
	UpdatedAt time.Time             `json:"updatedAt"`
	Error     string                `json:"error,omitempty"`
	Report    *Report               `json:"report,omitempty"`
}

