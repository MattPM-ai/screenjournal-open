/**
 * ============================================================================
 * MAIN PAGE COMPONENT
 * ============================================================================
 * 
 * PURPOSE: Renders the main chat interface page
 * 
 * DESCRIPTION:
 * This is the root page component that displays the chat interface.
 * It wraps the Chat component and provides the main page structure.
 * 
 * ============================================================================
 */

'use client'

import { useEffect } from 'react'
import Chat from '@/components/Chat'
import { checkAuthentication } from '@/lib/authAPI'

export const dynamic = 'force-dynamic'

export default function Home() {
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authStatus = await checkAuthentication()
        if (!authStatus) {
          window.location.href = '/login'
          return
        }
      } catch (error) {
        console.error('Failed to check authentication:', error)
        window.location.href = '/login'
      }
    }

    checkAuth()
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <Chat />
    </main>
  )
}

