/**
 * ============================================================================
 * NAVIGATION BAR COMPONENT
 * ============================================================================
 * 
 * PURPOSE: Provides permanent navigation across all pages
 * 
 * DESCRIPTION:
 * This component displays a navigation bar with the application title
 * and links to the main pages (Chat and Reports).
 * 
 * ============================================================================
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import UserMenu from './UserMenu'
import { checkAuthentication } from '@/lib/authAPI'

export default function NavBar() {
  const pathname = usePathname()
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authStatus = await checkAuthentication()
        setIsSignedIn(authStatus)
      } catch (error) {
        console.error('Authentication check failed:', error)
        setIsSignedIn(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()

    // Listen for auth state changes
    const handleAuthStateChange = () => {
      checkAuth()
    }

    window.addEventListener('authStateChange', handleAuthStateChange)
    return () => {
      window.removeEventListener('authStateChange', handleAuthStateChange)
    }
  }, [])

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMobileMenuOpen])

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  const logoHref = isLoading ? '/' : (isSignedIn ? '/' : '/login')

  const navLinks = [
    { href: '/', label: 'Chat' },
    { href: '/reports', label: 'Reports' },
    { href: '/organisations', label: 'Organisations' },
    { href: '/users', label: 'Users' },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-50 h-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-full flex items-center justify-between">
        {/* Left side: Hamburger (mobile) + Logo */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button - shown on mobile */}
          {!isLoading && isSignedIn && (
            <div className="[@media(min-width:775px)]:hidden relative" ref={mobileMenuRef}>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                aria-label="Toggle menu"
              >
                <svg 
                  className="w-6 h-6" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>

              {/* Mobile Dropdown Menu */}
              {isMobileMenuOpen && (
                <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block px-4 py-2 text-sm transition-colors ${
                        pathname === link.href
                          ? 'text-blue-600 bg-blue-50 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          <Link href={logoHref} className="text-xl font-semibold text-blue-600 hover:text-blue-700 transition-colors">
            ScreenJournal
          </Link>
        </div>

        {/* Right side: Desktop Navigation + UserMenu */}
        <div className="flex gap-6 items-center">
          {/* Desktop Navigation - hidden on mobile */}
          {!isLoading && isSignedIn && (
            <div className="hidden [@media(min-width:775px)]:flex gap-6 items-center">
              {navLinks.map((link) => (
                <Link 
                  key={link.href}
                  href={link.href} 
                  className={`text-base font-medium px-2 py-1 rounded transition-colors ${
                    pathname === link.href 
                      ? 'text-blue-600 bg-blue-50' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
          <UserMenu />
        </div>
      </div>
    </nav>
  )
}

