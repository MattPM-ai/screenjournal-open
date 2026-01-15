package handlers

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"sj-collector/internal/middleware"
	"sj-collector/internal/services"

	"github.com/gin-gonic/gin"
)

// ScreenshotHandler handles screenshot upload requests
type ScreenshotHandler struct {
	storageService services.StorageInterface
	influxService  *services.InfluxService
}

// NewScreenshotHandler creates a new screenshot handler
func NewScreenshotHandler(storageService services.StorageInterface, influxService *services.InfluxService) *ScreenshotHandler {
	return &ScreenshotHandler{
		storageService: storageService,
		influxService:  influxService,
	}
}

// UploadScreenshot handles POST /screenshots
// Expects:
// - Authorization header with JWT token (handled by middleware)
// - Multipart form with "file" field containing the screenshot
// - Optional "timestamp" form field (Unix timestamp in seconds, defaults to now)
// - Optional form fields for additional tags (will be added to InfluxDB point)
func (h *ScreenshotHandler) UploadScreenshot(c *gin.Context) {
	// Get user and org from middleware context (for backward compatibility)
	user := middleware.GetUser(c)
	org := middleware.GetOrg(c)
	
	// Get full claims to access all metadata fields
	claims := middleware.GetClaims(c)

	log.Printf("[DATA] Received screenshot upload - user=%s, org=%s, user_id=%s, org_id=%s, account_id=%s",
		user,
		org,
		claims.UserID,
		claims.OrgID,
		claims.AccountID,
	)

	// Get the uploaded file
	file, err := c.FormFile("file")
	if err != nil {
		log.Printf("[DATA] Screenshot upload failed - missing or invalid file: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing or invalid file"})
		return
	}

	log.Printf("[DATA] Screenshot file details - filename=%s, size=%d, content_type=%s",
		file.Filename,
		file.Size,
		file.Header.Get("Content-Type"),
	)

	// Open the file
	fileReader, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to open file"})
		return
	}
	defer fileReader.Close()

	// Parse timestamp (default to now if not provided)
	timestamp := time.Now()
	if tsStr := c.PostForm("timestamp"); tsStr != "" {
		ts, err := strconv.ParseInt(tsStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid timestamp format, expected Unix timestamp in seconds"})
			return
		}
		timestamp = time.Unix(ts, 0)
	}

	// Parse monitor_idx (default to 0 if not provided)
	monitorIdx := 0
	if idxStr := c.PostForm("monitor_idx"); idxStr != "" {
		idx, err := strconv.Atoi(idxStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid monitor_idx format, expected integer"})
			return
		}
		monitorIdx = idx
	}

	storageKey, err := h.storageService.UploadScreenshot(c.Request.Context(), org, user, timestamp, monitorIdx, fileReader, file.Header.Get("Content-Type"))
	if err != nil {
		log.Printf("[DATA] Screenshot upload failed - %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to upload screenshot: %v", err)})
		return
	}
	
	log.Printf("[DATA] Screenshot uploaded successfully - storage_key=%s", storageKey)

	// Get the full storage URL
	storageURL := h.storageService.GetFileURL(storageKey)

	// Build tags with all metadata from JWT claims
	tags := make(map[string]string)
	
	// Use names for user and org tags (prefer UserName/OrgName if available, fallback to user/org from context)
	if claims.UserName != "" {
		tags["user"] = claims.UserName
	} else {
		tags["user"] = user
	}
	if claims.OrgName != "" {
		tags["org"] = claims.OrgName
	} else {
		tags["org"] = org
	}
	
	// Add ID fields from claims if available
	if claims.UserID != "" {
		tags["user_id"] = claims.UserID
	}
	if claims.OrgID != "" {
		tags["org_id"] = claims.OrgID
	}
	if claims.AccountID != "" {
		tags["account_id"] = claims.AccountID
	}

	// Add any additional tags from form fields (exclude reserved fields)
	for key, values := range c.Request.PostForm {
		if key != "file" && key != "timestamp" && key != "monitor_idx" && len(values) > 0 {
			tags[key] = values[0]
		}
	}

	// Build InfluxDB line protocol
	// Format: measurement,tag1=value1,tag2=value2 field1=value1 timestamp
	var tagStr strings.Builder
	for key, value := range tags {
		if tagStr.Len() > 0 {
			tagStr.WriteString(",")
		}
		// Escape tag values to ensure proper line protocol format
		escapedValue := strings.ReplaceAll(value, ",", "_")
		escapedValue = strings.ReplaceAll(escapedValue, " ", "_")
		escapedValue = strings.ReplaceAll(escapedValue, "=", "_")
		tagStr.WriteString(fmt.Sprintf("%s=%s", key, escapedValue))
	}

	lineProtocol := fmt.Sprintf("screenshots,%s url=\"%s\",key=\"%s\" %d",
		tagStr.String(),
		storageURL,
		storageKey,
		timestamp.UnixNano(),
	)

	// Write to InfluxDB (if available)
	if h.influxService != nil {
		if err := h.influxService.Write(c.Request.Context(), lineProtocol); err != nil {
			// Log error but don't fail the request since file is already uploaded
			c.JSON(http.StatusOK, gin.H{
				"message":        "screenshot uploaded but failed to log to InfluxDB",
				"storage_key":    storageKey,
				"storage_url":    storageURL,
				"influxdb_error": err.Error(),
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "screenshot uploaded successfully",
		"storage_key": storageKey,
		"storage_url": storageURL,
		"org":         org,
		"user":        user,
		"timestamp":   timestamp.Unix(),
	})
}

// GetScreenshot handles GET /screenshots/:timestamp
// Returns the screenshot image for display in browser (uses user from JWT)
// Expects:
// - Authorization header with JWT token (handled by middleware)
// - timestamp path parameter (Unix timestamp in seconds)
// - Optional monitor_idx query parameter (defaults to 0)
func (h *ScreenshotHandler) GetScreenshot(c *gin.Context) {
	// Get user and org from middleware context
	user := middleware.GetUser(c)
	org := middleware.GetOrg(c)

	// Parse timestamp from path parameter
	timestampStr := c.Param("timestamp")
	timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid timestamp"})
		return
	}

	// Parse monitor_idx from query parameter (default to 0)
	monitorIdx := 0
	if idxStr := c.Query("monitor_idx"); idxStr != "" {
		idx, err := strconv.Atoi(idxStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid monitor_idx"})
			return
		}
		monitorIdx = idx
	}

	h.streamScreenshot(c, org, user, timestamp, monitorIdx)
}

