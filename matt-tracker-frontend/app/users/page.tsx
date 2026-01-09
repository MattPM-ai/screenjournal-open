/**
 * ============================================================================
 * USERS PAGE
 * ============================================================================
 * 
 * PURPOSE: Admin interface for managing all users
 * SCOPE: View active users and admins
 * 
 * ============================================================================
 */

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { usersAPI, User } from '@/lib/usersAPI'
import { getProfile, isAuthenticated } from '@/lib/authAPI'

export const dynamic = 'force-dynamic'

function UsersPageContent() {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'active'

  const [users, setUsers] = useState<User[]>([])
  const [usersPagination, setUsersPagination] = useState<{
    page: number
    limit: number
    count: number
    total: number
    totalPages: number
  } | null>(null)
  const [usersCurrentPage, setUsersCurrentPage] = useState(0)
  const [usersPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accountId, setAccountId] = useState<number | null>(null)

  // Check authentication and get account ID
  useEffect(() => {
    const checkAuthAndLoad = async () => {
      try {
        const authStatus = await isAuthenticated()
        if (!authStatus) {
          window.location.href = '/login'
          return
        }

        const profile = await getProfile()
        if (!profile.account_id) {
          setError('No account ID found')
          return
        }

        setAccountId(profile.account_id)
      } catch (error) {
        console.error('Failed to check authentication:', error)
        window.location.href = '/login'
      }
    }

    checkAuthAndLoad()
  }, [])

  const loadUsers = async () => {
    if (!accountId) return

    try {
      setLoading(true)
      const response = await usersAPI.getUsersPaginated(accountId, usersCurrentPage, usersPageSize)
      setUsers(response.data)
      setUsersPagination(response.pagination)
    } catch (error) {
      console.error('Failed to load users:', error)
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (accountId) {
      loadUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersCurrentPage, accountId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleUsersPageChange = (newPage: number) => {
    setUsersCurrentPage(newPage)
  }

  const activeUsers = users.filter((u) => !u.owner)
  const adminUsers = users.filter((u) => u.owner)

  return (
    <main className="min-h-[calc(100vh-64px)] p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Users</h1>
          <p className="text-sm text-gray-600">Manage all users for your organization</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-6 border-b-2 border-gray-200 mb-6">
          <a
            href="/users?tab=active"
            className={`px-4 py-2 text-base font-medium border-b-2 transition-colors ${
              activeTab === 'active' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            Active Users ({activeUsers.length})
          </a>
          <a
            href="/users?tab=admins"
            className={`px-4 py-2 text-base font-medium border-b-2 transition-colors ${
              activeTab === 'admins' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            Admins ({adminUsers.length})
          </a>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Loading users...</p>
          </div>
        ) : (
          <>
            {activeTab === 'active' && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                {usersPagination && usersPagination.total > usersPageSize && (
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      Showing {activeUsers.length || 0} of {usersPagination.total || activeUsers.length || 0} users
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUsersPageChange(usersCurrentPage - 1)}
                        disabled={usersCurrentPage === 0 || activeUsers.length <= usersPageSize}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => handleUsersPageChange(usersCurrentPage + 1)}
                        disabled={usersCurrentPage >= Math.ceil((activeUsers.length || 0) / usersPageSize) - 1 || activeUsers.length <= usersPageSize}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-6 space-y-4">
                  {activeUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No active users</h3>
                      <p className="text-sm text-gray-600">Users will appear here once they&apos;re added.</p>
                    </div>
                  ) : (
                    activeUsers.map((user) => (
                      <div key={user.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium text-lg">
                          {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-base font-medium text-gray-900">{user.name || 'No name'}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">Active</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Joined: {formatDate(user.created_at)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'admins' && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                {usersPagination && usersPagination.total > usersPageSize && (
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      Showing {adminUsers.length || 0} of {usersPagination.total || adminUsers.length || 0} admins
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUsersPageChange(usersCurrentPage - 1)}
                        disabled={usersCurrentPage === 0 || adminUsers.length <= usersPageSize}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => handleUsersPageChange(usersCurrentPage + 1)}
                        disabled={usersCurrentPage >= Math.ceil((adminUsers.length || 0) / usersPageSize) - 1 || adminUsers.length <= usersPageSize}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-6 space-y-4">
                  {adminUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No admin users</h3>
                      <p className="text-sm text-gray-600">Admin users will appear here.</p>
                    </div>
                  ) : (
                    adminUsers.map((user) => (
                      <div key={user.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center font-medium text-lg">
                          {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-base font-medium text-gray-900">{user.name || 'No name'}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded-full">Admin</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Joined: {formatDate(user.created_at)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default function UsersPage() {
  return (
    <Suspense fallback={
      <main className="min-h-[calc(100vh-64px)] p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </main>
    }>
      <UsersPageContent />
    </Suspense>
  )
}

