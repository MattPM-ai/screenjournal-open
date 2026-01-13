package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"matt-collector/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins for development - customize for production
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// TimeSeriesHandler handles WebSocket connections for time series data
type TimeSeriesHandler struct {
	jwtService    *services.JWTService
	influxService *services.InfluxService
}

// NewTimeSeriesHandler creates a new time series handler
func NewTimeSeriesHandler(jwtService *services.JWTService, influxService *services.InfluxService) *TimeSeriesHandler {
	return &TimeSeriesHandler{
		jwtService:    jwtService,
		influxService: influxService,
	}
}

// logConnectionMetrics logs structured connection health data
func logConnectionMetrics(connectionID, event, user, org string, metadata map[string]interface{}) {
	logMsg := fmt.Sprintf("[COLLECTOR-SERVER] %s: connection_id=%s, user=%s, org=%s",
		event, connectionID, user, org)

	if len(metadata) > 0 {
		logMsg += fmt.Sprintf(", metadata=%v", metadata)
	}

	log.Printf(logMsg)
}

// HandleWebSocket handles WebSocket connections for streaming time series data
// GET /time-series
// WebSocket protocol:
// 1. Client sends: $AUTH <jwt-token>
// 2. Server validates token and extracts user/org
// 3. Client sends line protocol data
// 4. Server appends user/org tags and writes to InfluxDB
func (h *TimeSeriesHandler) HandleWebSocket(c *gin.Context) {
	log.Printf("[WEBSOCKET] HandleWebSocket: Connection attempt from %s", c.ClientIP())
	
	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[WEBSOCKET] HandleWebSocket: Failed to upgrade connection - %v", err)
		return
	}
	log.Printf("[WEBSOCKET] HandleWebSocket: Connection upgraded successfully")
	defer conn.Close()

	// Wait for authentication message
	log.Printf("[WEBSOCKET] HandleWebSocket: Waiting for authentication message...")
	session, err := h.authenticate(conn)
	if err != nil {
		log.Printf("[WEBSOCKET] HandleWebSocket: Authentication failed - %v", err)
		conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("ERROR: %v", err)))
		return
	}
	log.Printf("[WEBSOCKET] HandleWebSocket: Authentication successful for user=%s, org=%s", session.User, session.Org)

	// Send authentication success message
	err = conn.WriteMessage(websocket.TextMessage, []byte("AUTH_SUCCESS"))
	if err != nil {
		log.Printf("Failed to send auth success message: %v", err)
		return
	}

	// Generate connection ID for tracking
	connectionID := uuid.New().String()

	// Log connection establishment
	log.Printf("WebSocket session authenticated: user=%s, org=%s, connection_id=%s",
		session.User, session.Org, connectionID)
	logConnectionMetrics(connectionID, "CONNECTION_ESTABLISHED", session.User, session.Org,
		map[string]interface{}{"timestamp": time.Now().Format(time.RFC3339)})

	// Configure Ping handler - manually respond to client pings
	conn.SetPingHandler(func(appData string) error {
		log.Printf("[COLLECTOR-SERVER] PING_RECEIVED: connection_id=%s, user=%s", connectionID, session.User)

		// Extend read deadline
		if err := conn.SetReadDeadline(time.Now().Add(60 * time.Second)); err != nil {
			log.Printf("Failed to extend read deadline: %v", err)
		}

		// Manually send Pong response (required when using custom PingHandler)
		if err := conn.WriteControl(websocket.PongMessage, []byte(appData), time.Now().Add(10*time.Second)); err != nil {
			log.Printf("Failed to send Pong response: %v", err)
			return err
		}

		log.Printf("[COLLECTOR-SERVER] PONG_SENT: connection_id=%s, user=%s", connectionID, session.User)

		return nil
	})

	// Configure Pong handler - receives pongs from client (for future server-initiated pings)
	conn.SetPongHandler(func(appData string) error {
		log.Printf("[COLLECTOR-SERVER] PONG_RECEIVED: connection_id=%s, user=%s",
			connectionID, session.User)

		// Extend read deadline
		if err := conn.SetReadDeadline(time.Now().Add(60 * time.Second)); err != nil {
			log.Printf("Failed to extend read deadline: %v", err)
		}

		return nil
	})

	// Set initial read deadline
	if err := conn.SetReadDeadline(time.Now().Add(60 * time.Second)); err != nil {
		log.Printf("Failed to set initial read deadline: %v", err)
		return
	}

	// Handle incoming messages
	h.handleMessages(conn, session, connectionID)
}

