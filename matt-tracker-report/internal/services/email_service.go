package services

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"matt-tracker-report/internal/config"
	"matt-tracker-report/internal/models"

	"github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
)

// EmailService handles email sending via SendGrid
type EmailService struct {
	apiKey    string
	fromEmail string
	client    *sendgrid.Client
}

// NewEmailService creates a new email service
func NewEmailService(cfg config.EmailConfig) *EmailService {
	client := sendgrid.NewSendClient(cfg.APIKey)
	return &EmailService{
		apiKey:    cfg.APIKey,
		fromEmail: cfg.FromEmail,
		client:    client,
	}
}

// SendWeeklyReportEmail sends a weekly report email with PDF attachment
func (s *EmailService) SendWeeklyReportEmail(
	toEmail string,
	orgName string,
	report *models.Report,
	pdfData []byte,
) error {
	// Create email message
	from := mail.NewEmail("Matt Tracker", s.fromEmail)
	to := mail.NewEmail("", toEmail)
	subject := fmt.Sprintf("Weekly Productivity Report - %s", orgName)

	// Create HTML email body
	htmlContent := s.buildWeeklyReportEmailHTML(orgName, report)
	plainTextContent := s.buildWeeklyReportEmailText(orgName, report)

	message := mail.NewSingleEmail(from, subject, to, plainTextContent, htmlContent)

	// Attach PDF
	if len(pdfData) > 0 {
		attachment := mail.NewAttachment()
		attachment.SetContent(base64.StdEncoding.EncodeToString(pdfData))
		attachment.SetType("application/pdf")
		attachment.SetFilename(fmt.Sprintf("weekly-report-%s.pdf", report.PeriodAnalyzed.StartDate))
		attachment.SetDisposition("attachment")
		message.AddAttachment(attachment)
	}

	// Send email
	response, err := s.client.Send(message)
	if err != nil {
		return fmt.Errorf("failed to send email via SendGrid: %w", err)
	}

	if response.StatusCode >= 400 {
		return fmt.Errorf("SendGrid API error: status %d, body: %s", response.StatusCode, response.Body)
	}

	return nil
}

// buildWeeklyReportEmailHTML builds the HTML content for the weekly report email
func (s *EmailService) buildWeeklyReportEmailHTML(orgName string, report *models.Report) string {
	var html bytes.Buffer

	html.WriteString(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #0066cc; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
        .summary-box { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #0066cc; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="header">
        <h1 style="margin: 0;">Weekly Productivity Report</h1>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">` + orgName + `</p>
    </div>
    <div class="content">
        <p>Hello,</p>
        <p>Your weekly productivity report for <strong>` + report.PeriodAnalyzed.StartDate + `</strong> to <strong>` + report.PeriodAnalyzed.EndDate + `</strong> is ready.</p>`)

	if len(report.Organizations) > 0 && report.Organizations[0].WeeklySummary != nil {
		summary := report.Organizations[0].WeeklySummary
		if summary.ProductivitySummary != "" {
			html.WriteString(`
        <div class="summary-box">
            <h3 style="margin-top: 0; color: #0066cc;">Organization Summary</h3>
            <p>` + summary.ProductivitySummary + `</p>
        </div>`)
		}
	}

	html.WriteString(`
        <p>The complete report is attached as a PDF document.</p>
        <p>Best regards,<br>Matt Tracker Team</p>
    </div>
    <div class="footer">
        <p>This is an automated email. Please do not reply.</p>
        <p>Generated on ` + report.GeneratedAt + `</p>
    </div>
</body>
</html>`)

	return html.String()
}

// buildWeeklyReportEmailText builds the plain text content for the weekly report email
func (s *EmailService) buildWeeklyReportEmailText(orgName string, report *models.Report) string {
	var text bytes.Buffer

	text.WriteString(fmt.Sprintf(`Weekly Productivity Report
%s

Hello,

Your weekly productivity report for %s to %s is ready.

`, orgName, report.PeriodAnalyzed.StartDate, report.PeriodAnalyzed.EndDate))

	if len(report.Organizations) > 0 && report.Organizations[0].WeeklySummary != nil {
		summary := report.Organizations[0].WeeklySummary
		if summary.ProductivitySummary != "" {
			text.WriteString(fmt.Sprintf(`Organization Summary:
%s

`, summary.ProductivitySummary))
		}
	}

	text.WriteString(`The complete report is attached as a PDF document.

Best regards,
Matt Tracker Team

---
This is an automated email. Please do not reply.
Generated on ` + report.GeneratedAt)

	return text.String()
}

