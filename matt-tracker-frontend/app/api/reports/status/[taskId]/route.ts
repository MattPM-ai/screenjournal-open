/**
 * ============================================================================
 * REPORT STATUS API ROUTE
 * ============================================================================
 * 
 * PURPOSE: Polls the backend API for report generation status
 * 
 * DESCRIPTION:
 * This API route checks the status of a report generation task by polling
 * the backend API status endpoint.
 * 
 * DEPENDENCIES:
 * - External: Backend API at https://matt-tracker-report-api.mattpm.ai
 * 
 * INPUTS:
 * - GET parameter: taskId - The task ID from the generation endpoint
 * 
 * OUTPUTS:
 * - JSON: { status: string, report?: object } - Status and report data if completed
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL// || 'https://matt-tracker-report-api.mattpm.ai'

// Force dynamic rendering to prevent Next.js from caching this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    // Get token from request cookies (server-side) - optional
    const token = request.cookies.get('accessToken')?.value

    const { taskId } = params

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      )
    }

    // Poll backend API for status
    // Use cache: 'no-store' to ensure we always get fresh data from the backend
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const response = await fetch(`${BACKEND_URL}/api/reports/status/${taskId}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('Backend API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to get report status', details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Return response with cache control headers to prevent browser/CDN caching
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('API route error:', error)

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Failed to connect to backend service' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