// Session holds all authentication data from JWT claims
type Session struct {
	User      string // User ID (for backward compatibility)
	Org       string // Organization ID (for backward compatibility)
	UserID    string // User ID (explicit field)
	UserName  string // User's display name
	OrgID     string // Organization ID (explicit field)
	OrgName   string // Organization's display name
	AccountID string // Account ID
}

// authenticate waits for and validates the $AUTH message
func (h *TimeSeriesHandler) authenticate(conn *websocket.Conn) (*Session, error) {
	log.Printf("[WEBSOCKET] authenticate: Waiting to read message...")
	
	// Read first message (should be $AUTH <token>)
	messageType, message, err := conn.ReadMessage()
	if err != nil {
		log.Printf("[WEBSOCKET] authenticate: ReadMessage failed - %v (type=%v)", err, messageType)
		return nil, fmt.Errorf("failed to read auth message: %w", err)
	}
	
	log.Printf("[WEBSOCKET] authenticate: Message received - type=%v, length=%d, content=%s", messageType, len(message), string(message))

	if messageType != websocket.TextMessage {
		return nil, fmt.Errorf("expected text message for authentication")
	}

	// Parse $AUTH command
	msgStr := strings.TrimSpace(string(message))
	if !strings.HasPrefix(msgStr, "$AUTH ") {
		return nil, fmt.Errorf("first message must be $AUTH <token>")
	}

	// Extract token
	token := strings.TrimSpace(strings.TrimPrefix(msgStr, "$AUTH "))
	if token == "" {
		return nil, fmt.Errorf("token is required")
	}

	// Validate token
	claims, err := h.jwtService.ValidateToken(token)
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	// DEBUG: Log all claims from JWT token
	log.Printf("[DEBUG-AUTH] JWT Claims received:")
	log.Printf("[DEBUG-AUTH]   claims.User: %q", claims.User)
	log.Printf("[DEBUG-AUTH]   claims.Org: %q", claims.Org)
	log.Printf("[DEBUG-AUTH]   claims.UserID: %q", claims.UserID)
	log.Printf("[DEBUG-AUTH]   claims.UserName: %q", claims.UserName)
	log.Printf("[DEBUG-AUTH]   claims.OrgID: %q", claims.OrgID)
	log.Printf("[DEBUG-AUTH]   claims.OrgName: %q", claims.OrgName)
	log.Printf("[DEBUG-AUTH]   claims.AccountID: %q", claims.AccountID)

	// Return session data with all fields from claims
	return &Session{
		User:      claims.User,      // User ID (for backward compatibility)
		Org:       claims.Org,       // Organization ID (for backward compatibility)
		UserID:    claims.UserID,    // User ID (explicit field)
		UserName:  claims.UserName,  // User's display name
		OrgID:     claims.OrgID,     // Organization ID (explicit field)
		OrgName:   claims.OrgName,   // Organization's display name
		AccountID: claims.AccountID, // Account ID
	}, nil
}

