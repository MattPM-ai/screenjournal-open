package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"matt-tracker-report/internal/config"
	"matt-tracker-report/internal/models"
	"net/url"
	"sort"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MongoDBClient wraps MongoDB client for report caching
type MongoDBClient struct {
	client                *mongo.Client
	database              *mongo.Database
	collection            *mongo.Collection
	weeklyReportsCollection *mongo.Collection
	optedAccountsCollection *mongo.Collection
}

// CachedReport represents a cached report document in MongoDB
type CachedReport struct {
	CacheKey     string          `bson:"_id" json:"cacheKey"`
	Org          string          `bson:"org" json:"org"`
	OrgID        int             `bson:"orgId" json:"orgId"`
	Users        []models.UserRequest `bson:"users" json:"users"`
	StartDate    string          `bson:"startDate" json:"startDate"`
	EndDate      string          `bson:"endDate" json:"endDate"`
	Report       models.Report   `bson:"report" json:"report"`
	CreatedAt    time.Time       `bson:"createdAt" json:"createdAt"`
	LastAccessed time.Time       `bson:"lastAccessed" json:"lastAccessed"`
}

// NewMongoDBClient creates a new MongoDB client for report caching
func NewMongoDBClient(cfg config.MongoDBConfig) (*MongoDBClient, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Build connection URI
	uri := cfg.URI
	if uri == "" {
		// Build URI from components if URI not provided
		if cfg.Username != "" && cfg.Password != "" {
			// Use url.UserPassword to properly encode username and password
			userInfo := url.UserPassword(cfg.Username, cfg.Password)
			// URI with authentication: mongodb://username:password@host:port/database?authSource=admin
			uri = fmt.Sprintf("mongodb://%s@%s:%s/%s?authSource=%s",
				userInfo.String(),
				cfg.Host,
				cfg.Port,
				cfg.Database,
				url.QueryEscape(cfg.AuthSource),
			)
		} else {
			// URI without authentication: mongodb://host:port/database
			uri = fmt.Sprintf("mongodb://%s:%s/%s",
				cfg.Host,
				cfg.Port,
				cfg.Database,
			)
		}
	}

	// Log connection attempt (mask password for security)
	logURI := uri
	if cfg.Password != "" && cfg.Username != "" {
		// Mask password in log
		userInfo := url.User(cfg.Username) // User without password for logging
		authSource := cfg.AuthSource
		if authSource == "" {
			authSource = "admin"
		}
		logURI = fmt.Sprintf("mongodb://%s:***@%s:%s/%s?authSource=%s",
			userInfo.String(), cfg.Host, cfg.Port, cfg.Database, url.QueryEscape(authSource))
	}
	log.Printf("Attempting to connect to MongoDB at %s", logURI)

	// Create MongoDB client
	clientOptions := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB at %s: %w", logURI, err)
	}

	// Ping to verify connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB at %s: %w", logURI, err)
	}

	database := client.Database(cfg.Database)
	collection := database.Collection(cfg.Collection)
	weeklyReportsCollection := database.Collection("weekly_reports")
	optedAccountsCollection := database.Collection("opted-accounts")

	// Create index on cacheKey for faster lookups (regular reports)
	indexModel := mongo.IndexModel{
		Keys: bson.D{{Key: "_id", Value: 1}},
	}
	_, err = collection.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		// Index might already exist, that's okay
		fmt.Printf("Note: MongoDB index creation: %v\n", err)
	}

	// Create index on cacheKey for faster lookups (weekly reports)
	_, err = weeklyReportsCollection.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		// Index might already exist, that's okay
		fmt.Printf("Note: MongoDB weekly reports index creation: %v\n", err)
	}

	// Create indexes for opted-accounts collection (accountId and orgId for faster lookups)
	accountIndexModel := mongo.IndexModel{
		Keys: bson.D{{Key: "accountId", Value: 1}, {Key: "orgId", Value: 1}},
		Options: options.Index().SetUnique(true), // Ensure one entry per account+org combination
	}
	_, err = optedAccountsCollection.Indexes().CreateOne(ctx, accountIndexModel)
	if err != nil {
		// Index might already exist, that's okay
		fmt.Printf("Note: MongoDB opted-accounts index creation: %v\n", err)
	}

	return &MongoDBClient{
		client:                client,
		database:              database,
		collection:            collection,
		weeklyReportsCollection: weeklyReportsCollection,
		optedAccountsCollection: optedAccountsCollection,
	}, nil
}

