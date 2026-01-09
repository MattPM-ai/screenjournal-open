/**
 * ============================================================================
 * WEEKLY PDF GENERATOR UTILITIES
 * ============================================================================
 * 
 * PURPOSE: Utility functions for generating professional PDF documents from weekly report data
 * 
 * DESCRIPTION:
 * These functions convert the raw weekly report JSON data into a professionally formatted
 * PDF document. They handle weekly summaries, top/bottom employees, and user summaries
 * with proper styling, page breaks, and layout.
 * 
 * DEPENDENCIES:
 * - jspdf: PDF generation library
 * 
 * ============================================================================
 */

import jsPDF from 'jspdf'

/**
 * PDF Configuration Constants
 */
const PDF_CONFIG = {
  pageWidth: 210, // A4 width in mm
  pageHeight: 297, // A4 height in mm
  margin: {
    top: 20,
    bottom: 20,
    left: 15,
    right: 15
  },
  colors: {
    primary: [0, 102, 204], // Blue
    secondary: [108, 117, 125], // Gray
    success: [40, 167, 69], // Green
    warning: [255, 193, 7], // Yellow
    danger: [220, 53, 69], // Red
    dark: [33, 37, 41], // Dark gray
    light: [248, 249, 250] // Light gray
  },
  fonts: {
    normal: 10,
    small: 9,
    medium: 12,
    large: 18,
    xlarge: 24
  },
  spacing: {
    small: 8,
    medium: 12,
    large: 16,
    xlarge: 24
  },
  boxPadding: {
    small: 4,
    medium: 5,
    large: 6
  },
  lineHeight: {
    small: 1.2,
    normal: 1.3,
    medium: 1.4,
    large: 1.5
  }
}

/**
 * Helper to convert color array to tuple for TypeScript compatibility
 */
function colorTuple(color: number[]): [number, number, number] {
  return [color[0], color[1], color[2]]
}

/**
 * Helper object to track Y position in PDF
 */
interface PDFState {
  doc: jsPDF
  y: number
}

/**
 * Checks if a new page is needed and adds it if necessary
 * 
 * INPUTS:
 * - state: PDFState - PDF state with doc and current Y position
 * - requiredHeight: number - Required height in mm
 * 
 * OUTPUTS:
 * - void - Updates state.y if page break occurs
 */
function checkPageBreak(state: PDFState, requiredHeight: number): void {
  const remainingHeight = PDF_CONFIG.pageHeight - state.y - PDF_CONFIG.margin.bottom
  
  if (remainingHeight < requiredHeight) {
    state.doc.addPage()
    state.y = PDF_CONFIG.margin.top
  }
}

/**
 * Gets line height for a given font size
 * 
 * INPUTS:
 * - fontSize: number - Font size in points
 * 
 * OUTPUTS:
 * - number - Line height in mm
 */
function getLineHeight(fontSize: number): number {
  return fontSize * PDF_CONFIG.lineHeight.normal * 0.352778 // Convert pt to mm
}

/**
 * Adds a header section to the PDF
 * 
 * INPUTS:
 * - state: PDFState - PDF state with doc and current Y position
 * - title: string - Header title
 * - subtitle?: string - Optional subtitle
 * 
 * OUTPUTS:
 * - void - Updates state.y
 */
