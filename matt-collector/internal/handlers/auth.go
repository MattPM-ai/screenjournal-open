package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"matt-collector/internal/middleware"
	"matt-collector/internal/models"
	"matt-collector/internal/services"

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

// MockAuth generates a JWT token for the authenticated backend user
// POST /mock-auth
// Requires: Authorization header with valid backend JWT token
// Request body: {
//   "user": "User Name",           // User's display name
//   "user_id": "123",              // User's ID (must match authenticated backend user)
//   "org": "Organization Name",    // Organization's display name
//   "org_id": "456",               // Organization's ID
//   "account_id": "789"             // Account ID
// }
// Response: {"token": "jwt-token-string"}
func (h *AuthHandler) MockAuth(c *gin.Context) {
	// Get the authenticated backend user ID from context
	backendUserId := middleware.GetBackendUserId(c)
	backendClaims := middleware.GetBackendClaims(c)
	
	log.Printf("[AUTH] MockAuth: Request received")
	
	if backendUserId == "" {
		log.Printf("[AUTH] MockAuth: Backend authentication missing")
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "Unauthorized",
			"message": "Backend authentication required",
		})
		return
	}

	// Log backend claims if available
	if backendClaims != nil {
		log.Printf("[AUTH] MockAuth: Backend JWT Claims - userId=%s, email=%s, iat=%v, exp=%v",
			backendClaims.UserId,
			backendClaims.Email,
			backendClaims.IssuedAt,
			backendClaims.ExpiresAt,
		)
	}
	log.Printf("[AUTH] MockAuth: Authenticated backend userId=%s", backendUserId)

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

	// SECURITY: Validate that the requested user_id matches the authenticated backend user
	// This prevents users from generating tokens for other users
	log.Printf("[AUTH] MockAuth: Comparing user_id - request.user_id=%s, backend.userId=%s",
		req.UserID,
		backendUserId,
	)
	
	if req.UserID != backendUserId {
		log.Printf("[AUTH] MockAuth: VALIDATION FAILED - user_id mismatch (request=%s, backend=%s)",
			req.UserID,
			backendUserId,
		)
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "Forbidden",
			"message": fmt.Sprintf("user_id in request (%s) does not match authenticated user (%s)", req.UserID, backendUserId),
		})
		return
	}

	log.Printf("[AUTH] MockAuth: VALIDATION PASSED - user_id matches (userId=%s)", backendUserId)

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
