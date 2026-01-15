package services

import (
	"context"
	"io"
	"time"
)

// StorageInterface defines the interface for storage operations
// This allows switching between S3 and local storage implementations
type StorageInterface interface {
	// UploadScreenshot uploads a screenshot and returns the storage key
	UploadScreenshot(ctx context.Context, org, user string, timestamp time.Time, monitorIdx int, reader io.Reader, contentType string) (string, error)
	
	// GetFileURL returns the full URL for a given key
	GetFileURL(key string) string
	
	// GetScreenshotKey generates the storage key for a screenshot
	GetScreenshotKey(org, user string, timestamp int64, monitorIdx int) string
	
	// GetObject retrieves an object from storage
	GetObject(ctx context.Context, key string) (io.ReadCloser, string, error)
}