function addHeader(state: PDFState, title: string, subtitle?: string): void {
  checkPageBreak(state, 30)
  
  // Add spacing before header
  state.y = state.y + PDF_CONFIG.spacing.small
  
  state.doc.setFontSize(PDF_CONFIG.fonts.large)
  state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
  state.doc.setFont('helvetica', 'bold')
  const titleLineHeight = getLineHeight(PDF_CONFIG.fonts.large)
  state.doc.text(title, PDF_CONFIG.margin.left, state.y + titleLineHeight)
  
  if (subtitle) {
    state.y = state.y + titleLineHeight + 4
    state.doc.setFontSize(PDF_CONFIG.fonts.small)
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.secondary))
    state.doc.setFont('helvetica', 'normal')
    const subtitleLineHeight = getLineHeight(PDF_CONFIG.fonts.small)
    state.doc.text(subtitle, PDF_CONFIG.margin.left, state.y + subtitleLineHeight)
    state.y = state.y + subtitleLineHeight + PDF_CONFIG.spacing.small
  } else {
    state.y = state.y + titleLineHeight + PDF_CONFIG.spacing.small
  }
  
  // Add subtle divider line after header
  state.doc.setDrawColor(...colorTuple(PDF_CONFIG.colors.primary))
  state.doc.setLineWidth(0.5)
  state.doc.line(
    PDF_CONFIG.margin.left,
    state.y,
    PDF_CONFIG.pageWidth - PDF_CONFIG.margin.right,
    state.y
  )
  
  state.y = state.y + PDF_CONFIG.spacing.medium
}

/**
 * Adds a footer with page number
 * 
 * INPUTS:
 * - doc: jsPDF - PDF document instance
 * 
 * OUTPUTS:
 * - void
 */
function addFooter(doc: jsPDF): void {
  const pageCount = (doc as any).internal?.pages?.length || 1
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(PDF_CONFIG.fonts.small)
    doc.setTextColor(...colorTuple(PDF_CONFIG.colors.secondary))
    doc.setFont('helvetica', 'normal')
    
    const pageText = `Page ${i} of ${pageCount}`
    const textWidth = doc.getTextWidth(pageText)
    const xPos = (PDF_CONFIG.pageWidth - textWidth) / 2
    const yPos = PDF_CONFIG.pageHeight - PDF_CONFIG.margin.bottom + 5
    
    doc.text(pageText, xPos, yPos)
    
    // Add date
    const dateText = new Date().toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    doc.text(dateText, PDF_CONFIG.margin.left, yPos)
  }
}

/**
 * Formats the weekly summary section
 * 
 * INPUTS:
 * - state: PDFState - PDF state with doc and current Y position
 * - weeklySummary: object - Weekly summary object
 * 
 * OUTPUTS:
 * - void - Updates state.y
 */
