package models

import "github.com/golang-jwt/jwt/v5"

// AuthRequest represents the request body for /mock-auth endpoint
type AuthRequest struct {
	User     string `json:"user" binding:"required"`      // User's display name
	UserID   string `json:"user_id" binding:"required"`   // User's ID
	Org      string `json:"org" binding:"required"`         // Organization's display name
	OrgID    string `json:"org_id" binding:"required"`     // Organization's ID
	AccountID string `json:"account_id" binding:"required"` // Account ID
}

// AuthResponse represents the response for /mock-auth endpoint
type AuthResponse struct {
	Token string `json:"token"`
}

// Claims represents JWT claims
type Claims struct {
	User      string `json:"user"`       // User ID (for backward compatibility and uniqueness)
	Org       string `json:"org"`        // Organization ID (for backward compatibility and uniqueness)
	UserID    string `json:"user_id"`    // User ID (explicit field)
	UserName  string `json:"user_name"` // User's display name
	OrgID     string `json:"org_id"`     // Organization ID (explicit field)
	OrgName   string `json:"org_name"`   // Organization's display name
	AccountID string `json:"account_id"` // Account ID
	jwt.RegisteredClaims
}

// WebSocketSession holds session data for an authenticated WebSocket connection
type WebSocketSession struct {
	User string
	Org  string
}
