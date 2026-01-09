/**
 * Updater Client
 * 
 * Provides functions to check for and install application updates
 * using the Tauri updater plugin. Handles update detection, download
 * progress tracking, and application relaunch.
 * 
 * Dependencies:
 * - @tauri-apps/plugin-updater: Update checking and installation
 * - @tauri-apps/plugin-process: Application relaunch after update
 */

import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/**
 * Update status information returned by checkForUpdate
 */
export type UpdateStatus = {
  /** Whether an update is available */
  available: boolean;
  /** New version string (e.g., "1.2.0") */
  version?: string;
  /** Current installed version */
  currentVersion?: string;
  /** Release notes / changelog */
  body?: string;
  /** Release date */
  date?: string;
};

/**
 * Progress callback for download tracking
 * @param downloaded - Bytes downloaded so far
 * @param total - Total bytes to download
 */
export type ProgressCallback = (downloaded: number, total: number) => void;

/**
 * Check if an application update is available
 * 
 * Contacts the update endpoint configured in tauri.conf.json and
 * compares the remote version against the current installed version.
 * 
 * @returns UpdateStatus object indicating availability and version info
 * @throws Error if the update check fails (network error, invalid response, etc.)
 */
export async function checkForUpdate(): Promise<UpdateStatus> {
  try {
    const update = await check();
    
    if (update) {
      return {
        available: true,
        version: update.version,
        currentVersion: update.currentVersion,
        body: update.body ?? undefined,
        date: update.date ?? undefined,
      };
    }
    
    return { available: false };
  } catch (error) {
    console.error('[UPDATER] Failed to check for updates:', error);
    throw error;
  }
}

/**
 * Download and install the available update, then relaunch the app
 * 
 * Downloads the update package with progress tracking, installs it,
 * and relaunches the application to apply the update.
 * 
 * @param onProgress - Optional callback for download progress updates
 * @throws Error if no update is available or download/install fails
 */
export async function downloadAndInstall(
  onProgress?: ProgressCallback
): Promise<void> {
  const update = await check();
  
  if (!update) {
    throw new Error('No update available');
  }
  
  console.log(`[UPDATER] Starting download of version ${update.version}`);
  
  let totalDownloaded = 0;
  let totalSize = 0;
  
  // Download with progress callback
  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      totalSize = event.data.contentLength ?? 0;
      console.log(`[UPDATER] Download started: ${totalSize || 'unknown'} bytes`);
    } else if (event.event === 'Progress') {
      totalDownloaded += event.data.chunkLength;
      
      if (totalSize && onProgress) {
        onProgress(totalDownloaded, totalSize);
      }
    } else if (event.event === 'Finished') {
      console.log('[UPDATER] Download finished, installing...');
    }
  });
  
  console.log('[UPDATER] Update installed, relaunching application...');
  
  // Relaunch the app to apply the update
  await relaunch();
}

