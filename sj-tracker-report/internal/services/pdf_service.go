package services

import (
	"bytes"
	"fmt"
	"sj-tracker-report/internal/models"
	"strings"

	"github.com/jung-kurt/gofpdf/v2"
)

// PDFService handles PDF generation for weekly reports
type PDFService struct{}

// NewPDFService creates a new PDF service
func NewPDFService() *PDFService {
	return &PDFService{}
}

// GenerateWeeklyReportPDF generates a PDF from weekly report data
func (s *PDFService) GenerateWeeklyReportPDF(report *models.Report) ([]byte, error) {
	if report == nil || len(report.Organizations) == 0 {
		return nil, fmt.Errorf("invalid report data")
	}

	// Create PDF document (A4, portrait)
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 20, 15)
	pdf.SetAutoPageBreak(true, 20)
	
	// Set total page count alias for footer
	pdf.AliasNbPages("{nb}")
	
	// Set footer function to add page numbers to all pages
	pdf.SetFooterFunc(func() {
		pdf.SetY(-15)
		pdf.SetFont("Arial", "", 9)
		pdf.SetTextColor(108, 117, 125) // Gray
		// Use {nb} placeholder which will be replaced with total page count by gofpdf
		// Format: "Page X of Y" where Y is replaced with total pages
		pdf.SetX(15) // Start from left margin
		pdf.CellFormat(0, 10, fmt.Sprintf("Page %d of {nb}", pdf.PageNo()), "", 0, "C", false, 0, "")
	})

	// Title page
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 24)
	pdf.SetTextColor(0, 102, 204) // Blue
	pdf.CellFormat(0, 20, "Weekly Activity Report", "", 0, "C", false, 0, "")

	pdf.Ln(15)
	pdf.SetFont("Arial", "", 12)
	pdf.SetTextColor(108, 117, 125) // Gray
	pdf.CellFormat(0, 10, fmt.Sprintf("Generated: %s", formatDateForPDF(report.GeneratedAt)), "", 0, "C", false, 0, "")

	// Process each organization
	for orgIndex, org := range report.Organizations {
		if orgIndex > 0 {
			pdf.AddPage()
		}

		// Organization header
		s.addHeader(pdf, org.OrganizationName)

		// Weekly Summary
		if org.WeeklySummary != nil {
			s.addWeeklySummary(pdf, org.WeeklySummary)
		}

		// Weekly User Summaries
		if len(org.WeeklyUserSummaries) > 0 {
			s.addWeeklyUserSummaries(pdf, org.WeeklyUserSummaries)
		}
	}

	// Generate PDF bytes
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %w", err)
	}

	return buf.Bytes(), nil
}

// addHeader adds a header section to the PDF
func (s *PDFService) addHeader(pdf *gofpdf.Fpdf, title string) {
	pdf.Ln(10)
	pdf.SetFont("Arial", "B", 18)
	pdf.SetTextColor(33, 37, 41) // Dark gray
	pdf.CellFormat(0, 10, title, "", 0, "L", false, 0, "")

	pdf.Ln(10)
	pdf.SetLineWidth(0.5)
	pdf.SetDrawColor(0, 102, 204) // Blue
	pdf.Line(15, pdf.GetY(), 195, pdf.GetY())
	pdf.Ln(8)
}

// addWeeklySummary adds the weekly organization summary section
func (s *PDFService) addWeeklySummary(pdf *gofpdf.Fpdf, summary *models.WeeklyOrganizationSummary) {
	// Productivity Summary box
	if summary.ProductivitySummary != "" {
		pdf.SetFillColor(248, 249, 250) // Light gray
		pdf.SetDrawColor(0, 102, 204)   // Blue
		pdf.SetLineWidth(0.5)
		startY := pdf.GetY()
		
		// Internal left padding
		padding := 8.0
		// Text width should account for padding on both sides
		textWidth := 180.0 - (padding * 2) // 180mm table width minus padding on both sides
		
		// Wrap text to calculate box height
		pdf.SetFont("Arial", "", 9)
		lines := pdf.SplitText(summary.ProductivitySummary, textWidth)
		boxHeight := float64(len(lines)*5 + 10) // 5mm per line + 10mm padding
		
		pdf.Rect(15, startY, 180, boxHeight, "FD")

		pdf.SetFont("Arial", "", 9)
		pdf.SetTextColor(33, 37, 41) // Dark gray
		
		// Wrap text - ensure each line has proper padding
		currentY := startY + 5
		for _, line := range lines {
			pdf.SetXY(15+padding, currentY) // Set X position with padding for each line
			pdf.CellFormat(0, 5, strings.TrimSpace(line), "", 0, "L", false, 0, "")
			currentY += 5
		}

		pdf.SetY(startY + boxHeight)
		pdf.Ln(10)
	}

	// Top X Employees (as table)
	if len(summary.Top5Employees) > 0 {
		pdf.Ln(4) // Add extra padding above the table
		topCount := len(summary.Top5Employees)
		sectionTitle := fmt.Sprintf("Top %d Employees", topCount)
		s.addEmployeeRankingTable(pdf, sectionTitle, summary.Top5Employees)
		pdf.Ln(10)
	}

	// Bottom X Employees (as table)
	if len(summary.Bottom5Employees) > 0 {
		bottomCount := len(summary.Bottom5Employees)
		sectionTitle := fmt.Sprintf("Bottom %d Employees", bottomCount)
		s.addEmployeeRankingTable(pdf, sectionTitle, summary.Bottom5Employees)
		pdf.Ln(10)
	}
}

