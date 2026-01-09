/**
 * ============================================================================
 * PDF GENERATOR UTILITIES
 * ============================================================================
 * 
 * PURPOSE: Utility functions for generating professional PDF documents from report data
 * 
 * DESCRIPTION:
 * These functions convert the raw report JSON data into a professionally formatted
 * PDF document. They handle user rankings, daily reports, hourly breakdowns,
 * and discrepancies with proper styling, page breaks, and layout.
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
 * Formats minutes into hours and minutes string
 * 
 * INPUTS:
 * - minutes: number - Total minutes
 * 
 * OUTPUTS:
 * - string - Formatted time string (e.g., "4h 30m")
 */
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`
  } else if (hours > 0) {
    return `${hours}h`
  } else {
    return `${mins}m`
  }
}

/**
 * Formats severity level text
 * 
 * INPUTS:
 * - severity: string - Severity level (high, medium, low, critical)
 * 
 * OUTPUTS:
 * - string - Formatted severity text
 */
function formatSeverity(severity: string): string {
  return severity.toUpperCase()
}

/**
 * Gets color for severity level
 * 
 * INPUTS:
 * - severity: string - Severity level
 * 
 * OUTPUTS:
 * - number[] - RGB color array
 */
function getSeverityColor(severity: string): number[] {
  const severityLower = severity.toLowerCase()
  switch (severityLower) {
    case 'critical':
      return PDF_CONFIG.colors.danger
    case 'high':
      return [255, 152, 0] // Orange
    case 'medium':
      return PDF_CONFIG.colors.warning
    case 'low':
      return PDF_CONFIG.colors.primary
    default:
      return PDF_CONFIG.colors.secondary
  }
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
 * Manually wraps text at word boundaries to fit within a width
 * This prevents character-by-character splitting issues
 * 
 * INPUTS:
 * - doc: jsPDF - PDF document instance
 * - text: string - Text to wrap
 * - maxWidth: number - Maximum width in mm
 * 
 * OUTPUTS:
 * - string[] - Array of wrapped lines
 */
function wrapTextAtWords(doc: jsPDF, text: string, maxWidth: number): string[] {
  if (!text || text.trim().length === 0) {
    return ['']
  }
  
  // Split by commas first (for app lists like "App1 (5m), App2 (10m)")
  const parts = text.split(',').map(part => part.trim()).filter(part => part.length > 0)
  const lines: string[] = []
  let currentLine = ''
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const separator = i > 0 ? ', ' : ''
    const testLine = currentLine + separator + part
    const testWidth = doc.getTextWidth(testLine)
    
    if (testWidth <= maxWidth) {
      // Part fits on current line
      currentLine = testLine
    } else {
      // Part doesn't fit
      if (currentLine.trim().length > 0) {
        // Save current line and start new one
        lines.push(currentLine.trim())
        currentLine = part
      } else {
        // Current line is empty but part is too long
        // Truncate the part to fit (don't use splitTextToSize to avoid character spacing issues)
        let truncated = part
        while (doc.getTextWidth(truncated + '...') > maxWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1)
        }
        if (truncated.length < part.length) {
          // Only truncate if we actually shortened it
          currentLine = truncated + '...'
        } else {
          // Even empty string is too wide (shouldn't happen), just use the part
          currentLine = part
        }
      }
    }
  }
  
  // Add the last line
  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trim())
  }
  
  return lines.length > 0 ? lines : ['']
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
  state.doc.setDrawColor(...colorTuple(PDF_CONFIG.colors.primary))
  state.doc.setLineWidth(0.5)
  state.doc.line(PDF_CONFIG.margin.left, state.y, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.right, state.y)
  
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
  // Get page count - use internal pages array length as fallback
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
 * Formats the hourly breakdown into PDF table
 * 
 * INPUTS:
 * - state: PDFState - PDF state with doc and current Y position
 * - hourlyBreakdown: array - Array of hour objects
 * 
 * OUTPUTS:
 * - void - Updates state.y
 */
function formatHourlyBreakdown(state: PDFState, hourlyBreakdown: any[]): void {
  if (!hourlyBreakdown || hourlyBreakdown.length === 0) {
    return
  }
  
  checkPageBreak(state, 30)
  
  const startX = PDF_CONFIG.margin.left
  const startY = state.y
  let currentY = startY
  
  // Table headers
  state.doc.setFontSize(PDF_CONFIG.fonts.small)
  state.doc.setFont('helvetica', 'bold')
  state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
  
  // Column widths - Apps column will use remaining space
  const fixedColWidths = [50, 30, 30] // Time, Active, AFK
  const tableWidth = PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right
  const usedWidth = fixedColWidths.reduce((sum, w) => sum + w, 0) + 4 // +4 for padding
  const appsColWidth = tableWidth - usedWidth - 4 // Remaining space for Apps column
  const colWidths = [...fixedColWidths, appsColWidth] // Time, Active, AFK, Apps
  const headers = ['Time', 'Active', 'AFK', 'Apps Used']
  const headerLineHeight = getLineHeight(PDF_CONFIG.fonts.small)
  const rowHeight = headerLineHeight + 4
  
  // Header background
  state.doc.setFillColor(...colorTuple(PDF_CONFIG.colors.light))
  state.doc.rect(startX, currentY, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, rowHeight, 'F')
  
  // Header text
  let xPos = startX + 2
  headers.forEach((header, index) => {
    state.doc.text(header, xPos, currentY + headerLineHeight)
    xPos += colWidths[index]
  })
  
  currentY += rowHeight
  state.doc.setFont('helvetica', 'normal')
  state.doc.setFontSize(PDF_CONFIG.fonts.small)
  
  // Table rows
  let i = 0
  while (i < hourlyBreakdown.length) {
    const hour = hourlyBreakdown[i]
    
    const tempState: PDFState = { doc: state.doc, y: currentY }
    checkPageBreak(tempState, 10)
    if (tempState.y !== currentY) {
      currentY = tempState.y
      state.y = currentY
    }
    
    const hasActiveTime = hour.activeMinutes && hour.activeMinutes > 0
    const hasAppUsage = hour.appUsage && hour.appUsage.length > 0
    
    if (!hasActiveTime && !hasAppUsage) {
      // Group consecutive zero-activity hours
      const offlineStart = hour.startTime
      let offlineEnd = hour.endTime
      let offlineCount = 1
      
      while (i + offlineCount < hourlyBreakdown.length) {
        const nextHour = hourlyBreakdown[i + offlineCount]
        if (!nextHour.activeMinutes && (!nextHour.appUsage || nextHour.appUsage.length === 0)) {
          offlineEnd = nextHour.endTime
          offlineCount++
        } else {
          break
        }
      }
      
      // Offline row
      state.doc.setFillColor(240, 240, 240)
      state.doc.rect(startX, currentY, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, rowHeight, 'F')
      
      state.doc.setTextColor(128, 128, 128)
      state.doc.setFont('helvetica', 'italic')
      const textY = currentY + headerLineHeight
      state.doc.text(`${offlineStart} - ${offlineEnd}`, startX + 2, textY)
      state.doc.text('Offline', startX + 60, textY)
      
      currentY += rowHeight
      i += offlineCount
    } else {
      // Regular activity row - calculate row height based on apps text wrapping
      state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
      state.doc.setFont('helvetica', 'normal')
      
      // Build apps list string - ensure clean formatting
      // Remove control characters (U+0000-U+001F) including U+000E which causes spacing issues
      const removeControlChars = (str: string): string => {
        return str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      }
      
      let appsList = hour.appUsage && hour.appUsage.length > 0
        ? hour.appUsage
            .map((app: any) => {
              const appName = removeControlChars(String(app.appName || '').trim())
              const time = formatTime(app.durationMinutes || 0)
              return `${appName} (${time})`
            })
            .filter((item: string) => item.length > 0)
            .join(', ')
        : 'None'
      
      // Clean the final appsList string to remove any control characters
      appsList = removeControlChars(appsList)
      
      // Calculate available width for apps column
      // Column starts at xPos after AFK column, and ends at page margin
      const textY = currentY + headerLineHeight
      xPos = startX + 2
      state.doc.text(`${hour.startTime} - ${hour.endTime}`, xPos, textY)
      xPos += colWidths[0]
      
      state.doc.text(formatTime(hour.activeMinutes || 0), xPos, textY)
      xPos += colWidths[1]
      
      state.doc.text(formatTime(hour.afkMinutes || 0), xPos, textY)
      xPos += colWidths[2]
      
      // Calculate exact available width for apps column
      const appsColumnStart = xPos + 2 // Small padding
      const appsColumnEnd = PDF_CONFIG.pageWidth - PDF_CONFIG.margin.right - 2
      const maxAppsWidth = appsColumnEnd - appsColumnStart // Available width for apps text
      
      // Set font before text operations - CRITICAL for proper text measurement
      state.doc.setFontSize(PDF_CONFIG.fonts.small)
      state.doc.setFont('helvetica', 'normal')
      
      // Use manual word wrapping - split by commas first, then by spaces if needed
      // This completely avoids splitTextToSize which can cause character spacing issues
      const appsLines: string[] = []
      
      if (appsList === 'None') {
        appsLines.push('None')
      } else {
        // Split by commas to get individual app entries
        // Remove control characters from each entry
        const appEntries = appsList
          .split(',')
          .map((e: string) => removeControlChars(e.trim()))
          .filter((e: string) => e.length > 0)
        let currentLine = ''
        
        for (let i = 0; i < appEntries.length; i++) {
          const entry = appEntries[i]
          // Build test line carefully - use string concatenation, not template literals
          let testLine: string
          if (currentLine) {
            testLine = currentLine + ', ' + entry
          } else {
            testLine = entry
          }
          // Clean the test line
          testLine = removeControlChars(testLine)
          const testWidth = state.doc.getTextWidth(testLine)
          
          if (testWidth <= maxAppsWidth) {
            // Entry fits on current line - store the cleaned version
            currentLine = testLine
          } else {
            // Entry doesn't fit
            if (currentLine) {
              // Save current line and start new one
              appsLines.push(currentLine)
              currentLine = removeControlChars(entry)
            } else {
              // Single entry is too long - must truncate it
              let truncated = entry
              while (state.doc.getTextWidth(truncated + '...') > maxAppsWidth && truncated.length > 0) {
                truncated = truncated.slice(0, -1)
              }
              const truncatedText = truncated + (truncated.length < entry.length ? '...' : '')
              appsLines.push(removeControlChars(truncatedText))
              currentLine = ''
            }
          }
        }
        
        // Add the last line - ensure it's cleaned
        if (currentLine) {
          appsLines.push(removeControlChars(currentLine))
        }
      }
      
      const appsRowHeight = Math.max(rowHeight, (appsLines.length * headerLineHeight) + 4)
      
      // Draw apps text - render each line as a clean string
      // CRITICAL: Ensure text is rendered as a single atomic string operation
      let appsY = textY
      for (let lineIndex = 0; lineIndex < appsLines.length; lineIndex++) {
        const line = appsLines[lineIndex]
        
        // Ensure font is set before each render - reset all text state
        state.doc.setFontSize(PDF_CONFIG.fonts.small)
        state.doc.setFont('helvetica', 'normal')
        state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
        
        // Clean the text and ensure it's a primitive string (not array-like)
        let textToRender = removeControlChars(String(line))
        // Remove any remaining problematic characters
        textToRender = textToRender.replace(/[\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, '')
        // Ensure no array-like behavior - create a fresh string
        textToRender = String(textToRender)
        
        // CRITICAL: Render as a simple string - no options that might trigger internal splitting
        // Pass the string directly to ensure jsPDF treats it as atomic text
        state.doc.text(textToRender, appsColumnStart, appsY)
        
        // Move to next line position
        if (lineIndex < appsLines.length - 1) {
          appsY += headerLineHeight
        }
      }
      
      currentY += appsRowHeight
      i++
    }
    
    // Add border between rows
    state.doc.setDrawColor(220, 220, 220)
    state.doc.setLineWidth(0.1)
    state.doc.line(startX, currentY, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.right, currentY)
  }
  
  state.y = currentY + PDF_CONFIG.spacing.small
}

/**
 * Formats notable discrepancies into PDF
 * 
 * INPUTS:
 * - doc: jsPDF - PDF document instance
 * - discrepancies: array - Array of discrepancy objects
 * 
 * OUTPUTS:
 * - void
 */
function formatNotableDiscrepancies(state: PDFState, discrepancies: any[]): void {
  if (!discrepancies || discrepancies.length === 0) {
    state.doc.setFontSize(PDF_CONFIG.fonts.small)
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.secondary))
    state.doc.setFont('helvetica', 'italic')
    const lineHeight = getLineHeight(PDF_CONFIG.fonts.small)
    state.doc.text('No notable discrepancies found.', PDF_CONFIG.margin.left, state.y + lineHeight)
    state.y = state.y + lineHeight + PDF_CONFIG.spacing.small
    return
  }
  
  discrepancies.forEach((discrepancy: any) => {
    checkPageBreak(state, 30)
    
    // Discrepancy box - calculate height dynamically
    const boxY = state.y
    const fontSize = PDF_CONFIG.fonts.small
    const lineHeight = getLineHeight(fontSize)
    const boxPadding = PDF_CONFIG.boxPadding.medium
    const boxWidth = PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right
    // Calculate text width with extra safety margin to prevent overflow
    const textWidth = boxWidth - (boxPadding * 2) - 2 // Extra 2mm safety margin
    
    // Calculate content height first
    const typeText = discrepancy.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
    const severityText = formatSeverity(discrepancy.severity)
    
    // Calculate badge dimensions with better padding
    state.doc.setFontSize(fontSize - 1)
    state.doc.setFont('helvetica', 'bold')
    const severityTextWidth = state.doc.getTextWidth(severityText)
    const badgePadding = 6 // Horizontal padding inside badge
    const badgeHeight = 7 // Badge height
    const severityWidth = severityTextWidth + (badgePadding * 2)
    
    const timeText = `${discrepancy.startTime} - ${discrepancy.endTime}`
    
    // Check if time will be on new line
    state.doc.setFontSize(fontSize)
    state.doc.setFont('helvetica', 'bold')
    const typeTextWidth = state.doc.getTextWidth(typeText)
    state.doc.setFontSize(fontSize - 1)
    state.doc.setFont('helvetica', 'normal')
    const timeTextWidth = state.doc.getTextWidth(timeText)
    const badgeX = PDF_CONFIG.pageWidth - PDF_CONFIG.margin.right - severityWidth - boxPadding
    const availableSpace = badgeX - (PDF_CONFIG.margin.left + boxPadding + typeTextWidth) - 5
    const timeOnNewLine = timeTextWidth > availableSpace || typeTextWidth > (boxWidth * 0.6)
    
    // Set font before text measurement
    state.doc.setFontSize(fontSize)
    state.doc.setFont('helvetica', 'normal')
    // Clean description text - remove control characters and normalize
    let descriptionText = String(discrepancy.description || '').trim()
    // Remove control characters (U+0000-U+001F, U+007F-U+009F) and zero-width characters
    descriptionText = descriptionText.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
    // Normalize whitespace
    descriptionText = descriptionText.replace(/\s+/g, ' ')
    
    // Manual word wrapping (like apps column) - avoid splitTextToSize which causes character spacing
    // Use a smaller textWidth to ensure we don't overflow (add safety margin)
    // Be more conservative - subtract more to account for padding and measurement inaccuracies
    const safeTextWidth = textWidth - 4 // Larger safety margin to prevent overflow
    const descriptionLines: string[] = []
    if (descriptionText.length > 0) {
      const words = descriptionText.split(/\s+/).filter((w: string) => w.length > 0)
      let currentLine = ''
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i]
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const testWidth = state.doc.getTextWidth(testLine)
        
        if (testWidth <= safeTextWidth) {
          currentLine = testLine
        } else {
          if (currentLine) {
            descriptionLines.push(currentLine)
            currentLine = word
            // Check if the word itself is too long - truncate if needed
            const wordWidth = state.doc.getTextWidth(word)
            if (wordWidth > safeTextWidth) {
              // Truncate the word
              let truncated = word
              while (state.doc.getTextWidth(truncated + '...') > safeTextWidth && truncated.length > 0) {
                truncated = truncated.slice(0, -1)
              }
              descriptionLines.push(truncated + (truncated.length < word.length ? '...' : ''))
              currentLine = ''
            }
          } else {
            // Single word is too long - truncate it
            let truncated = word
            while (state.doc.getTextWidth(truncated + '...') > safeTextWidth && truncated.length > 0) {
              truncated = truncated.slice(0, -1)
            }
            descriptionLines.push(truncated + (truncated.length < word.length ? '...' : ''))
            currentLine = ''
          }
        }
      }
      
      if (currentLine) {
        descriptionLines.push(currentLine)
      }
    }
    let contentHeight = lineHeight + boxPadding // Header line with padding
    
    // Add extra height if time is on new line
    if (timeOnNewLine) {
      contentHeight += getLineHeight(fontSize - 1) + 3
    }
    
    state.doc.setFontSize(fontSize)
    // Add spacing between header and description
    contentHeight += 6 // Space after header
    contentHeight += descriptionLines.length * lineHeight + 2
    
    // Calculate context lines for height calculation (reuse later for rendering)
    let contextLines: string[] = []
    if (discrepancy.context) {
      // Set font before text measurement
      state.doc.setFontSize(fontSize - 1)
      state.doc.setFont('helvetica', 'italic')
      // Clean context text - remove control characters and normalize
      let contextText = String(discrepancy.context || '').trim()
      // Remove control characters (U+0000-U+001F, U+007F-U+009F) and zero-width characters
      contextText = contextText.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
      // Normalize whitespace
      contextText = contextText.replace(/\s+/g, ' ')
      
      // Manual word wrapping (like apps column) - avoid splitTextToSize which causes character spacing
      // Use a smaller textWidth to ensure we don't overflow (add safety margin)
      const safeTextWidth = textWidth - 2 // Safety margin to prevent overflow
      if (contextText.length > 0) {
        const words = contextText.split(/\s+/).filter((w: string) => w.length > 0)
        let currentLine = ''
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i]
          const testLine = currentLine ? `${currentLine} ${word}` : word
          const testWidth = state.doc.getTextWidth(testLine)
          
          if (testWidth <= safeTextWidth) {
            currentLine = testLine
          } else {
            if (currentLine) {
              contextLines.push(currentLine)
              currentLine = word
              // Check if the word itself is too long - truncate if needed
              const wordWidth = state.doc.getTextWidth(word)
              if (wordWidth > safeTextWidth) {
                // Truncate the word
                let truncated = word
                while (state.doc.getTextWidth(truncated + '...') > safeTextWidth && truncated.length > 0) {
                  truncated = truncated.slice(0, -1)
                }
                contextLines.push(truncated + (truncated.length < word.length ? '...' : ''))
                currentLine = ''
              }
            } else {
              // Single word is too long - truncate it
              let truncated = word
              while (state.doc.getTextWidth(truncated + '...') > safeTextWidth && truncated.length > 0) {
                truncated = truncated.slice(0, -1)
              }
              contextLines.push(truncated + (truncated.length < word.length ? '...' : ''))
              currentLine = ''
            }
          }
        }
        
        if (currentLine) {
          contextLines.push(currentLine)
        }
      }
      contentHeight += 3 // Space before context
      contentHeight += contextLines.length * getLineHeight(fontSize - 1) + 2
    }
    
    const boxHeight = contentHeight + boxPadding // Bottom padding
    
    // Draw box with improved styling - subtle shadow effect
    // Shadow (drawn first, offset)
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
    
    // Main box background
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
    
    // Header with type and severity - improved spacing
    const headerY = boxY + boxPadding + lineHeight
    state.doc.setFontSize(fontSize)
    state.doc.setFont('helvetica', 'bold')
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
    state.doc.text(typeText, PDF_CONFIG.margin.left + boxPadding, headerY)
    
    // Severity badge - improved appearance with better styling
    const severityColor = getSeverityColor(discrepancy.severity)
    const badgeY = boxY + boxPadding // Position from top of box with padding
    
    // Draw badge background with subtle border
    state.doc.setFillColor(...colorTuple(severityColor))
    // Use slightly darker color for border to add depth
    const borderColor: [number, number, number] = [
      Math.max(0, severityColor[0] - 20),
      Math.max(0, severityColor[1] - 20),
      Math.max(0, severityColor[2] - 20)
    ]
    state.doc.setDrawColor(...colorTuple(borderColor))
    state.doc.setLineWidth(0.3)
    state.doc.rect(badgeX, badgeY, severityWidth, badgeHeight, 'FD')
    
    // Draw text centered in badge
    state.doc.setFontSize(fontSize - 1)
    state.doc.setFont('helvetica', 'bold')
    state.doc.setTextColor(255, 255, 255)
    // Center text vertically in badge - calculate proper baseline
    const badgeTextLineHeight = getLineHeight(fontSize - 1)
    const badgeTextY = badgeY + (badgeHeight / 2) + (badgeTextLineHeight / 2) - 0.5
    const badgeTextX = badgeX + badgePadding
    state.doc.text(severityText, badgeTextX, badgeTextY)
    
    // Time - place on new line if type text is too long, otherwise place after type text
    state.doc.setFontSize(fontSize - 1)
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.secondary))
    state.doc.setFont('helvetica', 'normal')
    
    if (timeOnNewLine) {
      // Place time on new line if not enough space
      state.doc.text(timeText, PDF_CONFIG.margin.left + boxPadding, headerY + lineHeight + getLineHeight(fontSize - 1) + 2)
    } else {
      // Place time after type text
      const timeX = PDF_CONFIG.margin.left + boxPadding + typeTextWidth + 5
      state.doc.text(timeText, timeX, headerY)
    }
    
    // Description - start after header (account for time if on same line or new line)
    // Improved spacing between header and content
    let currentY = headerY + lineHeight + 6
    if (timeOnNewLine) {
      currentY += getLineHeight(fontSize - 1) + 3
    }
    
    // Render description lines individually - use EXACT same approach as apps column
    let descriptionY = currentY + lineHeight
    // Use the same removeControlChars function approach as apps column
    const removeControlChars = (str: string): string => {
      return str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    }
    
    descriptionLines.forEach((line: string) => {
      // Clean the text exactly like apps column does
      let textToRender = removeControlChars(String(line))
      // Remove any remaining problematic characters
      textToRender = textToRender.replace(/[\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, '')
      // Ensure no array-like behavior - create a fresh string
      textToRender = String(textToRender).trim()
      
      if (textToRender.length > 0) {
        // Set font before each text call - exactly like apps column
        state.doc.setFontSize(fontSize)
        state.doc.setFont('helvetica', 'normal')
        state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
        // CRITICAL: Render as a simple string - no options, no extra processing
        // Pass the string directly to ensure jsPDF treats it as atomic text
        state.doc.text(textToRender, PDF_CONFIG.margin.left + boxPadding, descriptionY)
      }
      descriptionY += lineHeight
    })
    currentY = descriptionY - lineHeight + 2
    
    if (discrepancy.context && contextLines.length > 0) {
      // Render context lines individually - use EXACT same approach as apps column
      const contextLineHeight = getLineHeight(fontSize - 1)
      let contextY = currentY + contextLineHeight
      // Use the same removeControlChars function approach as apps column
      const removeControlChars = (str: string): string => {
        return str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      }
      
      contextLines.forEach((line: string) => {
        // Clean the text exactly like apps column does
        let textToRender = removeControlChars(String(line))
        // Remove any remaining problematic characters
        textToRender = textToRender.replace(/[\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, '')
        // Ensure no array-like behavior - create a fresh string
        textToRender = String(textToRender).trim()
        
        if (textToRender.length > 0) {
          // Set font before each text call - exactly like apps column
          state.doc.setFontSize(fontSize - 1)
          state.doc.setFont('helvetica', 'italic')
          state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.secondary))
          // CRITICAL: Render as a simple string - no options, no extra processing
          // Pass the string directly to ensure jsPDF treats it as atomic text
          state.doc.text(textToRender, PDF_CONFIG.margin.left + boxPadding, contextY)
        }
        contextY += contextLineHeight
      })
      currentY = contextY - contextLineHeight + 2
    }
    
    state.y = boxY + boxHeight + PDF_CONFIG.spacing.medium
  })
}

/**
 * Checks if a daily report has no activity
 * 
 * INPUTS:
 * - dailyReport: object - Daily report object
 * 
 * OUTPUTS:
 * - boolean - True if no activity
 */
function hasNoActivity(dailyReport: any): boolean {
  const hasActiveTime = dailyReport.totalActiveMinutes && dailyReport.totalActiveMinutes > 0
  const hasAfkTime = dailyReport.totalAfkMinutes && dailyReport.totalAfkMinutes > 0
  const hasHourlyData = dailyReport.hourlyBreakdown && dailyReport.hourlyBreakdown.length > 0 && 
    dailyReport.hourlyBreakdown.some((hour: any) => (hour.activeMinutes && hour.activeMinutes > 0) || (hour.afkMinutes && hour.afkMinutes > 0))
  const hasDiscrepancies = dailyReport.notableDiscrepancies && dailyReport.notableDiscrepancies.length > 0
  
  return !hasActiveTime && !hasAfkTime && !hasHourlyData && !hasDiscrepancies
}

/**
 * Combines consecutive days with no activity into a single report
 * 
 * INPUTS:
 * - dailyReports: array - Array of daily report objects
 * 
 * OUTPUTS:
 * - array - Processed array with consecutive inactive days combined
 */
function combineInactiveDays(dailyReports: any[]): any[] {
  if (!dailyReports || dailyReports.length === 0) {
    return []
  }
  
  const processed: any[] = []
  let inactiveStart: any = null
  let inactiveEnd: any = null
  
  for (let i = 0; i < dailyReports.length; i++) {
    const report = dailyReports[i]
    const isInactive = hasNoActivity(report)
    
    if (isInactive) {
      if (!inactiveStart) {
        inactiveStart = report
        inactiveEnd = report
      } else {
        inactiveEnd = report
      }
    } else {
      // If we have accumulated inactive days, add combined report
      if (inactiveStart && inactiveEnd) {
        if (inactiveStart === inactiveEnd) {
          // Single inactive day
          processed.push(inactiveStart)
        } else {
          // Multiple consecutive inactive days - combine them
          const combinedReport = {
            ...inactiveStart,
            date: inactiveStart.date, // Start date
            endDate: inactiveEnd.date, // End date
            isCombined: true,
            combinedDays: true
          }
          processed.push(combinedReport)
        }
        inactiveStart = null
        inactiveEnd = null
      }
      // Add active day
      processed.push(report)
    }
  }
  
  // Handle trailing inactive days
  if (inactiveStart && inactiveEnd) {
    if (inactiveStart === inactiveEnd) {
      processed.push(inactiveStart)
    } else {
      const combinedReport = {
        ...inactiveStart,
        date: inactiveStart.date,
        endDate: inactiveEnd.date,
        isCombined: true,
        combinedDays: true
      }
      processed.push(combinedReport)
    }
  }
  
  return processed
}

/**
 * Formats a daily report section
 * 
 * INPUTS:
 * - doc: jsPDF - PDF document instance
 * - dailyReport: object - Daily report object
 * 
 * OUTPUTS:
 * - void
 */
function formatDailyReport(state: PDFState, dailyReport: any): void {
  checkPageBreak(state, 50)
  
  // Handle combined inactive days
  let formattedDate: string
  if (dailyReport.isCombined && dailyReport.combinedDays && dailyReport.endDate) {
    const startDate = new Date(dailyReport.date)
    const endDate = new Date(dailyReport.endDate)
    const startFormatted = startDate.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    const endFormatted = endDate.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    formattedDate = `${startFormatted} - ${endFormatted}`
  } else {
    const date = new Date(dailyReport.date)
    formattedDate = date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }
  
  // Date header - in a box
  const dateBoxPadding = PDF_CONFIG.boxPadding.small
  state.doc.setFontSize(PDF_CONFIG.fonts.large)
  state.doc.setFont('helvetica', 'bold')
  const dateLineHeight = getLineHeight(PDF_CONFIG.fonts.large)
  const dateBoxHeight = dateLineHeight + (dateBoxPadding * 2)
  const dateBoxY = state.y
  
  // Date box
  state.doc.setFillColor(220, 220, 220)
  state.doc.setDrawColor(220, 220, 220)
  state.doc.setLineWidth(0)
  state.doc.rect(PDF_CONFIG.margin.left + 0.5, dateBoxY + 0.5, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, dateBoxHeight, 'F')
  
  state.doc.setFillColor(...colorTuple(PDF_CONFIG.colors.primary))
  state.doc.setDrawColor(...colorTuple(PDF_CONFIG.colors.primary))
  state.doc.setLineWidth(0.5)
  state.doc.rect(PDF_CONFIG.margin.left, dateBoxY, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, dateBoxHeight, 'FD')
  
  state.doc.setTextColor(255, 255, 255)
  state.doc.text(formattedDate, PDF_CONFIG.margin.left + dateBoxPadding, dateBoxY + dateLineHeight + dateBoxPadding)
  state.y = dateBoxY + dateBoxHeight + PDF_CONFIG.spacing.medium
  
  // Stats - in a box
  const statsBoxPadding = PDF_CONFIG.boxPadding.small
  state.doc.setFontSize(PDF_CONFIG.fonts.small)
  state.doc.setFont('helvetica', 'normal')
  const statsLineHeight = getLineHeight(PDF_CONFIG.fonts.small)
  const statsBoxY = state.y
  const statsBoxHeight = statsLineHeight + (statsBoxPadding * 2)
  
  // Stats box shadow
  state.doc.setFillColor(220, 220, 220)
  state.doc.setDrawColor(220, 220, 220)
  state.doc.setLineWidth(0)
  state.doc.rect(PDF_CONFIG.margin.left + 0.5, statsBoxY + 0.5, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, statsBoxHeight, 'F')
  
  // Stats box
  state.doc.setFillColor(255, 255, 255)
  state.doc.setDrawColor(180, 180, 180)
  state.doc.setLineWidth(0.5)
  state.doc.rect(PDF_CONFIG.margin.left, statsBoxY, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, statsBoxHeight, 'FD')
  
  state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
  state.doc.text(`Total Active Time: ${formatTime(dailyReport.totalActiveMinutes)}`, PDF_CONFIG.margin.left + statsBoxPadding, statsBoxY + statsLineHeight + statsBoxPadding)
  state.doc.text(`Total AFK Time: ${formatTime(dailyReport.totalAfkMinutes)}`, PDF_CONFIG.margin.left + 100, statsBoxY + statsLineHeight + statsBoxPadding)
  state.y = statsBoxY + statsBoxHeight + PDF_CONFIG.spacing.medium
  
  // Hourly breakdown
  if (dailyReport.hourlyBreakdown && dailyReport.hourlyBreakdown.length > 0) {
    checkPageBreak(state, 40) // Check page break before section header
    state.y = state.y + PDF_CONFIG.spacing.small // Extra spacing before section
    const sectionHeaderPadding = PDF_CONFIG.boxPadding.small
    state.doc.setFontSize(PDF_CONFIG.fonts.medium)
    state.doc.setFont('helvetica', 'bold')
    const sectionHeaderLineHeight = getLineHeight(PDF_CONFIG.fonts.medium)
    const sectionHeaderBoxY = state.y
    const sectionHeaderBoxHeight = sectionHeaderLineHeight + (sectionHeaderPadding * 2)
    
    // Section header box shadow
    state.doc.setFillColor(220, 220, 220)
    state.doc.setDrawColor(220, 220, 220)
    state.doc.setLineWidth(0)
    state.doc.rect(PDF_CONFIG.margin.left + 0.5, sectionHeaderBoxY + 0.5, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, sectionHeaderBoxHeight, 'F')
    
    // Section header box
    state.doc.setFillColor(...colorTuple(PDF_CONFIG.colors.primary))
    state.doc.setDrawColor(...colorTuple(PDF_CONFIG.colors.primary))
    state.doc.setLineWidth(0.5)
    state.doc.rect(PDF_CONFIG.margin.left, sectionHeaderBoxY, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, sectionHeaderBoxHeight, 'FD')
    
    state.doc.setTextColor(255, 255, 255)
    state.doc.text('Hourly Breakdown', PDF_CONFIG.margin.left + sectionHeaderPadding, sectionHeaderBoxY + sectionHeaderLineHeight + sectionHeaderPadding)
    state.y = sectionHeaderBoxY + sectionHeaderBoxHeight + PDF_CONFIG.spacing.small
    formatHourlyBreakdown(state, dailyReport.hourlyBreakdown)
    
    // Note: Timeline events are excluded from PDF generation per requirements
  }
  
  // Discrepancies
  if (dailyReport.notableDiscrepancies && dailyReport.notableDiscrepancies.length > 0) {
    checkPageBreak(state, 30)
    state.y = state.y + PDF_CONFIG.spacing.small // Extra spacing before section
    const sectionHeaderPadding = PDF_CONFIG.boxPadding.small
    state.doc.setFontSize(PDF_CONFIG.fonts.medium)
    state.doc.setFont('helvetica', 'bold')
    const sectionHeaderLineHeight = getLineHeight(PDF_CONFIG.fonts.medium)
    const sectionHeaderBoxY = state.y
    const sectionHeaderBoxHeight = sectionHeaderLineHeight + (sectionHeaderPadding * 2)
    
    // Section header box shadow
    state.doc.setFillColor(220, 220, 220)
    state.doc.setDrawColor(220, 220, 220)
    state.doc.setLineWidth(0)
    state.doc.rect(PDF_CONFIG.margin.left + 0.5, sectionHeaderBoxY + 0.5, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, sectionHeaderBoxHeight, 'F')
    
    // Section header box
    state.doc.setFillColor(...colorTuple(PDF_CONFIG.colors.primary))
    state.doc.setDrawColor(...colorTuple(PDF_CONFIG.colors.primary))
    state.doc.setLineWidth(0.5)
    state.doc.rect(PDF_CONFIG.margin.left, sectionHeaderBoxY, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, sectionHeaderBoxHeight, 'FD')
    
    state.doc.setTextColor(255, 255, 255)
    state.doc.text('Notable Unproductive Activity', PDF_CONFIG.margin.left + sectionHeaderPadding, sectionHeaderBoxY + sectionHeaderLineHeight + sectionHeaderPadding)
    state.y = sectionHeaderBoxY + sectionHeaderBoxHeight + PDF_CONFIG.spacing.small
    formatNotableDiscrepancies(state, dailyReport.notableDiscrepancies)
  }
  
  // Summary - in a box
  if (dailyReport.summary) {
    checkPageBreak(state, 30)
    const summaryBoxPadding = PDF_CONFIG.boxPadding.medium
    state.doc.setFontSize(PDF_CONFIG.fonts.small)
    state.doc.setFont('helvetica', 'normal')
    const summaryLines = state.doc.splitTextToSize(dailyReport.summary, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right - (summaryBoxPadding * 2))
    const summaryLineHeight = getLineHeight(PDF_CONFIG.fonts.small)
    const summaryBoxY = state.y
    const summaryBoxHeight = (summaryLines.length * summaryLineHeight) + (summaryBoxPadding * 2)
    
    // Summary box shadow
    state.doc.setFillColor(220, 220, 220)
    state.doc.setDrawColor(220, 220, 220)
    state.doc.setLineWidth(0)
    state.doc.rect(PDF_CONFIG.margin.left + 0.5, summaryBoxY + 0.5, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, summaryBoxHeight, 'F')
    
    // Summary box
    state.doc.setFillColor(255, 255, 255)
    state.doc.setDrawColor(180, 180, 180)
    state.doc.setLineWidth(0.5)
    state.doc.rect(PDF_CONFIG.margin.left, summaryBoxY, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, summaryBoxHeight, 'FD')
    
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
    let summaryY = summaryBoxY + summaryLineHeight + summaryBoxPadding
    summaryLines.forEach((line: string) => {
      state.doc.text(line.trim(), PDF_CONFIG.margin.left + summaryBoxPadding, summaryY)
      summaryY += summaryLineHeight
    })
    state.y = summaryBoxY + summaryBoxHeight + PDF_CONFIG.spacing.medium
  }
  
  state.y = state.y + PDF_CONFIG.spacing.medium
}

/**
 * Formats the user ranking section
 * 
 * INPUTS:
 * - doc: jsPDF - PDF document instance
 * - userRanking: object - User ranking object
 * 
 * OUTPUTS:
 * - void
 */
function formatUserRanking(state: PDFState, userRanking: any): void {
  if (!userRanking || !userRanking.rankings || !Array.isArray(userRanking.rankings)) {
    return
  }
  
  checkPageBreak(state, 40)
  
  addHeader(state, 'User Rankings')
  
  // Table
  const startX = PDF_CONFIG.margin.left
  const startY = state.y
  let currentY = startY
  
  // Column widths (adjusted for A4) - total must fit within available width (180mm)
  // Available width: 210 - 15 (left margin) - 15 (right margin) = 180mm
  const colWidths = [12, 35, 25, 25, 20, 18, 20, 25, 0] // Insights will use remaining space
  const tableWidth = PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right
  const usedWidth = colWidths.slice(0, -1).reduce((sum, w) => sum + w, 0) + 1 // +1 for padding
  colWidths[8] = Math.max(15, tableWidth - usedWidth - 1) // Ensure minimum 15mm for Insights
  const headers = ['Rank', 'User', 'Total Active', 'Avg Daily', 'Total AFK', 'Active %', 'Discrep.', 'Critical', 'Insights']
  
  // Header row
  const tableFontSize = PDF_CONFIG.fonts.small - 1
  state.doc.setFontSize(tableFontSize)
  state.doc.setFont('helvetica', 'bold')
  state.doc.setFillColor(...colorTuple(PDF_CONFIG.colors.light))
  const tableLineHeight = getLineHeight(tableFontSize)
  const tableRowHeight = tableLineHeight + 4
  state.doc.rect(startX, currentY, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, tableRowHeight, 'F')
  
  let xPos = startX + 1
  headers.forEach((header, index) => {
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
    state.doc.text(header, xPos, currentY + tableLineHeight)
    xPos += colWidths[index]
  })
  
  currentY += tableRowHeight
  state.doc.setFont('helvetica', 'normal')
  state.doc.setFontSize(tableFontSize)
  
  // Data rows
  userRanking.rankings.forEach((ranking: any) => {
    const tempState: PDFState = { doc: state.doc, y: currentY }
    checkPageBreak(tempState, 8)
    if (tempState.y !== currentY) {
      currentY = tempState.y
      state.y = currentY
    }
    
    xPos = startX + 1
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
    const rowTextY = currentY + tableLineHeight
    
    // Rank
    state.doc.setFont('helvetica', 'bold')
    state.doc.text(`#${ranking.rank}`, xPos, rowTextY)
    xPos += colWidths[0]
    
    // User name (truncate if needed)
    state.doc.setFont('helvetica', 'normal')
    let userName = ranking.userName || 'Unknown'
    if (state.doc.getTextWidth(userName) > colWidths[1] - 2) {
      while (state.doc.getTextWidth(userName + '...') > colWidths[1] - 2 && userName.length > 0) {
        userName = userName.slice(0, -1)
      }
      userName += '...'
    }
    state.doc.text(userName, xPos, rowTextY)
    xPos += colWidths[1]
    
    // Stats
    state.doc.text(`${ranking.totalActiveHours.toFixed(1)}h`, xPos, rowTextY)
    xPos += colWidths[2]
    state.doc.text(`${ranking.averageDailyActiveHours.toFixed(1)}h`, xPos, rowTextY)
    xPos += colWidths[3]
    state.doc.text(`${ranking.totalAfkHours.toFixed(1)}h`, xPos, rowTextY)
    xPos += colWidths[4]
    state.doc.text(`${ranking.activePercentage.toFixed(1)}%`, xPos, rowTextY)
    xPos += colWidths[5]
    state.doc.text(`${ranking.totalDiscrepancies}`, xPos, rowTextY)
    xPos += colWidths[6]
    
    // Critical discrepancies (highlighted)
    if (ranking.criticalDiscrepancies > 0) {
      state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.danger))
      state.doc.setFont('helvetica', 'bold')
    }
    state.doc.text(`${ranking.criticalDiscrepancies}`, xPos, rowTextY)
    xPos += colWidths[7]
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
    state.doc.setFont('helvetica', 'normal')
    
    // Insights (truncate if needed to fit column width)
    const insights = ranking.insights || '-'
    const maxInsightsWidth = colWidths[8] - 2
    let insightsText = insights
    if (insights !== '-' && state.doc.getTextWidth(insightsText) > maxInsightsWidth) {
      // Truncate to fit column width
      while (state.doc.getTextWidth(insightsText + '...') > maxInsightsWidth && insightsText.length > 0) {
        insightsText = insightsText.slice(0, -1)
      }
      insightsText += '...'
    }
    state.doc.text(insightsText, xPos, rowTextY)
    
    currentY += tableRowHeight
    
    // Row border
    state.doc.setDrawColor(240, 240, 240)
    state.doc.setLineWidth(0.1)
    state.doc.line(startX, currentY, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.right, currentY)
  })
  
  state.y = currentY + PDF_CONFIG.spacing.small
  
  // Summary - in a box
  if (userRanking.summary) {
    checkPageBreak(state, 30)
    const summaryBoxPadding = PDF_CONFIG.boxPadding.medium
    state.doc.setFontSize(PDF_CONFIG.fonts.small)
    state.doc.setFont('helvetica', 'normal')
    const summaryLines = state.doc.splitTextToSize(userRanking.summary, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right - (summaryBoxPadding * 2))
    const summaryLineHeight = getLineHeight(PDF_CONFIG.fonts.small)
    const summaryBoxY = state.y
    const summaryBoxHeight = (summaryLines.length * summaryLineHeight) + (summaryBoxPadding * 2)
    
    // Summary box shadow
    state.doc.setFillColor(220, 220, 220)
    state.doc.setDrawColor(220, 220, 220)
    state.doc.setLineWidth(0)
    state.doc.rect(PDF_CONFIG.margin.left + 0.5, summaryBoxY + 0.5, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, summaryBoxHeight, 'F')
    
    // Summary box
    state.doc.setFillColor(255, 255, 255)
    state.doc.setDrawColor(180, 180, 180)
    state.doc.setLineWidth(0.5)
    state.doc.rect(PDF_CONFIG.margin.left, summaryBoxY, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, summaryBoxHeight, 'FD')
    
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
    let summaryY = summaryBoxY + summaryLineHeight + summaryBoxPadding
    summaryLines.forEach((line: string) => {
      state.doc.text(line.trim(), PDF_CONFIG.margin.left + summaryBoxPadding, summaryY)
      summaryY += summaryLineHeight
    })
    state.y = summaryBoxY + summaryBoxHeight + PDF_CONFIG.spacing.medium
  }
}

