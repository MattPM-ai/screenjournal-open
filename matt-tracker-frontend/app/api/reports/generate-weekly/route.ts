/**
 * ============================================================================
 * WEEKLY REPORT GENERATION API ROUTE
 * ============================================================================
 * 
 * PURPOSE: Initiates weekly report generation on the backend API
 * 
 * DESCRIPTION:
 * This API route forwards weekly report generation requests to the backend API
 * and returns the task ID for polling.
 * 
 * DEPENDENCIES:
 * - External: Backend API at NEXT_PUBLIC_BACKEND_URL
 * 
 * INPUTS:
 * - POST body: { accountId: number, users: Array<{name: string, id: number}>, org: string, orgId: number, weekStartDate: string }
 * 
 * OUTPUTS:
 * - JSON: { taskId: string, status: string } - Task ID for polling
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

export async function POST(request: NextRequest) {
  try {
    // Get token from request cookies (server-side) - optional
    const token = request.cookies.get('accessToken')?.value

    const body = await request.json()
    const { accountId, users, org, orgId, weekStartDate } = body

    // Normalize accountId (optional, defaults to 0)
    let normalizedAccountId: number = 0
    if (accountId !== null && accountId !== undefined) {
      normalizedAccountId = typeof accountId === 'string' ? Number(accountId) : accountId
      if (isNaN(normalizedAccountId)) {
        normalizedAccountId = 0
      }
    }

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'users is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    // Validate and normalize each user in the array
    const normalizedUsers = []
    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      if (!user || typeof user !== 'object') {
        return NextResponse.json(
          { error: `users[${i}] must be an object` },
          { status: 400 }
        )
      }
      if (!user.name || typeof user.name !== 'string' || !user.name.trim()) {
        return NextResponse.json(
          { error: `users[${i}].name is required and must be a non-empty string` },
          { status: 400 }
        )
      }
      // Normalize user ID (optional, defaults to 0)
      let normalizedUserId: number = 0
      if (user.id !== null && user.id !== undefined) {
        normalizedUserId = typeof user.id === 'string' ? Number(user.id) : user.id
        if (isNaN(normalizedUserId)) {
          normalizedUserId = 0
        }
      }
      normalizedUsers.push({
        name: user.name.trim(),
        id: normalizedUserId
      })
    }

    if (!org || typeof org !== 'string' || !org.trim()) {
      return NextResponse.json(
        { error: 'org is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    // Normalize orgId (optional, defaults to 0)
    let normalizedOrgId: number = 0
    if (orgId !== null && orgId !== undefined) {
      normalizedOrgId = typeof orgId === 'string' ? Number(orgId) : orgId
      if (isNaN(normalizedOrgId)) {
        normalizedOrgId = 0
      }
    }

    if (!weekStartDate || typeof weekStartDate !== 'string') {
      return NextResponse.json(
        { error: 'weekStartDate is required and must be a string' },
        { status: 400 }
      )
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(weekStartDate)) {
      return NextResponse.json(
        { error: 'weekStartDate must be in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    // Forward request to backend API
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const response = await fetch(`${BACKEND_URL}/api/reports/generate-weekly`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        accountId: normalizedAccountId,
        users: normalizedUsers,
        org: org.trim(),
        orgId: normalizedOrgId,
        weekStartDate,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('Backend API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to generate weekly report', details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('API route error:', error)
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

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


