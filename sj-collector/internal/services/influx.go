package services

import (
	"context"
	"fmt"
	"log"
	"strings"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
)

// InfluxService handles writing data to InfluxDB
type InfluxService struct {
	client     influxdb2.Client
	writeAPI   api.WriteAPIBlocking
	org        string
	bucket     string
}

// NewInfluxService creates a new InfluxDB service
func NewInfluxService(url, token, org, bucket string) (*InfluxService, error) {
	log.Printf("[INFLUX-INIT] Initializing InfluxDB 2.0 client: url=%s, org=%s, bucket=%s", url, org, bucket)
	
	// Create InfluxDB 2.0 client
	client := influxdb2.NewClient(url, token)
	
	// Test connection health
	health, err := client.Health(context.Background())
	if err != nil {
		log.Printf("[INFLUX-ERROR] Failed to check InfluxDB health: %v", err)
		client.Close()
		return nil, fmt.Errorf("failed to connect to InfluxDB: %w", err)
	}
	if health.Status != "pass" {
		log.Printf("[INFLUX-WARN] InfluxDB health check returned status: %s", health.Status)
	}
	
	// Get write API for the specified org and bucket
	writeAPI := client.WriteAPIBlocking(org, bucket)
	
	log.Printf("[INFLUX-INIT] InfluxDB 2.0 client initialized successfully")
	return &InfluxService{
		client:   client,
		writeAPI: writeAPI,
		org:      org,
		bucket:   bucket,
	}, nil
}

// Write writes line protocol data to InfluxDB as-is (without adding tags)
func (s *InfluxService) Write(ctx context.Context, lineProtocol string) error {
	err := s.writeAPI.WriteRecord(ctx, lineProtocol)
	if err != nil {
		return fmt.Errorf("failed to write to InfluxDB: %w", err)
	}
	return nil
}

// WriteLineProtocol writes line protocol data to InfluxDB
// It appends user, org, and all additional metadata tags to the line protocol
func (s *InfluxService) WriteLineProtocol(ctx context.Context, lineProtocol, user, org string) error {
	// For backward compatibility, call the new method with empty strings for new fields
	return s.WriteLineProtocolWithDetails(ctx, lineProtocol, user, org, "", "", "", "", "")
}

// WriteLineProtocolWithDetails writes line protocol data to InfluxDB with full metadata
// It appends user (name), org (name), user_id, org_id, account_id, user_name, and org_name tags to the line protocol
// user and org parameters should be the display names, userID and orgID should be the IDs
func (s *InfluxService) WriteLineProtocolWithDetails(ctx context.Context, lineProtocol, user, org, userID, orgID, accountID, userName, orgName string) error {
	// DEBUG: Log all parameters received
	log.Printf("[DEBUG-INFLUX] WriteLineProtocolWithDetails called with:")
	log.Printf("[DEBUG-INFLUX]   lineProtocol: %q", lineProtocol)
	log.Printf("[DEBUG-INFLUX]   user: %q", user)
	log.Printf("[DEBUG-INFLUX]   org: %q", org)
	log.Printf("[DEBUG-INFLUX]   userID: %q", userID)
	log.Printf("[DEBUG-INFLUX]   orgID: %q", orgID)
	log.Printf("[DEBUG-INFLUX]   accountID: %q", accountID)
	log.Printf("[DEBUG-INFLUX]   userName: %q", userName)
	log.Printf("[DEBUG-INFLUX]   orgName: %q", orgName)

	// Parse and modify line protocol to add all tags
	// Note: user and org should be names, not IDs. If userName/orgName are provided, use those for user/org tags
	enhancedLine := s.addTagsToLineProtocol(lineProtocol, user, org, userID, orgID, accountID, userName, orgName)

	// Debug logging to verify tags are being added
	log.Printf("[DEBUG-INFLUX] Enhanced line protocol result: %q", enhancedLine)

	// Write to InfluxDB
	log.Printf("[INFLUX-WRITE] Attempting to write to InfluxDB, org=%s, bucket=%s", s.org, s.bucket)
	err := s.writeAPI.WriteRecord(ctx, enhancedLine)
	if err != nil {
		log.Printf("[INFLUX-ERROR] Failed to write to InfluxDB: %v", err)
		log.Printf("[INFLUX-ERROR] Original input: %q", lineProtocol)
		log.Printf("[INFLUX-ERROR] Enhanced output: %q", enhancedLine)
		log.Printf("[INFLUX-ERROR] Org: %s, Bucket: %s", s.org, s.bucket)
		return fmt.Errorf("failed to write to InfluxDB: %w", err)
	}

	// Log successful write
	log.Printf("[INFLUX-SUCCESS] Successfully wrote data to InfluxDB, org=%s, bucket=%s", s.org, s.bucket)
	return nil
}