// Close closes the MongoDB client connection
func (c *MongoDBClient) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return c.client.Disconnect(ctx)
}

// GenerateCacheKey generates a unique cache key from report request parameters
func GenerateCacheKey(org string, orgID int, users []models.UserRequest, startDate, endDate string) string {
	// Sort users by ID to ensure consistent cache keys
	sortedUsers := make([]models.UserRequest, len(users))
	copy(sortedUsers, users)
	sort.Slice(sortedUsers, func(i, j int) bool {
		return sortedUsers[i].ID < sortedUsers[j].ID
	})

	// Create a unique string from all parameters
	// Format: org:orgId:user1Id,user1Name:user2Id,user2Name:startDate:endDate
	userStrings := make([]string, len(sortedUsers))
	for i, user := range sortedUsers {
		userStrings[i] = fmt.Sprintf("%d:%s", user.ID, user.Name)
	}
	keyData := fmt.Sprintf("%s:%d:%v:%s:%s", org, orgID, userStrings, startDate, endDate)
	
	// Hash the key data to create a fixed-length cache key
	hash := sha256.Sum256([]byte(keyData))
	return hex.EncodeToString(hash[:])
}

// GetCachedReport retrieves a cached report from MongoDB
func (c *MongoDBClient) GetCachedReport(cacheKey string) (*models.Report, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var cached CachedReport
	err := c.collection.FindOne(ctx, bson.M{"_id": cacheKey}).Decode(&cached)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // No cached report found
		}
		return nil, fmt.Errorf("failed to query cached report: %w", err)
	}

	// Update lastAccessed timestamp
	update := bson.M{"$set": bson.M{"lastAccessed": time.Now()}}
	_, err = c.collection.UpdateOne(ctx, bson.M{"_id": cacheKey}, update)
	if err != nil {
		// Log but don't fail - the report is still valid
		fmt.Printf("WARNING: Failed to update lastAccessed for cache key %s: %v\n", cacheKey, err)
	}

	return &cached.Report, nil
}

// CacheReport stores a report in MongoDB
func (c *MongoDBClient) CacheReport(
	org string,
	orgID int,
	users []models.UserRequest,
	startDate, endDate string,
	report *models.Report,
) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cacheKey := GenerateCacheKey(org, orgID, users, startDate, endDate)
	now := time.Now()

	cached := CachedReport{
		CacheKey:     cacheKey,
		Org:          org,
		OrgID:        orgID,
		Users:        users,
		StartDate:    startDate,
		EndDate:      endDate,
		Report:       *report,
		CreatedAt:    now,
		LastAccessed: now,
	}

	// Use upsert to replace existing cached report if it exists
	opts := options.Update().SetUpsert(true)
	filter := bson.M{"_id": cacheKey}
	update := bson.M{"$set": cached}

	_, err := c.collection.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		return fmt.Errorf("failed to cache report: %w", err)
	}

	return nil
}

// DeleteCachedReport deletes a cached report from MongoDB
func (c *MongoDBClient) DeleteCachedReport(cacheKey string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := c.collection.DeleteOne(ctx, bson.M{"_id": cacheKey})
	if err != nil {
		return fmt.Errorf("failed to delete cached report: %w", err)
	}

	return nil
}

// GetCachedWeeklyReport retrieves a cached weekly report from MongoDB
func (c *MongoDBClient) GetCachedWeeklyReport(cacheKey string) (*models.Report, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var cached CachedReport
	err := c.weeklyReportsCollection.FindOne(ctx, bson.M{"_id": cacheKey}).Decode(&cached)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // No cached report found
		}
		return nil, fmt.Errorf("failed to query cached weekly report: %w", err)
	}

	// Update lastAccessed timestamp
	update := bson.M{"$set": bson.M{"lastAccessed": time.Now()}}
	_, err = c.weeklyReportsCollection.UpdateOne(ctx, bson.M{"_id": cacheKey}, update)
	if err != nil {
		// Log but don't fail - the report is still valid
		fmt.Printf("WARNING: Failed to update lastAccessed for weekly report cache key %s: %v\n", cacheKey, err)
	}

	return &cached.Report, nil
}