// addEmployeeRankingTable adds a table for employee rankings
func (s *PDFService) addEmployeeRankingTable(pdf *gofpdf.Fpdf, title string, employees []models.WeeklyUserRank) {
	// Section title
	pdf.SetFont("Arial", "B", 12)
	pdf.SetTextColor(33, 37, 41)
	pdf.CellFormat(0, 8, title, "", 0, "L", false, 0, "")
	pdf.Ln(6)

	if len(employees) == 0 {
		return
	}

	// Add padding before table
	pdf.Ln(4)

	// Table dimensions
	// Page width: 210mm, margins: 15mm each side, so available width: 180mm
	// Add padding around the table (left/right margins)
	tablePadding := 3.0 // Padding around the table
	tableStartX := 15.0 + tablePadding
	tableWidth := 180.0 - (tablePadding * 2) // Reduce width to account for side padding
	padding := 5.0 // Padding inside table cells
	
	// Column widths - must fit within table width minus padding
	// Table width: 174mm (180 - 3*2 for side padding)
	// Total usable width: 174 - (padding * 2) = 164mm
	// Distribute: Employee name gets most, Activity and Hours get equal smaller amounts
	col1Width := 104.0  // Employee name column (reduced to fit)
	col2Width := 30.0   // Activity ratio column  
	col3Width := 30.0   // Active hours column
	// Total: 104 + 30 + 30 = 164mm (fits within 174mm table with padding)
	
	rowHeight := 7.0
	headerHeight := 8.0

	// Table header
	headerY := pdf.GetY()
	pdf.SetFillColor(0, 102, 204) // Blue background
	pdf.SetTextColor(255, 255, 255) // White text
	pdf.SetFont("Arial", "B", 9)
	
	// Header row
	pdf.Rect(tableStartX, headerY, tableWidth, headerHeight, "FD")
	
	// Employee column header - adjust vertical position to center better (move text higher)
	pdf.SetXY(tableStartX+padding, headerY+headerHeight/2-3)
	pdf.CellFormat(col1Width, headerHeight, "Employee", "", 0, "L", false, 0, "")
	
	// Activity column header - position at col1 end + padding
	pdf.SetXY(tableStartX+col1Width+padding, headerY+headerHeight/2-3)
	pdf.CellFormat(col2Width, headerHeight, "Activity", "", 0, "R", false, 0, "")
	
	// Hours column header - position at col1+col2 end + padding, but ensure it doesn't exceed table width
	pdf.SetXY(tableStartX+col1Width+col2Width+padding, headerY+headerHeight/2-3)
	pdf.CellFormat(col3Width, headerHeight, "Hours", "", 0, "R", false, 0, "")
	
	pdf.SetY(headerY + headerHeight)

	// Table rows
	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(33, 37, 41) // Dark gray text
	
	for i, emp := range employees {
		// Alternate row colors
		if i%2 == 0 {
			pdf.SetFillColor(255, 255, 255) // White
		} else {
			pdf.SetFillColor(248, 249, 250) // Light gray
		}
		
		rowY := pdf.GetY()
		pdf.Rect(tableStartX, rowY, tableWidth, rowHeight, "FD")
		
		// Employee name (with rank)
		pdf.SetXY(tableStartX+padding, rowY+rowHeight/2-2)
		pdf.CellFormat(col1Width, rowHeight, fmt.Sprintf("%d. %s", emp.Rank, emp.UserName), "", 0, "L", false, 0, "")
		
		// Activity ratio
		pdf.SetXY(tableStartX+col1Width+padding, rowY+rowHeight/2-2)
		pdf.CellFormat(col2Width, rowHeight, fmt.Sprintf("%.1f%%", emp.ActivityRatio), "", 0, "R", false, 0, "")
		
		// Active hours - ensure it doesn't exceed table boundary
		hoursX := tableStartX + col1Width + col2Width + padding
		// Make sure hours column fits: hoursX + col3Width should be <= tableStartX + tableWidth - padding
		pdf.SetXY(hoursX, rowY+rowHeight/2-2)
		pdf.CellFormat(col3Width, rowHeight, fmt.Sprintf("%.1f", emp.ActiveHours), "", 0, "R", false, 0, "")
		
		pdf.SetY(rowY + rowHeight)
	}
	
	// Add bottom padding after table (increased)
	pdf.Ln(12)
	
	// Reset text color
	pdf.SetTextColor(33, 37, 41)
}

