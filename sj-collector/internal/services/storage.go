package services

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

// StorageService handles local file storage operations
// Replaces S3Service for local development
type StorageService struct {
	basePath string
	baseURL  string // Base URL for serving files (e.g., http://localhost:8080/storage)
}

// NewStorageService creates a new local storage service
func NewStorageService(basePath, baseURL string) (*StorageService, error) {
	// Ensure base directory exists
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create storage directory: %w", err)
	}

	return &StorageService{
		basePath: basePath,
		baseURL:  baseURL,
	}, nil
}

// UploadScreenshot uploads a screenshot to local storage
// Returns the storage key (path) of the uploaded file
// monitorIdx differentiates screenshots from multiple monitors captured at the same timestamp
func (s *StorageService) UploadScreenshot(ctx context.Context, org, user string, timestamp time.Time, monitorIdx int, reader io.Reader, contentType string) (string, error) {
	// Generate storage key: <org>/<user>/<timestamp>_monitor<idx>.png
	key := fmt.Sprintf("%s/%s/%d_monitor%d.png", org, user, timestamp.Unix(), monitorIdx)
	
	// Full file path
	fullPath := filepath.Join(s.basePath, key)
	
	// Ensure directory exists
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}
	
	// Create file
	file, err := os.Create(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()
	
	// Copy data to file
	_, err = io.Copy(file, reader)
	if err != nil {
		// Clean up on error
		os.Remove(fullPath)
		return "", fmt.Errorf("failed to write file: %w", err)
	}
	
	return key, nil
}

// GetFileURL returns the full URL for a given key
func (s *StorageService) GetFileURL(key string) string {
	// Return URL that can be served by the HTTP server
	return fmt.Sprintf("%s/%s", s.baseURL, key)
}

// GetScreenshotKey generates the storage key for a screenshot given org, user, timestamp, and monitor index
func (s *StorageService) GetScreenshotKey(org, user string, timestamp int64, monitorIdx int) string {
	return fmt.Sprintf("%s/%s/%d_monitor%d.png", org, user, timestamp, monitorIdx)
}

// GetObject retrieves an object from local storage
// Returns the object body, content type, and any error
func (s *StorageService) GetObject(ctx context.Context, key string) (io.ReadCloser, string, error) {
	fullPath := filepath.Join(s.basePath, key)
	
	// Check if file exists
	file, err := os.Open(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, "", fmt.Errorf("file not found: %s", key)
		}
		return nil, "", fmt.Errorf("failed to open file: %w", err)
	}
	
	// Determine content type from extension
	contentType := "application/octet-stream"
	ext := filepath.Ext(key)
	switch ext {
	case ".png":
		contentType = "image/png"
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	case ".gif":
		contentType = "image/gif"
	case ".webp":
		contentType = "image/webp"
	}
	
	return file, contentType, nil
}

