/**
 * ============================================================================
 * SESSION ID UTILITY
 * ============================================================================
 * 
 * PURPOSE: Manages session ID generation and persistence using UUIDv5
 * 
 * DESCRIPTION:
 * This module provides functions to generate and retrieve a persistent
 * session ID using UUIDv5. The session ID is stored in localStorage and
 * persists across page refreshes, providing continuity for the chat session.
 * 
 * DEPENDENCIES:
 * - uuid: UUID generation library
 * 
 * INPUTS:
 * - getSessionId(): No parameters - retrieves or generates session ID
 * 
 * OUTPUTS:
 * - getSessionId(): string - UUIDv5 session identifier
 * 
 * ============================================================================
 */

import { v5 as uuidv5 } from 'uuid'

const SESSION_ID_KEY = 'chat_session_id'
const SESSION_SEED_KEY = 'chat_session_seed'
// Application namespace UUID for UUIDv5 generation
const APP_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8' // Standard DNS namespace

/**
 * Gets or creates a persistent seed for session ID generation
 * 
 * DESCRIPTION:
 * Retrieves an existing seed from localStorage or generates a new one.
 * The seed is used to generate a deterministic UUIDv5 session ID.
 * 
 * OUTPUTS:
 * - string: A unique seed identifier
 */
function getOrCreateSeed(): string {
  if (typeof window === 'undefined') {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  }

  let seed = localStorage.getItem(SESSION_SEED_KEY)

  if (!seed) {
    // Generate a unique seed combining timestamp and random component
    seed = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${navigator.userAgent.substring(0, 50)}`
    localStorage.setItem(SESSION_SEED_KEY, seed)
  }

  return seed
}

/**
 * Generates a session ID using UUIDv5
 * 
 * DESCRIPTION:
 * Creates a UUIDv5 by combining the application namespace with a persistent
 * seed. This ensures the same session ID is generated for the same browser/device.
 * 
 * OUTPUTS:
 * - string: A UUIDv5 formatted session identifier
 */
function generateSessionId(): string {
  const seed = getOrCreateSeed()
  return uuidv5(seed, APP_NAMESPACE)
}

/**
 * Retrieves or generates a persistent session ID
 * 
 * DESCRIPTION:
 * Checks localStorage for an existing session ID. If found, returns it.
 * If not found, generates a new UUIDv5 session ID, stores it in localStorage,
 * and returns it. This ensures session continuity across page refreshes.
 * 
 * OUTPUTS:
 * - string: The session ID (either retrieved or newly generated)
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') {
    // Server-side: generate a temporary ID (shouldn't happen in client component)
    return generateSessionId()
  }

  let sessionId = localStorage.getItem(SESSION_ID_KEY)

  if (!sessionId) {
    sessionId = generateSessionId()
    localStorage.setItem(SESSION_ID_KEY, sessionId)
  }

  return sessionId
}