/**
 * Formats the overall report summary section
 * 
 * INPUTS:
 * - doc: jsPDF - PDF document instance
 * - overallReport: object - Overall report object
 * 
 * OUTPUTS:
 * - void
 */
function formatOverallReport(state: PDFState, overallReport: any): void {
  checkPageBreak(state, 60)
  
  const periodStart = new Date(overallReport.periodStart).toLocaleDateString('en-GB')
  const periodEnd = new Date(overallReport.periodEnd).toLocaleDateString('en-GB')
  const periodRange = periodStart === periodEnd ? periodStart : `${periodStart} - ${periodEnd}`
  
  addHeader(state, 'Overall Report Summary', `Period: ${periodRange}`)
  
  // Stats grid
  const stats = [
    { label: 'Total Active Time', value: formatTime(overallReport.totalActiveMinutes) },
    { label: 'Total AFK Time', value: formatTime(overallReport.totalAfkMinutes) },
    { label: 'Average Daily Active', value: formatTime(overallReport.averageDailyActiveMinutes) },
    { label: 'Total Discrepancies', value: overallReport.totalDiscrepancies.toString() },
    { label: 'Critical Discrepancies', value: overallReport.criticalDiscrepancies.toString(), highlight: true }
  ]
  
  const boxSpacing = 8 // Spacing between stat boxes
  const boxWidth = (PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right - (boxSpacing * 2)) / 3
  const boxHeight = 24 // Increased height for better appearance
  const statBoxPadding = PDF_CONFIG.boxPadding.small
  let xPos = PDF_CONFIG.margin.left
  let yPos = state.y
  
  stats.forEach((stat, index) => {
    if (index > 0 && index % 3 === 0) {
      yPos += boxHeight + boxSpacing
      xPos = PDF_CONFIG.margin.left
      const tempState: PDFState = { doc: state.doc, y: yPos }
      checkPageBreak(tempState, boxHeight + boxSpacing)
      if (tempState.y !== yPos - boxHeight - boxSpacing) {
        yPos = tempState.y
        state.y = yPos
      }
    }
    
    // Stat box with improved styling - subtle shadow
    const fillColor = stat.highlight ? [255, 240, 240] : PDF_CONFIG.colors.light
    // Shadow
    state.doc.setFillColor(220, 220, 220)
    state.doc.setDrawColor(220, 220, 220)
    state.doc.setLineWidth(0)
    state.doc.rect(xPos + 0.5, yPos + 0.5, boxWidth, boxHeight, 'F')
    
    // Main box
    state.doc.setFillColor(...colorTuple(fillColor))
    state.doc.setDrawColor(180, 180, 180)
    state.doc.setLineWidth(0.5)
    state.doc.rect(xPos, yPos, boxWidth, boxHeight, 'FD')
    
    // Label
    state.doc.setFontSize(PDF_CONFIG.fonts.small)
    state.doc.setFont('helvetica', 'normal')
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.secondary))
    const labelLines = state.doc.splitTextToSize(stat.label, boxWidth - (statBoxPadding * 2))
    const labelLineHeight = getLineHeight(PDF_CONFIG.fonts.small)
    state.doc.text(labelLines, xPos + statBoxPadding, yPos + labelLineHeight + statBoxPadding)
    
    // Value
    state.doc.setFontSize(PDF_CONFIG.fonts.medium)
    state.doc.setFont('helvetica', 'bold')
    if (stat.highlight) {
      state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.danger))
    } else {
      state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
    }
    const valueLineHeight = getLineHeight(PDF_CONFIG.fonts.medium)
    const valueY = yPos + (labelLines.length * labelLineHeight) + valueLineHeight + statBoxPadding
    state.doc.text(stat.value, xPos + statBoxPadding, valueY)
    
    xPos += boxWidth + boxSpacing
  })
  
  state.y = yPos + boxHeight + PDF_CONFIG.spacing.medium
  
  // Summary - in a box
  if (overallReport.summary) {
    checkPageBreak(state, 30)
    const summaryBoxPadding = PDF_CONFIG.boxPadding.medium
    state.doc.setFontSize(PDF_CONFIG.fonts.small)
    state.doc.setFont('helvetica', 'normal')
    const summaryLines = state.doc.splitTextToSize(overallReport.summary, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right - (summaryBoxPadding * 2))
    const summaryLineHeight = getLineHeight(PDF_CONFIG.fonts.small)
    const summaryBoxY = state.y
    const summaryBoxHeight = (summaryLines.length * summaryLineHeight) + (summaryBoxPadding * 2)
    
    // Summary box shadow
    state.doc.setFillColor(220, 220, 220)
    state.doc.setDrawColor(220, 220, 220)
    state.doc.setLineWidth(0)
    state.doc.rect(PDF_CONFIG.margin.left + 0.5, summaryBoxY + 0.5, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, summaryBoxHeight, 'F')
    
    // Summary box
    state.doc.setFillColor(255, 255, 255)
    state.doc.setDrawColor(180, 180, 180)
    state.doc.setLineWidth(0.5)
    state.doc.rect(PDF_CONFIG.margin.left, summaryBoxY, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right, summaryBoxHeight, 'FD')
    
    state.doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
    let summaryY = summaryBoxY + summaryLineHeight + summaryBoxPadding
    summaryLines.forEach((line: string) => {
      state.doc.text(line.trim(), PDF_CONFIG.margin.left + summaryBoxPadding, summaryY)
      summaryY += summaryLineHeight
    })
    state.y = summaryBoxY + summaryBoxHeight + PDF_CONFIG.spacing.medium
  }
  
  // Conclusion - improved styling
  if (overallReport.conclusion) {
    checkPageBreak(state, 30)
    const isCritical = overallReport.conclusion.includes('CRITICAL')
    const conclusionFontSize = PDF_CONFIG.fonts.small
    const conclusionLineHeight = getLineHeight(conclusionFontSize)
    const conclusionText = `Conclusion: ${overallReport.conclusion}`
    const boxPadding = PDF_CONFIG.boxPadding.medium
    const boxWidth = PDF_CONFIG.pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right
    const availableWidth = boxWidth - (boxPadding * 2)
    
    state.doc.setFontSize(conclusionFontSize)
    state.doc.setFont('helvetica', 'bold') // Set font before splitTextToSize
    const conclusionLines = state.doc.splitTextToSize(conclusionText, availableWidth)
    const conclusionBoxHeight = (conclusionLines.length * conclusionLineHeight) + (boxPadding * 2)
    const conclusionBoxY = state.y
    
    // Shadow effect
    state.doc.setFillColor(220, 220, 220)
    state.doc.setDrawColor(220, 220, 220)
    state.doc.setLineWidth(0)
    state.doc.rect(
      PDF_CONFIG.margin.left + 0.5,
      conclusionBoxY + 0.5,
      boxWidth,
      conclusionBoxHeight,
      'F'
    )
    
    // Main conclusion box
    state.doc.setFillColor(...colorTuple(isCritical ? [255, 240, 240] : PDF_CONFIG.colors.light))
    const borderColor = isCritical ? PDF_CONFIG.colors.danger : [180, 180, 180]
    state.doc.setDrawColor(...colorTuple(borderColor))
    state.doc.setLineWidth(0.5)
    state.doc.rect(
      PDF_CONFIG.margin.left,
      conclusionBoxY,
      boxWidth,
      conclusionBoxHeight,
      'FD'
    )
    
    state.doc.setFontSize(conclusionFontSize)
    state.doc.setFont('helvetica', 'bold')
    state.doc.setTextColor(...colorTuple(isCritical ? PDF_CONFIG.colors.danger : PDF_CONFIG.colors.dark))
    // Render each line individually to ensure proper positioning
    let conclusionY = conclusionBoxY + conclusionLineHeight + boxPadding
    conclusionLines.forEach((line: string) => {
      state.doc.text(line.trim(), PDF_CONFIG.margin.left + boxPadding, conclusionY)
      conclusionY += conclusionLineHeight
    })
    state.y = conclusionBoxY + conclusionBoxHeight + PDF_CONFIG.spacing.medium
  }
}

