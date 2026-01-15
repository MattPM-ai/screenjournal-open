'use client';

import Link from 'next/link';

export default function RegisterSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-light text-gray-900 mb-4">
            Registration Successful!
          </h1>
          
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            Your account has been created. An administrator will review your request and approve your account. You will receive an email notification once your account is approved.
          </p>
          
          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 transition-all font-medium flex items-center justify-center"
            >
              Go to Login
            </Link>
            
            <Link
              href="/"
              className="w-full px-4 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-md hover:bg-blue-50 active:bg-blue-100 transition-all font-medium flex items-center justify-center"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
