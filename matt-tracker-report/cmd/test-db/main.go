package main

import (
	"fmt"
	"log"
	"matt-tracker-report/internal/config"
	"matt-tracker-report/internal/database"
	"matt-tracker-report/internal/utils"
	"os"
	"time"
)

func main() {
	// Load config
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Parse command line arguments
	if len(os.Args) < 7 {
		fmt.Println("Usage: go run cmd/test-db/main.go <accountID> <orgID> <userID> <startDate> <endDate>")
		fmt.Println("Example: go run cmd/test-db/main.go 1 2 3 2025-11-19 2025-11-20")
		os.Exit(1)
	}

	var accountID, orgID, userID int
	accountID, err = parseInt(os.Args[1])
	if err != nil {
		log.Fatalf("Invalid account ID: %v", err)
	}
	orgID, err = parseInt(os.Args[2])
	if err != nil {
		log.Fatalf("Invalid org ID: %v", err)
	}
	userID, err = parseInt(os.Args[3])
	if err != nil {
		log.Fatalf("Invalid user ID: %v", err)
	}
	startDateStr := os.Args[4]
	endDateStr := os.Args[5]

	// Parse dates
	startDate, err := utils.ParseDate(startDateStr)
	if err != nil {
		log.Fatalf("Invalid start date: %v", err)
	}

	endDate, err := utils.ParseDate(endDateStr)
	if err != nil {
		log.Fatalf("Invalid end date: %v", err)
	}

	// Add one day to endDate to include the full end date
	endDate = endDate.Add(24 * time.Hour)

	fmt.Printf("=== InfluxDB Query Test ===\n\n")
	fmt.Printf("Account ID: %d\n", accountID)
	fmt.Printf("Org ID: %d\n", orgID)
	fmt.Printf("User ID: %d\n", userID)
	fmt.Printf("Start Date: %s\n", startDate.Format("2006-01-02 15:04:05"))
	fmt.Printf("End Date: %s\n", endDate.Format("2006-01-02 15:04:05"))
	fmt.Printf("InfluxDB URL: %s\n", cfg.InfluxDB.URL)
	fmt.Printf("Org: %s\n", cfg.InfluxDB.Org)
	fmt.Printf("Bucket: %s\n", cfg.InfluxDB.Bucket)
	fmt.Printf("\n")

	// Create InfluxDB client
	client, err := database.NewInfluxDBClient(
		cfg.InfluxDB.URL,
		cfg.InfluxDB.Token,
		cfg.InfluxDB.Org,
		cfg.InfluxDB.Bucket,
	)
	if err != nil {
		log.Fatalf("Failed to create InfluxDB client: %v", err)
	}

	// Query AFK Status
	fmt.Println("=== AFK Status Data ===")
	afkData, err := client.QueryAFKStatus(accountID, orgID, userID, startDate, endDate)
	if err != nil {
		log.Printf("ERROR querying AFK status: %v", err)
	} else {
		fmt.Printf("Found %d AFK status records\n\n", len(afkData))
		if len(afkData) > 0 {
			fmt.Println("First 10 records:")
			for i, afk := range afkData {
				if i >= 10 {
					break
				}
				fmt.Printf("  [%d] Time: %s, Status: %s, Duration: %d seconds\n",
					i+1, afk.Time.Format(time.RFC3339), afk.Status, afk.Duration)
			}
			if len(afkData) > 10 {
				fmt.Printf("  ... and %d more records\n", len(afkData)-10)
			}
		}
	}
	fmt.Println()

	// Query Window Activity
	fmt.Println("=== Window Activity Data ===")
	windowData, err := client.QueryWindowActivity(accountID, orgID, userID, startDate, endDate)
	if err != nil {
		log.Printf("ERROR querying window activity: %v", err)
	} else {
		fmt.Printf("Found %d window activity records\n\n", len(windowData))
		if len(windowData) > 0 {
			fmt.Println("First 10 records:")
			for i, window := range windowData {
				if i >= 10 {
					break
				}
				fmt.Printf("  [%d] Time: %s, App: %s, Title: %s, Duration: %d seconds\n",
					i+1, window.Time.Format(time.RFC3339), window.App, window.Title, window.Duration)
			}
			if len(windowData) > 10 {
				fmt.Printf("  ... and %d more records\n", len(windowData)-10)
			}
		}
	}
	fmt.Println()

	// Query App Usage
	fmt.Println("=== App Usage Data ===")
	appData, err := client.QueryAppUsage(accountID, orgID, userID, startDate, endDate)
	if err != nil {
		log.Printf("ERROR querying app usage: %v", err)
	} else {
		fmt.Printf("Found %d app usage records\n\n", len(appData))
		if len(appData) > 0 {
			fmt.Println("First 10 records:")
			for i, app := range appData {
				if i >= 10 {
					break
				}
				fmt.Printf("  [%d] Time: %s, App: %s, Duration: %d seconds, Events: %d\n",
					i+1, app.Time.Format(time.RFC3339), app.AppName, app.DurationSeconds, app.EventCount)
			}
			if len(appData) > 10 {
				fmt.Printf("  ... and %d more records\n", len(appData)-10)
			}
		}
	}
	fmt.Println()

	// Query Daily Metrics
	fmt.Println("=== Daily Metrics Data ===")
	metricsData, err := client.QueryDailyMetrics(accountID, orgID, userID, startDate, endDate)
	if err != nil {
		log.Printf("ERROR querying daily metrics: %v", err)
	} else {
		fmt.Printf("Found %d daily metrics records\n\n", len(metricsData))
		if len(metricsData) > 0 {
			for i, metric := range metricsData {
				fmt.Printf("  [%d] Date: %s, Active: %d seconds, AFK: %d seconds, Idle: %d seconds, Utilization: %.2f\n",
					i+1, metric.Date.Format("2006-01-02"), metric.ActiveSeconds, metric.AfkSeconds, metric.IdleSeconds, metric.UtilizationRatio)
			}
		}
	}
	fmt.Println()

	// Summary
	fmt.Println("=== Summary ===")
	fmt.Printf("Total records retrieved:\n")
	fmt.Printf("  AFK Status: %d\n", len(afkData))
	fmt.Printf("  Window Activity: %d\n", len(windowData))
	fmt.Printf("  App Usage: %d\n", len(appData))
	fmt.Printf("  Daily Metrics: %d\n", len(metricsData))
	
	if len(afkData) == 0 && len(windowData) == 0 {
		fmt.Println("\n⚠️  WARNING: No data found! This could mean:")
		fmt.Println("  1. The date range doesn't have data")
		fmt.Println("  2. The account/org/user ID combination is incorrect")
		fmt.Println("  3. The query format is wrong")
		fmt.Println("  4. There's a connection/authentication issue")
	}
}

// parseInt parses a string to an integer
func parseInt(s string) (int, error) {
	var result int
	_, err := fmt.Sscanf(s, "%d", &result)
	return result, err
}

