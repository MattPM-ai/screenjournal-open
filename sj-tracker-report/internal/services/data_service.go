package services

import (
	"fmt"
	"log"
	"sj-tracker-report/internal/database"
	"sj-tracker-report/internal/models"
	"sj-tracker-report/internal/utils"
	"strings"
	"time"
)

// HourlyAggregation represents aggregated data for a specific hour of a specific day
type HourlyAggregation struct {
	Date          string             // YYYY-MM-DD
	Hour          int                // 0-23
	ActiveSeconds int                // Non-AFK seconds in this hour
	AfkSeconds    int                // AFK seconds in this hour
	AppUsage      map[string]AppHourlyUsage // App name -> usage data
	TimelineEvents []TimelineEvent   // Screen timeline events for this hour
}

// TimelineEvent represents a screen timeline event
type TimelineEvent struct {
	Time            time.Time
	App             string
	AppTitle        string
	Description     string
	ProductiveScore int
	DurationSeconds int
	SegmentID       string
}

// AppHourlyUsage represents app usage for a specific hour
type AppHourlyUsage struct {
	DurationSeconds int
	WindowTitles    []string
}

// DataService handles data retrieval and aggregation from InfluxDB
type DataService struct {
	influxClient *database.InfluxDBClient
}

// NewDataService creates a new data service
func NewDataService(influxClient *database.InfluxDBClient) *DataService {
	return &DataService{
		influxClient: influxClient,
	}
}

// QueryAllData queries all InfluxDB measurements for a given user and time range
func (s *DataService) QueryAllData(accountID, orgID, userID int, startDate, endDate time.Time) (
	[]database.AFKStatus,
	[]database.WindowActivity,
	[]database.AppUsageData,
	[]database.DailyMetrics,
	[]database.ScreenTimeline,
	error,
) {
	// Query all measurements in parallel would be ideal, but for simplicity we'll do sequentially
	afkData, err := s.influxClient.QueryAFKStatus(accountID, orgID, userID, startDate, endDate)
	if err != nil {
		return nil, nil, nil, nil, nil, fmt.Errorf("failed to query AFK status: %w", err)
	}

	windowData, err := s.influxClient.QueryWindowActivity(accountID, orgID, userID, startDate, endDate)
	if err != nil {
		return nil, nil, nil, nil, nil, fmt.Errorf("failed to query window activity: %w", err)
	}

	appData, err := s.influxClient.QueryAppUsage(accountID, orgID, userID, startDate, endDate)
	if err != nil {
		return nil, nil, nil, nil, nil, fmt.Errorf("failed to query app usage: %w", err)
	}

	metricsData, err := s.influxClient.QueryDailyMetrics(accountID, orgID, userID, startDate, endDate)
	if err != nil {
		return nil, nil, nil, nil, nil, fmt.Errorf("failed to query daily metrics: %w", err)
	}

	timelineData, err := s.influxClient.QueryScreenTimeline(accountID, orgID, userID, startDate, endDate)
	if err != nil {
		return nil, nil, nil, nil, nil, fmt.Errorf("failed to query screen timeline: %w", err)
	}

	return afkData, windowData, appData, metricsData, timelineData, nil
}

