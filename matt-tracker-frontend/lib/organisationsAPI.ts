/**
 * ============================================================================
 * ORGANISATIONS API CLIENT
 * ============================================================================
 * 
 * PURPOSE: Handle all organisations API operations
 * SCOPE: Organisations CRUD operations, user management
 * DEPENDENCIES: Backend API
 * 
 * ============================================================================
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface Organisation {
  id: number
  name: string
  description: string
  account_id: number
  created_at: string
  updated_at: string
}

export interface OrganisationUser {
  id: number
  email: string
  name: string
  owner: boolean
  created_at: string
}

export interface PaginationInfo {
  page: number
  limit: number
  count: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: PaginationInfo
}

export interface SingleResponse<T> {
  success: boolean
  data: T
}

export interface MessageResponse {
  success: boolean
  message: string
  data?: unknown
}

export interface CreateOrganisationRequest {
  name: string
  description: string
}

export interface UpdateOrganisationRequest {
  name?: string
  description?: string
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
// ORGANISATIONS API
// ============================================================================

export const organisationsAPI = {
  // Get all organisations with pagination
  getOrganisations: async (page: number = 0, limit: number = 20): Promise<PaginatedResponse<Organisation>> => {
    const response = await fetch(`${API_BASE_URL}/organisations?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return handleResponse(response)
  },

  // Get single organisation by ID
  getOrganisation: async (organisationId: number): Promise<SingleResponse<Organisation>> => {
    const response = await fetch(`${API_BASE_URL}/organisations/${organisationId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return handleResponse(response)
  },

  // Create new organisation
  createOrganisation: async (organisationData: CreateOrganisationRequest): Promise<MessageResponse> => {
    const response = await fetch(`${API_BASE_URL}/organisations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(organisationData),
    })
    return handleResponse(response)
  },

  // Update organisation
  updateOrganisation: async (organisationId: number, organisationData: UpdateOrganisationRequest): Promise<MessageResponse> => {
    const response = await fetch(`${API_BASE_URL}/organisations/${organisationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(organisationData),
    })
    return handleResponse(response)
  },

  // Delete organisation
  deleteOrganisation: async (organisationId: number): Promise<MessageResponse> => {
    const response = await fetch(`${API_BASE_URL}/organisations/${organisationId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return handleResponse(response)
  },

  // Get organisation users with pagination
  getOrganisationUsersPaginated: async (organisationId: number, page: number = 0, limit: number = 20): Promise<PaginatedResponse<OrganisationUser>> => {
    const response = await fetch(`${API_BASE_URL}/organisations/${organisationId}/users?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return handleResponse(response)
  },

  // Add user to organisation
  addUserToOrganisation: async (organisationId: number, userId: number): Promise<MessageResponse> => {
    const response = await fetch(`${API_BASE_URL}/organisations/${organisationId}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    })
    return handleResponse(response)
  },

  // Remove user from organisation
  removeUserFromOrganisation: async (organisationId: number, userId: number): Promise<MessageResponse> => {
    const response = await fetch(`${API_BASE_URL}/organisations/${organisationId}/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return handleResponse(response)
  },
}

