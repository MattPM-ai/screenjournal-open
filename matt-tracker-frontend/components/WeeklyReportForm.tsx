/**
 * ============================================================================
 * WEEKLY REPORT FORM COMPONENT
 * ============================================================================
 * 
 * PURPOSE: Form component for submitting weekly report generation requests
 * 
 * DESCRIPTION:
 * Provides a form interface for selecting week (Monday-Sunday)
 * to generate weekly reports from the backend API. Uses default values
 * for organization and user.
 * 
 * ============================================================================
 */

'use client'

import { useState, FormEvent, useEffect } from 'react'

interface WeeklyReportFormProps {
  onSubmit: (data: {
    users: Array<{ name: string; id: number }>
    org: string
    orgId: number
    weekStartDate: string
  }) => void
}

/**
 * Gets the Monday of the week containing the given date
 * 
 * INPUTS:
 * - date: Date - Any date in the week
 * 
 * OUTPUTS:
 * - Date - Monday of that week
 */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date) // Create a copy to avoid mutation
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  return new Date(d.setDate(diff))
}

/**
 * Gets all Mondays for weeks in the current year
 * 
 * OUTPUTS:
 * - Date[] - Array of Monday dates for each week
 */
function getWeeksInCurrentYear(): Date[] {
  const year = new Date().getFullYear()
  const weeks: Date[] = []
  
  // Start from January 1st
  let currentDate = new Date(year, 0, 1)
  
  // Find the first Monday of the year (or the Monday of the week containing Jan 1)
  const firstMonday = getMondayOfWeek(new Date(currentDate))
  
  // Generate all weeks until we're past December 31st
  let weekStart = new Date(firstMonday)
  while (weekStart.getFullYear() === year || weekStart.getFullYear() === year - 1) {
    if (weekStart.getFullYear() === year) {
      weeks.push(new Date(weekStart))
    }
    
    // Move to next Monday
    weekStart = new Date(weekStart)
    weekStart.setDate(weekStart.getDate() + 7)
    
    // Safety check to prevent infinite loop
    if (weeks.length > 60) break
  }
  
  return weeks
}

/**
 * Formats a week range as "Mon DD - Sun DD, MMM YYYY"
 * 
 * INPUTS:
 * - monday: Date - Monday of the week
 * 
 * OUTPUTS:
 * - string - Formatted week range
 */
function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  
  const mondayStr = monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const sundayStr = sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  
  return `${mondayStr} - ${sundayStr}`
}

export default function WeeklyReportForm({ onSubmit }: WeeklyReportFormProps) {
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const [weeks, setWeeks] = useState<Date[]>([])

  // Initialize weeks on mount
  useEffect(() => {
    // Generate weeks for current year
    const yearWeeks = getWeeksInCurrentYear()
    setWeeks(yearWeeks)
    
    // Default to current week
    const today = new Date()
    const currentMonday = getMondayOfWeek(new Date(today))
    setSelectedWeekStart(currentMonday)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!selectedWeekStart) {
      alert('Please select a week')
      return
    }

    // Format week start date as YYYY-MM-DD
    const weekStartDateStr = selectedWeekStart.toISOString().split('T')[0]

    // Use default values matching collector defaults
    onSubmit({
      users: [{ name: 'Local', id: 0 }],
      org: 'Local',
      orgId: 0,
      weekStartDate: weekStartDateStr,
    })
  }

  return (
    <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm border border-gray-200 p-10">
      <h1 className="text-3xl font-semibold text-gray-900 mb-2">Generate Weekly Report</h1>
      <p className="text-sm text-gray-600 mb-8">
        Select the week to generate a comprehensive weekly activity report.
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="week" className="block text-sm font-medium text-gray-700 mb-2">Week:</label>
          <select
            id="week"
            name="week"
            required
            value={selectedWeekStart ? selectedWeekStart.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              const dateStr = e.target.value
              if (dateStr) {
                setSelectedWeekStart(new Date(dateStr))
              }
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">Select a week</option>
            {weeks.map((week, index) => (
              <option key={index} value={week.toISOString().split('T')[0]}>
                {formatWeekRange(week)}
              </option>
            ))}
          </select>
          {selectedWeekStart && (
            <p className="mt-2 text-xs text-gray-500">
              Week: {formatWeekRange(selectedWeekStart)}
            </p>
          )}
        </div>

        <div>
          <button 
            type="submit" 
            disabled={loading || !selectedWeekStart}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Generate Weekly Report
          </button>
        </div>
      </form>
    </div>
  )
}
