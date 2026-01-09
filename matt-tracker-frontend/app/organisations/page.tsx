/**
 * ============================================================================
 * ORGANISATIONS PAGE
 * ============================================================================
 * 
 * PURPOSE: Admin interface for managing organisations
 * SCOPE: Full CRUD operations for organisations, user management
 * 
 * ============================================================================
 */

'use client'

import { useState, useEffect } from 'react'
import {
  organisationsAPI,
  Organisation,
  OrganisationUser,
  PaginationInfo,
  CreateOrganisationRequest,
  UpdateOrganisationRequest,
} from '@/lib/organisationsAPI'
import { isAuthenticated, getProfile } from '@/lib/authAPI'
import { usersAPI, User } from '@/lib/usersAPI'

export const dynamic = 'force-dynamic'

export default function OrganisationsPage() {
  const [organisations, setOrganisations] = useState<Organisation[]>([])
  const [organisationsPagination, setOrganisationsPagination] = useState<PaginationInfo | null>(null)
  const [organisationsCurrentPage, setOrganisationsCurrentPage] = useState(0)
  const [organisationsPageSize] = useState(20)
  const [organisationsLoading, setOrganisationsLoading] = useState(false)

  const [organisationUsers, setOrganisationUsers] = useState<Record<number, OrganisationUser[]>>({})
  const [organisationUsersPagination, setOrganisationUsersPagination] = useState<Record<number, PaginationInfo>>({})
  const [organisationUsersCurrentPage, setOrganisationUsersCurrentPage] = useState<Record<number, number>>({})
  const [organisationUsersPageSize] = useState(5)

  const [showOrganisationForm, setShowOrganisationForm] = useState(false)
  const [editingOrganisation, setEditingOrganisation] = useState<Organisation | null>(null)
  const [organisationFormData, setOrganisationFormData] = useState({
    name: '',
    description: '',
  })

  const [expandedOrganisations, setExpandedOrganisations] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showAddUserModal, setShowAddUserModal] = useState<number | null>(null)
  const [addUserFormData, setAddUserFormData] = useState({ userId: '' })
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [availableUsersLoading, setAvailableUsersLoading] = useState(false)
  const [accountId, setAccountId] = useState<number | null>(null)
  const [isOwner, setIsOwner] = useState(false)

  // Check authentication on mount and get account ID
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authStatus = await isAuthenticated()
        if (!authStatus) {
          window.location.href = '/login'
          return
        }

        const profile = await getProfile()
        if (profile.account_id) {
          setAccountId(profile.account_id)
        }
        setIsOwner(profile.owner === true)
      } catch (error) {
        console.error('Failed to check authentication:', error)
        window.location.href = '/login'
      }
    }

    checkAuth()
  }, [])

  const loadOrganisations = async () => {
    try {
      setOrganisationsLoading(true)
      const response = await organisationsAPI.getOrganisations(organisationsCurrentPage, organisationsPageSize)
      setOrganisations(response.data)
      setOrganisationsPagination(response.pagination)
    } catch (error) {
      console.error('Failed to load organisations:', error)
      setError('Failed to load organisations')
    } finally {
      setOrganisationsLoading(false)
      setLoading(false)
    }
  }

  // Load organisations data
  useEffect(() => {
    loadOrganisations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationsCurrentPage])

  const loadOrganisationUsers = async (organisationId: number, page: number = 0) => {
    try {
      const currentPage = organisationUsersCurrentPage[organisationId] || 0
      const pageToLoad = page !== undefined ? page : currentPage

      const pagination = organisationUsersPagination[organisationId]
      if (pagination && (pageToLoad < 0 || pageToLoad >= pagination.totalPages)) {
        return
      }

      const response = await organisationsAPI.getOrganisationUsersPaginated(organisationId, pageToLoad, organisationUsersPageSize)

      if (response.success && response.data) {
        setOrganisationUsers((prev) => ({ ...prev, [organisationId]: response.data }))
        setOrganisationUsersPagination((prev) => ({ ...prev, [organisationId]: response.pagination }))
        setOrganisationUsersCurrentPage((prev) => ({ ...prev, [organisationId]: pageToLoad }))
      }
    } catch (error) {
      console.error('Failed to load organisation users:', error)
    }
  }

  const handleCreateOrganisation = async () => {
    if (!organisationFormData.name.trim() || !organisationFormData.description.trim()) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setActionLoading('create-organisation')
      const organisationData: CreateOrganisationRequest = {
        name: organisationFormData.name.trim(),
        description: organisationFormData.description.trim(),
      }

      await organisationsAPI.createOrganisation(organisationData)
      setShowOrganisationForm(false)
      setOrganisationFormData({ name: '', description: '' })
      await loadOrganisations()
      setError('')
    } catch (error) {
      console.error('Failed to create organisation:', error)
      setError('Failed to create organisation')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUpdateOrganisation = async () => {
    if (!editingOrganisation || !organisationFormData.name.trim() || !organisationFormData.description.trim()) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setActionLoading(`update-organisation-${editingOrganisation.id}`)
      const organisationData: UpdateOrganisationRequest = {
        name: organisationFormData.name.trim(),
        description: organisationFormData.description.trim(),
      }

      await organisationsAPI.updateOrganisation(editingOrganisation.id, organisationData)
      setShowOrganisationForm(false)
      setEditingOrganisation(null)
      setOrganisationFormData({ name: '', description: '' })
      await loadOrganisations()
      setError('')
    } catch (error) {
      console.error('Failed to update organisation:', error)
      setError('Failed to update organisation')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteOrganisation = async (organisationId: number) => {
    if (!confirm('Are you sure you want to delete this organisation? This action cannot be undone.')) {
      return
    }

    try {
      setActionLoading(`delete-organisation-${organisationId}`)
      await organisationsAPI.deleteOrganisation(organisationId)
      await loadOrganisations()
      setError('')
    } catch (error) {
      console.error('Failed to delete organisation:', error)
      setError('Failed to delete organisation')
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const openOrganisationForm = (organisation?: Organisation) => {
    if (organisation) {
      setEditingOrganisation(organisation)
      setOrganisationFormData({
        name: organisation.name,
        description: organisation.description,
      })
    } else {
      setEditingOrganisation(null)
      setOrganisationFormData({ name: '', description: '' })
    }
    setShowOrganisationForm(true)
  }

  const toggleOrganisationExpanded = (organisationId: number) => {
    const newExpanded = new Set(expandedOrganisations)
    if (newExpanded.has(organisationId)) {
      newExpanded.delete(organisationId)
    } else {
      newExpanded.add(organisationId)
      loadOrganisationUsers(organisationId)
    }
    setExpandedOrganisations(newExpanded)
  }

  const handleOrganisationsPageChange = (newPage: number) => {
    setOrganisationsCurrentPage(newPage)
  }

  const loadAvailableUsers = async () => {
    if (!accountId) return

    try {
      setAvailableUsersLoading(true)
      
      // Get all users from the account (with pagination)
      const allUsers: User[] = []
      let page = 0
      const limit = 100
      let hasMore = true

      while (hasMore) {
        const response = await usersAPI.getUsersPaginated(accountId, page, limit)
        allUsers.push(...response.data)
        
        if (response.pagination && page < response.pagination.totalPages - 1) {
          page++
        } else {
          hasMore = false
        }
      }

      // Get all users already in organisations by fetching fresh data
      const usersInOrganisations = new Set<number>()
      for (const org of organisations) {
        try {
          // Fetch fresh organisation users data (with pagination)
          let orgPage = 0
          let orgHasMore = true
          const orgLimit = 100

          while (orgHasMore) {
            const orgUsersResponse = await organisationsAPI.getOrganisationUsersPaginated(org.id, orgPage, orgLimit)
            if (orgUsersResponse.success && orgUsersResponse.data) {
              orgUsersResponse.data.forEach(user => usersInOrganisations.add(user.id))
              
              if (orgUsersResponse.pagination && orgPage < orgUsersResponse.pagination.totalPages - 1) {
                orgPage++
              } else {
                orgHasMore = false
              }
            } else {
              orgHasMore = false
            }
          }
        } catch (error) {
          console.error(`Failed to load users for organisation ${org.id}:`, error)
        }
      }

      // Filter out users who are already in organisations
      const available = allUsers.filter(user => !usersInOrganisations.has(user.id))
      setAvailableUsers(available)
    } catch (error) {
      console.error('Failed to load available users:', error)
      setError('Failed to load available users')
    } finally {
      setAvailableUsersLoading(false)
    }
  }

  const handleOpenAddUserModal = (organisationId: number) => {
    setShowAddUserModal(organisationId)
    setAddUserFormData({ userId: '' })
    loadAvailableUsers()
  }

  const handleAddUserToOrganisation = async (organisationId: number) => {
    const userId = parseInt(addUserFormData.userId.trim())
    if (!userId || isNaN(userId)) {
      setError('Please select a user')
      return
    }

    try {
      setActionLoading(`add-user-${organisationId}`)
      await organisationsAPI.addUserToOrganisation(organisationId, userId)
      await loadOrganisationUsers(organisationId, 0)
      // Reload available users to update the list
      await loadAvailableUsers()
      setShowAddUserModal(null)
      setAddUserFormData({ userId: '' })
      setError('')
    } catch (error) {
      console.error('Failed to add user to organisation:', error)
      setError(error instanceof Error ? error.message : 'Failed to add user to organisation')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemoveUserFromOrganisation = async (organisationId: number, userId: number) => {
    if (!confirm('Are you sure you want to remove this user from the organisation?')) {
      return
    }

    try {
      setActionLoading(`remove-user-${organisationId}-${userId}`)
      await organisationsAPI.removeUserFromOrganisation(organisationId, userId)
      await loadOrganisationUsers(organisationId, organisationUsersCurrentPage[organisationId] || 0)
      setError('')
    } catch (error) {
      console.error('Failed to remove user from organisation:', error)
      setError(error instanceof Error ? error.message : 'Failed to remove user from organisation')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <main className="min-h-[calc(100vh-64px)] p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col [@media(min-width:520px)]:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">Organisations</h1>
            <p className="text-sm text-gray-600">Manage organisations for your account</p>
          </div>
          {isOwner && (
            <button 
              onClick={() => openOrganisationForm()} 
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Organisation
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Loading organisations...</p>
          </div>
        ) : organisations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200">
            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No organisations</h3>
            <p className="text-sm text-gray-600">Get started by creating a new organisation.</p>
          </div>
        ) : (
          <>
            {organisationsPagination && organisationsPagination.total > organisationsPageSize && (
              <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing {organisationsPagination.count || organisations.length || 0} of {organisationsPagination.total || organisations.length || 0} organisations
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOrganisationsPageChange(organisationsCurrentPage - 1)}
                    disabled={organisationsCurrentPage === 0}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handleOrganisationsPageChange(organisationsCurrentPage + 1)}
                    disabled={organisationsCurrentPage >= Math.ceil((organisationsPagination.total || organisations.length || 0) / organisationsPageSize) - 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {organisations.map((organisation) => (
                <div key={organisation.id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="p-6 flex flex-wrap items-start gap-4">
                    <div className="flex-[1_1_0%] min-w-[200px]">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2 break-words">{organisation.name}</h3>
                      <p className="text-sm text-gray-600 mb-2 break-words">{organisation.description}</p>
                      <p className="text-xs text-gray-500 break-words">Created: {formatDate(organisation.created_at)}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleOrganisationExpanded(organisation.id)}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors whitespace-nowrap"
                      >
                        {expandedOrganisations.has(organisation.id) ? 'Hide' : 'Show'} Details
                      </button>
                      {isOwner && (
                        <>
                          <button
                            onClick={() => openOrganisationForm(organisation)}
                            className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteOrganisation(organisation.id)}
                            disabled={actionLoading === `delete-organisation-${organisation.id}`}
                            className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {actionLoading === `delete-organisation-${organisation.id}` ? 'Deleting...' : 'Delete'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {expandedOrganisations.has(organisation.id) && (
                    <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-lg font-semibold text-gray-900">Organisation Members</h4>
                          {isOwner && (
                            <button
                              onClick={() => handleOpenAddUserModal(organisation.id)}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              Add User
                            </button>
                          )}
                        </div>
                        {organisationUsers[organisation.id] ? (
                          organisationUsers[organisation.id].length > 0 ? (
                            <>
                              <div className="space-y-3 mb-4">
                                {organisationUsers[organisation.id].map((user) => (
                                  <div key={user.id} className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-md min-w-0 overflow-hidden">
                                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium flex-shrink-0">
                                      {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-[1_1_0%] min-w-0 overflow-hidden">
                                      <p className="text-sm font-medium text-gray-900 break-words">{user.name || 'No name'}</p>
                                      <p className="text-xs text-gray-600 truncate">{user.email}</p>
                                    </div>
                                    {user.owner && (
                                      <span className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded-full flex-shrink-0 self-start">Admin</span>
                                    )}
                                    {isOwner && (
                                      <button
                                        onClick={() => handleRemoveUserFromOrganisation(organisation.id, user.id)}
                                        disabled={actionLoading === `remove-user-${organisation.id}-${user.id}`}
                                        className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 whitespace-nowrap self-start"
                                        title="Remove user from organisation"
                                      >
                                      {actionLoading === `remove-user-${organisation.id}-${user.id}` ? (
                                        <div className="flex items-center gap-1">
                                          <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                                          <span>Removing...</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                          <span>Remove</span>
                                        </div>
                                      )}
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {organisationUsersPagination[organisation.id] && (
                                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                                  <div className="text-sm text-gray-600">
                                    Page {organisationUsersPagination[organisation.id].page + 1} of {organisationUsersPagination[organisation.id].totalPages || Math.ceil(organisationUsersPagination[organisation.id].total / organisationUsersPagination[organisation.id].limit)}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => loadOrganisationUsers(organisation.id, organisationUsersCurrentPage[organisation.id] - 1)}
                                      disabled={organisationUsersCurrentPage[organisation.id] === 0}
                                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Previous
                                    </button>
                                    <button
                                      onClick={() => loadOrganisationUsers(organisation.id, organisationUsersCurrentPage[organisation.id] + 1)}
                                      disabled={
                                        !organisationUsers[organisation.id] ||
                                        organisationUsers[organisation.id].length < organisationUsersPageSize ||
                                        (organisationUsersPagination[organisation.id] &&
                                          organisationUsersCurrentPage[organisation.id] >= organisationUsersPagination[organisation.id].totalPages - 1)
                                      }
                                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Next
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-gray-500 py-4">No users in this organisation</p>
                          )
                        ) : (
                          <div className="flex justify-center py-8">
                            <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Organisation Form Modal */}
      {showOrganisationForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={() => setShowOrganisationForm(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">{editingOrganisation ? 'Edit Organisation' : 'Create New Organisation'}</h3>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (editingOrganisation) {
                  handleUpdateOrganisation()
                } else {
                  handleCreateOrganisation()
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Organisation Name</label>
                <input
                  type="text"
                  value={organisationFormData.name}
                  onChange={(e) => setOrganisationFormData({ ...organisationFormData, name: e.target.value })}
                  placeholder="Enter organisation name..."
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={organisationFormData.description}
                  onChange={(e) => setOrganisationFormData({ ...organisationFormData, description: e.target.value })}
                  placeholder="Enter organisation description..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={actionLoading === (editingOrganisation ? `update-organisation-${editingOrganisation.id}` : 'create-organisation')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === (editingOrganisation ? `update-organisation-${editingOrganisation.id}` : 'create-organisation')
                    ? 'Saving...'
                    : editingOrganisation
                    ? 'Update Organisation'
                    : 'Create Organisation'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowOrganisationForm(false)} 
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={() => setShowAddUserModal(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Add User to Organisation</h3>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (showAddUserModal) {
                  handleAddUserToOrganisation(showAddUserModal)
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Select User</label>
                {availableUsersLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-2 text-sm text-gray-600">Loading users...</span>
                  </div>
                ) : availableUsers.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-md text-sm text-gray-600">
                    No available users. All users are already in organisations.
                  </div>
                ) : (
                  <select
                    value={addUserFormData.userId}
                    onChange={(e) => setAddUserFormData({ userId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">Select a user...</option>
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id.toString()}>
                        {user.name || 'No name'} ({user.email})
                      </option>
                    ))}
                  </select>
                )}
                <p className="mt-1 text-xs text-gray-500">Select a user who is not yet in any organisation</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={actionLoading === `add-user-${showAddUserModal}` || availableUsersLoading || availableUsers.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === `add-user-${showAddUserModal}` ? 'Adding...' : 'Add User'}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddUserModal(null)
                    setAddUserFormData({ userId: '' })
                  }} 
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