// AggregateDataForAI transforms raw InfluxDB data into a structured format for AI processing
func (s *DataService) AggregateDataForAI(
	afkData []database.AFKStatus,
	windowData []database.WindowActivity,
	appData []database.AppUsageData,
	metricsData []database.DailyMetrics,
	timelineData []database.ScreenTimeline,
) string {
	// Build a comprehensive data context string for the AI
	context := "DATA CONTEXT:\n\n"

	// AFK Status Summary
	context += "AFK STATUS DATA:\n"
	if len(afkData) == 0 {
		context += "No AFK status data found.\n"
	} else {
		totalAFKSeconds := 0
		totalActiveSeconds := 0
		statusCounts := make(map[string]int)
		for _, afk := range afkData {
			statusUpper := strings.ToUpper(strings.TrimSpace(afk.Status))
			statusCounts[afk.Status]++
			if statusUpper == "AFK" {
				totalAFKSeconds += afk.Duration
			} else {
				totalActiveSeconds += afk.Duration
			}
			context += fmt.Sprintf("- Time: %s, Status: '%s', Duration: %d seconds\n",
				afk.Time.Format(time.RFC3339), afk.Status, afk.Duration)
		}
		context += fmt.Sprintf("Total AFK seconds: %d, Total Active seconds: %d\n", totalAFKSeconds, totalActiveSeconds)
		context += fmt.Sprintf("Status values found (with counts): %v\n\n", statusCounts)
	}

	// Window Activity Summary
	context += "WINDOW ACTIVITY DATA:\n"
	if len(windowData) == 0 {
		context += "No window activity data found.\n"
	} else {
		appUsageMap := make(map[string]int)
		windowTitlesMap := make(map[string][]string)
		for _, window := range windowData {
			appUsageMap[window.App] += window.Duration
			if titles, exists := windowTitlesMap[window.App]; exists {
				// Avoid duplicates
				found := false
				for _, title := range titles {
					if title == window.Title {
						found = true
						break
					}
				}
				if !found {
					windowTitlesMap[window.App] = append(titles, window.Title)
				}
			} else {
				windowTitlesMap[window.App] = []string{window.Title}
			}
			context += fmt.Sprintf("- Time: %s, App: %s, Title: %s, Duration: %d seconds\n",
				window.Time.Format(time.RFC3339), window.App, window.Title, window.Duration)
		}
	}
	context += "\n"

	// App Usage Summary
	context += "APP USAGE DATA:\n"
	if len(appData) == 0 {
		context += "No app usage data found.\n"
	} else {
		for _, app := range appData {
			context += fmt.Sprintf("- Time: %s, App: %s, Duration: %d seconds, Events: %d\n",
				app.Time.Format(time.RFC3339), app.AppName, app.DurationSeconds, app.EventCount)
		}
	}
	context += "\n"

	// Daily Metrics Summary
	context += "DAILY METRICS DATA:\n"
	if len(metricsData) == 0 {
		context += "No daily metrics data found.\n"
	} else {
		for _, metric := range metricsData {
			context += fmt.Sprintf("- Date: %s, Active: %d seconds, AFK: %d seconds, Idle: %d seconds, Utilization: %.2f\n",
				metric.Date.Format("2006-01-02"), metric.ActiveSeconds, metric.AfkSeconds, metric.IdleSeconds, metric.UtilizationRatio)
		}
	}
	context += "\n"

	// Screen Timeline Summary
	context += "SCREEN TIMELINE DATA:\n"
	if len(timelineData) == 0 {
		context += "No screen timeline data found.\n"
	} else {
		// Group by segment for better context
		segmentMap := make(map[string][]database.ScreenTimeline)
		for _, timeline := range timelineData {
			segmentMap[timeline.SegmentID] = append(segmentMap[timeline.SegmentID], timeline)
		}

		// Summarize key events and distractions
		lowProductivityCount := 0
		distractionApps := make(map[string]int)
		for _, timeline := range timelineData {
			if timeline.ProductiveScore == 0 {
				lowProductivityCount++
			}
			// Track apps with low productivity scores
			if timeline.ProductiveScore <= 1 {
				distractionApps[timeline.App]++
			}
			context += fmt.Sprintf("- Time: %s, App: %s, Title: %s, Score: %d, Duration: %ds, Description: %s\n",
				timeline.Time.Format(time.RFC3339), timeline.App, timeline.AppTitle, timeline.ProductiveScore,
				timeline.DurationSeconds, truncateString(timeline.Description, 100))
		}
		context += fmt.Sprintf("Total timeline events: %d, Low productivity events (score=0): %d\n", len(timelineData), lowProductivityCount)
		if len(distractionApps) > 0 {
			context += fmt.Sprintf("Apps with low productivity scores: %v\n", distractionApps)
		}
	}
	context += "\n"

	return context
}