function formatWeeklySummary(state: PDFState, weeklySummary: any): void {
  checkPageBreak(state, 50)
  
  addHeader(state, 'Weekly Summary')
  
  // Productivity Summary
  if (weeklySummary.productivitySummary) {
    checkPageBreak(state, 30)
    const boxPadding = PDF_CONFIG.boxPadding.medium
    state.doc.setFontSize(PDF_CONFIG.fonts.small)
    state.doc.setFont('helvetica', 'normal')
    const summaryLines = state.doc.splitTextToSize(
      weeklySummary.productivitySummary,
      PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right - (boxPadding * 2)
    )
    const summaryLineHeight = getLineHeight(PDF_CONFIG.fonts.small)
    const summaryBoxY = state.y
    const summaryBoxHeight = (summaryLines.length * summaryLineHeight) + (boxPadding * 2)
    
    // Summary box shadow
    state.doc.setFillColor(220, 220, 220)
    state.doc.setDrawColor(220, 220, 220)
    state.doc.setLineWidth(0)
    state.doc.rect(
      PDF_CONFIG.margin.left + 0.5,
      summaryBoxY + 0.5,
      PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right,
      summaryBoxHeight,
      'F'
    )
    
    // Summary box
    state.doc.setFillColor(...colorTuple(PDF_CONFIG.colors.light))
    state.doc.setDrawColor(180, 180, 180)
    state.doc.setLineWidth(0.5)
    state.doc.rect(
      PDF_CONFIG.margin.left,
      summaryBoxY,
      PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right,
      summaryBoxHeight,
      'FD'
    )
    
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
    let summaryY = summaryBoxY + summaryLineHeight + boxPadding
    summaryLines.forEach((line: string) => {
      state.doc.text(line.trim(), PDF_CONFIG.margin.left + boxPadding, summaryY)
      summaryY += summaryLineHeight
    })
    state.y = summaryBoxY + summaryBoxHeight + PDF_CONFIG.spacing.medium
  }
  
  // Top Employees (dynamic count) - Table format
  if (weeklySummary.top5Employees && Array.isArray(weeklySummary.top5Employees) && weeklySummary.top5Employees.length > 0) {
    const count = weeklySummary.top5Employees.length
    checkPageBreak(state, 50)
    state.y = state.y + PDF_CONFIG.spacing.small
    state.doc.setFontSize(PDF_CONFIG.fonts.medium)
    state.doc.setFont('helvetica', 'bold')
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
    state.doc.text(`Top ${String(count)} Employees`, PDF_CONFIG.margin.left, state.y)
    state.y = state.y + PDF_CONFIG.spacing.small
    
    // Table format
    const startX = PDF_CONFIG.margin.left
    const startY = state.y
    let currentY = startY
    
    // Column widths
    const colWidths = [100, 30, 30] // Employee, Activity, Hours
    const headers = ['Employee', 'Activity', 'Hours']
    
    // Header row
    const tableFontSize = PDF_CONFIG.fonts.small - 1
    state.doc.setFontSize(tableFontSize)
    state.doc.setFont('helvetica', 'bold')
    state.doc.setFillColor(...colorTuple(PDF_CONFIG.colors.light))
    const tableLineHeight = getLineHeight(tableFontSize)
    const tableRowHeight = tableLineHeight + 4
    state.doc.rect(
      startX,
      currentY,
      PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right,
      tableRowHeight,
      'F'
    )
    
    // Calculate column start positions
    const colStarts = [startX + 2] // Employee column starts at margin + padding
    let cumulativeWidth = colWidths[0]
    for (let i = 1; i < colWidths.length; i++) {
      colStarts.push(startX + cumulativeWidth + 2)
      cumulativeWidth += colWidths[i]
    }
    
    // Draw headers
    headers.forEach((header, index) => {
      state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
      let headerX = colStarts[index]
      
      if (index > 0) {
        // Right-align Activity and Hours columns
        const textWidth = state.doc.getTextWidth(header)
        headerX = colStarts[index] + colWidths[index] - textWidth - 2
      }
      
      state.doc.text(header, headerX, currentY + tableLineHeight)
    })
    
    currentY += tableRowHeight
    state.doc.setFont('helvetica', 'normal')
    state.doc.setFontSize(tableFontSize)
    
    // Data rows
    weeklySummary.top5Employees.forEach((employee: any) => {
      const tempState: PDFState = { doc: state.doc, y: currentY }
      checkPageBreak(tempState, 8)
      if (tempState.y !== currentY) {
        currentY = tempState.y
        state.y = currentY
      }
      
      state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
      const rowTextY = currentY + tableLineHeight
      
      const employeeName = employee.name || employee.userName || 'Unknown'
      const rank = employee.rank || 1
      const activityRatio = employee.activityRatio?.toFixed(1) || '0.0'
      const activeHours = employee.activeHours?.toFixed(1) || '0.0'
      
      // Employee name with rank (left-aligned)
      state.doc.text(`${rank}. ${employeeName}`, colStarts[0], rowTextY)
      
      // Activity (right-aligned)
      const activityText = `${activityRatio}%`
      const activityWidth = state.doc.getTextWidth(activityText)
      const activityX = colStarts[1] + colWidths[1] - activityWidth - 2
      state.doc.text(activityText, activityX, rowTextY)
      
      // Hours (right-aligned)
      const hoursText = activeHours
      const hoursWidth = state.doc.getTextWidth(hoursText)
      const hoursX = colStarts[2] + colWidths[2] - hoursWidth - 2
      state.doc.text(hoursText, hoursX, rowTextY)
      
      currentY += tableRowHeight
      
      // Row border
      state.doc.setDrawColor(240, 240, 240)
      state.doc.setLineWidth(0.1)
      state.doc.line(startX, currentY, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.right, currentY)
    })
    
    state.y = currentY + PDF_CONFIG.spacing.medium
  }
  
  // Bottom Employees (dynamic count) - Table format
  if (weeklySummary.bottom5Employees && Array.isArray(weeklySummary.bottom5Employees) && weeklySummary.bottom5Employees.length > 0) {
    const count = weeklySummary.bottom5Employees.length
    checkPageBreak(state, 50)
    state.y = state.y + PDF_CONFIG.spacing.small
    state.doc.setFontSize(PDF_CONFIG.fonts.medium)
    state.doc.setFont('helvetica', 'bold')
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
    state.doc.text(`Bottom ${String(count)} Employees`, PDF_CONFIG.margin.left, state.y)
    state.y = state.y + PDF_CONFIG.spacing.small
    
    // Table format
    const startX = PDF_CONFIG.margin.left
    const startY = state.y
    let currentY = startY
    
    // Column widths
    const colWidths = [100, 30, 30] // Employee, Activity, Hours
    const headers = ['Employee', 'Activity', 'Hours']
    
    // Header row
    const tableFontSize = PDF_CONFIG.fonts.small - 1
    state.doc.setFontSize(tableFontSize)
    state.doc.setFont('helvetica', 'bold')
    state.doc.setFillColor(...colorTuple(PDF_CONFIG.colors.light))
    const tableLineHeight = getLineHeight(tableFontSize)
    const tableRowHeight = tableLineHeight + 4
    state.doc.rect(
      startX,
      currentY,
      PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right,
      tableRowHeight,
      'F'
    )
    
    // Calculate column start positions
    const colStarts = [startX + 2] // Employee column starts at margin + padding
    let cumulativeWidth = colWidths[0]
    for (let i = 1; i < colWidths.length; i++) {
      colStarts.push(startX + cumulativeWidth + 2)
      cumulativeWidth += colWidths[i]
    }
    
    // Draw headers
    headers.forEach((header, index) => {
      state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
      let headerX = colStarts[index]
      
      if (index > 0) {
        // Right-align Activity and Hours columns
        const textWidth = state.doc.getTextWidth(header)
        headerX = colStarts[index] + colWidths[index] - textWidth - 2
      }
      
      state.doc.text(header, headerX, currentY + tableLineHeight)
    })
    
    currentY += tableRowHeight
    state.doc.setFont('helvetica', 'normal')
    state.doc.setFontSize(tableFontSize)
    
    // Data rows
    weeklySummary.bottom5Employees.forEach((employee: any) => {
      const tempState: PDFState = { doc: state.doc, y: currentY }
      checkPageBreak(tempState, 8)
      if (tempState.y !== currentY) {
        currentY = tempState.y
        state.y = currentY
      }
      
      state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
      const rowTextY = currentY + tableLineHeight
      
      const employeeName = employee.name || employee.userName || 'Unknown'
      const rank = employee.rank || 1
      const activityRatio = employee.activityRatio?.toFixed(1) || '0.0'
      const activeHours = employee.activeHours?.toFixed(1) || '0.0'
      
      // Employee name with rank (left-aligned)
      state.doc.text(`${rank}. ${employeeName}`, colStarts[0], rowTextY)
      
      // Activity (right-aligned)
      const activityText = `${activityRatio}%`
      const activityWidth = state.doc.getTextWidth(activityText)
      const activityX = colStarts[1] + colWidths[1] - activityWidth - 2
      state.doc.text(activityText, activityX, rowTextY)
      
      // Hours (right-aligned)
      const hoursText = activeHours
      const hoursWidth = state.doc.getTextWidth(hoursText)
      const hoursX = colStarts[2] + colWidths[2] - hoursWidth - 2
      state.doc.text(hoursText, hoursX, rowTextY)
      
      currentY += tableRowHeight
      
      // Row border
      state.doc.setDrawColor(240, 240, 240)
      state.doc.setLineWidth(0.1)
      state.doc.line(startX, currentY, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.right, currentY)
    })
    
    state.y = currentY + PDF_CONFIG.spacing.medium
  }
}

