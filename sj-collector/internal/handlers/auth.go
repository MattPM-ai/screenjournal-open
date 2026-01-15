package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"sj-collector/internal/models"
	"sj-collector/internal/services"

	"github.com/gin-gonic/gin"
)

// AuthHandler handles authentication-related endpoints
type AuthHandler struct {
	jwtService *services.JWTService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(jwtService *services.JWTService) *AuthHandler {
	return &AuthHandler{
		jwtService: jwtService,
	}
}

// MockAuth generates a JWT token for the collector
// POST /mock-auth
// No authentication required - for desktop app use
// Request body: {
//   "user": "User Name",           // User's display name
//   "user_id": "123",              // User's ID
//   "org": "Organization Name",    // Organization's display name
//   "org_id": "456",               // Organization's ID
//   "account_id": "789"             // Account ID
// }
// Response: {"token": "jwt-token-string"}
func (h *AuthHandler) MockAuth(c *gin.Context) {
	log.Printf("[AUTH] MockAuth: Request received (no backend auth required)")

	var req models.AuthRequest

	// Bind JSON request body
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[AUTH] MockAuth: Invalid request body - %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Log request body for debugging
	reqJSON, _ := json.Marshal(req)
	log.Printf("[AUTH] MockAuth: Request body - %s", string(reqJSON))
	log.Printf("[AUTH] MockAuth: Request values - user=%s, user_id=%s, org=%s, org_id=%s, account_id=%s",
		req.User,
		req.UserID,
		req.Org,
		req.OrgID,
		req.AccountID,
	)

	// Validate required fields
	if req.UserID == "" {
		log.Printf("[AUTH] MockAuth: VALIDATION FAILED - user_id is required")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "user_id is required",
		})
		return
	}

	log.Printf("[AUTH] MockAuth: VALIDATION PASSED - generating token for user_id=%s", req.UserID)

	// Generate JWT token with all details
	// Use IDs for user/org fields in token (for backward compatibility and uniqueness)
	log.Printf("[AUTH] MockAuth: Generating token with - userID=%s, orgID=%s, userName=%s, orgName=%s, accountID=%s",
		req.UserID,
		req.OrgID,
		req.User,
		req.Org,
		req.AccountID,
	)
	
	token, err := h.jwtService.GenerateTokenWithDetails(
		req.UserID,   // userID
		req.OrgID,    // orgID
		req.User,     // userName (display name)
		req.Org,      // orgName (display name)
		req.AccountID, // accountID
		"",           // user (fallback, not used when userID is provided)
		"",           // org (fallback, not used when orgID is provided)
	)
	if err != nil {
		log.Printf("[AUTH] MockAuth: Token generation failed - %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate token",
			"details": err.Error(),
		})
		return
	}

	log.Printf("[AUTH] MockAuth: Token generated successfully (length=%d)", len(token))
	
	// Return token
	c.JSON(http.StatusOK, models.AuthResponse{
		Token: token,
	})
}