// Helper function to truncate strings
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// AggregateHourlyData aggregates AFK, window activity, and timeline data by hour
func (s *DataService) AggregateHourlyData(
	afkData []database.AFKStatus,
	windowData []database.WindowActivity,
	timelineData []database.ScreenTimeline,
	startDate, endDate time.Time,
) map[string]map[int]*HourlyAggregation {
	log.Printf("Aggregating hourly data: %d AFK records, %d window records, %d timeline records, range: %s to %s",
		len(afkData), len(windowData), len(timelineData), startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))

	// Initialize hourly aggregations for all days and hours
	hourlyData := make(map[string]map[int]*HourlyAggregation)

	// Initialize all hours for all days in range
	currentDate := startDate
	for currentDate.Before(endDate) {
		dateStr := utils.FormatDate(currentDate)
		hourlyData[dateStr] = make(map[int]*HourlyAggregation)
		for hour := 0; hour < 24; hour++ {
			hourlyData[dateStr][hour] = &HourlyAggregation{
				Date:          dateStr,
				Hour:          hour,
				ActiveSeconds: 0,
				AfkSeconds:    0,
				AppUsage:      make(map[string]AppHourlyUsage),
				TimelineEvents: []TimelineEvent{},
			}
		}
		log.Printf("Initialized hourly buckets for date: %s", dateStr)
		currentDate = currentDate.Add(24 * time.Hour)
	}

	// Aggregate AFK data by hour
	totalAFKProcessed := 0
	for _, afk := range afkData {
		beforeCount := countTotalSeconds(hourlyData)
		aggregateAFKByHour(afk, hourlyData)
		afterCount := countTotalSeconds(hourlyData)
		if afterCount > beforeCount {
			totalAFKProcessed++
		}
	}
	log.Printf("Processed %d/%d AFK records successfully", totalAFKProcessed, len(afkData))

	// Aggregate window activity by hour
	totalWindowProcessed := 0
	for _, window := range windowData {
		beforeCount := countTotalAppSeconds(hourlyData)
		aggregateWindowActivityByHour(window, hourlyData)
		afterCount := countTotalAppSeconds(hourlyData)
		if afterCount > beforeCount {
			totalWindowProcessed++
		}
	}
	log.Printf("Processed %d/%d window records successfully", totalWindowProcessed, len(windowData))

	// Aggregate timeline events by hour
	totalTimelineProcessed := 0
	for _, timeline := range timelineData {
		aggregateTimelineByHour(timeline, hourlyData)
		totalTimelineProcessed++
	}
	log.Printf("Processed %d/%d timeline records successfully", totalTimelineProcessed, len(timelineData))

	// Log summary of aggregated data
	for date, hours := range hourlyData {
		totalActive := 0
		totalAFK := 0
		for hour := 0; hour < 24; hour++ {
			if hours[hour] != nil {
				totalActive += hours[hour].ActiveSeconds
				totalAFK += hours[hour].AfkSeconds
			}
		}
		log.Printf("Date %s: Total Active: %d seconds, Total AFK: %d seconds", date, totalActive, totalAFK)
	}

	return hourlyData
}

// Helper function to count total seconds for debugging
func countTotalSeconds(hourlyData map[string]map[int]*HourlyAggregation) int {
	total := 0
	for _, hours := range hourlyData {
		for _, agg := range hours {
			if agg != nil {
				total += agg.ActiveSeconds + agg.AfkSeconds
			}
		}
	}
	return total
}

// Helper function to count total app seconds for debugging
func countTotalAppSeconds(hourlyData map[string]map[int]*HourlyAggregation) int {
	total := 0
	for _, hours := range hourlyData {
		for _, agg := range hours {
			if agg != nil {
				for _, usage := range agg.AppUsage {
					total += usage.DurationSeconds
				}
			}
		}
	}
	return total
}

// aggregateAFKByHour distributes an AFK status record across the hours it spans
func aggregateAFKByHour(afk database.AFKStatus, hourlyData map[string]map[int]*HourlyAggregation) {
	startTime := afk.Time
	endTime := startTime.Add(time.Duration(afk.Duration) * time.Second)

	currentTime := startTime
	for currentTime.Before(endTime) {
		// Get the hour bucket for this timestamp
		dateStr := utils.FormatDate(currentTime)
		hour := currentTime.Hour()

		// Calculate the end of the current hour
		hourEnd := time.Date(
			currentTime.Year(),
			currentTime.Month(),
			currentTime.Day(),
			hour+1,
			0,
			0,
			0,
			currentTime.Location(),
		)

		// If the interval extends beyond this hour, only count until hour end
		intervalEnd := endTime
		if endTime.After(hourEnd) {
			intervalEnd = hourEnd
		}

		// Calculate seconds in this hour
		secondsInHour := int(intervalEnd.Sub(currentTime).Seconds())

		// Add to the appropriate bucket - create if it doesn't exist
		if hourlyData[dateStr] == nil {
			hourlyData[dateStr] = make(map[int]*HourlyAggregation)
		}
		if hourlyData[dateStr][hour] == nil {
			hourlyData[dateStr][hour] = &HourlyAggregation{
				Date:          dateStr,
				Hour:          hour,
				ActiveSeconds: 0,
				AfkSeconds:    0,
				AppUsage:      make(map[string]AppHourlyUsage),
				TimelineEvents: []TimelineEvent{},
			}
		}

		// Check status (case-insensitive)
		statusUpper := strings.ToUpper(strings.TrimSpace(afk.Status))
		if statusUpper == "AFK" {
			hourlyData[dateStr][hour].AfkSeconds += secondsInHour
		} else {
			// Any other status (active, not_afk, etc.) counts as active
			hourlyData[dateStr][hour].ActiveSeconds += secondsInHour
		}

		// Move to the next hour
		currentTime = hourEnd
	}
}