// CacheWeeklyReport stores a weekly report in MongoDB
func (c *MongoDBClient) CacheWeeklyReport(
	org string,
	orgID int,
	users []models.UserRequest,
	startDate, endDate string,
	report *models.Report,
) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cacheKey := GenerateCacheKey(org, orgID, users, startDate, endDate)
	now := time.Now()

	cached := CachedReport{
		CacheKey:     cacheKey,
		Org:          org,
		OrgID:        orgID,
		Users:        users,
		StartDate:    startDate,
		EndDate:      endDate,
		Report:       *report,
		CreatedAt:    now,
		LastAccessed: now,
	}

	// Use upsert to replace existing cached report if it exists
	opts := options.Update().SetUpsert(true)
	filter := bson.M{"_id": cacheKey}
	update := bson.M{"$set": cached}

	_, err := c.weeklyReportsCollection.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		return fmt.Errorf("failed to cache weekly report: %w", err)
	}

	return nil
}

// DeleteCachedWeeklyReport deletes a cached weekly report from MongoDB
func (c *MongoDBClient) DeleteCachedWeeklyReport(cacheKey string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := c.weeklyReportsCollection.DeleteOne(ctx, bson.M{"_id": cacheKey})
	if err != nil {
		return fmt.Errorf("failed to delete cached weekly report: %w", err)
	}

	return nil
}

// OptedAccount represents an account that has opted into weekly email reports
type OptedAccount struct {
	AccountID      int                 `bson:"accountId" json:"accountId"`
	OrgID          int                 `bson:"orgId" json:"orgId"`
	OrgName        string              `bson:"orgName" json:"orgName"`
	Email          string              `bson:"email" json:"email"` // Account owner email
	Users          []models.UserRequest `bson:"users" json:"users"` // Users to include in the report
	OptedInAt      time.Time           `bson:"optedInAt" json:"optedInAt"`
	NextTriggerTime *time.Time         `bson:"nextTriggerTime,omitempty" json:"nextTriggerTime,omitempty"` // Optional override for testing
}

// AddOptedAccount adds an account to the opted-in collection
func (c *MongoDBClient) AddOptedAccount(accountID, orgID int, orgName, email string, users []models.UserRequest, nextTriggerTime *time.Time) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	optedAccount := OptedAccount{
		AccountID:       accountID,
		OrgID:           orgID,
		OrgName:         orgName,
		Email:           email,
		Users:           users,
		OptedInAt:       time.Now(),
		NextTriggerTime: nextTriggerTime,
	}

	// Use upsert to replace existing entry if it exists
	opts := options.Update().SetUpsert(true)
	filter := bson.M{"accountId": accountID, "orgId": orgID}
	update := bson.M{"$set": optedAccount}

	_, err := c.optedAccountsCollection.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		return fmt.Errorf("failed to add opted account: %w", err)
	}

	return nil
}

// RemoveOptedAccount removes an account from the opted-in collection
func (c *MongoDBClient) RemoveOptedAccount(accountID, orgID int) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := c.optedAccountsCollection.DeleteOne(ctx, bson.M{"accountId": accountID, "orgId": orgID})
	if err != nil {
		return fmt.Errorf("failed to remove opted account: %w", err)
	}

	return nil
}

// GetAllOptedAccounts retrieves all accounts that have opted into weekly reports
func (c *MongoDBClient) GetAllOptedAccounts() ([]OptedAccount, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := c.optedAccountsCollection.Find(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("failed to query opted accounts: %w", err)
	}
	defer cursor.Close(ctx)

	var accounts []OptedAccount
	if err := cursor.All(ctx, &accounts); err != nil {
		return nil, fmt.Errorf("failed to decode opted accounts: %w", err)
	}

	return accounts, nil
}

// GetOptedAccount retrieves a specific opted account
func (c *MongoDBClient) GetOptedAccount(accountID, orgID int) (*OptedAccount, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var account OptedAccount
	err := c.optedAccountsCollection.FindOne(ctx, bson.M{"accountId": accountID, "orgId": orgID}).Decode(&account)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // Not found
		}
		return nil, fmt.Errorf("failed to query opted account: %w", err)
	}

	return &account, nil
}

// GetOptedAccountsByAccountID retrieves all opted-in organizations for a specific account
func (c *MongoDBClient) GetOptedAccountsByAccountID(accountID int) ([]OptedAccount, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := c.optedAccountsCollection.Find(ctx, bson.M{"accountId": accountID})
	if err != nil {
		return nil, fmt.Errorf("failed to query opted accounts: %w", err)
	}
	defer cursor.Close(ctx)

	var accounts []OptedAccount
	if err := cursor.All(ctx, &accounts); err != nil {
		return nil, fmt.Errorf("failed to decode opted accounts: %w", err)
	}

	return accounts, nil
}

