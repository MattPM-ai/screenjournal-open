package services

import (
	"fmt"
	"log"
	"matt-tracker-report/internal/database"
	"matt-tracker-report/internal/models"
	"matt-tracker-report/internal/utils"
	"time"

	"github.com/robfig/cron/v3"
)

// WeeklyEmailService handles scheduled weekly report email sending
type WeeklyEmailService struct {
	reportService *ReportService
	emailService  *EmailService
	pdfService    *PDFService
	mongoClient   *database.MongoDBClient
	cron          *cron.Cron
}

// NewWeeklyEmailService creates a new weekly email service
func NewWeeklyEmailService(
	reportService *ReportService,
	emailService *EmailService,
	pdfService *PDFService,
	mongoClient *database.MongoDBClient,
) *WeeklyEmailService {
	// Create cron with seconds precision
	c := cron.New(cron.WithSeconds())

	return &WeeklyEmailService{
		reportService: reportService,
		emailService:  emailService,
		pdfService:    pdfService,
		mongoClient:   mongoClient,
		cron:          c,
	}
}

// Start starts the cron scheduler
func (s *WeeklyEmailService) Start() {
	s.cron.Start()
	log.Println("Weekly email cron scheduler started")
}

// Stop stops the cron scheduler
func (s *WeeklyEmailService) Stop() {
	s.cron.Stop()
	log.Println("Weekly email cron scheduler stopped")
}

// ScheduleWeeklyReport schedules a weekly report email for a specific account/org
// If nextTriggerTime is provided, schedules recurring weekly at that time (day of week, hour, minute, second)
// Otherwise, schedules for every Monday at 00:00:00
func (s *WeeklyEmailService) ScheduleWeeklyReport(accountID, orgID int, orgName, email string, nextTriggerTime *time.Time) (cron.EntryID, error) {
	var schedule string
	
	if nextTriggerTime != nil {
		// Use the provided time to create a recurring weekly schedule
		// Extract: second, minute, hour, and weekday from the provided time
		second := nextTriggerTime.Second()
		minute := nextTriggerTime.Minute()
		hour := nextTriggerTime.Hour()
		weekday := int(nextTriggerTime.Weekday()) // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
		
		// Cron format with seconds: second minute hour day month weekday
		// For weekly: use * for day and month, and the specific weekday
		schedule = fmt.Sprintf("%d %d %d * * %d", second, minute, hour, weekday)
		
		log.Printf("Scheduling weekly report for account %d, org %d (%s) at %s (recurring weekly) - email: %s", 
			accountID, orgID, orgName, nextTriggerTime.Format("Monday 15:04:05"), email)
	} else {
		// Default: Schedule for Monday at 00:00:00 (start of week)
		schedule = "0 0 0 * * 1" // cron format: second minute hour day month weekday (1 = Monday)
		
		log.Printf("Scheduling weekly report for account %d, org %d (%s) at Monday 00:00:00 (default) - email: %s", 
			accountID, orgID, orgName, email)
	}

	entryID, err := s.cron.AddFunc(schedule, func() {
		s.sendWeeklyReportForAccount(accountID, orgID, orgName, email)
	})

	if err != nil {
		return 0, fmt.Errorf("failed to schedule weekly report: %w", err)
	}

	log.Printf("Successfully scheduled weekly report for account %d, org %d with schedule: %s", accountID, orgID, schedule)
	return entryID, nil
}

// UnscheduleWeeklyReport removes a scheduled weekly report
func (s *WeeklyEmailService) UnscheduleWeeklyReport(entryID cron.EntryID) {
	s.cron.Remove(entryID)
	log.Printf("Unscheduled weekly report (entry ID: %d)", entryID)
}