// aggregateWindowActivityByHour distributes window activity across the hours it spans
func aggregateWindowActivityByHour(window database.WindowActivity, hourlyData map[string]map[int]*HourlyAggregation) {
	startTime := window.Time
	endTime := startTime.Add(time.Duration(window.Duration) * time.Second)

	currentTime := startTime
	for currentTime.Before(endTime) {
		// Get the hour bucket for this timestamp
		dateStr := utils.FormatDate(currentTime)
		hour := currentTime.Hour()

		// Calculate the end of the current hour
		hourEnd := time.Date(
			currentTime.Year(),
			currentTime.Month(),
			currentTime.Day(),
			hour+1,
			0,
			0,
			0,
			currentTime.Location(),
		)

		// If the interval extends beyond this hour, only count until hour end
		intervalEnd := endTime
		if endTime.After(hourEnd) {
			intervalEnd = hourEnd
		}

		// Calculate seconds in this hour
		secondsInHour := int(intervalEnd.Sub(currentTime).Seconds())

		// Add to the app usage for this hour - create if it doesn't exist
		if hourlyData[dateStr] == nil {
			hourlyData[dateStr] = make(map[int]*HourlyAggregation)
		}
		if hourlyData[dateStr][hour] == nil {
			hourlyData[dateStr][hour] = &HourlyAggregation{
				Date:          dateStr,
				Hour:          hour,
				ActiveSeconds: 0,
				AfkSeconds:    0,
				AppUsage:      make(map[string]AppHourlyUsage),
				TimelineEvents: []TimelineEvent{},
			}
		}

		appUsage := hourlyData[dateStr][hour].AppUsage[window.App]
		appUsage.DurationSeconds += secondsInHour

		// Add window title if not already present
		titleExists := false
		for _, title := range appUsage.WindowTitles {
			if title == window.Title {
				titleExists = true
				break
			}
		}
		if !titleExists && window.Title != "" {
			appUsage.WindowTitles = append(appUsage.WindowTitles, window.Title)
		}

		hourlyData[dateStr][hour].AppUsage[window.App] = appUsage

		// Move to the next hour
		currentTime = hourEnd
	}
}

// aggregateTimelineByHour adds timeline events to the appropriate hour bucket
func aggregateTimelineByHour(timeline database.ScreenTimeline, hourlyData map[string]map[int]*HourlyAggregation) {
	eventTime := timeline.Time
	dateStr := utils.FormatDate(eventTime)
	hour := eventTime.Hour()

	// Ensure the hour bucket exists
	if hourlyData[dateStr] == nil {
		hourlyData[dateStr] = make(map[int]*HourlyAggregation)
	}
	if hourlyData[dateStr][hour] == nil {
		hourlyData[dateStr][hour] = &HourlyAggregation{
			Date:          dateStr,
			Hour:          hour,
			ActiveSeconds: 0,
			AfkSeconds:    0,
			AppUsage:      make(map[string]AppHourlyUsage),
			TimelineEvents: []TimelineEvent{},
		}
	}

	// Add timeline event
	event := TimelineEvent{
		Time:            timeline.Time,
		App:             timeline.App,
		AppTitle:        timeline.AppTitle,
		Description:     timeline.Description,
		ProductiveScore: timeline.ProductiveScore,
		DurationSeconds: timeline.DurationSeconds,
		SegmentID:       timeline.SegmentID,
	}
	hourlyData[dateStr][hour].TimelineEvents = append(hourlyData[dateStr][hour].TimelineEvents, event)
}

