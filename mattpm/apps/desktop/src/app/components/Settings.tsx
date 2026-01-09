"use client";

/**
 * Settings Component
 * 
 * A standalone settings page component that manages dashboard, recording,
 * and data sync configuration. This component is rendered in a separate
 * Tauri window and communicates with the main window via localStorage events.
 * 
 * Features:
 * - Dashboard auto-refresh settings
 * - Screen recording configuration (multi-display)
 * - Cloud data sync settings
 * 
 * Cross-window communication:
 * - Reads/writes settings to localStorage
 * - Dispatches storage events to notify other windows of changes
 */

import { useEffect, useState } from "react";
import {
  getRecordingConfig,
  updateRecordingConfig,
  getRecordingStatus,
  getDisplayCount,
  formatFileSize,
  type RecordingConfig,
  type RecordingStatus,
  // Gemini AI imports
  getGeminiConfig,
  updateGeminiConfig,
  getGeminiQueueStatus,
  hasGeminiApiKey,
  DEFAULT_GEMINI_CONFIG,
  type GeminiConfig,
  type GeminiQueueStatus,
} from "@/lib/recordingClient";
import {
  CollectorConfig,
  DEFAULT_COLLECTOR_CONFIG,
  getCollectorConfig,
  updateCollectorConfig,
  testConnection,
  validateConfig,
} from "@/lib/collectorClient";
import { getProfile, getOrganisations, getAccessToken, type User, type Organisation } from "@/lib/authAPI";
import { Button } from "@repo/ui";
import { Video, Settings2, HardDrive, Gauge, Cloud, CheckCircle, AlertCircle, Network, X, Loader, Monitor, Sparkles } from "lucide-react";
import { message } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Dashboard settings type definition
 * Controls auto-refresh behavior in the main dashboard
 */
type DashboardSettings = {
  auto_refresh_enabled: boolean;
  refresh_interval_seconds: number;
  refresh_on_focus: boolean;
};

/**
 * Default dashboard settings used when no stored settings exist
 */
const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  auto_refresh_enabled: true,
  refresh_interval_seconds: 10,
  refresh_on_focus: true,
};

/**
 * Settings Component
 * 
 * Renders a full-page settings interface with tabbed navigation for:
 * - Dashboard settings (auto-refresh configuration)
 * - Recording settings (screen recording configuration)
 * - Data Sync settings (cloud sync configuration)
 */
