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

import Chat from '@/components/Chat'

export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <Chat />
    </main>
  )
}

