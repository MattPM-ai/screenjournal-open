package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all application configuration
type Config struct {
	InfluxDB InfluxDBConfig
	OpenAI   OpenAIConfig
	Server   ServerConfig
	MongoDB  MongoDBConfig
	Email    EmailConfig
}

// InfluxDBConfig holds InfluxDB connection details
type InfluxDBConfig struct {
	URL      string
	Token    string
	User     string // Optional for InfluxDB 2.x
	Password string // Optional for InfluxDB 2.x
	Org      string
	Bucket   string
}

// OpenAIConfig holds OpenAI API configuration
type OpenAIConfig struct {
	APIKey     string
	Model      string
	Temperature float64
	MaxTokens  int
}

// ServerConfig holds server configuration
type ServerConfig struct {
	Port string
	Host string
}

// MongoDBConfig holds MongoDB connection details
type MongoDBConfig struct {
	URI        string
	Username   string
	Password   string
	Host       string
	Port       string
	Database   string
	Collection string
	AuthSource string // Database to authenticate against (default: admin)
}

// EmailConfig holds SendGrid email configuration
// Note: Email functionality is disabled in the open source version
type EmailConfig struct {
	APIKey   string
	FromEmail string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() (*Config, error) {
	// Try to load .env file (ignore error if it doesn't exist)
	_ = godotenv.Load()

	config := &Config{
		InfluxDB: InfluxDBConfig{
			URL:      getEnv("INFLUXDB2_URL", "http://localhost:8086"),
			Token:    getEnv("INFLUXDB2_TOKEN", ""),
			User:     getEnv("INFLUXDB2_USER", ""),
			Password: getEnv("INFLUXDB2_PASSWORD", ""),
			Org:      getEnv("INFLUXDB2_ORG", ""),
			Bucket:   getEnv("INFLUXDB2_BUCKET", ""),
		},
		OpenAI: OpenAIConfig{
			APIKey:      getEnv("OPENAI_API_KEY", ""),
			Model:       getEnv("OPENAI_MODEL", "gpt-4o-mini"),
			Temperature: getEnvFloat("OPENAI_TEMPERATURE", 0.3),
			MaxTokens:   getEnvInt("OPENAI_MAX_TOKENS", 0), // 0 means no limit (or use max for model)
		},
		Server: ServerConfig{
			Port: getEnv("PORT", "8085"),
			Host: getEnv("HOST", "0.0.0.0"),
		},
		MongoDB: MongoDBConfig{
			URI:        getEnv("MONGODB_URI", ""),
			Username:   getEnv("MONGODB_USERNAME", ""),
			Password:   getEnv("MONGODB_PASSWORD", ""),
			Host:       getEnv("MONGODB_HOST", "localhost"),
			Port:       getEnv("MONGODB_PORT", "27017"),
			Database:   getEnv("MONGODB_DATABASE", "reports"),
			Collection: getEnv("MONGODB_COLLECTION", "reports"),
			AuthSource: getEnv("MONGODB_AUTH_SOURCE", "admin"),
		},
		Email: EmailConfig{
			APIKey:   getEnv("SENDGRID_API_KEY", ""),
			FromEmail: getEnv("SENDGRID_FROM_EMAIL", ""), // Email disabled in open source version
		},
	}

	if err := ValidateConfig(config); err != nil {
		return nil, err
	}

	return config, nil
}

// ValidateConfig validates that required configuration values are present
func ValidateConfig(config *Config) error {
	// For InfluxDB 2.x: token is required (or user/password)
	if config.InfluxDB.Token == "" && (config.InfluxDB.User == "" || config.InfluxDB.Password == "") {
		return fmt.Errorf("INFLUXDB2_TOKEN is required (or INFLUXDB2_USER and INFLUXDB2_PASSWORD)")
	}
	// For InfluxDB 2.x: bucket and org are required
	if config.InfluxDB.Bucket == "" {
		return fmt.Errorf("INFLUXDB2_BUCKET is required")
	}
	if config.InfluxDB.Org == "" {
		return fmt.Errorf("INFLUXDB2_ORG is required")
	}
	// OpenAI API key is no longer required - users provide Gemini API keys per-request
	// The OpenAI config struct is still used for model/temperature settings
	return nil
}

// Helper functions for environment variable access
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}