/**
 * Formats an individual employee summary card
 * 
 * INPUTS:
 * - state: PDFState - PDF state with doc and current Y position
 * - user: object - User summary object
 * 
 * OUTPUTS:
 * - void - Updates state.y
 */
function formatEmployeeSummary(state: PDFState, user: any): void {
  const boxPadding = PDF_CONFIG.boxPadding.medium
  const boxWidth = PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right
  const textWidth = boxWidth - (boxPadding * 2)
  const fontSize = PDF_CONFIG.fonts.small
  const lineHeight = getLineHeight(fontSize)
  
  // Calculate content height
  const headerLineHeight = getLineHeight(PDF_CONFIG.fonts.medium)
  let contentHeight = headerLineHeight + boxPadding // Header with padding
  
  // Stats section (3 rows of stats)
  contentHeight += (lineHeight * 3) + 12 // 3 rows with spacing
  
  // Productivity summary (if exists)
  let summaryLines: string[] = []
  if (user.productivitySummary && user.productivitySummary !== '-') {
    state.doc.setFontSize(fontSize)
    state.doc.setFont('helvetica', 'normal')
    summaryLines = state.doc.splitTextToSize(user.productivitySummary, textWidth)
    contentHeight += 6 // Space before summary label
    contentHeight += lineHeight + 3 // "Productivity Summary:" label
    contentHeight += (summaryLines.length * lineHeight) + 2 // Summary text lines
  }
  
  const boxHeight = contentHeight + boxPadding // Bottom padding
  
  checkPageBreak(state, boxHeight)
  
  const boxY = state.y
  
  // Draw box with shadow
  // Shadow
  state.doc.setFillColor(220, 220, 220)
  state.doc.setDrawColor(220, 220, 220)
  state.doc.setLineWidth(0)
  state.doc.rect(
    PDF_CONFIG.margin.left + 0.5,
    boxY + 0.5,
    boxWidth,
    boxHeight,
    'F'
  )
  
  // Main box
  state.doc.setFillColor(255, 255, 255)
  state.doc.setDrawColor(180, 180, 180)
  state.doc.setLineWidth(0.5)
  state.doc.rect(
    PDF_CONFIG.margin.left,
    boxY,
    boxWidth,
    boxHeight,
    'FD'
  )
  
  // Employee name header
  const headerY = boxY + boxPadding + headerLineHeight
  state.doc.setFontSize(PDF_CONFIG.fonts.medium)
  state.doc.setFont('helvetica', 'bold')
  state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
  const userName = user.userName || 'Unknown'
  state.doc.text(userName, PDF_CONFIG.margin.left + boxPadding, headerY)
  
  // Stats section
  let statsY = headerY + headerLineHeight + 6
  state.doc.setFontSize(fontSize)
  state.doc.setFont('helvetica', 'normal')
  state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
  
  // First row of stats
  const statsX1 = PDF_CONFIG.margin.left + boxPadding
  const statsX2 = PDF_CONFIG.margin.left + boxPadding + (boxWidth / 2)
  
  state.doc.text(`Activity Ratio: ${user.activityRatio?.toFixed(1) || '0.0'}%`, statsX1, statsY)
  state.doc.text(`Active Hours: ${user.activeHours?.toFixed(1) || '0.0'}h`, statsX2, statsY)
  
  statsY += lineHeight + 4
  
  // Second row of stats
  state.doc.text(`AFK Hours: ${user.afkHours?.toFixed(1) || '0.0'}h`, statsX1, statsY)
  state.doc.text(`Distracted Time: ${user.distractedTimeHours?.toFixed(1) || '0.0'}h`, statsX2, statsY)
  
  statsY += lineHeight + 4
  
  // Third row of stats
  state.doc.text(`Total Discrepancies: ${user.totalDiscrepancies || 0}`, statsX1, statsY)
  
  // Critical Discrepancies (highlighted if > 0)
  if (user.criticalDiscrepancies > 0) {
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.danger))
    state.doc.setFont('helvetica', 'bold')
  }
  state.doc.text(`Critical Discrepancies: ${user.criticalDiscrepancies || 0}`, statsX2, statsY)
  state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
  state.doc.setFont('helvetica', 'normal')
  
  statsY += lineHeight + 6
  
  // Productivity Summary
  if (summaryLines.length > 0) {
    state.doc.setFontSize(fontSize)
    state.doc.setFont('helvetica', 'bold')
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
    state.doc.text('Productivity Summary:', PDF_CONFIG.margin.left + boxPadding, statsY)
    
    statsY += lineHeight + 3
    
    state.doc.setFont('helvetica', 'normal')
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.secondary))
    summaryLines.forEach((line: string) => {
      state.doc.text(line.trim(), PDF_CONFIG.margin.left + boxPadding, statsY)
      statsY += lineHeight
    })
  }
  
  state.y = boxY + boxHeight + PDF_CONFIG.spacing.medium
}

