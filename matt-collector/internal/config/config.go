package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all application configuration
type Config struct {
	Server   ServerConfig
	JWT      JWTConfig
	InfluxDB InfluxDBConfig
	S3       S3Config
}

// ServerConfig holds server-related configuration
type ServerConfig struct {
	Port string
	Host string
}

// JWTConfig holds JWT-related configuration
type JWTConfig struct {
	Secret string
}

// InfluxDBConfig holds InfluxDB connection details
type InfluxDBConfig struct {
	URL      string
	Token    string
	User     string
	Password string
	Org      string
	Bucket   string
}

// S3Config holds S3 connection details
type S3Config struct {
	Bucket          string
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	Endpoint        string // Optional: for S3-compatible services like MinIO
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	// Load .env file if it exists (ignore error if file doesn't exist)
	_ = godotenv.Load()

	cfg := &Config{
		Server: ServerConfig{
			Port: getEnv("SERVER_PORT", "8080"),
			Host: getEnv("SERVER_HOST", "0.0.0.0"),
		},
		JWT: JWTConfig{
			Secret: getEnv("JWT_SECRET", "your-secret-key-change-in-production"),
		},
		InfluxDB: InfluxDBConfig{
			URL:      getEnv("INFLUXDB2_URL", ""),
			Token:    getEnv("INFLUXDB2_TOKEN", ""),
			User:     getEnv("INFLUXDB2_USER", ""),
			Password: getEnv("INFLUXDB2_PASSWORD", ""),
			Org:      getEnv("INFLUXDB2_ORG", ""),
			Bucket:   getEnv("INFLUXDB2_BUCKET", ""),
		},
		S3: S3Config{
			Bucket:          getEnv("S3_BUCKET", ""),
			Region:          getEnv("S3_REGION", "us-east-1"),
			AccessKeyID:     getEnv("S3_ACCESS_KEY_ID", ""),
			SecretAccessKey: getEnv("S3_SECRET_ACCESS_KEY", ""),
			Endpoint:        getEnv("S3_ENDPOINT", ""), // Optional for MinIO/custom S3
		},
	}

	// Validate required fields
	if cfg.InfluxDB.URL == "" {
		return nil, fmt.Errorf("INFLUXDB2_URL is required")
	}
	if cfg.InfluxDB.Token == "" {
		return nil, fmt.Errorf("INFLUXDB2_TOKEN is required")
	}
	if cfg.InfluxDB.Org == "" {
		return nil, fmt.Errorf("INFLUXDB2_ORG is required")
	}
	if cfg.InfluxDB.Bucket == "" {
		return nil, fmt.Errorf("INFLUXDB2_BUCKET is required")
	}
	if cfg.S3.Bucket == "" {
		return nil, fmt.Errorf("S3_BUCKET is required")
	}
	if cfg.S3.AccessKeyID == "" {
		return nil, fmt.Errorf("S3_ACCESS_KEY_ID is required")
	}
	if cfg.S3.SecretAccessKey == "" {
		return nil, fmt.Errorf("S3_SECRET_ACCESS_KEY is required")
	}

	return cfg, nil
}

// getEnv retrieves an environment variable or returns a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