export function Settings() {
  // Tab navigation state
  const [activeTab, setActiveTab] = useState<"dashboard" | "recording" | "ai" | "sync">("dashboard");

  // Recording settings state
  const [config, setConfig] = useState<RecordingConfig | null>(null);
  const [status, setStatus] = useState<RecordingStatus | null>(null);
  const [displayCount, setDisplayCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dashboard settings state (loaded from localStorage)
  const [localDashboardSettings, setLocalDashboardSettings] = useState<DashboardSettings>(DEFAULT_DASHBOARD_SETTINGS);

  // Collector/Sync settings state
  const [collectorConfig, setCollectorConfig] = useState<CollectorConfig>(DEFAULT_COLLECTOR_CONFIG);
  const [collectorLoading, setCollectorLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [collectorError, setCollectorError] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // User and organisation data
  const [user, setUser] = useState<User | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loadingUserData, setLoadingUserData] = useState(false);

  // Gemini AI settings state
  const [geminiConfig, setGeminiConfig] = useState<GeminiConfig>(DEFAULT_GEMINI_CONFIG);
  const [geminiQueueStatus, setGeminiQueueStatus] = useState<GeminiQueueStatus | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(true);
  const [geminiApiKeySet, setGeminiApiKeySet] = useState(false);

  /**
   * Load user profile and organisations
   */
  const loadUserData = async () => {
    setLoadingUserData(true);
    try {
      const [profileData, orgsData] = await Promise.all([
        getProfile().catch(() => null),
        getOrganisations().catch(() => []),
      ]);
      
      if (profileData) {
        setUser(profileData);
        // Always populate user fields from authenticated profile
        setCollectorConfig((prev) => ({
          ...prev,
          user_name: profileData.name || profileData.email,
          user_id: String(profileData.id),
          account_id: profileData.account_id ? String(profileData.account_id) : '',
        }));
      }
      
      setOrganisations(orgsData);
      
      // If an organisation is already selected, make sure it's still valid
      if (collectorConfig.org_id && orgsData.length > 0) {
        const selectedOrg = orgsData.find(org => org.id === collectorConfig.org_id);
        if (selectedOrg) {
          setCollectorConfig((prev) => ({
            ...prev,
            org_name: selectedOrg.name,
            org_id: selectedOrg.id,
          }));
        }
      }
    } catch (error) {
      console.error("Failed to load user data:", error);
    } finally {
      setLoadingUserData(false);
    }
  };

  /**
   * Handle organisation selection
   */
  const handleOrganisationSelect = (orgId: string) => {
    const selectedOrg = organisations.find(org => org.id === orgId);
    if (selectedOrg) {
      setCollectorConfig((prev) => ({
        ...prev,
        org_name: selectedOrg.name,
        org_id: selectedOrg.id,
      }));
    }
  };

  /**
   * Load all configuration on component mount
   */
  useEffect(() => {
    loadDashboardSettings();
    loadConfig();
    loadCollectorConfig();
    loadStatus();
    loadDisplayCount();
    loadUserData();
    loadGeminiSettings();
    
    // Update collector with current token if available
    const updateCollectorToken = async () => {
      try {
        const { updateCollectorAppJwtToken } = await import('@/lib/collectorClient');
        const token = getAccessToken();
        if (token) {
          await updateCollectorAppJwtToken(token);
          console.log('[SETTINGS] Updated collector with app JWT token on mount');
        }
      } catch (error) {
        console.warn('[SETTINGS] Failed to update collector token on mount:', error);
      }
    };
    updateCollectorToken();

    // Update recording status every 5 seconds
    const interval = setInterval(() => {
      loadStatus();
      loadGeminiQueueStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Load dashboard settings from localStorage
   */
  const loadDashboardSettings = () => {
    try {
      const stored = localStorage.getItem("dashboard_settings");
      if (stored) {
        const parsed = JSON.parse(stored) as DashboardSettings;
        setLocalDashboardSettings(parsed);
      } else {
        setLocalDashboardSettings(DEFAULT_DASHBOARD_SETTINGS);
      }
    } catch (error) {
      console.error("Failed to load dashboard settings:", error);
      setLocalDashboardSettings(DEFAULT_DASHBOARD_SETTINGS);
    }
  };

  /**
   * Load recording configuration from backend
   */
  const loadConfig = async () => {
    try {
      const cfg = await getRecordingConfig();
      setConfig(cfg);
    } catch (error) {
      console.error("Failed to load config:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load collector configuration from backend
   */
  const loadCollectorConfig = async () => {
    setCollectorLoading(true);
    setCollectorError("");
    try {
      const loadedConfig = await getCollectorConfig();
      setCollectorConfig(loadedConfig);
      // After loading config, also load user data to populate fields
      await loadUserData();
    } catch (err: any) {
      setCollectorError(`Failed to load configuration: ${err.message}`);
      setCollectorConfig(DEFAULT_COLLECTOR_CONFIG);
    } finally {
      setCollectorLoading(false);
    }
  };

  /**
   * Load current recording status
   */
  const loadStatus = async () => {
    try {
      const st = await getRecordingStatus();
      setStatus(st);
    } catch (error) {
      console.error("Failed to load status:", error);
    }
  };

  /**
   * Load display count
   */
  const loadDisplayCount = async () => {
    try {
      const count = await getDisplayCount();
      setDisplayCount(count);
    } catch (error) {
      console.error("Failed to load display count:", error);
    }
  };

  /**
   * Load Gemini AI settings
   */
  const loadGeminiSettings = async () => {
    setGeminiLoading(true);
    try {
      const [config, hasKey, queueStatus] = await Promise.all([
        getGeminiConfig(),
        hasGeminiApiKey(),
        getGeminiQueueStatus(),
      ]);
      setGeminiConfig(config);
      setGeminiApiKeySet(hasKey);
      setGeminiQueueStatus(queueStatus);
    } catch (error) {
      console.error("Failed to load Gemini settings:", error);
    } finally {
      setGeminiLoading(false);
    }
  };

  /**
   * Load Gemini queue status only
   */
  const loadGeminiQueueStatus = async () => {
    try {
      const status = await getGeminiQueueStatus();
      setGeminiQueueStatus(status);
    } catch (error) {
      console.error("Failed to load Gemini queue status:", error);
    }
  };

  /**
   * Update a field in the collector configuration
   */
  const updateCollectorField = <K extends keyof CollectorConfig>(
    field: K,
    value: CollectorConfig[K]
  ) => {
    setCollectorConfig((prev) => ({ ...prev, [field]: value }));
    setCollectorError("");
    setTestResult(null);
  };

  /**
   * Test the collector connection with current settings
   */
  const handleTestConnection = async () => {
    const validationError = validateConfig(collectorConfig);
    if (validationError) {
      setCollectorError(validationError);
      return;
    }

    setTesting(true);
    setCollectorError("");
    setTestResult(null);

    try {
      // Include app JWT token from localStorage if available
      const appJwtToken = getAccessToken();
      console.log("[SETTINGS] handleTestConnection - getAccessToken() returned:", appJwtToken ? `token (length: ${appJwtToken.length})` : "null");
      
      const configWithToken = {
        ...collectorConfig,
        app_jwt_token: appJwtToken || undefined,
      };
      
      console.log("[SETTINGS] handleTestConnection - configWithToken.app_jwt_token:", configWithToken.app_jwt_token ? `present (length: ${configWithToken.app_jwt_token.length})` : "undefined");
      console.log("[SETTINGS] handleTestConnection - Full config keys:", Object.keys(configWithToken));
      
      const result = await testConnection(configWithToken);
      setTestResult({ success: true, message: result });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  /**
   * Save all settings and notify other windows via storage event
   * Settings are saved independently so one failure doesn't block others
   */
  const handleSave = async () => {
    setSaving(true);
    const errors: string[] = [];

    try {
      // 1. Save dashboard settings to localStorage (always works)
      localStorage.setItem("dashboard_settings", JSON.stringify(localDashboardSettings));

      // Dispatch a custom storage event for cross-window communication
      // (storage events only fire in OTHER windows, so we manually dispatch for same-window listeners)
      window.dispatchEvent(new StorageEvent("storage", {
        key: "dashboard_settings",
        newValue: JSON.stringify(localDashboardSettings),
        storageArea: localStorage
      }));
    } catch (error: any) {
      errors.push(`Dashboard settings: ${error?.message || error}`);
    }

    // 2. Save recording settings if config exists
    // Backend handles restart logic internally based on config diffing
    if (config) {
      try {
        await updateRecordingConfig(config);
        loadStatus();
      } catch (error: any) {
        // May fail if ActivityWatch isn't running - that's expected
        // Config is still saved, recording will start when AW starts (if enabled)
        console.info("Recording config update:", error?.message || error);
        if (String(error?.message || error).includes("not running")) {
          // AW not running is not a user-facing error - config was saved
          loadStatus();
        } else {
          errors.push(`Recording config: ${error?.message || error}`);
        }
      }
    }

    // 3. Validate and save collector settings
    const validationError = validateConfig(collectorConfig);
    if (validationError) {
      setCollectorError(validationError);
      errors.push(`Collector validation: ${validationError}`);
    } else {
      try {
        // Include app JWT token from localStorage if available
        const appJwtToken = getAccessToken();
        const configWithToken = {
          ...collectorConfig,
          app_jwt_token: appJwtToken || undefined,
        };
        
        await updateCollectorConfig(configWithToken);

        // Notify other windows that collector config was saved
        localStorage.setItem("collector_config_saved", Date.now().toString());
        window.dispatchEvent(new StorageEvent("storage", {
          key: "collector_config_saved",
          newValue: Date.now().toString(),
          storageArea: localStorage
        }));
      } catch (error: any) {
        errors.push(`Collector settings: ${error?.message || error}`);
      }
    }

    // 4. Save Gemini AI settings
    try {
      await updateGeminiConfig(geminiConfig);
    } catch (error: any) {
      errors.push(`Gemini AI settings: ${error?.message || error}`);
    }

    setSaving(false);

    // Show result message
    if (errors.length === 0) {
      await message("Settings saved successfully!", {
        title: "Settings Saved",
        kind: "info",
      });
    } else if (errors.length < 3) {
      // Some settings saved, some failed
      await message(
        `Some settings were saved, but there were issues:\n\n${errors.join("\n")}`,
        {
          title: "Settings Partially Saved",
          kind: "warning",
        }
      );
    } else {
      // All failed
      await message(
        `Failed to save settings:\n\n${errors.join("\n")}`,
        {
          title: "Failed to Save Settings",
          kind: "error",
        }
      );
    }
  };

  /**
   * Close the settings window
   */
  const handleClose = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (error) {
      console.error("Failed to close window:", error);
    }
  };

  // Loading state
  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-white rounded-lg p-8">
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b bg-white">
        <div className="flex items-center gap-3">
          <Settings2 className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Settings</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving} className="flex-inline gap-2">
            Save
            {saving && <Loader className="size-4 animate-spin" />}
          </Button>
          <Button onClick={handleClose} className=" p-0 aspect-square" variant="outline" title="Close">
            <X className="size-4 " />
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b bg-white">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex-1 px-4 py-3 font-semibold transition-colors ${activeTab === "dashboard"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-800"
            }`}
        >
          <Gauge className="w-4 h-4 inline mr-2" />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab("recording")}
          className={`flex-1 px-4 py-3 font-semibold transition-colors ${activeTab === "recording"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-800"
            }`}
        >
          <Video className="w-4 h-4 inline mr-2" />
          Recording
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex-1 px-4 py-3 font-semibold transition-colors ${activeTab === "ai"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-800"
            }`}
        >
          <Sparkles className="w-4 h-4 inline mr-2" />
          AI Analysis
        </button>
        <button
          onClick={() => setActiveTab("sync")}
          className={`flex-1 px-4 py-3 font-semibold transition-colors ${activeTab === "sync"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-800"
            }`}
        >
          <Cloud className="w-4 h-4 inline mr-2" />
          Data Sync
        </button>
      </div>

      {/* Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
        {activeTab === "dashboard" && (
          <>
            {/* Dashboard Settings */}
            <div className="space-y-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold mb-2 text-blue-900">Auto-Refresh Configuration</h3>
                <p className="text-sm text-blue-700">
                  Configure how and when the dashboard automatically updates with new activity data.
                </p>
              </div>

              {/* Enable Auto-Refresh */}
              <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
                <div>
                  <label className="font-semibold">Enable Auto-Refresh</label>
                  <p className="text-sm text-gray-600">
                    Automatically update dashboard data at regular intervals
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={localDashboardSettings.auto_refresh_enabled}
                  onChange={(e) =>
                    setLocalDashboardSettings({
                      ...localDashboardSettings,
                      auto_refresh_enabled: e.target.checked,
                    })
                  }
                  className="w-5 h-5"
                />
              </div>

              {/* Refresh Interval */}
              <div className="bg-white p-4 rounded-lg border">
                <label className="font-semibold block mb-2">
                  Refresh Interval (seconds)
                </label>
                <input
                  type="number"
                  value={localDashboardSettings.refresh_interval_seconds}
                  onChange={(e) =>
                    setLocalDashboardSettings({
                      ...localDashboardSettings,
                      refresh_interval_seconds: Math.max(5, parseInt(e.target.value) || 10),
                    })
                  }
                  min={5}
                  step={5}
                  disabled={!localDashboardSettings.auto_refresh_enabled}
                  className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
                />
                <p className="text-sm text-gray-600 mt-1">
                  Minimum 5 seconds (default: 10 seconds)
                </p>
              </div>

              {/* Refresh on Focus */}
              <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
                <div>
                  <label className="font-semibold">Refresh on Window Focus</label>
                  <p className="text-sm text-gray-600">
                    Update dashboard when application window gains focus
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={localDashboardSettings.refresh_on_focus}
                  onChange={(e) =>
                    setLocalDashboardSettings({
                      ...localDashboardSettings,
                      refresh_on_focus: e.target.checked,
                    })
                  }
                  className="w-5 h-5"
                />
              </div>
            </div>
          </>
        )}

        {activeTab === "recording" && (
          <>
            {/* Recording Settings */}
            {/* Info Banner */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="font-semibold mb-2 text-blue-900 flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Multi-Display Recording
              </h3>
              <p className="text-sm text-blue-700">
                Records all {displayCount} display{displayCount !== 1 ? 's' : ''} simultaneously. 
                Each display is saved as a separate MP4 file encoded with H.264.
              </p>
            </div>

            {/* Storage Status Section */}
            <div className="bg-white rounded-lg p-4 border">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                Storage Status
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Displays</p>
                  <p className="font-semibold">{status?.display_count || displayCount}</p>
                </div>
                <div>
                  <p className="text-gray-600">Total Segments</p>
                  <p className="font-semibold">{status?.total_segments || 0}</p>
                </div>
                <div>
                  <p className="text-gray-600">Storage Used</p>
                  <p className="font-semibold">
                    {formatFileSize(status?.total_storage_bytes || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Enable/Disable */}
            <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
              <div>
                <label className="font-semibold">Enable Screen Recording</label>
                <p className="text-sm text-gray-600">
                  Recording will start when you press play on the main screen
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) =>
                  setConfig({ ...config, enabled: e.target.checked })
                }
                className="w-5 h-5"
              />
            </div>

            {/* Segment Duration */}
            <div className="bg-white p-4 rounded-lg border">
              <label className="font-semibold block mb-2">
                Segment Duration (seconds)
              </label>
              <input
                type="number"
                value={config.segment_duration_seconds}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    segment_duration_seconds: parseInt(e.target.value) || 60,
                  })
                }
                min={10}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="text-sm text-gray-600 mt-1">
                Each segment is saved as a separate file. Minimum 10 seconds (default: 60 = 1 minute)
              </p>
            </div>

            {/* Framerate */}
            <div className="bg-white p-4 rounded-lg border">
              <label className="font-semibold block mb-2">
                Framerate: {config.framerate} fps
              </label>
              <input
                type="range"
                min={1}
                max={30}
                value={config.framerate}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    framerate: parseInt(e.target.value),
                  })
                }
                className="w-full"
              />
              <p className="text-sm text-gray-600 mt-1">
                Lower framerate = smaller files, less CPU usage. 4 fps recommended for activity tracking.
              </p>
            </div>

            {/* Retention */}
            <div className="bg-white p-4 rounded-lg border">
              <label className="font-semibold block mb-2">
                Retention Period (days)
              </label>
              <input
                type="number"
                value={config.retention_days}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    retention_days: parseInt(e.target.value) || 3,
                  })
                }
                min={1}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="text-sm text-gray-600 mt-1">
                Recordings older than this will be automatically deleted
              </p>
            </div>

            {/* Storage Quota */}
            <div className="bg-white p-4 rounded-lg border">
              <label className="font-semibold block mb-2">
                Maximum Storage (GB)
              </label>
              <input
                type="number"
                value={(config.max_storage_bytes / (1024 * 1024 * 1024)).toFixed(1)}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    max_storage_bytes: Math.floor(
                      parseFloat(e.target.value) * 1024 * 1024 * 1024
                    ),
                  })
                }
                min={1}
                step={1}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="text-sm text-gray-600 mt-1">
                Oldest recordings will be deleted when storage limit is reached
              </p>
            </div>
          </>
        )}

        {activeTab === "ai" && (
          <>
            {/* AI Analysis Settings */}
            {geminiLoading ? (
              <div className="text-center py-8">
                <Loader className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
                <p className="text-gray-600">Loading AI settings...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Info Banner */}
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h3 className="font-semibold mb-2 text-purple-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Gemini AI Video Analysis
                  </h3>
                  <p className="text-sm text-purple-700">
                    Automatically analyze screen recordings using Google Gemini AI to extract
                    activity timelines with productivity scores. Timeline data is sent to the
                    collector for analytics.
                  </p>
                </div>

                {/* API Key Status */}
                {geminiApiKeySet ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-800 font-medium">API key is configured</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="text-yellow-800 font-medium">No API key configured at build time</span>
                  </div>
                )}

                {/* Enable/Disable */}
                <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
                  <div>
                    <label className="font-semibold">Enable AI Analysis</label>
                    <p className="text-sm text-gray-600">
                      Automatically analyze recordings after each segment completes
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={geminiConfig.enabled}
                    onChange={(e) => setGeminiConfig({ ...geminiConfig, enabled: e.target.checked })}
                    disabled={!geminiApiKeySet}
                    className="w-5 h-5"
                  />
                </div>

                {!geminiApiKeySet && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800">
                      AI analysis requires an API key to be embedded at build time.
                    </p>
                  </div>
                )}

                {/* Queue Status */}
                {geminiQueueStatus && (
                  <div className="bg-white p-4 rounded-lg border">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <HardDrive className="w-5 h-5" />
                      Processing Queue
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Status</p>
                        <p className="font-semibold">
                          {geminiQueueStatus.running ? (
                            <span className="text-green-600">Running</span>
                          ) : (
                            <span className="text-gray-500">Stopped</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Pending Jobs</p>
                        <p className="font-semibold">{geminiQueueStatus.stats.jobs_pending}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Completed</p>
                        <p className="font-semibold text-green-600">{geminiQueueStatus.stats.jobs_completed}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Failed</p>
                        <p className="font-semibold text-red-600">{geminiQueueStatus.stats.jobs_failed}</p>
                      </div>
                    </div>
                    {geminiQueueStatus.stats.last_error && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        <strong>Last Error:</strong> {geminiQueueStatus.stats.last_error}
                      </div>
                    )}
                  </div>
                )}

                {/* Advanced Settings */}
                <div className="bg-white p-4 rounded-lg border">
                  <h3 className="font-semibold mb-3">Advanced Settings</h3>
                  
                  <div className="space-y-4">
                    {/* Thinking Budget */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Thinking Budget
                      </label>
                      <input
                        type="number"
                        value={geminiConfig.thinking_budget}
                        onChange={(e) => setGeminiConfig({
                          ...geminiConfig,
                          thinking_budget: Math.max(0, parseInt(e.target.value) || 0),
                        })}
                        min={0}
                        max={10000}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Token budget for Gemini&apos;s reasoning (0-10000). Higher = better analysis, more cost.
                      </p>
                    </div>

                    {/* Max Retries */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Max Retries
                      </label>
                      <input
                        type="number"
                        value={geminiConfig.max_retries}
                        onChange={(e) => setGeminiConfig({
                          ...geminiConfig,
                          max_retries: Math.max(1, Math.min(10, parseInt(e.target.value) || 3)),
                        })}
                        min={1}
                        max={10}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Number of retry attempts for failed analysis (1-10)
                      </p>
                    </div>

                    {/* Retry Delay */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Retry Delay (seconds)
                      </label>
                      <input
                        type="number"
                        value={geminiConfig.retry_delay_seconds}
                        onChange={(e) => setGeminiConfig({
                          ...geminiConfig,
                          retry_delay_seconds: Math.max(1, parseInt(e.target.value) || 5),
                        })}
                        min={1}
                        max={60}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Base delay between retries (uses exponential backoff)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "sync" && (
          <>
            {/* Data Sync Settings */}
            {collectorLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Loading sync configuration...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Error Display */}
                {collectorError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{collectorError}</p>
                  </div>
                )}

                {/* Test Result Display */}
                {testResult && (
                  <div
                    className={`p-3 rounded-md flex items-start gap-2 ${testResult.success
                        ? "bg-green-50 border border-green-200"
                        : "bg-red-50 border border-red-200"
                      }`}
                  >
                    {testResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <p
                      className={`text-sm ${testResult.success ? "text-green-800" : "text-red-800"
                        }`}
                    >
                      {testResult.message}
                    </p>
                  </div>
                )}

                {/* Info Banner */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold mb-2 text-blue-900">Cloud Data Sync</h3>
                  <p className="text-sm text-blue-700">
                    Sync your activity data to the cloud for backup and cross-device access.
                  </p>
                </div>

                {/* Enable/Disable */}
                <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
                  <div>
                    <label className="font-semibold">Enable Data Sync</label>
                    <p className="text-sm text-gray-600">
                      Automatically sync activity data to the cloud
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={collectorConfig.enabled}
                    onChange={(e) => updateCollectorField("enabled", e.target.checked)}
                    className="w-5 h-5"
                  />
                </div>

                {/* Organization Selection */}
                <div className="bg-white p-4 rounded-lg border">
                  <label className="font-semibold block mb-1">
                    Organization <span className="text-red-500">*</span>
                  </label>
                  {loadingUserData ? (
                    <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 flex items-center gap-2">
                      <Loader className="w-4 h-4 animate-spin text-gray-400" />
                      <span className="text-gray-500">Loading organisations...</span>
                    </div>
                  ) : organisations.length === 0 ? (
                    <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500">
                      No organisations available. Please ensure you have access to at least one organisation.
                    </div>
                  ) : (
                    <select
                      value={collectorConfig.org_id}
                      onChange={(e) => handleOrganisationSelect(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Select an organisation...</option>
                      {organisations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name} {org.description ? `- ${org.description}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Select the organisation to use for data sync
                  </p>
                  {collectorConfig.org_id && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                      <strong>Selected:</strong> {collectorConfig.org_name} (ID: {collectorConfig.org_id})
                    </div>
                  )}
                </div>

                {/* Test Connection Button */}
                <div>
                  <Button
                    onClick={handleTestConnection}
                    variant="outline"
                    disabled={testing || saving}
                    className="flex items-center gap-2"
                  >
                    <Network className="w-3.5 h-3.5" />
                    {testing ? "Testing..." : "Test Connection"}
                  </Button>
                </div>

                {/* Advanced Settings Toggle */}
                <div className="pt-4 border-t">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    {showAdvanced ? "Hide" : "Show"} Advanced Settings
                  </button>
                </div>

                {/* Advanced Settings */}
                {showAdvanced && (
                  <div className="space-y-4 pl-4 border-l-2 border-gray-200">
                    {/* Server URL */}
                    <div className="bg-white p-4 rounded-lg border">
                      <label className="block text-sm font-medium mb-1">
                        Server URL
                      </label>
                      <input
                        type="text"
                        value={collectorConfig.server_url}
                        onChange={(e) => updateCollectorField("server_url", e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                      />
                    </div>

                    {/* Auth URL */}
                    <div className="bg-white p-4 rounded-lg border">
                      <label className="block text-sm font-medium mb-1">
                        Authentication URL
                      </label>
                      <input
                        type="text"
                        value={collectorConfig.auth_url}
                        onChange={(e) => updateCollectorField("auth_url", e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                      />
                    </div>

                    {/* Batch Settings */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-lg border">
                        <label className="block text-sm font-medium mb-1">
                          Batch Size
                        </label>
                        <input
                          type="number"
                          value={collectorConfig.batch_max_size}
                          onChange={(e) => updateCollectorField("batch_max_size", parseInt(e.target.value))}
                          min={10}
                          max={10000}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                        <p className="text-xs text-gray-500 mt-1">Events per batch (10-10,000)</p>
                      </div>

                      <div className="bg-white p-4 rounded-lg border">
                        <label className="block text-sm font-medium mb-1">
                          Batch Interval (s)
                        </label>
                        <input
                          type="number"
                          value={collectorConfig.batch_max_interval_seconds}
                          onChange={(e) => updateCollectorField("batch_max_interval_seconds", parseInt(e.target.value))}
                          min={10}
                          max={3600}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                        <p className="text-xs text-gray-500 mt-1">Time between sends (10-3,600)</p>
                      </div>
                    </div>

                    {/* Retry Settings */}
                    <div className="bg-white p-4 rounded-lg border">
                      <label className="block text-sm font-medium mb-1">
                        Max Retry Attempts
                      </label>
                      <input
                        type="number"
                        value={collectorConfig.retry_max_attempts}
                        onChange={(e) => updateCollectorField("retry_max_attempts", parseInt(e.target.value))}
                        min={1}
                        max={20}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">Failed transmission retries (1-20)</p>
                    </div>

                    {/* Checkboxes */}
                    <div className="space-y-2 bg-white p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="flush_on_afk"
                          checked={collectorConfig.flush_on_afk}
                          onChange={(e) => updateCollectorField("flush_on_afk", e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <label htmlFor="flush_on_afk" className="text-sm cursor-pointer">
                          Flush batch when going AFK
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="auto_reconnect"
                          checked={collectorConfig.auto_reconnect}
                          onChange={(e) => updateCollectorField("auto_reconnect", e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <label htmlFor="auto_reconnect" className="text-sm cursor-pointer">
                          Automatically reconnect on disconnect
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