/**
 * Formats the weekly user summaries as individual employee sections
 * 
 * INPUTS:
 * - state: PDFState - PDF state with doc and current Y position
 * - userSummaries: array - Array of user summary objects
 * 
 * OUTPUTS:
 * - void - Updates state.y
 */
function formatWeeklyUserSummaries(state: PDFState, userSummaries: any[]): void {
  if (!userSummaries || userSummaries.length === 0) {
    return
  }
  
  checkPageBreak(state, 40)
  
  addHeader(state, 'Employee Summaries')
  
  // Format each employee as an individual summary card
  userSummaries.forEach((user: any) => {
    formatEmployeeSummary(state, user)
  })
}

/**
 * Generates a PDF document from weekly report data
 * 
 * INPUTS:
 * - reportData: object - Parsed weekly report data
 * - filename?: string - Optional filename (default: "weekly-report.pdf")
 * 
 * OUTPUTS:
 * - void - Triggers PDF download
 */
export function generateWeeklyPDF(reportData: any, filename: string = 'weekly-report.pdf'): void {
  if (!reportData || !reportData.organizations) {
    console.error('Invalid weekly report data structure')
    return
  }
  
  // Initialize PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })
  
  // Create state object to track Y position
  const state: PDFState = {
    doc,
    y: PDF_CONFIG.margin.top
  }
  
  // Title page
  doc.setFontSize(PDF_CONFIG.fonts.xlarge)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...colorTuple(PDF_CONFIG.colors.primary))
  doc.text('Weekly Activity Report', PDF_CONFIG.pageWidth / 2, PDF_CONFIG.pageHeight / 2 - 20, { align: 'center' })
  
  doc.setFontSize(PDF_CONFIG.fonts.medium)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...colorTuple(PDF_CONFIG.colors.secondary))
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    PDF_CONFIG.pageWidth / 2,
    PDF_CONFIG.pageHeight / 2,
    { align: 'center' }
  )
  
  doc.addPage()
  state.y = PDF_CONFIG.margin.top
  
  // Process each organization
  reportData.organizations.forEach((org: any, orgIndex: number) => {
    if (orgIndex > 0) {
      doc.addPage()
      state.y = PDF_CONFIG.margin.top
    }
    
    // Organization header
    addHeader(state, org.organizationName)
    
    // Weekly Summary
    if (org.weeklySummary) {
      formatWeeklySummary(state, org.weeklySummary)
    }
    
    // Weekly User Summaries
    if (org.weeklyUserSummaries && org.weeklyUserSummaries.length > 0) {
      formatWeeklyUserSummaries(state, org.weeklyUserSummaries)
    }
  })
  
  // Add footers to all pages
  addFooter(doc)
  
  // Save PDF
  doc.save(filename)
}


