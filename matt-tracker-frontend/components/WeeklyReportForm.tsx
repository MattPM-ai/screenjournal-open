/**
 * ============================================================================
 * WEEKLY REPORT FORM COMPONENT
 * ============================================================================
 * 
 * PURPOSE: Form component for submitting weekly report generation requests
 * 
 * DESCRIPTION:
 * Provides a form interface for selecting organization and week (Monday-Sunday)
 * to generate weekly reports from the backend API. Automatically loads all users
 * from the selected organization.
 * 
 * ============================================================================
 */

'use client'

import { useState, FormEvent, useEffect } from 'react'
import { getProfile } from '@/lib/authAPI'
import { organisationsAPI, Organisation, OrganisationUser } from '@/lib/organisationsAPI'

interface WeeklyReportFormProps {
  onSubmit: (data: {
    accountId: number
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
  const [accountId, setAccountId] = useState<number | null>(null)
  const [organisations, setOrganisations] = useState<Organisation[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [error, setError] = useState('')
  const [weeks, setWeeks] = useState<Date[]>([])

  // Load user profile and organizations
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError('')

        // Get user profile to retrieve accountId
        const userProfile = await getProfile()
        if (!userProfile.account_id) {
          setError('No account ID found. Please ensure you are logged in.')
          return
        }

        setAccountId(userProfile.account_id)

        // Fetch organizations for the account
        const orgsResponse = await organisationsAPI.getOrganisations(0, 100)
        setOrganisations(orgsResponse.data)

        // Generate weeks for current year
        const yearWeeks = getWeeksInCurrentYear()
        setWeeks(yearWeeks)
        
        // Default to current week
        const today = new Date()
        const currentMonday = getMondayOfWeek(new Date(today))
        setSelectedWeekStart(currentMonday)
      } catch (err) {
        console.error('Failed to load form data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load form data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!accountId) {
      alert('Account ID not available. Please refresh the page.')
      return
    }

    if (organisations.length === 0) {
      alert('Organizations not loaded. Please wait and try again.')
      return
    }

    if (!selectedOrgId || selectedOrgId === '') {
      alert('Please select an organization')
      return
    }

    if (!selectedWeekStart) {
      alert('Please select a week')
      return
    }

    // Get selected organization
    const selectedOrg = organisations.find(org => {
      return String(org.id) === String(selectedOrgId)
    })
    
    if (!selectedOrg) {
      console.error('Selected organization not found', {
        selectedOrgId,
        organisations: organisations.map(o => ({ id: o.id, name: o.name }))
      })
      alert('Selected organization not found. Please try selecting again.')
      return
    }

    // Load all users for the selected organization
    try {
      setLoadingUsers(true)
      const orgId = Number(selectedOrgId)
      if (isNaN(orgId)) {
        alert('Invalid organization ID. Please try selecting again.')
        return
      }

      // Get all users with pagination
      const allUsers: OrganisationUser[] = []
      let page = 0
      const limit = 100
      let hasMore = true

      while (hasMore) {
        const usersResponse = await organisationsAPI.getOrganisationUsersPaginated(orgId, page, limit)
        if (usersResponse.success && usersResponse.data) {
          allUsers.push(...usersResponse.data)
          
          if (usersResponse.pagination && page < usersResponse.pagination.totalPages - 1) {
            page++
          } else {
            hasMore = false
          }
        } else {
          hasMore = false
        }
      }

      if (allUsers.length === 0) {
        alert('No users found in this organization.')
        return
      }

      // Build users array with {name, id} structure
      const users = allUsers.map(user => {
        const userIdNum = typeof user.id === 'string' ? Number(user.id) : user.id
        if (isNaN(userIdNum)) {
          console.error('Invalid user ID:', user.id)
          return null
        }
        
        return {
          name: user.name || user.email,
          id: userIdNum
        }
      }).filter((user): user is { name: string; id: number } => user !== null)

      if (users.length === 0) {
        alert('No valid users found in this organization.')
        return
      }

      // Convert orgId to number
      const orgIdNum = typeof selectedOrg.id === 'string' ? Number(selectedOrg.id) : selectedOrg.id
      if (isNaN(orgIdNum)) {
        alert('Invalid organization ID. Please try selecting again.')
        return
      }

      // Format week start date as YYYY-MM-DD
      const weekStartDateStr = selectedWeekStart.toISOString().split('T')[0]

      onSubmit({
        accountId: Number(accountId),
        users,
        org: selectedOrg.name,
        orgId: orgIdNum,
        weekStartDate: weekStartDateStr,
      })
    } catch (err) {
      console.error('Failed to load organization users:', err)
      alert(`Failed to load organization users: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoadingUsers(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm border border-gray-200 p-10">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Generate Weekly Report</h1>
        <p className="text-sm text-gray-600 mb-8">Loading form data...</p>
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm border border-gray-200 p-10">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Generate Weekly Report</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm border border-gray-200 p-10">
      <h1 className="text-3xl font-semibold text-gray-900 mb-2">Generate Weekly Report</h1>
      <p className="text-sm text-gray-600 mb-8">
        Select the organization and week to generate a comprehensive weekly activity report.
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="org" className="block text-sm font-medium text-gray-700 mb-2">Organization:</label>
          <select
            id="org"
            name="org"
            required
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">Select an organization</option>
            {organisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

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
            disabled={loading || loadingUsers || !accountId || !selectedOrgId || !selectedWeekStart}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loadingUsers ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Loading users...
              </>
            ) : (
              'Generate Weekly Report'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

