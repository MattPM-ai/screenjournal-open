/**
 * ============================================================================
 * USERS API CLIENT
 * ============================================================================
 * 
 * PURPOSE: Handle all users API operations
 * SCOPE: User management operations
 * DEPENDENCIES: Backend API
 * 
 * ============================================================================
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface User {
  id: number
  email: string
  name: string | null
  owner?: boolean
  account_id?: number
  created_at: string
  updated_at: string
}

export interface PaginationInfo {
  page: number
  limit: number
  count: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationInfo
}

// ============================================================================
// API BASE CONFIGURATION
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BACKEND_URL

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
  }
  return response.json()
}

// ============================================================================
// USERS API
// ============================================================================

export const usersAPI = {
  // Get all users with pagination
  getUsersPaginated: async (accountId: number, page: number = 0, limit: number = 20): Promise<PaginatedResponse<User>> => {
    const response = await fetch(`${API_BASE_URL}/users/${accountId}/users?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return handleResponse(response)
  },
}

