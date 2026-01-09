"use client";

/**
 * Profile Page
 * 
 * Standalone page for the profile window. This page is opened in a separate
 * Tauri window when the user clicks the profile button in the main dashboard.
 */

import { useEffect, useState } from "react";
import { getProfile, getOrganisations, logout, type User, type Organisation } from "@/lib/authAPI";
import { Button } from "@repo/ui";
import { User as UserIcon, Mail, Calendar, LogOut, Loader, Building2 } from "lucide-react";
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
    loadOrganisations();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const profileData = await getProfile();
      setUser(profileData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const loadOrganisations = async () => {
    try {
      setLoadingOrgs(true);
      const orgsData = await getOrganisations();
      setOrganisations(orgsData);
    } catch (err) {
      console.error("Failed to load organisations:", err);
      // Don't set error state for orgs, just log it
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleLogout = async () => {
    // Clear authentication tokens
    logout();
    
    try {
      // Emit event to notify main window to redirect to login
      await emit('logout-requested');
      
      // Close the profile window
      const profileWindow = getCurrentWindow();
      await profileWindow.close();
    } catch (error) {
      console.error("Error during logout:", error);
      // Fallback: close the profile window even if event emission fails
      try {
        const profileWindow = getCurrentWindow();
        await profileWindow.close();
      } catch (closeError) {
        console.error("Error closing profile window:", closeError);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadProfile} variant="outline">
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No profile data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {user.name || "User"}
              </h1>
              <p className="text-gray-600">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Profile Information */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Information</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-gray-900">{user.email}</p>
              </div>
            </div>
            {user.name && (
              <div className="flex items-start gap-3">
                <UserIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="text-gray-900">{user.name}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Account Created</p>
                <p className="text-gray-900">
                  {new Date(user.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                <span className="text-gray-400 text-sm">#</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">User ID</p>
                <p className="text-gray-900">{user.id}</p>
              </div>
            </div>
            {user.account_id && (
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                  <span className="text-gray-400 text-sm">#</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Account ID</p>
                  <p className="text-gray-900">{user.account_id}</p>
                </div>
              </div>
            )}
            {user.owner && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700 font-medium">Account Owner</p>
              </div>
            )}
          </div>
        </div>

        {/* Organisations */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Organisations</h2>
          {loadingOrgs ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-5 h-5 animate-spin text-blue-600" />
            </div>
          ) : organisations.length === 0 ? (
            <p className="text-gray-500 text-sm">No organisations found</p>
          ) : (
            <div className="space-y-3">
              {organisations.map((org) => (
                <div
                  key={org.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Building2 className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{org.name}</p>
                    {org.description && (
                      <p className="text-sm text-gray-600 mt-1">{org.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>ID: {org.id}</span>
                      {org.account_id && <span>Account ID: {org.account_id}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </Button>
        </div>
      </div>
    </div>
  );
}