// sendWeeklyReportForAccount generates and sends weekly report for an account
func (s *WeeklyEmailService) sendWeeklyReportForAccount(accountID, orgID int, orgName, email string) {
	log.Printf("Generating weekly report for account %d, org %d (%s)", accountID, orgID, orgName)

	// Get opted account to retrieve users
	optedAccount, err := s.mongoClient.GetOptedAccount(accountID, orgID)
	if err != nil {
		log.Printf("ERROR: Failed to get opted account for account %d, org %d: %v", accountID, orgID, err)
		return
	}

	if optedAccount == nil {
		log.Printf("WARNING: Opted account not found for account %d, org %d, skipping report", accountID, orgID)
		return
	}

	if len(optedAccount.Users) == 0 {
		log.Printf("WARNING: No users found for opted account %d, org %d, skipping report", accountID, orgID)
		return
	}

	// Determine the week period based on nextTriggerTime if available
	var weekStartDate time.Time
	var customStartDate, customEndDate *string
	
	if optedAccount.NextTriggerTime != nil {
		// Use the exact 7-day period ending at nextTriggerTime
		// Calculate start as 7 days before the trigger time
		periodStart := optedAccount.NextTriggerTime.AddDate(0, 0, -7)
		
		// Format as ISO 8601 for custom dates
		startStr := periodStart.Format(time.RFC3339)
		endStr := optedAccount.NextTriggerTime.Format(time.RFC3339)
		customStartDate = &startStr
		customEndDate = &endStr
		
		// Also set WeekStartDate for compatibility (date portion of start)
		weekStartDate = periodStart
		
		log.Printf("Using custom trigger time period: %s to %s (exact 7-day period)", 
			startStr, endStr)
	} else {
		// Default: Calculate last week's Monday (7 days ago, then find Monday of that week)
		lastWeekMonday := time.Now().AddDate(0, 0, -7)
		weekStartDate, _ = utils.CalculateWeekRange(lastWeekMonday)
		log.Printf("Using default Monday-Sunday period: %s", utils.FormatDate(weekStartDate))
	}

	// Create weekly report request
	request := models.GenerateWeeklyReportRequest{
		AccountID:      accountID,
		OrgID:          orgID,
		Org:            orgName,
		WeekStartDate:  utils.FormatDate(weekStartDate),
		CustomStartDate: customStartDate,
		CustomEndDate:   customEndDate,
		Users:          optedAccount.Users,
	}

	// Generate report synchronously
	report, err := s.reportService.GenerateWeeklyReportSync(request)
	if err != nil {
		log.Printf("ERROR: Failed to generate weekly report for account %d, org %d: %v", accountID, orgID, err)
		return
	}

	// Generate PDF
	pdfData, err := s.pdfService.GenerateWeeklyReportPDF(report)
	if err != nil {
		log.Printf("ERROR: Failed to generate PDF for account %d, org %d: %v", accountID, orgID, err)
		// Continue without PDF attachment
		pdfData = nil
	}

	// Send email
	err = s.emailService.SendWeeklyReportEmail(email, orgName, report, pdfData)
	if err != nil {
		log.Printf("ERROR: Failed to send weekly report email to %s for account %d, org %d: %v", email, accountID, orgID, err)
		return
	}

	log.Printf("Successfully sent weekly report email to %s for account %d, org %d", email, accountID, orgID)
}

// SendWeeklyReportEmailForWeek sends a weekly report email for a specific week (manual trigger)
func (s *WeeklyEmailService) SendWeeklyReportEmailForWeek(
	accountID, orgID int,
	orgName, email string,
	users []models.UserRequest,
	weekStartDate string,
) error {
	log.Printf("Manually generating weekly report for account %d, org %d (%s), week: %s", accountID, orgID, orgName, weekStartDate)

	// Create weekly report request
	request := models.GenerateWeeklyReportRequest{
		AccountID:    accountID,
		OrgID:        orgID,
		Org:          orgName,
		WeekStartDate: weekStartDate,
		Users:        users,
	}

	// Generate report synchronously
	report, err := s.reportService.GenerateWeeklyReportSync(request)
	if err != nil {
		return fmt.Errorf("failed to generate weekly report: %w", err)
	}

	// Generate PDF
	pdfData, err := s.pdfService.GenerateWeeklyReportPDF(report)
	if err != nil {
		log.Printf("WARNING: Failed to generate PDF for account %d, org %d: %v, continuing without PDF", accountID, orgID, err)
		// Continue without PDF attachment
		pdfData = nil
	}

	// Send email
	err = s.emailService.SendWeeklyReportEmail(email, orgName, report, pdfData)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("Successfully sent weekly report email to %s for account %d, org %d, week: %s", email, accountID, orgID, weekStartDate)
	return nil
}

// LoadAndScheduleOptedAccounts loads all opted-in accounts from MongoDB and schedules them
func (s *WeeklyEmailService) LoadAndScheduleOptedAccounts() error {
	if s.mongoClient == nil {
		return fmt.Errorf("MongoDB client not available")
	}

	accounts, err := s.mongoClient.GetAllOptedAccounts()
	if err != nil {
		return fmt.Errorf("failed to load opted accounts: %w", err)
	}

	log.Printf("Loading %d opted-in accounts for weekly reports", len(accounts))

	for _, account := range accounts {
		_, err := s.ScheduleWeeklyReport(account.AccountID, account.OrgID, account.OrgName, account.Email, account.NextTriggerTime)
		if err != nil {
			log.Printf("WARNING: Failed to schedule weekly report for account %d, org %d: %v", 
				account.AccountID, account.OrgID, err)
			continue
		}
	}

	log.Printf("Successfully scheduled %d weekly report emails", len(accounts))
	return nil
}