// addWeeklyUserSummaries adds user summary sections
func (s *PDFService) addWeeklyUserSummaries(pdf *gofpdf.Fpdf, summaries []models.WeeklyUserSummary) {
	pdf.SetFont("Arial", "B", 14)
	pdf.SetTextColor(33, 37, 41)
	pdf.CellFormat(0, 8, "Individual User Summaries", "", 0, "L", false, 0, "")
	pdf.Ln(8)

	for _, user := range summaries {
		// Check if we need a new page (leave room for footer)
		if pdf.GetY() > 260 {
			pdf.AddPage()
		}

		// Internal left padding
		padding := 8.0
		// Text width should account for padding on both sides
		textWidth := 180.0 - (padding * 2) // 180mm table width minus padding on both sides
		
		// Calculate box height based on content
		pdf.SetFont("Arial", "", 9)
		summaryLines := []string{}
		if user.ProductivitySummary != "" {
			summaryLines = pdf.SplitText(user.ProductivitySummary, textWidth)
		}
		
		// Box height: name (8mm) + stats (20mm) + summary header (5mm) + summary text + padding (reduced from 15mm to 10mm)
		boxHeight := 8.0 + 20.0 + 5.0 + float64(len(summaryLines)*5) + 10.0

		// User summary box
		pdf.SetFillColor(248, 249, 250) // Light gray
		pdf.SetDrawColor(0, 102, 204)   // Blue
		pdf.SetLineWidth(0.5)
		startY := pdf.GetY()
		pdf.Rect(15, startY, 180, boxHeight, "FD")

		// User name header
		pdf.SetFont("Arial", "B", 12)
		pdf.SetTextColor(33, 37, 41)
		pdf.SetXY(15+padding, startY+5) // Add internal left padding
		pdf.CellFormat(0, 6, user.UserName, "", 0, "L", false, 0, "")

		// Stats
		pdf.SetFont("Arial", "", 9)
		pdf.SetTextColor(33, 37, 41)
		pdf.SetXY(15+padding, startY+12) // Add internal left padding
		pdf.CellFormat(90, 5, fmt.Sprintf("Activity Ratio: %.1f%%", user.ActivityRatio), "", 0, "L", false, 0, "")
		pdf.CellFormat(90, 5, fmt.Sprintf("Active Hours: %.1f", user.ActiveHours), "", 0, "L", false, 0, "")

		pdf.SetXY(15+padding, startY+17)
		pdf.CellFormat(90, 5, fmt.Sprintf("AFK Hours: %.1f", user.AfkHours), "", 0, "L", false, 0, "")
		pdf.CellFormat(90, 5, fmt.Sprintf("Distracted Time: %.1f hrs", user.DistractedTimeHours), "", 0, "L", false, 0, "")

		pdf.SetXY(15+padding, startY+22)
		pdf.CellFormat(90, 5, fmt.Sprintf("Total Discrepancies: %d", user.TotalDiscrepancies), "", 0, "L", false, 0, "")
		pdf.CellFormat(90, 5, fmt.Sprintf("Critical: %d", user.CriticalDiscrepancies), "", 0, "L", false, 0, "")

		// Productivity Summary
		if user.ProductivitySummary != "" {
			pdf.SetXY(15+padding, startY+28) // Add internal left padding
			pdf.SetFont("Arial", "B", 9)
			pdf.CellFormat(0, 5, "Productivity Summary:", "", 0, "L", false, 0, "")
			
			// Ensure each line of productivity summary has proper padding
			currentY := startY + 33 // After the header line
			pdf.SetFont("Arial", "", 9)
			pdf.SetTextColor(108, 117, 125) // Gray
			for _, line := range summaryLines {
				pdf.SetXY(15+padding, currentY) // Set X position with padding for each line
				pdf.CellFormat(0, 5, strings.TrimSpace(line), "", 0, "L", false, 0, "")
				currentY += 5
			}
		}

		pdf.SetY(startY + boxHeight)
		pdf.Ln(8) // Reduced spacing between user boxes
	}
}

// Note: Footer is now handled via SetFooterFunc in GenerateWeeklyReportPDF
// This function is kept for potential future use but is not currently called

// formatDateForPDF formats a date string for PDF display
func formatDateForPDF(dateStr string) string {
	// Parse ISO 8601 format and format nicely
	// Simple implementation - just return the date part if it's ISO format
	if len(dateStr) >= 10 {
		return dateStr[:10]
	}
	return dateStr
}

