/**
 * ============================================================================
 * REPORT FORM COMPONENT
 * ============================================================================
 * 
 * PURPOSE: Form component for submitting report generation requests
 * 
 * DESCRIPTION:
 * Provides a form interface for selecting organization, users, and date range
 * to generate reports from the backend API. Fetches organizations and users
 * from the account and provides dropdown selections.
 * 
 * ============================================================================
 */

'use client'

import { useState, FormEvent, useEffect } from 'react'
import { getProfile } from '@/lib/authAPI'
import { organisationsAPI, Organisation, OrganisationUser } from '@/lib/organisationsAPI'

interface ReportFormProps {
  onSubmit: (data: {
    accountId: number
    users: Array<{ name: string; id: number }>
    org: string
    orgId: number
    startDate: string
    endDate: string
  }) => void
}

export default function ReportForm({ onSubmit }: ReportFormProps) {
  const [accountId, setAccountId] = useState<number | null>(null)
  const [organisations, setOrganisations] = useState<Organisation[]>([])
  const [users, setUsers] = useState<OrganisationUser[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [error, setError] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string>('')
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('')

  // Load user profile and organizations
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError('')

        // Get user profile to retrieve accountId and check ownership
        const userProfile = await getProfile()
        if (!userProfile.account_id) {
          setError('No account ID found. Please ensure you are logged in.')
          return
        }

        setAccountId(userProfile.account_id)
        setIsOwner(userProfile.owner === true)
        setCurrentUserId(userProfile.id)
        setCurrentUserName(userProfile.name || '')
        setCurrentUserEmail(userProfile.email)

        // Fetch organizations for the account
        const orgsResponse = await organisationsAPI.getOrganisations(0, 100)
        setOrganisations(orgsResponse.data)

        // If user is not an owner, find their organisation and pre-select it
        if (!userProfile.owner) {
          // Find which organisation the user belongs to
          // We only need to check which org they're in, not load all users
          for (const org of orgsResponse.data) {
            try {
              // Just check the first page to see if user is in this org
              const usersResponse = await organisationsAPI.getOrganisationUsersPaginated(org.id, 0, 100)
              if (usersResponse.success && usersResponse.data) {
                // Check if current user is in this organisation
                const userInOrg = usersResponse.data.find(u => u.id === userProfile.id)
                if (userInOrg) {
                  // Found the user's organisation
                  setSelectedOrgId(String(org.id))
                  // Pre-select the user immediately without loading all users
                  setSelectedUserIds([userProfile.id])
                  break
                }
              }
            } catch (err) {
              console.error(`Failed to check organisation ${org.id}:`, err)
            }
          }
        }
      } catch (err) {
        console.error('Failed to load form data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load form data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Load users for the selected organization (only for owners)
  useEffect(() => {
    const loadOrgUsers = async () => {
      if (!selectedOrgId || selectedOrgId === '') {
        setUsers([])
        if (isOwner) {
          setSelectedUserIds([])
        }
        return
      }

      // Skip loading users for regular users - they can only select themselves
      if (!isOwner) {
        setUsers([])
        return
      }

      try {
        setLoadingUsers(true)
        // Fetch users for the selected organization
        // Convert to number for API call (API expects number)
        const orgId = Number(selectedOrgId)
        if (!isNaN(orgId)) {
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

          setUsers(allUsers)
          // Clear selected users when organization changes (for owners)
          setSelectedUserIds([])
        }
      } catch (err) {
        console.error('Failed to load organization users:', err)
        setError(err instanceof Error ? err.message : 'Failed to load organization users')
        setUsers([])
      } finally {
        setLoadingUsers(false)
      }
    }

    loadOrgUsers()
  }, [selectedOrgId, isOwner])

  const handleSubmit = (e: FormEvent) => {
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

    // Get selected organization
    // Handle both string and number IDs from the API (API may return strings even though interface says number)
    const selectedOrg = organisations.find(org => {
      // Compare as strings (most reliable since select value is always string)
      return String(org.id) === String(selectedOrgId)
    })
    
    if (!selectedOrg) {
      console.error('Selected organization not found', {
        selectedOrgId,
        selectedOrgIdType: typeof selectedOrgId,
        organisations: organisations.map(o => ({ id: o.id, name: o.name, idType: typeof o.id }))
      })
      alert('Selected organization not found. Please try selecting again.')
      return
    }

    if (selectedUserIds.length === 0) {
      alert('Please select at least one user')
      return
    }

    if (!startDate || !endDate) {
      alert('Please fill in both date fields')
      return
    }

    // Build array of selected users with {name, id} structure
    let selectedUsers: Array<{ name: string; id: number }> = []

    if (!isOwner && currentUserId) {
      // For regular users, use their own info directly
      if (selectedUserIds.includes(currentUserId)) {
        selectedUsers = [{
          name: currentUserName || currentUserEmail,
          id: currentUserId
        }]
      }
    } else {
      // For owners, find users from the loaded users list
      selectedUsers = selectedUserIds
        .map(userId => {
          // Find user by comparing as strings first (since IDs might be strings)
          const user = users.find(u => String(u.id) === String(userId) || Number(u.id) === Number(userId))
          if (!user) return null
          
          // Convert user ID to number
          const userIdNum = typeof user.id === 'string' ? Number(user.id) : user.id
          if (isNaN(userIdNum)) {
            console.error('Invalid user ID:', user.id)
            return null
          }
          
          return {
            name: user.name || user.email,
            id: userIdNum
          }
        })
        .filter((user): user is { name: string; id: number } => user !== null)
    }

    if (selectedUsers.length === 0) {
      alert('No valid users selected')
      return
    }

    // Ensure accountId and orgId are numbers
    if (!accountId) {
      alert('Account ID not available. Please refresh the page.')
      return
    }

    // Convert orgId to number (API may return it as string)
    const orgIdNum = typeof selectedOrg.id === 'string' ? Number(selectedOrg.id) : selectedOrg.id
    if (isNaN(orgIdNum)) {
      alert('Invalid organization ID. Please try selecting again.')
      return
    }

    onSubmit({
      accountId: Number(accountId), // Ensure it's a number
      users: selectedUsers,
      org: selectedOrg.name,
      orgId: orgIdNum,
      startDate,
      endDate,
    })
  }

  const handleUserToggle = (userId: number) => {
    // Regular users can only select themselves and cannot deselect
    if (!isOwner && userId !== currentUserId) {
      return
    }
    if (!isOwner && userId === currentUserId) {
      // Regular users must always have themselves selected
      return
    }

    setSelectedUserIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId)
      } else {
        return [...prev, userId]
      }
    })
  }

  if (loading) {
    return (
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm border border-gray-200 p-10">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Generate a report</h1>
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
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Generate a report</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm border border-gray-200 p-10">
      <h1 className="text-3xl font-semibold text-gray-900 mb-2">Generate a report</h1>
      <p className="text-sm text-gray-600 mb-8">
        Select the organization, users, and date range to generate a comprehensive activity report.
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
            disabled={!isOwner}
            className={`w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              !isOwner ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'
            }`}
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
          <label htmlFor="users" className="block text-sm font-medium text-gray-700 mb-2">
            Users {isOwner ? '(select multiple):' : ':'}
          </label>
          {!isOwner ? (
            // For regular users, just show their name without loading all users
            <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
              <div className="flex items-center space-x-2 py-2">
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 opacity-50 cursor-not-allowed"
                />
                <span className="text-sm text-gray-700">
                  {currentUserName || currentUserEmail}
                  <span className="ml-2 text-xs text-gray-500">(You)</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="border border-gray-300 rounded-md p-3 min-h-[120px] max-h-[200px] overflow-y-auto bg-white">
              {!selectedOrgId ? (
                <p className="text-sm text-gray-500">Please select an organization first</p>
              ) : loadingUsers ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
              ) : users.length === 0 ? (
                <p className="text-sm text-gray-500">No users available in this organization</p>
              ) : (
                users.map((user) => {
                  const isSelected = selectedUserIds.includes(user.id)
                  return (
                    <label 
                      key={user.id} 
                      className="flex items-center space-x-2 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleUserToggle(user.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {user.name || user.email}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          )}
          {isOwner && selectedUserIds.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">Start Date:</label>
          <input
            type="date"
            id="startDate"
            name="startDate"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">End Date:</label>
          <input
            type="date"
            id="endDate"
            name="endDate"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <button 
            type="submit" 
            disabled={loading || !accountId}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Generate Report
          </button>
        </div>
      </form>
    </div>
  )
}