// addTagsToLineProtocol adds user, org, and all additional metadata tags to the line protocol
// Prepends tags right after the measurement name for better query performance
// Line protocol format: measurement,tag1=value1,tag2=value2 field1=value1,field2=value2 timestamp
// user and org should be the display names (not IDs)
func (s *InfluxService) addTagsToLineProtocol(lineProtocol, user, org, userID, orgID, accountID, userName, orgName string) string {
	log.Printf("[DEBUG-ADDTAGS] addTagsToLineProtocol called")
	log.Printf("[DEBUG-ADDTAGS]   user param: %q", user)
	log.Printf("[DEBUG-ADDTAGS]   org param: %q", org)
	log.Printf("[DEBUG-ADDTAGS]   userName param: %q", userName)
	log.Printf("[DEBUG-ADDTAGS]   orgName param: %q", orgName)

	lineProtocol = strings.TrimSpace(lineProtocol)

	// Build tag string with all metadata
	var tags []string

	// Use names for user and org tags (prefer userName/orgName if provided, otherwise use user/org)
	userTagValue := user
	if userName != "" {
		userTagValue = userName
	}
	log.Printf("[DEBUG-ADDTAGS] userTagValue (before escape): %q", userTagValue)

	if userTagValue != "" {
		escapedUser := s.escapeTagValue(userTagValue)
		log.Printf("[DEBUG-ADDTAGS] userTagValue (after escape): %q", escapedUser)
		tags = append(tags, fmt.Sprintf("user=%s", escapedUser))
	}

	orgTagValue := org
	if orgName != "" {
		orgTagValue = orgName
	}
	log.Printf("[DEBUG-ADDTAGS] orgTagValue (before escape): %q", orgTagValue)

	if orgTagValue != "" {
		escapedOrg := s.escapeTagValue(orgTagValue)
		log.Printf("[DEBUG-ADDTAGS] orgTagValue (after escape): %q", escapedOrg)
		tags = append(tags, fmt.Sprintf("org=%s", escapedOrg))
	}

	// Add ID fields if provided
	if userID != "" {
		escapedUserID := s.escapeTagValue(userID)
		log.Printf("[DEBUG-ADDTAGS] userID (after escape): %q", escapedUserID)
		tags = append(tags, fmt.Sprintf("user_id=%s", escapedUserID))
	}
	if orgID != "" {
		escapedOrgID := s.escapeTagValue(orgID)
		log.Printf("[DEBUG-ADDTAGS] orgID (after escape): %q", escapedOrgID)
		tags = append(tags, fmt.Sprintf("org_id=%s", escapedOrgID))
	}
	if accountID != "" {
		escapedAccountID := s.escapeTagValue(accountID)
		log.Printf("[DEBUG-ADDTAGS] accountID (after escape): %q", escapedAccountID)
		tags = append(tags, fmt.Sprintf("account_id=%s", escapedAccountID))
	}

	tagStr := strings.Join(tags, ",")
	log.Printf("[DEBUG-ADDTAGS] Built tag string: %q", tagStr)

	// Find the measurement name (everything before first comma)
	commaIdx := strings.Index(lineProtocol, ",")
	if commaIdx == -1 {
		// Line protocol consists of just measurement name
		result := fmt.Sprintf("%s,%s", lineProtocol, tagStr)
		log.Printf("[DEBUG-ADDTAGS] Final result (no existing tags): %q", result)
		return result
	}

	// Prepend tags right after measurement name
	measurement := lineProtocol[:commaIdx]
	restPart := lineProtocol[commaIdx:] // includes existing tags and fields
	log.Printf("[DEBUG-ADDTAGS] measurement: %q", measurement)
	log.Printf("[DEBUG-ADDTAGS] restPart: %q", restPart)

	result := fmt.Sprintf("%s,%s%s", measurement, tagStr, restPart)
	log.Printf("[DEBUG-ADDTAGS] Final result: %q", result)
	return result
}

// escapeTagValue escapes special characters in tag values for InfluxDB line protocol
// InfluxDB tag values should not contain commas, spaces, or equals signs
func (s *InfluxService) escapeTagValue(value string) string {
	log.Printf("[DEBUG-ESCAPE] escapeTagValue called with: %q (len=%d, bytes=%v)", value, len(value), []byte(value))

	// Replace problematic characters with underscores
	original := value
	value = strings.ReplaceAll(value, ",", "_")
	if value != original {
		log.Printf("[DEBUG-ESCAPE]   After comma replacement: %q", value)
	}

	original = value
	value = strings.ReplaceAll(value, " ", "_")
	if value != original {
		log.Printf("[DEBUG-ESCAPE]   After space replacement: %q", value)
	}

	original = value
	value = strings.ReplaceAll(value, "=", "_")
	if value != original {
		log.Printf("[DEBUG-ESCAPE]   After equals replacement: %q", value)
	}

	log.Printf("[DEBUG-ESCAPE] escapeTagValue returning: %q", value)
	return value
}

// Close closes the InfluxDB client connection
func (s *InfluxService) Close() error {
	if s.client != nil {
		s.client.Close()
	}
	return nil
}
