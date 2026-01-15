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
	Storage  StorageConfig
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

// StorageConfig holds local storage configuration
type StorageConfig struct {
	BasePath string // Base path for storing files locally
	BaseURL  string // Base URL for serving files (e.g., http://localhost:8080/storage)
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
		Storage: StorageConfig{
			BasePath: getEnv("STORAGE_BASE_PATH", "./storage"),
			BaseURL:  getEnv("STORAGE_BASE_URL", "http://localhost:8080/storage"),
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
	if cfg.Storage.BasePath == "" {
		return nil, fmt.Errorf("STORAGE_BASE_PATH is required")
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
