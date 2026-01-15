/**
 * ============================================================================
 * WEEKLY REPORT FORMATTER UTILITIES
 * ============================================================================
 * 
 * PURPOSE: Utility functions for formatting weekly report data into HTML
 * 
 * DESCRIPTION:
 * These functions convert the raw weekly report JSON data into formatted HTML
 * for display. They handle weekly summaries, top/bottom employees, and user summaries.
 * 
 * ============================================================================
 */

/**
 * Formats the complete weekly report
 * 
 * INPUTS:
 * - reportData: object - Parsed weekly report data
 * 
 * OUTPUTS:
 * - string - HTML string
 */
export function formatWeeklyReport(reportData: any): string {
  if (!reportData || !reportData.organizations) {
    return '<div class="error-message">Invalid weekly report data structure</div>'
  }
  
  let html = ''
  
  reportData.organizations.forEach((org: any) => {
    html += `<div class="organization-section">
      <h2 class="organization-name">${org.organizationName}</h2>`
    
    // Weekly Summary
    if (org.weeklySummary) {
      html += formatWeeklySummary(org.weeklySummary)
    }
    
    // Weekly User Summaries
    if (org.weeklyUserSummaries && org.weeklyUserSummaries.length > 0) {
      html += '<div class="weekly-user-summaries-section">'
      html += '<h3 class="section-header">Employee Summaries</h3>'
      html += formatWeeklyUserSummaries(org.weeklyUserSummaries)
      html += '</div>'
    }
    
    html += '</div>'
  })
  
  return html
}

/**
 * Formats the weekly summary section
 * 
 * INPUTS:
 * - weeklySummary: object - Weekly summary object
 * 
 * OUTPUTS:
 * - string - HTML string
 */
function formatWeeklySummary(weeklySummary: any): string {
  let html = '<div class="weekly-summary-section">'
  html += '<h3 class="section-header">Weekly Summary</h3>'
  
  if (weeklySummary.productivitySummary) {
    html += `<div class="productivity-summary">
      <p class="summary-text">${weeklySummary.productivitySummary}</p>
    </div>`
  }
  
  // Top Employees (dynamic count)
  if (weeklySummary.top5Employees && Array.isArray(weeklySummary.top5Employees) && weeklySummary.top5Employees.length > 0) {
    const count = weeklySummary.top5Employees.length
    html += '<div class="top-employees-section">'
    html += `<h4 class="subsection-header">Top ${String(count)} Employees</h4>`
    html += '<div class="employee-ranking-table-container">'
    html += '<table class="employee-ranking-table">'
    html += '<thead><tr><th class="col-employee">Employee</th><th class="col-activity">Activity</th><th class="col-hours">Hours</th></tr></thead>'
    html += '<tbody>'
    weeklySummary.top5Employees.forEach((employee: any) => {
      const employeeName = employee.name || employee.userName || 'Unknown'
      const rank = employee.rank || 1
      const activityRatio = employee.activityRatio?.toFixed(1) || '0.0'
      const activeHours = employee.activeHours?.toFixed(1) || '0.0'
      html += `<tr class="top-employee-row">
        <td class="col-employee">${rank}. ${employeeName}</td>
        <td class="col-activity">${activityRatio}%</td>
        <td class="col-hours">${activeHours}</td>
      </tr>`
    })
    html += '</tbody></table></div></div>'
  }
  
  // Bottom Employees (dynamic count)
  if (weeklySummary.bottom5Employees && Array.isArray(weeklySummary.bottom5Employees) && weeklySummary.bottom5Employees.length > 0) {
    const count = weeklySummary.bottom5Employees.length
    html += '<div class="bottom-employees-section">'
    html += `<h4 class="subsection-header">Bottom ${String(count)} Employees</h4>`
    html += '<div class="employee-ranking-table-container">'
    html += '<table class="employee-ranking-table">'
    html += '<thead><tr><th class="col-employee">Employee</th><th class="col-activity">Activity</th><th class="col-hours">Hours</th></tr></thead>'
    html += '<tbody>'
    weeklySummary.bottom5Employees.forEach((employee: any) => {
      const employeeName = employee.name || employee.userName || 'Unknown'
      const rank = employee.rank || 1
      const activityRatio = employee.activityRatio?.toFixed(1) || '0.0'
      const activeHours = employee.activeHours?.toFixed(1) || '0.0'
      html += `<tr class="bottom-employee-row">
        <td class="col-employee">${rank}. ${employeeName}</td>
        <td class="col-activity">${activityRatio}%</td>
        <td class="col-hours">${activeHours}</td>
      </tr>`
    })
    html += '</tbody></table></div></div>'
  }
  
  html += '</div>'
  return html
}

/**
 * Formats an individual employee summary card
 * 
 * INPUTS:
 * - user: object - User summary object
 * 
 * OUTPUTS:
 * - string - HTML string
 */
function formatEmployeeSummary(user: any): string {
  const userName = user.userName || 'Unknown'
  const activityRatio = user.activityRatio?.toFixed(1) || '0.0'
  const activeHours = user.activeHours?.toFixed(1) || '0.0'
  const afkHours = user.afkHours?.toFixed(1) || '0.0'
  const distractedTime = user.distractedTimeHours?.toFixed(1) || '0.0'
  const totalDiscrepancies = user.totalDiscrepancies || 0
  const criticalDiscrepancies = user.criticalDiscrepancies || 0
  const productivitySummary = user.productivitySummary || '-'
  
  // Build stats HTML
  const statsHtml = `
    <div class="employee-summary-stat-row">
      <div class="employee-summary-stat"><span class="stat-label">Activity Ratio:</span> <span class="stat-value">${activityRatio}%</span></div>
      <div class="employee-summary-stat"><span class="stat-label">Active Hours:</span> <span class="stat-value">${activeHours}h</span></div>
    </div>
    <div class="employee-summary-stat-row">
      <div class="employee-summary-stat"><span class="stat-label">AFK Hours:</span> <span class="stat-value">${afkHours}h</span></div>
      <div class="employee-summary-stat"><span class="stat-label">Distracted Time:</span> <span class="stat-value">${distractedTime}h</span></div>
    </div>
    <div class="employee-summary-stat-row">
      <div class="employee-summary-stat"><span class="stat-label">Total Discrepancies:</span> <span class="stat-value">${totalDiscrepancies}</span></div>
      <div class="employee-summary-stat"><span class="stat-label">Critical Discrepancies:</span> <span class="stat-value ${criticalDiscrepancies > 0 ? 'critical' : ''}">${criticalDiscrepancies}</span></div>
    </div>
  `
  
  // Build productivity summary HTML
  const productivityHtml = productivitySummary !== '-' 
    ? `<div class="employee-productivity-summary">
        <strong>Productivity Summary:</strong>
        <p>${productivitySummary}</p>
      </div>`
    : ''
  
  // Combine everything in the card
  return `<div class="employee-summary-card">
    <h4 class="employee-summary-name">${userName}</h4>
    <div class="employee-summary-stats">
      ${statsHtml}
    </div>
    ${productivityHtml}
  </div>`
}

/**
 * Formats the weekly user summaries section as individual employee cards
 * 
 * INPUTS:
 * - userSummaries: array - Array of user summary objects
 * 
 * OUTPUTS:
 * - string - HTML string
 */
function formatWeeklyUserSummaries(userSummaries: any[]): string {
  let html = '<div class="employee-summaries-container">'
  
  userSummaries.forEach((user: any) => {
    html += formatEmployeeSummary(user)
  })
  
  html += '</div>'
  return html
}


