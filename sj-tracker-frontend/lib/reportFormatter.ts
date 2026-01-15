/**
 * ============================================================================
 * REPORT FORMATTER UTILITIES
 * ============================================================================
 * 
 * PURPOSE: Utility functions for formatting report data into HTML
 * 
 * DESCRIPTION:
 * These functions convert the raw report JSON data into formatted HTML
 * for display. They handle user rankings, daily reports, hourly breakdowns,
 * and discrepancies.
 * 
 * ============================================================================
 */

/**
 * Formats minutes into hours and minutes string
 * 
 * INPUTS:
 * - minutes: number - Total minutes
 * 
 * OUTPUTS:
 * - string - Formatted time string (e.g., "4h 30m")
 */
export function formatTime(minutes: number): string {
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
 * Formats severity level with appropriate styling class
 * 
 * INPUTS:
 * - severity: string - Severity level (high, medium, low, critical)
 * 
 * OUTPUTS:
 * - string - HTML with severity badge
 */
export function formatSeverity(severity: string): string {
  const severityClass = severity.toLowerCase()
  return `<span class="severity-badge severity-${severityClass}">${severity.toUpperCase()}</span>`
}

/**
 * Formats duration in seconds to human-readable string
 * 
 * INPUTS:
 * - seconds: number - Duration in seconds
 * 
 * OUTPUTS:
 * - string - Formatted duration (e.g., "7s", "2m 30s", "1h 15m")
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (minutes < 60) {
    if (remainingSeconds > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${minutes}m`
  }
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  if (remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`
  }
  return `${hours}h`
}

/**
 * Gets productivity color class based on score
 * 
 * INPUTS:
 * - score: number - Productivity score (0-10)
 * 
 * OUTPUTS:
 * - string - CSS class name for productivity level
 */
function getProductivityClass(score: number): string {
  if (score <= 1) return 'productivity-low'
  if (score <= 5) return 'productivity-mixed'
  return 'productivity-high'
}

/**
 * Gets productivity label based on score
 * 
 * INPUTS:
 * - score: number - Productivity score (0-10)
 * 
 * OUTPUTS:
 * - string - Human-readable productivity label
 */
function getProductivityLabel(score: number): string {
  if (score <= 1) return 'Low Productivity'
  if (score <= 5) return 'Mixed'
  return 'High Productivity'
}

/**
 * Formats a timeline event into HTML
 * 
 * INPUTS:
 * - event: object - Timeline event object
 * 
 * OUTPUTS:
 * - string - HTML string for the event
 */
function formatTimelineEvent(event: any): string {
  // Escape HTML to prevent XSS
  const escapeHtml = (text: string | null | undefined): string => {
    if (!text) return ''
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
  
  const eventTime = event.time ? new Date(event.time) : new Date()
  const formattedTime = eventTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  
  const productiveScore = event.productiveScore ?? 0
  const productivityClass = getProductivityClass(productiveScore)
  const productivityLabel = getProductivityLabel(productiveScore)
  const duration = formatDuration(event.durationSeconds ?? 0)
  
  const safeDescription = escapeHtml(event.description)
  const safeApp = escapeHtml(event.app)
  const safeAppTitle = escapeHtml(event.appTitle)
  
  return `<div class="timeline-event ${productivityClass}">
    <div class="timeline-event-header">
      <span class="timeline-time">${formattedTime}</span>
      <span class="timeline-app">${safeApp || 'Unknown'}</span>
      <span class="productivity-badge ${productivityClass}">${productivityLabel} (${productiveScore})</span>
      <span class="timeline-duration">${duration}</span>
    </div>
    ${safeAppTitle ? `<div class="timeline-app-title">${safeAppTitle}</div>` : ''}
    <div class="timeline-description">${safeDescription || 'No description available'}</div>
  </div>`
}


/**
 * Checks if an hour has zero activity
 * 
 * INPUTS:
 * - hour: object - Hour object
 * 
 * OUTPUTS:
 * - boolean - True if hour has zero activity
 */
function isZeroActivity(hour: any): boolean {
  const hasActiveTime = hour.activeMinutes && hour.activeMinutes > 0
  const hasAppUsage = hour.appUsage && hour.appUsage.length > 0
  return !hasActiveTime && !hasAppUsage
}

/**
 * Formats the hourly breakdown into HTML table
 * 
 * INPUTS:
 * - hourlyBreakdown: array - Array of hour objects
 * 
 * OUTPUTS:
 * - string - HTML table string with timeline events section
 */
export function formatHourlyBreakdown(hourlyBreakdown: any[]): string {
  let html = '<div class="hourly-table-container"><table class="hourly-table"><thead><tr><th>Time</th><th>Active</th><th>AFK</th><th>Apps Used</th><th>Timeline Events</th></tr></thead><tbody>'
  
  // Track hours with timeline events for display below table
  const hoursWithTimelineEvents: Array<{ hour: any; index: number }> = []
  
  let i = 0
  while (i < hourlyBreakdown.length) {
    const hour = hourlyBreakdown[i]
    
    if (isZeroActivity(hour)) {
      // Group consecutive zero-activity hours
      const offlineStart = hour.startTime
      let offlineEnd = hour.endTime
      let offlineCount = 1
      
      // Look ahead to find consecutive zero-activity hours
      while (i + offlineCount < hourlyBreakdown.length && 
             isZeroActivity(hourlyBreakdown[i + offlineCount])) {
        offlineEnd = hourlyBreakdown[i + offlineCount].endTime
        offlineCount++
      }
      
      // Add offline row
      html += `<tr class="offline-row">
        <td>${offlineStart} - ${offlineEnd}</td>
        <td colspan="4" class="offline-cell">Offline</td>
      </tr>`
      
      i += offlineCount
    } else {
      // Regular activity hour
      const appsList = hour.appUsage && hour.appUsage.length > 0
        ? hour.appUsage.map((app: any) => `${app.appName} (${formatTime(app.durationMinutes)})`).join(', ')
        : 'None'
      
      // Check for timeline events
      const hasTimelineEvents = hour.timelineEvents && Array.isArray(hour.timelineEvents) && hour.timelineEvents.length > 0
      const eventCount = hasTimelineEvents ? hour.timelineEvents.length : 0
      
      if (hasTimelineEvents) {
        hoursWithTimelineEvents.push({ hour, index: i })
      }
      
      html += `<tr class="hour-row" data-hour-index="${i}">
        <td>${hour.startTime} - ${hour.endTime}</td>
        <td>${formatTime(hour.activeMinutes)}</td>
        <td>${formatTime(hour.afkMinutes)}</td>
        <td class="apps-cell">${appsList || 'None'}</td>
        <td class="timeline-cell">${hasTimelineEvents ? `<span class="timeline-indicator">${eventCount} event${eventCount !== 1 ? 's' : ''}</span>` : '<span class="no-timeline">-</span>'}</td>
      </tr>`
      
      i++
    }
  }
  
  html += '</tbody></table></div>'
  
  // Add timeline events section after the table
  if (hoursWithTimelineEvents.length > 0) {
    html += '<div class="timeline-events-section"><h4>Timeline Events</h4>'
    
    hoursWithTimelineEvents.forEach(({ hour }) => {
      const timelineHtml = formatTimelineEventsForHour(hour)
      if (timelineHtml) {
        html += timelineHtml
      }
    })
    
    html += '</div>'
  }
  
  return html
}

/**
 * Formats timeline events for a single hour into HTML
 * 
 * INPUTS:
 * - hour: object - Hour object with timelineEvents
 * 
 * OUTPUTS:
 * - string - HTML string for timeline events section
 */
function formatTimelineEventsForHour(hour: any): string {
  if (!hour.timelineEvents || hour.timelineEvents.length === 0) {
    return ''
  }
  
  // Sort events by time to ensure chronological order
  const sortedEvents = [...hour.timelineEvents].sort((a, b) => {
    return new Date(a.time).getTime() - new Date(b.time).getTime()
  })
  
  let html = `<details class="timeline-hour-details">
    <summary class="timeline-hour-summary">
      <span class="timeline-hour-time">${hour.startTime} - ${hour.endTime}</span>
      <span class="timeline-hour-count">${sortedEvents.length} event${sortedEvents.length !== 1 ? 's' : ''}</span>
    </summary>
    <div class="timeline-events-container">
      ${sortedEvents.map((event) => formatTimelineEvent(event)).join('')}
    </div>
  </details>`
  
  return html
}

/**
 * Formats notable discrepancies into HTML list
 * 
 * INPUTS:
 * - discrepancies: array - Array of discrepancy objects
 * 
 * OUTPUTS:
 * - string - HTML string
 */
export function formatNotableDiscrepancies(discrepancies: any[]): string {
  if (!discrepancies || discrepancies.length === 0) {
    return '<p class="no-discrepancies">No notable discrepancies found.</p>'
  }
  
  let html = '<div class="discrepancies-list">'
  discrepancies.forEach((discrepancy: any) => {
    html += `<div class="discrepancy-item">
      <div class="discrepancy-header">
        <span class="discrepancy-type">${discrepancy.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</span>
        ${formatSeverity(discrepancy.severity)}
        <span class="discrepancy-time">${discrepancy.startTime} - ${discrepancy.endTime}</span>
      </div>
      <p class="discrepancy-description">${discrepancy.description}</p>
      ${discrepancy.context ? `<p class="discrepancy-context">${discrepancy.context}</p>` : ''}
    </div>`
  })
  html += '</div>'
  return html
}

/**
 * Formats a daily report section
 * 
 * INPUTS:
 * - dailyReport: object - Daily report object
 * 
 * OUTPUTS:
 * - string - HTML string
 */
export function formatDailyReport(dailyReport: any): string {
  const date = new Date(dailyReport.date)
  const formattedDate = date.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  
  let html = `<div class="daily-report">
    <h3 class="daily-report-date">${formattedDate}</h3>
    <div class="daily-stats">
      <div class="stat-item">
        <span class="stat-label">Total Active Time:</span>
        <span class="stat-value">${formatTime(dailyReport.totalActiveMinutes)}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Total AFK Time:</span>
        <span class="stat-value">${formatTime(dailyReport.totalAfkMinutes)}</span>
      </div>
    </div>
    <div class="hourly-section">
      <h4>Hourly Breakdown</h4>
      ${formatHourlyBreakdown(dailyReport.hourlyBreakdown)}
    </div>
    <div class="discrepancies-section">
      <h4>Notable Unproductive Activity</h4>
      ${formatNotableDiscrepancies(dailyReport.notableDiscrepancies)}
    </div>
    ${dailyReport.summary ? `<div class="daily-summary"><p>${dailyReport.summary}</p></div>` : ''}
  </div>`
  
  return html
}

/**
 * Formats the user ranking section
 * 
 * INPUTS:
 * - userRanking: object - User ranking object
 * 
 * OUTPUTS:
 * - string - HTML string
 */
export function formatUserRanking(userRanking: any): string {
  if (!userRanking || !userRanking.rankings || !Array.isArray(userRanking.rankings)) {
    return ''
  }
  
  let html = '<div class="user-ranking-section">'
  html += '<h3 class="ranking-header">User Rankings</h3>'
  
  // Rankings table
  html += '<div class="ranking-table-container"><table class="ranking-table">'
  html += '<thead><tr>'
  html += '<th>Rank</th>'
  html += '<th>User</th>'
  html += '<th>Total Active Hours</th>'
  html += '<th>Avg Daily Active Hours</th>'
  html += '<th>Total AFK Hours</th>'
  html += '<th>Active %</th>'
  html += '<th>Total Discrepancies</th>'
  html += '<th>Critical Discrepancies</th>'
  html += '<th>Insights</th>'
  html += '</tr></thead><tbody>'
  
  userRanking.rankings.forEach((ranking: any) => {
    html += '<tr>'
    html += `<td class="rank-cell">#${ranking.rank}</td>`
    html += `<td class="user-cell">${ranking.userName}</td>`
    html += `<td class="hours-cell">${ranking.totalActiveHours.toFixed(2)}h</td>`
    html += `<td class="hours-cell">${ranking.averageDailyActiveHours.toFixed(2)}h</td>`
    html += `<td class="hours-cell">${ranking.totalAfkHours.toFixed(2)}h</td>`
    html += `<td class="percentage-cell">${ranking.activePercentage.toFixed(1)}%</td>`
    html += `<td class="discrepancies-cell">${ranking.totalDiscrepancies}</td>`
    html += `<td class="discrepancies-cell critical">${ranking.criticalDiscrepancies}</td>`
    html += `<td class="insights-cell">${ranking.insights || '-'}</td>`
    html += '</tr>'
  })
  
  html += '</tbody></table></div>'
  
  // Summary
  if (userRanking.summary) {
    html += `<div class="ranking-summary"><p>${userRanking.summary}</p></div>`
  }
  
  html += '</div>'
  return html
}

/**
 * Formats the overall report summary section
 * 
 * INPUTS:
 * - overallReport: object - Overall report object
 * 
 * OUTPUTS:
 * - string - HTML string
 */
export function formatOverallReport(overallReport: any): string {
  const periodStart = new Date(overallReport.periodStart).toLocaleDateString('en-GB')
  const periodEnd = new Date(overallReport.periodEnd).toLocaleDateString('en-GB')
  const periodRange = periodStart === periodEnd ? periodStart : `${periodStart} - ${periodEnd}`
  
  let html = `<div class="overall-report">
    <div class="report-header">
      <h2>Overall Report Summary</h2>
      <p class="report-period">Period: ${periodRange}</p>
    </div>
    <div class="overall-stats-grid">
      <div class="stat-card">
        <div class="stat-card-label">Total Active Time</div>
        <div class="stat-card-value">${formatTime(overallReport.totalActiveMinutes)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Total AFK Time</div>
        <div class="stat-card-value">${formatTime(overallReport.totalAfkMinutes)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Average Daily Active</div>
        <div class="stat-card-value">${formatTime(overallReport.averageDailyActiveMinutes)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Total Discrepancies</div>
        <div class="stat-card-value">${overallReport.totalDiscrepancies}</div>
      </div>
      <div class="stat-card critical">
        <div class="stat-card-label">Critical Discrepancies</div>
        <div class="stat-card-value">${overallReport.criticalDiscrepancies}</div>
      </div>
    </div>
    ${overallReport.summary ? `<div class="report-summary"><p>${overallReport.summary}</p></div>` : ''}
    ${overallReport.conclusion ? `<div class="report-conclusion ${overallReport.conclusion.includes('CRITICAL') ? 'critical' : ''}"><p><strong>Conclusion:</strong> ${overallReport.conclusion}</p></div>` : ''}
  </div>`
  
  return html
}

/**
 * Formats the complete report
 * 
 * INPUTS:
 * - reportData: object - Parsed report data
 * 
 * OUTPUTS:
 * - string - HTML string
 */
export function formatReport(reportData: any): string {
  if (!reportData || !reportData.organizations) {
    return '<div class="error-message">Invalid report data structure</div>'
  }
  
  let html = ''
  
  reportData.organizations.forEach((org: any) => {
    html += `<div class="organization-section">
      <h2 class="organization-name">${org.organizationName}</h2>`
    
    // User ranking section (if available)
    if (org.userRanking) {
      html += formatUserRanking(org.userRanking)
    }
    
    org.users.forEach((user: any) => {
      html += `<div class="user-section">
        <h3 class="user-name">User: ${user.userName}</h3>`
      
      // Overall report
      if (user.overallReport) {
        html += formatOverallReport(user.overallReport)
      }
      
      // Daily reports
      if (user.dailyReports && user.dailyReports.length > 0) {
        html += '<div class="daily-reports-section"><h3>Daily Reports</h3>'
        user.dailyReports.forEach((dailyReport: any) => {
          html += formatDailyReport(dailyReport)
        })
        html += '</div>'
      }
      
      html += '</div>'
    })
    
    html += '</div>'
  })
  
  return html
}

