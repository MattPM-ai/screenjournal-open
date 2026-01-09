#!/usr/bin/env node

/**
 * ============================================================================
 * Bundle Resources Script
 * ============================================================================
 * 
 * Copies external binary resources into the Tauri app bundle after building.
 * This is necessary because Tauri's resources config doesn't handle large
 * binary distributions well.
 * 
 * USAGE:
 *   npm run bundle-resources
 * 
 * BUNDLED RESOURCES:
 *   - ActivityWatch: aw-server, aw-watcher-window, etc.
 *   - FFmpeg: Video encoding for screen recording
 * 
 */

const fs = require('fs');
const path = require('path');
const { bundleResource, getAllResourceNames, getResource } = require('./lib/resource-manager');
const { printHeader, printSection, isMacOS } = require('./lib/utils');

// =============================================================================
// Bundle Path Detection
// =============================================================================

const TARGET_PLATFORM = process.platform;

/**
 * Get the bundle resources path for the current platform
 */
function getBundlePath() {
  const bundleDir = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle');
  
  // Platform-specific bundle paths
  if (TARGET_PLATFORM === 'darwin') {
    // macOS: Find the .app bundle
    const macosDir = path.join(bundleDir, 'macos');
    if (fs.existsSync(macosDir)) {
      const apps = fs.readdirSync(macosDir).filter(f => f.endsWith('.app'));
      if (apps.length > 0) {
        return path.join(macosDir, apps[0], 'Contents', 'Resources');
      }
    }
  } else if (TARGET_PLATFORM === 'win32') {
    // Windows: resources go next to the .exe
    const nsis = path.join(bundleDir, 'nsis');
    if (fs.existsSync(nsis)) {
      return nsis;
    }
  } else if (TARGET_PLATFORM === 'linux') {
    // Linux: AppImage or deb
    const appimage = path.join(bundleDir, 'appimage');
    if (fs.existsSync(appimage)) {
      return appimage;
    }
  }
  
  return null;
}

// =============================================================================
// Main
// =============================================================================

function main() {
  printHeader('Bundling Resources');
  
  // Find bundle location
  const bundlePath = getBundlePath();
  if (!bundlePath) {
    console.error('❌ Could not find Tauri bundle directory');
    console.error('   Make sure you ran `tauri build` first');
    process.exit(1);
  }
  
  console.log(`🎯 Bundle target: ${bundlePath}\n`);
  
  // Bundle each resource
  const resourceNames = getAllResourceNames();
  const results = {};
  
  for (const resourceName of resourceNames) {
    const resource = getResource(resourceName);
    console.log(`📦 Bundling ${resource.name}...`);
    
    const result = bundleResource(resourceName, bundlePath);
    results[resourceName] = result;
    
    if (result.success) {
      console.log(`  ✅ ${resource.name} bundled successfully!\n`);
    } else {
      console.error(`  ❌ Failed: ${result.error}`);
      if (resourceName === 'activitywatch') {
        console.error(`     Run: npm run setup-aw\n`);
      } else if (resourceName === 'ffmpeg') {
        console.error(`     Run: npm run setup-ffmpeg\n`);
      }
    }
  }
  
  // Summary
  printSection('Bundle Summary');
  
  let hasFailures = false;
  for (const [name, result] of Object.entries(results)) {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${name}`);
    if (!result.success) hasFailures = true;
  }
  
  console.log('═'.repeat(60));
  
  if (hasFailures) {
    console.error('\n❌ Some resources failed to bundle. Check errors above.');
    process.exit(1);
  }
  
  console.log('\n✅ All resources bundled successfully!\n');
  console.log(`📍 Resources are at: ${bundlePath}`);
}

// =============================================================================
// Entry Point
// =============================================================================

// Run if called directly
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('❌ Failed to bundle resources:', error.message);
    process.exit(1);
  }
}

module.exports = { getBundlePath };
