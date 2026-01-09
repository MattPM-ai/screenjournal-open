package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"matt-collector/internal/config"
	"matt-collector/internal/handlers"
	"matt-collector/internal/middleware"
	"matt-collector/internal/services"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize services
	jwtService := services.NewJWTService(cfg.JWT.Secret)

	influxService, err := services.NewInfluxService(
		cfg.InfluxDB.URL,
		cfg.InfluxDB.Token,
		cfg.InfluxDB.Org,
		cfg.InfluxDB.Bucket,
	)
	if err != nil {
		log.Fatalf("Failed to initialize InfluxDB service: %v", err)
	}
	defer influxService.Close()

	s3Service, err := services.NewS3Service(&cfg.S3)
	if err != nil {
		log.Fatalf("Failed to initialize S3 service: %v", err)
	}

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(jwtService)
	timeSeriesHandler := handlers.NewTimeSeriesHandler(jwtService, influxService)
	screenshotHandler := handlers.NewScreenshotHandler(s3Service, influxService)

	// Setup router
	router := setupRouter(jwtService, authHandler, timeSeriesHandler, screenshotHandler)

	// Setup graceful shutdown
	setupGracefulShutdown(influxService)

	// Start server
	addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
	log.Printf("Starting server on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// setupRouter configures the Gin router with all routes
func setupRouter(jwtService *services.JWTService, authHandler *handlers.AuthHandler, timeSeriesHandler *handlers.TimeSeriesHandler, screenshotHandler *handlers.ScreenshotHandler) *gin.Engine {
	router := gin.Default()

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
		})
	})

	// Mock authentication endpoint (protected by backend JWT auth)
	router.POST("/mock-auth", middleware.BackendAuth(), authHandler.MockAuth)

	// WebSocket endpoint for time series data
	router.GET("/time-series", timeSeriesHandler.HandleWebSocket)

	// Protected routes (require JWT authentication)
	protected := router.Group("/")
	protected.Use(middleware.JWTAuth(jwtService))
	{
		// Screenshot endpoints
		protected.POST("/screenshots", screenshotHandler.UploadScreenshot)
		protected.GET("/screenshots/me/:timestamp", screenshotHandler.GetScreenshot)
		protected.GET("/screenshots/:user/:timestamp", screenshotHandler.GetScreenshotByUser)
	}

	return router
}

// setupGracefulShutdown handles cleanup on application termination
func setupGracefulShutdown(influxService *services.InfluxService) {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Shutting down gracefully...")
		influxService.Close()
		os.Exit(0)
	}()
}
