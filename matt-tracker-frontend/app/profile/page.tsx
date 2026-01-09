/**
 * ============================================================================
 * PROFILE PAGE
 * ============================================================================
 * 
 * PURPOSE: Display authenticated user profile information and organization management
 * SCOPE: User profile display, organization management, join codes, pending user approval
 * DEPENDENCIES: authAPI for profile data and logout
 * 
 * FEATURES:
 * - Protected route requiring authentication
 * - User profile information display
 * - Organization management for business owners
 * - Join code management
 * - Pending user approval
 * - User invitation
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, getAccountInfo, logout, checkAuthentication, getJoinCodes, createJoinCode, refreshJoinCode, deleteAllJoinCodes, inviteUser, getPendingUsers, approvePendingUser, deletePendingUser, generateReferralLink, PendingUser } from '@/lib/authAPI';
import WeeklyReportsEmailSettings from '@/components/WeeklyReportsEmailSettings';
import Link from 'next/link';

 export const dynamic = 'force-dynamic'

interface User {
  id: number;
  email: string;
  name: string | null;
  owner?: boolean;
  account_id?: number;
  created_at: string;
  updated_at: string;
}

interface Account {
  id: number;
  name: string;
  type: string;
  industry: string;
  created_at: string;
  updated_at: string;
}

function ProfilePageContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [joinCodes, setJoinCodes] = useState<{ code: string; account_id: string }[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joinCodeLoading, setJoinCodeLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [pendingUsersLoading, setPendingUsersLoading] = useState(false);

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        const authStatus = await checkAuthentication();
        if (!authStatus) {
          // Only redirect if authentication check completely fails
          window.location.href = '/login';
          return;
        }
        // Load user profile
        loadProfile();
      } catch (error) {
        console.error('Authentication check failed:', error);
        // Only redirect on actual auth failure, not temporary issues
        if (error instanceof Error && error.message.includes('refresh token expired')) {
          window.location.href = '/login';
        }
      }
    };
    
    checkAuth();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');
      
      const userData = await getProfile();
      setUser(userData);
      
      // If user is admin and has account_id, fetch account information
      if (userData.owner && userData.account_id) {
        try {
          const accountData = await getAccountInfo(userData.account_id);
          setAccount(accountData);
          
          // Fetch join codes for admin users
          const joinCodesData = await getJoinCodes(userData.account_id);
          setJoinCodes(joinCodesData);
          
          // Fetch pending users
          const pendingUsersData = await getPendingUsers(userData.account_id);
          setPendingUsers(pendingUsersData);
        } catch (error) {
          console.error('Failed to fetch account info or join codes:', error);
          // Don't set error for account info, just log it
        }
      }
      
    } catch (error) {
      console.error('Failed to load profile:', error);
      setError(error instanceof Error ? error.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleCreateJoinCode = async () => {
    if (!user?.account_id) return;
    
    try {
      setJoinCodeLoading(true);
      setError('');
      const newCode = await createJoinCode(user.account_id, 30); // 30 days expiry
      setJoinCodes([newCode]);
    } catch (error) {
      console.error('Failed to create join code:', error);
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          setError('Join code endpoint not available yet. Please try again later.');
        } else {
          setError(`Failed to create join code: ${error.message}`);
        }
      } else {
        setError('Failed to create join code');
      }
    } finally {
      setJoinCodeLoading(false);
    }
  };

  const handleRefreshJoinCode = async () => {
    if (!user?.account_id) return;
    
    try {
      setJoinCodeLoading(true);
      setError('');
      const newCode = await refreshJoinCode(user.account_id);
      setJoinCodes([newCode]);
    } catch (error) {
      console.error('Failed to refresh join code:', error);
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          setError('Join code refresh endpoint not available yet. Please try again later.');
        } else {
          setError(`Failed to refresh join code: ${error.message}`);
        }
      } else {
        setError('Failed to refresh join code');
      }
    } finally {
      setJoinCodeLoading(false);
    }
  };

  const handleDeleteJoinCodes = async () => {
    if (!user?.account_id) return;
    
    try {
      setJoinCodeLoading(true);
      setError('');
      await deleteAllJoinCodes(user.account_id);
      setJoinCodes([]);
    } catch (error) {
      console.error('Failed to delete join codes:', error);
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          setError('Join code delete endpoint not available yet. Please try again later.');
        } else {
          setError(`Failed to delete join codes: ${error.message}`);
        }
      } else {
        setError('Failed to delete join codes');
      }
    } finally {
      setJoinCodeLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!user?.account_id || !inviteEmail.trim() || joinCodes.length === 0) return;
    
    try {
      setInviteLoading(true);
      setError('');
      setInviteSuccess('');
      
      await inviteUser(user.account_id, inviteEmail.trim(), joinCodes[0].code);
      
      setInviteSuccess(`Invite sent successfully to ${inviteEmail.trim()}`);
      setInviteEmail('');
    } catch (error) {
      console.error('Failed to send invite:', error);
      setError(error instanceof Error ? error.message : 'Failed to send invite');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleApprovePendingUser = async (pendingUserId: string) => {
    if (!user?.account_id) return;
    
    try {
      setPendingUsersLoading(true);
      setError('');
      
      await approvePendingUser(user.account_id, pendingUserId);
      
      // Reload pending users list
      const pendingUsersData = await getPendingUsers(user.account_id);
      setPendingUsers(pendingUsersData);
      
      setInviteSuccess('User approved successfully!');
    } catch (error) {
      console.error('Failed to approve pending user:', error);
      setError(error instanceof Error ? error.message : 'Failed to approve user');
    } finally {
      setPendingUsersLoading(false);
    }
  };

  const handleDeletePendingUser = async (pendingUserId: string) => {
    if (!user?.account_id) return;
    
    try {
      setPendingUsersLoading(true);
      setError('');
      
      await deletePendingUser(user.account_id, pendingUserId);
      
      // Reload pending users list
      const pendingUsersData = await getPendingUsers(user.account_id);
      setPendingUsers(pendingUsersData);
      
      setInviteSuccess('Pending user deleted successfully!');
    } catch (error) {
      console.error('Failed to delete pending user:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete user');
    } finally {
      setPendingUsersLoading(false);
    }
  };

  const handleCopyReferralLink = async (email: string) => {
    if (joinCodes.length === 0 || !user?.account_id) return;
    
    try {
      const referralLink = await generateReferralLink(user.account_id);
      navigator.clipboard.writeText(referralLink);
      setInviteSuccess(`Referral link copied to clipboard for ${email}`);
    } catch (error) {
      console.error('Failed to generate referral link:', error);
      setError('Failed to generate referral link');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Error Loading Profile
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {error}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={loadProfile}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 transition-all font-medium"
              >
                Try Again
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-3 text-gray-600 border border-gray-300 rounded-md bg-white hover:text-gray-900 transition-colors font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">
              User Profile
            </h1>
            <p className="text-sm text-gray-600">
              Your account information and details
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md bg-white hover:text-gray-900 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {inviteSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
            {inviteSuccess}
          </div>
        )}

        {/* Business Account Information for Admin Users */}
        {user?.owner && account && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Business Account Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">
                  Account Details
                </h4>
                <div className="flex flex-col gap-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Account ID:</span>
                    <span className="ml-2 text-gray-900">{account.id}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Name:</span>
                    <span className="ml-2 text-gray-900">{account.name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Type:</span>
                    <span className="ml-2 text-gray-900">{account.type}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">
                  Account Dates
                </h4>
                <div className="flex flex-col gap-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Created:</span>
                    <span className="ml-2 text-gray-900">
                      {new Date(account.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Updated:</span>
                    <span className="ml-2 text-gray-900">
                      {new Date(account.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Admin Actions */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900 mb-6">
                Admin Actions
              </h4>
              
              {/* Invite User Section */}
              <div className="mb-8">
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={joinCodes.length === 0}
                    className={`px-4 py-3 border border-gray-300 rounded-md text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors max-w-xs ${
                      joinCodes.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                  <button
                    onClick={handleInviteUser}
                    disabled={!inviteEmail.trim() || joinCodes.length === 0 || inviteLoading}
                    className={`px-4 py-3 rounded-md text-base font-medium transition-all ${
                      (!inviteEmail.trim() || joinCodes.length === 0 || inviteLoading)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                    }`}
                  >
                    {inviteLoading ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
                
                {joinCodes.length === 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    Generate a join code first to invite users
                  </p>
                )}
              </div>

              {/* Join Code Management */}
              <div className="mb-8">
                <h5 className="text-base font-semibold text-gray-900 mb-4">
                  Join Code Management
                </h5>
                
                {/* Current Join Code Display */}
                <div className="mb-4">
                  <label className="block mb-2 text-sm font-medium text-gray-600">
                    Current Join Code:
                  </label>
                  {joinCodes.length > 0 ? (
                    <div className="flex gap-2 items-center">
                      <code className="px-3 py-2 bg-gray-100 text-gray-900 rounded-md font-mono text-sm border border-gray-300">
                        {joinCodes[0].code}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(joinCodes[0].code)}
                        className="p-2 text-blue-600 hover:text-blue-700 transition-colors"
                        title="Copy to clipboard"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <span className="italic text-gray-400 text-sm">No join code active</span>
                  )}
                </div>

                {/* Join Code Action Buttons */}
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    onClick={handleCreateJoinCode}
                    disabled={joinCodeLoading || joinCodes.length > 0}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                      (joinCodeLoading || joinCodes.length > 0)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                    }`}
                  >
                    {joinCodeLoading ? 'Creating...' : 'Create Code'}
                  </button>

                  <button
                    onClick={handleRefreshJoinCode}
                    disabled={joinCodeLoading || joinCodes.length === 0}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      (joinCodeLoading || joinCodes.length === 0)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                    }`}
                  >
                    {joinCodeLoading ? 'Refreshing...' : 'Refresh Code'}
                  </button>

                  <button
                    onClick={handleDeleteJoinCodes}
                    disabled={joinCodeLoading || joinCodes.length === 0}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      (joinCodeLoading || joinCodes.length === 0)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
                    }`}
                  >
                    {joinCodeLoading ? 'Deleting...' : 'Delete Code'}
                  </button>
                </div>

                <p className="text-xs text-gray-500">
                  Join codes allow new users to register for your organization. Only one code can be active at a time.
                </p>
              </div>

              {/* Weekly Reports Email Settings */}
              <div className="mb-8">
                <WeeklyReportsEmailSettings accountId={user.account_id || 0} ownerEmail={user.email} />
              </div>

              {/* Pending Users Section */}
              <div>
                <h5 className="text-base font-semibold text-gray-900 mb-4">
                  Pending User Approvals
                </h5>
                
                {pendingUsersLoading ? (
                  <div className="text-center py-6">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : pendingUsers.length === 0 ? (
                  <p className="text-sm italic text-gray-400">No pending users</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {pendingUsers.map((pendingUser) => (
                      <div key={pendingUser.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                          <div>
                            <p className="font-semibold text-gray-900 mb-1">{pendingUser.email}</p>
                            <p className="text-xs text-gray-500">
                              Requested: {new Date(pendingUser.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            <button
                              onClick={() => handleCopyReferralLink(pendingUser.email)}
                              className="px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
                              title="Copy referral link"
                            >
                              Copy Link
                            </button>
                            <button
                              onClick={() => handleApprovePendingUser(pendingUser.id)}
                              disabled={pendingUsersLoading}
                              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                pendingUsersLoading
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              }`}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDeletePendingUser(pendingUser.id)}
                              disabled={pendingUsersLoading}
                              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                pendingUsersLoading
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-red-600 text-white hover:bg-red-700'
                              }`}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Profile Summary */}
        {user && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Account Information
                </h3>
                <div className="flex flex-col gap-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">ID:</span>
                    <span className="ml-2 text-gray-900">{user.id}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Email:</span>
                    <span className="ml-2 text-gray-900">{user.email}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Name:</span>
                    <span className="ml-2 text-gray-900">
                      {user.name || 'Not provided'}
                    </span>
                  </div>
                  {user.owner && (
                    <div>
                      <span className="font-medium text-gray-600">Role:</span>
                      <span className="ml-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                          Admin
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Account Dates
                </h3>
                <div className="flex flex-col gap-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Created:</span>
                    <span className="ml-2 text-gray-900">
                      {new Date(user.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Updated:</span>
                    <span className="ml-2 text-gray-900">
                      {new Date(user.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  );
}

