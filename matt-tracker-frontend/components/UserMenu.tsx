/**
 * ============================================================================
 * USER MENU COMPONENT
 * ============================================================================
 * 
 * PURPOSE: Display user authentication status and provide quick access to auth actions
 * SCOPE: Login/Register buttons for unauthenticated users, profile menu for authenticated users
 * DEPENDENCIES: authAPI for authentication state and logout
 * 
 * FEATURES:
 * - Dynamic display based on authentication state
 * - Login/Register buttons for unauthenticated users
 * - User profile dropdown for authenticated users
 * - Logout functionality
 * - Responsive design
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout, getProfile, checkAuthentication } from '@/lib/authAPI';

interface User {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
  updated_at: string;
  owner?: boolean;
}

export default function UserMenu() {
  const router = useRouter();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authStatus = await checkAuthentication();
        setIsSignedIn(authStatus);
        
        if (authStatus) {
          // Load user profile asynchronously
          getProfile().then(userData => {
            setUser(userData);
          }).catch(error => {
            console.error('Failed to load user profile:', error);
          });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        setIsSignedIn(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Check auth on mount
    checkAuth();
    
    // Listen for auth state changes (e.g., after registration/login)
    const handleAuthStateChange = () => {
      console.log('🔍 UserMenu: Auth state change detected, re-checking authentication...');
      setIsLoading(true);
      checkAuth();
    };
    
    window.addEventListener('authStateChange', handleAuthStateChange);
    
    return () => {
      window.removeEventListener('authStateChange', handleAuthStateChange);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    router.push('/login');
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:text-gray-900 hover:bg-gray-50 transition-colors"
        >
          Login
        </Link>
        <Link
          href="/register"
          className="px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-all"
        >
          Register
        </Link>
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={toggleDropdown}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-900 bg-transparent border-none rounded-md cursor-pointer hover:bg-gray-50 transition-colors min-w-0"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-medium">
            {user?.name ? user.name.charAt(0).toUpperCase() : user?.email.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap flex-shrink-0">
          {user?.name || user?.email}
        </span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <div className="px-3 py-2 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-900 mb-1">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap">
              {user?.email}
            </p>
          </div>
          
          <Link
            href="/profile"
            className="block px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>View Profile</span>
            </div>
          </Link>
          
          <button
            onClick={handleLogout}
            className="block w-full text-left px-3 py-2 text-sm text-gray-900 bg-transparent border-none cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
