/**
 * ============================================================================
 * CHAT API ROUTE
 * ============================================================================
 * 
 * PURPOSE: Handles communication with the n8n webhook endpoint
 * 
 * DESCRIPTION:
 * This API route receives chat messages from the frontend and forwards
 * them to the n8n webhook. It processes the response and returns it
 * to the client in a standardized format.
 * 
 * DEPENDENCIES:
 * - External: n8n webhook URL (configured via NEXT_PUBLIC_N8N_WEBHOOK environment variable)
 * 
 * INPUTS:
 * - POST body: { chatInput: string, sessionId: string } - The user's message and session ID
 * - Cookies: accessToken - The user's authentication token (automatically included)
 * 
 * OUTPUTS:
 * - JSON: { response: string } - The assistant's response from webhook
 * 
 * ERROR HANDLING:
 * - Returns appropriate HTTP status codes
 * - Provides error messages for debugging
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server'

const WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK || 'https://engine.upnode.org/webhook/19d61f71-86b7-4cf7-a553-a10214b2f5d2/chat'
const API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BACKEND_URL

/**
 * Refreshes the access token using the refresh token
 * 
 * INPUTS:
 * - refreshToken: string - The refresh token from cookies
 * 
 * OUTPUTS:
 * - { accessToken: string, refreshToken: string } | null - New tokens or null if refresh failed
 * 
 * ERROR HANDLING:
 * - Returns null if refresh fails
 * - Logs errors for debugging
 */
async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string, refreshToken: string } | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      console.error('Token refresh failed:', response.status, response.statusText)
      return null
    }

    const data = await response.json()
    if (data.data?.accessToken && data.data?.refreshToken) {
      return {
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
      }
    }

    return null
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}

/**
 * Sets authentication cookies in the NextResponse
 * 
 * INPUTS:
 * - response: NextResponse - The response object to set cookies on
 * - accessToken: string - The access token
 * - refreshToken: string - The refresh token
 * 
 * OUTPUTS:
 * - NextResponse with cookies set
 */
function setAuthCookiesInResponse(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
): NextResponse {
  // Set cookies with 7 day expiry
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  
  response.cookies.set('accessToken', accessToken, {
    expires,
    path: '/',
    sameSite: 'strict',
    httpOnly: false, // Must be accessible to client-side code
  })
  
  response.cookies.set('refreshToken', refreshToken, {
    expires,
    path: '/',
    sameSite: 'strict',
    httpOnly: false, // Must be accessible to client-side code
  })
  
  return response
}

/**
 * Handles POST requests to send messages to the n8n webhook
 * 
 * INPUTS:
 * - request: NextRequest - Contains the user's chat input and session ID in JSON body
 * 
 * OUTPUTS:
 * - NextResponse with webhook response or error
 * 
 * ERROR HANDLING:
 * - Validates request body
 * - Handles network errors
 * - Returns appropriate status codes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chatInput, sessionId } = body

    // Validate input
    if (!chatInput || typeof chatInput !== 'string' || !chatInput.trim()) {
      return NextResponse.json(
        { error: 'chatInput is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Session ID is required and must be a string' },
        { status: 400 }
      )
    }

    // Get user token from cookies
    let accessToken = request.cookies.get('accessToken')?.value || null
    const refreshToken = request.cookies.get('refreshToken')?.value || null
    let refreshedTokens: { accessToken: string, refreshToken: string } | null = null

    // Prepare request body for n8n webhook
    const webhookBody: {
      chatInput: string
      sessionId: string
      userToken?: string
    } = {
      chatInput: chatInput.trim(),
      sessionId: sessionId,
    }

    // Include user token if available
    if (accessToken) {
      webhookBody.userToken = accessToken
    }

    // Forward request to n8n webhook with session ID and user token
    let webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookBody),
    })

    // Handle 500 errors - likely due to expired token
    // Try refreshing token and retrying once
    if (webhookResponse.status === 500 && refreshToken) {
      console.log('Webhook returned 500, attempting token refresh...')
      
      refreshedTokens = await refreshAccessToken(refreshToken)
      
      if (refreshedTokens) {
        // Update access token for retry
        accessToken = refreshedTokens.accessToken
        webhookBody.userToken = accessToken
        
        // Retry the webhook request with new token
        webhookResponse = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookBody),
        })
      }
    }

    // Handle webhook response (including after retry)
    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text()
      console.error('Webhook error:', webhookResponse.status, errorText)
      
      // Create error response
      const errorResponse = NextResponse.json(
        { 
          error: webhookResponse.status === 500 
            ? 'Server responded with a status of 500 (Internal Server Error)'
            : 'Failed to get response from webhook',
          details: errorText 
        },
        { status: webhookResponse.status }
      )
      
      // If we refreshed tokens, update cookies even on error
      if (refreshedTokens) {
        setAuthCookiesInResponse(errorResponse, refreshedTokens.accessToken, refreshedTokens.refreshToken)
      }
      
      return errorResponse
    }

    // Parse webhook response
    let responseData
    const contentType = webhookResponse.headers.get('content-type')
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await webhookResponse.json()
    } else {
      const textResponse = await webhookResponse.text()
      responseData = { output: textResponse }
    }

    // Extract output field from webhook response
    const output = responseData.output

    if (output === undefined || output === null) {
      console.error('Webhook response missing output field:', responseData)
      return NextResponse.json(
        { error: 'Webhook response missing output field' },
        { status: 500 }
      )
    }

    // Create success response
    const successResponse = NextResponse.json({ response: output })
    
    // If we refreshed tokens during retry, update cookies in response
    if (refreshedTokens) {
      setAuthCookiesInResponse(successResponse, refreshedTokens.accessToken, refreshedTokens.refreshToken)
    }
    
    return successResponse
  } catch (error) {
    console.error('API route error:', error)
    
    // Handle different error types
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Failed to connect to webhook service' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