// GetScreenshotByUser handles GET /screenshots/:user/:timestamp
// Returns the screenshot image for display in browser (allows specifying user)
// Expects:
// - Authorization header with JWT token (handled by middleware)
// - user path parameter
// - timestamp path parameter (Unix timestamp in seconds)
// - Optional monitor_idx query parameter (defaults to 0)
func (h *ScreenshotHandler) GetScreenshotByUser(c *gin.Context) {
	// Get org from middleware context
	org := middleware.GetOrg(c)

	// Get user from path parameter
	user := c.Param("user")
	if user == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user is required"})
		return
	}

	// Parse timestamp from path parameter
	timestampStr := c.Param("timestamp")
	timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid timestamp"})
		return
	}

	// Parse monitor_idx from query parameter (default to 0)
	monitorIdx := 0
	if idxStr := c.Query("monitor_idx"); idxStr != "" {
		idx, err := strconv.Atoi(idxStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid monitor_idx"})
			return
		}
		monitorIdx = idx
	}

	h.streamScreenshot(c, org, user, timestamp, monitorIdx)
}

// streamScreenshot streams a screenshot from storage to the response
func (h *ScreenshotHandler) streamScreenshot(c *gin.Context, org, user string, timestamp int64, monitorIdx int) {
	// Generate storage key
	storageKey := h.storageService.GetScreenshotKey(org, user, timestamp, monitorIdx)
	log.Printf("DEBUG: Streaming screenshot for key: %s", storageKey)
	// Get object from storage
	body, contentType, err := h.storageService.GetObject(c.Request.Context(), storageKey)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "screenshot not found"})
		return
	}
	defer body.Close()

	// Set content type header for browser display
	c.Header("Content-Type", contentType)

	// Stream the file to the response
	c.Status(http.StatusOK)
	io.Copy(c.Writer, body)
}
