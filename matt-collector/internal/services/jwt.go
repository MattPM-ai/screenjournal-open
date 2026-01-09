package services

import (
	"fmt"
	"time"

	"matt-collector/internal/models"

	"github.com/golang-jwt/jwt/v5"
)

// JWTService handles JWT token generation and validation
type JWTService struct {
	secret []byte
}

// NewJWTService creates a new JWT service
func NewJWTService(secret string) *JWTService {
	return &JWTService{
		secret: []byte(secret),
	}
}

// GenerateToken generates a JWT token for the given user and org
// This method is kept for backward compatibility but is deprecated
// Use GenerateTokenWithDetails instead
func (s *JWTService) GenerateToken(user, org string) (string, error) {
	return s.GenerateTokenWithDetails(user, org, "", "", "", "", "")
}

// GenerateTokenWithDetails generates a JWT token with full user/org/account details
// userID and orgID are used for the user/org fields in the token (for backward compatibility)
// user and org are the display names, accountID is the account identifier
func (s *JWTService) GenerateTokenWithDetails(userID, orgID, userName, orgName, accountID, user, org string) (string, error) {
	// Use IDs for user and org fields to maintain backward compatibility
	// If userID/orgID are empty, fall back to user/org (for backward compatibility)
	if userID == "" {
		userID = user
	}
	if orgID == "" {
		orgID = org
	}

	// Create claims with all fields
	claims := &models.Claims{
		User:      userID,   // User ID (for backward compatibility)
		Org:       orgID,    // Organization ID (for backward compatibility)
		UserID:    userID,   // User ID (explicit field)
		UserName:  userName, // User's display name
		OrgID:     orgID,    // Organization ID (explicit field)
		OrgName:   orgName,  // Organization's display name
		AccountID: accountID, // Account ID
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)), // Token valid for 24 hours
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	// Create token with claims
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Sign the token with secret
	tokenString, err := token.SignedString(s.secret)
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, nil
}

// ValidateToken validates a JWT token and returns the claims
func (s *JWTService) ValidateToken(tokenString string) (*models.Claims, error) {
	// Parse and validate token
	token, err := jwt.ParseWithClaims(tokenString, &models.Claims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.secret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	// Extract claims
	claims, ok := token.Claims.(*models.Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}
