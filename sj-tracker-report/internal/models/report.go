package models

// Report represents the complete generated report
type Report struct {
	Organizations []Organization `json:"organizations"`
	GeneratedAt   string          `json:"generatedAt"` // ISO 8601
	PeriodAnalyzed Period         `json:"periodAnalyzed"`
}

// Organization represents an organization in the report
type Organization struct {
	OrganizationName string       `json:"organizationName"`
	Users            []User       `json:"users"`
	UserRanking      *UserRanking `json:"userRanking,omitempty"` // Only present when there are 2+ users
	// Weekly report specific fields
	WeeklySummary    *WeeklyOrganizationSummary `json:"weeklySummary,omitempty"` // Only present for weekly reports
	WeeklyUserSummaries []WeeklyUserSummary     `json:"weeklyUserSummaries,omitempty"` // Only present for weekly reports
}

// User represents a user in the report
type User struct {
	UserName      string        `json:"userName"`
	OverallReport OverallReport `json:"overallReport"`
	DailyReports  []DailyReport `json:"dailyReports"`
}

// OverallReport represents the overall summary for a user
type OverallReport struct {
	PeriodStart              string  `json:"periodStart"`
	PeriodEnd                string  `json:"periodEnd"`
	TotalActiveHours         float64 `json:"totalActiveHours"`
	TotalActiveMinutes       float64 `json:"totalActiveMinutes"`
	TotalAfkHours            float64 `json:"totalAfkHours"`
	TotalAfkMinutes          float64 `json:"totalAfkMinutes"`
	AverageDailyActiveHours  float64 `json:"averageDailyActiveHours"`
	AverageDailyActiveMinutes float64 `json:"averageDailyActiveMinutes"`
	TotalDiscrepancies       int     `json:"totalDiscrepancies"`
	CriticalDiscrepancies    int     `json:"criticalDiscrepancies"`
	Summary                  string  `json:"summary"`
	Conclusion               string  `json:"conclusion"`
}

// DailyReport represents a daily breakdown
type DailyReport struct {
	Date                string            `json:"date"`
	HourlyBreakdown     []HourlyBreakdown `json:"hourlyBreakdown"`
	TotalActiveMinutes  float64           `json:"totalActiveMinutes"`
	TotalActiveHours    float64           `json:"totalActiveHours"`
	TotalAfkMinutes     float64           `json:"totalAfkMinutes"`
	TotalAfkHours       float64           `json:"totalAfkHours"`
	NotableDiscrepancies []Discrepancy     `json:"notableDiscrepancies"`
	Summary             string            `json:"summary"`
}

// HourlyBreakdown represents an hour's activity breakdown
type HourlyBreakdown struct {
	Hour          int        `json:"hour"` // 0-23
	StartTime     string     `json:"startTime"` // HH:MM
	EndTime       string     `json:"endTime"`   // HH:MM
	ActiveMinutes float64    `json:"activeMinutes"`
	AfkMinutes    float64    `json:"afkMinutes"`
	AppUsage      []AppUsage `json:"appUsage"`
	TimelineEvents []TimelineEvent `json:"timelineEvents,omitempty"` // Screen timeline events for this hour
	TotalMinutes  int        `json:"totalMinutes"` // Always 60
}

// TimelineEvent represents a screen timeline event in the report
type TimelineEvent struct {
	Time            string  `json:"time"`            // ISO 8601 timestamp
	App             string  `json:"app"`             // Application name
	AppTitle        string  `json:"appTitle"`        // Application title
	Description     string  `json:"description"`     // Event description
	ProductiveScore int     `json:"productiveScore"` // Productivity score (0-10)
	DurationSeconds int     `json:"durationSeconds"` // Duration in seconds
}

// AppUsage represents app usage within a time period
type AppUsage struct {
	AppName        string   `json:"appName"`
	DurationMinutes float64 `json:"durationMinutes"`
	WindowTitles   []string `json:"windowTitles,omitempty"`
}

// Discrepancy represents a notable discrepancy in activity
type Discrepancy struct {
	Type           string  `json:"type"` // extended_afk, social_media, etc.
	Severity       string  `json:"severity"` // low, medium, high, critical
	StartTime      string  `json:"startTime"` // HH:MM
	EndTime        string  `json:"endTime"`   // HH:MM
	DurationMinutes float64 `json:"durationMinutes"`
	Description    string  `json:"description"`
	Context        string  `json:"context,omitempty"`
}

// Period represents a time period
type Period struct {
	StartDate string `json:"startDate"` // YYYY-MM-DD
	EndDate   string `json:"endDate"`   // YYYY-MM-DD
}

// UserRanking represents comparative rankings of users
type UserRanking struct {
	Rankings []UserRank `json:"rankings"` // Sorted by rank (1st, 2nd, 3rd, etc.)
	Summary  string     `json:"summary"`  // AI-generated summary of rankings
}

// UserRank represents a single user's ranking
type UserRank struct {
	UserName                string  `json:"userName"`
	Rank                    int     `json:"rank"` // 1 = best, 2 = second, etc.
	TotalActiveHours        float64 `json:"totalActiveHours"`
	AverageDailyActiveHours float64 `json:"averageDailyActiveHours"`
	TotalAfkHours           float64 `json:"totalAfkHours"`
	ActivePercentage        float64 `json:"activePercentage"` // Percentage: totalActive / (totalActive + totalAfk) * 100
	TotalDiscrepancies      int     `json:"totalDiscrepancies"`
	CriticalDiscrepancies   int     `json:"criticalDiscrepancies"`
	Insights                string  `json:"insights,omitempty"` // AI-generated insights for this user's ranking
}

// WeeklyOrganizationSummary represents the overall weekly summary for an organization
type WeeklyOrganizationSummary struct {
	ProductivitySummary string              `json:"productivitySummary"` // Overall week productivity summary
	Top5Employees       []WeeklyUserRank    `json:"top5Employees"`      // Top 5 most productive employees
	Bottom5Employees    []WeeklyUserRank    `json:"bottom5Employees"`  // Bottom 5 least productive employees
}

// WeeklyUserRank represents a user's ranking in the weekly summary
type WeeklyUserRank struct {
	UserName         string  `json:"userName"`
	ActiveHours      float64 `json:"activeHours"`
	ActivityRatio    float64 `json:"activityRatio"`    // active / (active + afk) as percentage
	TotalDiscrepancies int   `json:"totalDiscrepancies"`
	Rank             int     `json:"rank"`              // Rank position (1 = best for top, 1 = worst for bottom)
}

// WeeklyUserSummary represents a condensed user summary for weekly reports
type WeeklyUserSummary struct {
	UserName            string  `json:"userName"`
	ActivityRatio       float64 `json:"activityRatio"`       // active / (active + afk) as percentage
	ActiveHours         float64 `json:"activeHours"`
	ActiveMinutes       float64 `json:"activeMinutes"`
	AfkHours            float64 `json:"afkHours"`
	AfkMinutes          float64 `json:"afkMinutes"`
	TotalDiscrepancies  int     `json:"totalDiscrepancies"`
	CriticalDiscrepancies int   `json:"criticalDiscrepancies"`
	DistractedTimeHours float64 `json:"distractedTimeHours"` // Total time spent on unproductive activities
	DistractedTimeMinutes float64 `json:"distractedTimeMinutes"`
	ProductivitySummary string  `json:"productivitySummary"` // Very short summary highlighting top 3 unproductive things
}

