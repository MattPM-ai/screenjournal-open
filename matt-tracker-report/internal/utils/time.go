package utils

import (
	"math"
	"time"
)

// FormatTime formats a time.Time as HH:MM in 24-hour format
func FormatTime(t time.Time) string {
	return t.Format("15:04")
}

// FormatDate formats a time.Time as YYYY-MM-DD
func FormatDate(t time.Time) string {
	return t.Format("2006-01-02")
}

// SecondsToMinutes converts seconds to minutes, rounded to 2 decimal places
func SecondsToMinutes(seconds int) float64 {
	return math.Round(float64(seconds)/60.0*100) / 100
}

// MinutesToHours converts minutes to hours, rounded to 2 decimal places
func MinutesToHours(minutes float64) float64 {
	return math.Round(minutes/60.0*100) / 100
}

// ParseDate parses a date string in YYYY-MM-DD format
func ParseDate(dateStr string) (time.Time, error) {
	return time.Parse("2006-01-02", dateStr)
}

// GenerateHourRange generates start and end time strings for a given hour (0-23)
func GenerateHourRange(hour int) (startTime, endTime string) {
	start := time.Date(2000, 1, 1, hour, 0, 0, 0, time.UTC)
	end := time.Date(2000, 1, 1, hour+1, 0, 0, 0, time.UTC)
	return FormatTime(start), FormatTime(end)
}

// CalculateWeekRange calculates the Monday (start) and Sunday (end) of the week containing the given date
// If the given date is already a Monday, it returns that Monday and the following Sunday
// Otherwise, it finds the Monday of that week and returns Monday to Sunday
func CalculateWeekRange(weekStartDate time.Time) (monday time.Time, sunday time.Time) {
	// Get the weekday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
	weekday := int(weekStartDate.Weekday())
	
	// Convert to Monday = 0, Tuesday = 1, ..., Sunday = 6
	if weekday == 0 {
		weekday = 7 // Sunday becomes 7
	}
	daysFromMonday := weekday - 1
	
	// Calculate Monday of the week
	monday = weekStartDate.AddDate(0, 0, -daysFromMonday)
	monday = time.Date(monday.Year(), monday.Month(), monday.Day(), 0, 0, 0, 0, monday.Location())
	
	// Calculate Sunday (6 days after Monday)
	sunday = monday.AddDate(0, 0, 6)
	sunday = time.Date(sunday.Year(), sunday.Month(), sunday.Day(), 23, 59, 59, 999999999, sunday.Location())
	
	return monday, sunday
}

