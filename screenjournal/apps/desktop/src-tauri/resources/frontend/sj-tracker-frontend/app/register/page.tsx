/**
 * ============================================================================
 * REGISTRATION PAGE
 * ============================================================================
 * 
 * PURPOSE: User account creation and registration functionality
 * SCOPE: Registration form, validation, error handling, navigation to login
 * DEPENDENCIES: authAPI for backend communication
 * 
 * FEATURES:
 * - Email/password/name registration form
 * - Form validation and error handling
 * - Loading states during registration
 * - Navigation to login page
 * - Redirect to profile after successful registration
 * 
 * ============================================================================
 */

'use client';

import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10">
          <h1 className="text-3xl font-light text-gray-900 mb-2 text-center">Choose Account Type</h1>
          <p className="text-sm text-gray-500 mb-8 text-center">
            Select the type of account you want to create
          </p>

          <div className="flex flex-col gap-4 mb-8">
            <Link
              href="/register/business"
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 transition-all font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>Register as Business</span>
            </Link>

            <Link
              href="/register/user"
              className="w-full px-4 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-md hover:bg-blue-50 active:bg-blue-100 transition-all font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Register as Individual User</span>
            </Link>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Already have an account?
              </span>
            </div>
          </div>

          <Link
            href="/login"
            className="block w-full text-center px-4 py-2 text-blue-600 font-medium hover:text-blue-700 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