/**
 * Generates a PDF document from report data
 * 
 * INPUTS:
 * - reportData: object - Parsed report data
 * - filename?: string - Optional filename (default: "report.pdf")
 * 
 * OUTPUTS:
 * - void - Triggers PDF download
 */
export function generatePDF(reportData: any, filename: string = 'report.pdf'): void {
  if (!reportData || !reportData.organizations) {
    console.error('Invalid report data structure')
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
  doc.text('Activity Report', PDF_CONFIG.pageWidth / 2, PDF_CONFIG.pageHeight / 2 - 20, { align: 'center' })
  
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
    
    // User ranking (if available)
    if (org.userRanking) {
      formatUserRanking(state, org.userRanking)
      state.y = state.y + PDF_CONFIG.spacing.large
    }
    
    // Process each user
    org.users.forEach((user: any, userIndex: number) => {
      if (userIndex > 0 || org.userRanking) {
        checkPageBreak(state, 30)
        addHeader(state, `User: ${user.userName}`)
      }
      
      // Overall report
      if (user.overallReport) {
        formatOverallReport(state, user.overallReport)
      }
      
      // Daily reports
      if (user.dailyReports && user.dailyReports.length > 0) {
        checkPageBreak(state, 20)
        doc.setFontSize(PDF_CONFIG.fonts.medium)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...colorTuple(PDF_CONFIG.colors.dark))
        doc.text('Daily Reports', PDF_CONFIG.margin.left, state.y)
        state.y = state.y + PDF_CONFIG.spacing.medium
        
        // Combine consecutive days with no activity
        const processedReports = combineInactiveDays(user.dailyReports)
        processedReports.forEach((report: any) => {
          formatDailyReport(state, report)
        })
      }
    })
  })
  
  // Add footers to all pages
  addFooter(doc)
  
  // Save PDF
  doc.save(filename)
}

