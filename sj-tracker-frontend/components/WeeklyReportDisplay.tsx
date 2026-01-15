/**
 * ============================================================================
 * WEEKLY REPORT DISPLAY COMPONENT
 * ============================================================================
 * 
 * PURPOSE: Displays formatted weekly report data
 * 
 * DESCRIPTION:
 * This component renders the formatted weekly report HTML using the formatting
 * utilities. It handles both successful reports and error states.
 * 
 * DEPENDENCIES:
 * - /lib/weeklyReportFormatter.ts: Formatting utility functions
 * 
 * ============================================================================
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { formatWeeklyReport } from '@/lib/weeklyReportFormatter'
import { generateWeeklyPDF } from '@/lib/weeklyPdfGenerator'

interface WeeklyReportDisplayProps {
  reportData: any
  onNewReport: () => void
}

/**
 * Parses the weekly report data, handling various response formats
 * 
 * INPUTS:
 * - data: any - The response data object
 * 
 * OUTPUTS:
 * - object | null - Parsed report data or null if parsing fails
 */
function parseWeeklyReportData(data: any): any {
  try {
    if (!data) {
      console.warn('parseWeeklyReportData: data is null or undefined')
      return null
    }
    
    // Backend API format: data has organizations directly
    if (data.organizations && Array.isArray(data.organizations)) {
      return data
    }
    
    // n8n webhook format: data has an output field that's a JSON string
    if (data.output && typeof data.output === 'string') {
      try {
        const parsed = JSON.parse(data.output)
        if (parsed && parsed.organizations && Array.isArray(parsed.organizations)) {
          return parsed
        }
      } catch (parseError) {
        console.error('parseWeeklyReportData: Failed to parse output string:', parseError)
        try {
          const doubleParsed = JSON.parse(JSON.parse(data.output))
          if (doubleParsed && doubleParsed.organizations && Array.isArray(doubleParsed.organizations)) {
            return doubleParsed
          }
        } catch (doubleParseError) {
          console.error('parseWeeklyReportData: Failed to parse as double-encoded JSON:', doubleParseError)
        }
      }
    }
    
    // Check if data might be a string that needs parsing
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data)
        if (parsed && parsed.organizations && Array.isArray(parsed.organizations)) {
          return parsed
        }
        if (parsed && parsed.output && typeof parsed.output === 'string') {
          return parseWeeklyReportData(parsed)
        }
      } catch (stringParseError) {
        console.error('parseWeeklyReportData: Failed to parse string data:', stringParseError)
      }
    }
    
    console.warn('parseWeeklyReportData: Could not find valid weekly report structure in data:', data)
    return null
  } catch (error) {
    console.error('parseWeeklyReportData: Unexpected error:', error, data)
    return null
  }
}

export default function WeeklyReportDisplay({ reportData, onNewReport }: WeeklyReportDisplayProps) {
  const reportOutputRef = useRef<HTMLDivElement>(null)
  const [parsedData, setParsedData] = useState<any>(null)

  /**
   * Handles PDF download generation
   * 
   * INPUTS:
   * - None (uses parsedData from state)
   * 
   * OUTPUTS:
   * - void - Triggers PDF download
   */
  const handleDownloadPDF = () => {
    if (!parsedData) {
      console.error('No valid weekly report data available for PDF generation')
      return
    }

    try {
      // Generate filename based on report data
      let filename = 'weekly-report'
      
      if (parsedData.organizations && parsedData.organizations.length > 0) {
        const orgName = parsedData.organizations[0].organizationName || 'report'
        // Sanitize filename (remove special characters)
        const sanitizedOrgName = orgName.replace(/[^a-z0-9]/gi, '-').toLowerCase()
        filename = `${sanitizedOrgName}-weekly-report`
      }

      // Add week if available (we'd need to pass weekStartDate from formData)
      // For now, just add current date
      const today = new Date().toISOString().split('T')[0]
      filename += `-${today}`

      filename += '.pdf'

      generateWeeklyPDF(parsedData, filename)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please check the console for details.')
    }
  }

  useEffect(() => {
    if (!reportOutputRef.current) return

    try {
      // Handle error state
      if (reportData?.error) {
        setParsedData(null) // Clear parsed data on error
        const errorMessage = reportData.message || 'Unknown error occurred'
        const errorDetails = reportData.details || ''
        const backendUrl = reportData.backendUrl || ''
        
        reportOutputRef.current.innerHTML = `
          <div class="error-message">
            <strong>Error:</strong> ${errorMessage}
            ${errorDetails ? `<br><small>${errorDetails}</small>` : ''}
            ${backendUrl ? `<br><small>Backend URL: ${backendUrl}</small>` : ''}
          </div>
          <pre class="json-output">${JSON.stringify(reportData, null, 2)}</pre>`
        return
      }

      // Try to parse and format as weekly report
      const parsedData = parseWeeklyReportData(reportData)
      setParsedData(parsedData) // Store parsed data for PDF generation
      
      if (parsedData) {
        reportOutputRef.current.innerHTML = formatWeeklyReport(parsedData)
      } else {
        setParsedData(null) // Clear parsed data if parsing fails
        // Fallback to JSON display if parsing fails
        const formattedJson = JSON.stringify(reportData, null, 2)
        reportOutputRef.current.innerHTML = `
          <div class="error-message">
            <strong>Unable to format weekly report.</strong> The response structure may be different than expected. 
            Showing raw JSON below. Check the browser console for details.
          </div>
          <pre class="json-output">${formattedJson}</pre>`
      }
    } catch (error) {
      console.error('Error displaying weekly report:', error)
      if (reportOutputRef.current) {
        reportOutputRef.current.innerHTML = `
          <div class="error-message">
            <strong>Error displaying weekly report:</strong> ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
          <pre class="json-output">${JSON.stringify(reportData, null, 2)}</pre>`
      }
    }
  }, [reportData])

  return (
    <div className="w-full max-w-6xl bg-white rounded-lg shadow-sm border border-gray-200 p-10">
      <h1 className="text-3xl font-semibold text-gray-900 mb-8">Weekly Report Results</h1>
      <div className="space-y-6">
        <div ref={reportOutputRef} className="prose max-w-none"></div>
        <div className="flex gap-4">
          {parsedData && !reportData?.error && (
            <button 
              onClick={handleDownloadPDF}
              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>
          )}
          <button 
            onClick={onNewReport} 
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Generate New Weekly Report
          </button>
        </div>
      </div>
    </div>
  )
}


