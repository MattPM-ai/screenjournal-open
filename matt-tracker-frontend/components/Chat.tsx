/**
 * ============================================================================
 * CHAT COMPONENT
 * ============================================================================
 * 
 * PURPOSE: Main chat interface component with message display and input
 * 
 * DESCRIPTION:
 * This component provides a minimalist chat interface that communicates
 * with the n8n webhook API. It handles message sending, receiving, and
 * displays messages in a clean, aesthetic design.
 * 
 * DEPENDENCIES:
 * - /app/api/chat/route.ts: Handles webhook communication
 * 
 * ============================================================================
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { getSessionId } from '@/lib/session'
import { parseMessageContent } from '@/lib/graphParser'
import GraphDisplay from './GraphDisplay'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

/**
 * Renders message content with support for inline graphs
 * 
 * INPUTS:
 * - content: string - The message content
 * - role: 'user' | 'assistant' - Message role for styling
 * 
 * OUTPUTS:
 * - JSX.Element - Rendered message content with graphs
 */
function MessageContent({ content, role }: { content: string; role: 'user' | 'assistant' }) {
  const segments = parseMessageContent(content)

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'graph' && segment.graphData) {
          return (
            <div key={`graph-${index}`} className="w-full my-1">
              <GraphDisplay graphData={segment.graphData} />
            </div>
          )
        } else if (segment.type === 'text' && segment.content) {
          return (
            <span key={`text-${index}`} className="block">
              {segment.content}
            </span>
          )
        }
        return null
      })}
    </>
  )
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  /**
   * Initializes session ID on component mount
   * 
   * DESCRIPTION:
   * Retrieves or generates a session ID using UUIDv5 and stores it in state.
   * This ensures the session ID is available for all webhook requests.
   */
  useEffect(() => {
    const id = getSessionId()
    setSessionId(id)
  }, [])

  /**
   * Scrolls the chat container to the bottom when new messages are added
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  /**
   * Handles sending a message to the webhook
   * 
   * INPUTS:
   * - message: string - The user's message content
   * 
   * OUTPUTS:
   * - Updates messages state with user message and assistant response
   * - Sets loading state during API call
   * 
   * ERROR HANDLING:
   * - Displays error message if API call fails
   */
  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading || !sessionId) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          chatInput: message.trim(),
          sessionId: sessionId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Extract error message from API response
        const errorMsg = data.error || 'Failed to send message'
        throw new Error(errorMsg)
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message || 'No response received',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      // Display the specific error message from the API
      const errorContent = error instanceof Error 
        ? error.message 
        : 'Sorry, I encountered an error. Please try again.'
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handles form submission
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  /**
   * Handles Enter key press (with Shift for new line)
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="w-full max-w-4xl h-[90vh] max-h-[800px] flex flex-col bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold text-gray-900 m-0 tracking-tight">Chat</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-white">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8">
            <p className="text-base text-gray-600 text-center">
              Start a conversation by sending a message below.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex max-w-[75%] animate-[fadeIn_0.3s_ease-in-out] ${
                message.role === 'user' ? 'self-end ml-auto' : 'self-start'
              } ${message.content.includes('graph') ? 'max-w-[95%]' : ''}`}
            >
              <div
                className={`px-4 py-3 rounded-lg text-base leading-relaxed break-words flex flex-col gap-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}
              >
                <MessageContent content={message.content} role={message.role} />
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex max-w-[75%] self-start">
            <div className="px-4 py-3 rounded-lg bg-gray-100 text-gray-900 rounded-bl-sm">
              <span className="inline-flex gap-1 items-center">
                <span className="w-2 h-2 rounded-full bg-gray-600 animate-[typing_1.4s_infinite_ease-in-out]" style={{ animationDelay: '-0.32s' }}></span>
                <span className="w-2 h-2 rounded-full bg-gray-600 animate-[typing_1.4s_infinite_ease-in-out]" style={{ animationDelay: '-0.16s' }}></span>
                <span className="w-2 h-2 rounded-full bg-gray-600 animate-[typing_1.4s_infinite_ease-in-out]"></span>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2 items-end bg-gray-50 rounded-lg p-2 border border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 border-none bg-transparent resize-none focus:outline-none text-base text-gray-900 placeholder-gray-400"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}