// BuildHourlyBreakdownFromAggregation converts hourly aggregated data into HourlyBreakdown models
func (s *DataService) BuildHourlyBreakdownFromAggregation(hourlyData map[string]map[int]*HourlyAggregation) map[string][]models.HourlyBreakdown {
	result := make(map[string][]models.HourlyBreakdown)

	// Sort dates for consistent output
	dates := make([]string, 0, len(hourlyData))
	for date := range hourlyData {
		dates = append(dates, date)
	}
	// Simple sort (assuming YYYY-MM-DD format)
	for i := 0; i < len(dates)-1; i++ {
		for j := i + 1; j < len(dates); j++ {
			if dates[i] > dates[j] {
				dates[i], dates[j] = dates[j], dates[i]
			}
		}
	}

	for _, date := range dates {
		hourlyBreakdowns := make([]models.HourlyBreakdown, 24)
		
		for hour := 0; hour < 24; hour++ {
			agg := hourlyData[date][hour]
			if agg == nil {
				agg = &HourlyAggregation{
					Date:          date,
					Hour:          hour,
					ActiveSeconds: 0,
					AfkSeconds:    0,
					AppUsage:      make(map[string]AppHourlyUsage),
				}
			}

			startTime, endTime := utils.GenerateHourRange(hour)
			
			// Convert app usage map to slice, sorted by duration
			appUsageList := make([]models.AppUsage, 0, len(agg.AppUsage))
			for appName, usage := range agg.AppUsage {
				appUsageList = append(appUsageList, models.AppUsage{
					AppName:         appName,
					DurationMinutes: utils.SecondsToMinutes(usage.DurationSeconds),
					WindowTitles:     usage.WindowTitles,
				})
			}
			// Sort by duration (longest first)
			for i := 0; i < len(appUsageList)-1; i++ {
				for j := i + 1; j < len(appUsageList); j++ {
					if appUsageList[i].DurationMinutes < appUsageList[j].DurationMinutes {
						appUsageList[i], appUsageList[j] = appUsageList[j], appUsageList[i]
					}
				}
			}

			// Convert timeline events to models
			timelineEvents := make([]models.TimelineEvent, 0, len(agg.TimelineEvents))
			for _, event := range agg.TimelineEvents {
				timelineEvents = append(timelineEvents, models.TimelineEvent{
					Time:            event.Time.Format(time.RFC3339),
					App:             event.App,
					AppTitle:        event.AppTitle,
					Description:     event.Description,
					ProductiveScore: event.ProductiveScore,
					DurationSeconds: event.DurationSeconds,
				})
			}

			hourlyBreakdowns[hour] = models.HourlyBreakdown{
				Hour:          hour,
				StartTime:     startTime,
				EndTime:       endTime,
				ActiveMinutes: utils.SecondsToMinutes(agg.ActiveSeconds),
				AfkMinutes:    utils.SecondsToMinutes(agg.AfkSeconds),
				AppUsage:      appUsageList,
				TimelineEvents: timelineEvents,
				TotalMinutes:  60,
			}
		}

		result[date] = hourlyBreakdowns
	}

	return result
}

// FormatHourlyDataForAI formats the hourly aggregated data as a string for the AI
func (s *DataService) FormatHourlyDataForAI(hourlyData map[string]map[int]*HourlyAggregation) string {
	context := "HOURLY BREAKDOWN DATA (Pre-aggregated - USE THIS DATA DIRECTLY):\n\n"

	if len(hourlyData) == 0 {
		context += "No hourly data available.\n\n"
		return context
	}

	// Build structured breakdown
	breakdowns := s.BuildHourlyBreakdownFromAggregation(hourlyData)

	// Format as readable text
	for date, hourlyList := range breakdowns {
		context += fmt.Sprintf("DATE: %s\n", date)
		for _, hourly := range hourlyList {
			context += fmt.Sprintf("  Hour %d (%s-%s): Active: %.2f min, AFK: %.2f min",
				hourly.Hour, hourly.StartTime, hourly.EndTime, hourly.ActiveMinutes, hourly.AfkMinutes)

			if len(hourly.AppUsage) > 0 {
				context += ", Apps: "
				for i, app := range hourly.AppUsage {
					if i > 0 {
						context += ", "
					}
					context += fmt.Sprintf("%s (%.2f min)", app.AppName, app.DurationMinutes)
				}
			}
			// Add timeline events summary
			if len(hourly.TimelineEvents) > 0 {
				context += fmt.Sprintf(", Timeline Events: %d", len(hourly.TimelineEvents))
				// Show key events (low productivity or notable descriptions)
				keyEvents := 0
				for _, event := range hourly.TimelineEvents {
					if event.ProductiveScore <= 1 || len(event.Description) > 50 {
						keyEvents++
					}
				}
				if keyEvents > 0 {
					context += fmt.Sprintf(" (%d notable)", keyEvents)
				}
			}
			context += "\n"
		}
		context += "\n"
	}

	return context
}