// handleMessages processes incoming line protocol messages
func (h *TimeSeriesHandler) handleMessages(conn *websocket.Conn, session *Session, connectionID string) {
	ctx := context.Background()
	startTime := time.Now()
	messagesProcessed := 0

	for {
		// Read message
		messageType, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Handle different message types
		// Note: Ping/Pong messages are handled by SetPingHandler/SetPongHandler
		// ReadMessage() only returns TextMessage or BinaryMessage
		// CloseMessage is not returned by ReadMessage - close events cause error returns
		switch messageType {
		case websocket.TextMessage:
			// Process line protocol data
			lineProtocol := strings.TrimSpace(string(message))
			if lineProtocol == "" {
				log.Printf("[DATA] Received empty message, skipping")
				continue
			}

			// Extract measurement type from line protocol
			// Line protocol format: measurement,tag1=value1 field1=value1 timestamp
			measurementType := "unknown"
			if commaIdx := strings.Index(lineProtocol, ","); commaIdx > 0 {
				measurementType = lineProtocol[:commaIdx]
			} else if spaceIdx := strings.Index(lineProtocol, " "); spaceIdx > 0 {
				// Handle case with no tags: measurement field1=value1
				measurementType = lineProtocol[:spaceIdx]
			} else {
				// Fallback: use entire line if no separators found
				measurementType = lineProtocol
			}

			// Log every data reception with measurement type
			log.Printf("[DATA] Received data - type=%s, user=%s, org=%s, connection_id=%s, length=%d",
				measurementType,
				session.User,
				session.Org,
				connectionID,
				len(lineProtocol),
			)
			
			// Log full line protocol for debugging (truncate if too long)
			linePreview := lineProtocol
			if len(lineProtocol) > 200 {
				linePreview = lineProtocol[:200] + "..."
			}
			log.Printf("[DATA] Line protocol preview: %s", linePreview)

			// Write to InfluxDB with all metadata tags (if available)
			// user and org tags should be names, not IDs
			if h.influxService != nil {
				err = h.influxService.WriteLineProtocolWithDetails(
					ctx,
					lineProtocol,
					session.UserName,  // user (display name)
					session.OrgName,   // org (display name)
					session.UserID,    // user_id
					session.OrgID,     // org_id
					session.AccountID, // account_id
					session.UserName,  // user_name (same as user tag)
					session.OrgName,   // org_name (same as org tag)
				)
				if err != nil {
					log.Printf("[ERROR] Failed to write to InfluxDB: %v", err)
					log.Printf("[ERROR] Problematic line protocol: %q", lineProtocol)
					log.Printf("[ERROR] User: %q, Org: %q, UserID: %q, OrgID: %q, AccountID: %q",
						session.User, session.Org, session.UserID, session.OrgID, session.AccountID)
					// Send error back to client
					errMsg := fmt.Sprintf("ERROR: %v", err)
					conn.WriteMessage(websocket.TextMessage, []byte(errMsg))
					continue
				}
			} else {
				log.Printf("[WARN] InfluxDB not available - data received but not persisted: type=%s, user=%s, org=%s",
					measurementType, session.User, session.Org)
			}

			// Send acknowledgment
			if err := conn.WriteMessage(websocket.TextMessage, []byte("OK")); err != nil {
				log.Printf("[ERROR] Failed to send OK acknowledgment: connection_id=%s, user=%s, error=%v",
					connectionID, session.User, err)
				break // Connection is dead, exit message loop
			}
			log.Printf("[ACK] Sent OK acknowledgment: connection_id=%s, user=%s", connectionID, session.User)
			messagesProcessed++

			// Extend read deadline after successful data processing
			// This keeps the connection alive during active data transmission
			if err := conn.SetReadDeadline(time.Now().Add(60 * time.Second)); err != nil {
				log.Printf("[WARN] Failed to extend read deadline: %v", err)
			}

		default:
			// Log unexpected message type
			log.Printf("[COLLECTOR-SERVER] UNEXPECTED_MESSAGE_TYPE: connection_id=%s, user=%s, type=%d",
				connectionID, session.User, messageType)
		}
	}

	// Log connection closure with metrics
	duration := time.Since(startTime)
	log.Printf("WebSocket connection closed for user=%s, org=%s, connection_id=%s",
		session.User, session.Org, connectionID)
	logConnectionMetrics(connectionID, "CONNECTION_CLOSED", session.User, session.Org,
		map[string]interface{}{
			"duration_seconds":   duration.Seconds(),
			"messages_processed": messagesProcessed,
			"timestamp":          time.Now().Format(time.RFC3339),
		})
}
