/**
 * ============================================================================
 * Resource Manager
 * ============================================================================
 * 
 * Core logic for setting up, checking, and bundling external binary resources.
 * Uses configuration from resources.config.js.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const {
  PATHS,
  getCurrentPlatform,
  getAllPlatforms,
  isMacOS,
  ensureDir,
  removeDir,
  fileExists,
  copyFile,
  copyDirRecursive,
  makeExecutable,
  findFiles,
} = require('./utils');

const { downloadFile, extractArchive } = require('./download');
const { signDirectory } = require('./signing');
const { getResource, getAllResourceNames, getDownloadUrl, getPlatformConfig } = require('../resources.config');

// =============================================================================
// Setup Functions
// =============================================================================

/**
 * Setup a single resource for specified platforms
 * @param {string} resourceName - Resource name from config
 * @param {Object} options - Setup options
 * @param {string|string[]} options.platforms - 'current', 'all', or array of platform keys
 * @param {boolean} options.force - Force re-download even if exists
 * @param {boolean} options.verbose - Verbose output
 * @returns {Promise<{ success: boolean, platforms: Object }>}
 */
async function setupResource(resourceName, options = {}) {
  const { platforms = 'current', force = false, verbose = true } = options;
  
  const resource = getResource(resourceName);
  if (!resource) {
    throw new Error(`Unknown resource: ${resourceName}`);
  }
  
  if (verbose) {
    console.log(`\n🚀 Setting up ${resource.name}...`);
  }
  
  // Determine which platforms to setup
  let platformList;
  if (platforms === 'current') {
    const current = getCurrentPlatform();
    if (!current) {
      throw new Error('Could not detect current platform');
    }
    platformList = [current];
  } else if (platforms === 'all') {
    platformList = getAllPlatforms();
  } else if (Array.isArray(platforms)) {
    platformList = platforms;
  } else {
    platformList = [platforms];
  }
  
  // Filter to only platforms that have config
  platformList = platformList.filter(p => resource.platforms[p]);
  
  if (platformList.length === 0) {
    throw new Error(`No valid platforms found for ${resourceName}`);
  }
  
  if (verbose) {
    console.log(`  📦 Platforms: ${platformList.join(', ')}`);
  }
  
  // Setup each platform
  const results = {};
  for (const platform of platformList) {
    results[platform] = await setupResourcePlatform(resourceName, platform, { force, verbose });
  }
  
  // Cleanup temp directory
  removeDir(PATHS.tempDir);
  
  const allSuccess = Object.values(results).every(r => r.success);
  return { success: allSuccess, platforms: results };
}

/**
 * Setup a resource for a single platform
 * @private
 */
async function setupResourcePlatform(resourceName, platform, options = {}) {
  const { force = false, verbose = true } = options;
  
  const resource = getResource(resourceName);
  const platformConfig = getPlatformConfig(resourceName, platform);
  
  if (!platformConfig) {
    return { success: false, error: `No config for platform: ${platform}` };
  }
  
  const targetDir = path.join(PATHS.resourcesDir, resource.resourceDir, platform.replace('-', '/'));
  const primaryBinaryPath = path.join(targetDir, resource.primaryBinary(platform));
  
  if (verbose) {
    console.log(`\n  📍 ${platform}:`);
  }
  
  // Check if already installed
  if (!force && fileExists(primaryBinaryPath)) {
    if (verbose) {
      console.log(`    ✅ Already installed`);
    }
    return { success: true, skipped: true };
  }
  
  try {
    // Ensure temp directory
    ensureDir(PATHS.tempDir);
    
    // Download
    const url = getDownloadUrl(resourceName, platform);
    const archiveExt = platformConfig.archiveType === 'tar.xz' ? '.tar.xz' : '.zip';
    const archivePath = path.join(PATHS.tempDir, `${resourceName}-${platform}${archiveExt}`);
    
    await downloadFile(url, archivePath, { showProgress: verbose });
    
    // Extract
    const extractDir = path.join(PATHS.tempDir, `extract-${resourceName}-${platform}`);
    removeDir(extractDir);
    extractArchive(archivePath, extractDir, platformConfig.archiveType);
    
    // Ensure target directory exists
    ensureDir(targetDir);
    
    // Extract binaries (use custom or default logic)
    if (resource.extractBinaries) {
      // Custom extraction logic
      const copied = resource.extractBinaries(extractDir, targetDir, platform);
      if (verbose && copied.length > 0) {
        console.log(`    📋 Copied: ${copied.join(', ')}`);
      }
    } else {
      // Default extraction for single-binary resources
      let sourceBinary = null;
      
      if (platformConfig.extractedPattern) {
        // Find binary by pattern
        const matches = findFiles(extractDir, platformConfig.extractedPattern);
        if (matches.length > 0) {
          sourceBinary = matches[0];
        }
      } else if (platformConfig.extractedName) {
        // Direct path
        sourceBinary = path.join(extractDir, platformConfig.extractedName);
        if (!fileExists(sourceBinary)) {
          // Try finding it
          const pattern = new RegExp(`${platformConfig.extractedName}$`);
          const matches = findFiles(extractDir, pattern);
          if (matches.length > 0) {
            sourceBinary = matches[0];
          }
        }
      }
      
      if (!sourceBinary || !fileExists(sourceBinary)) {
        throw new Error('Could not find binary in extracted archive');
      }
      
      const targetBinary = path.join(targetDir, platformConfig.binaryName);
      copyFile(sourceBinary, targetBinary);
      makeExecutable(targetBinary);
      
      if (verbose) {
        console.log(`    📋 Installed: ${platformConfig.binaryName}`);
      }
    }
    
    // Make binaries executable (Unix)
    if (platform.startsWith('darwin') || platform.startsWith('linux')) {
      const binaries = findFiles(targetDir, /./);
      binaries.forEach(b => makeExecutable(b));
    }
    
    // Sign on macOS
    if (platform.startsWith('darwin') && isMacOS()) {
      if (verbose) {
        console.log(`    🔏 Signing binaries...`);
      }
      const signResults = signDirectory(targetDir, PATHS.entitlements, { verbose: false });
      if (verbose && signResults.success > 0) {
        console.log(`    ✓ Signed ${signResults.success} binaries`);
      }
    }
    
    // Verify if command provided
    if (resource.verifyCommand) {
      try {
        const verifyPath = path.join(targetDir, resource.primaryBinary(platform));
        const cmd = resource.verifyCommand(verifyPath);
        const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        const version = output.split('\n')[0];
        if (verbose) {
          console.log(`    🎉 Verified: ${version.substring(0, 50)}`);
        }
      } catch {
        if (verbose) {
          console.log(`    ⚠️  Could not verify (may be cross-platform build)`);
        }
      }
    }
    
    if (verbose) {
      console.log(`    ✅ Setup complete`);
    }
    
    return { success: true };
    
  } catch (error) {
    if (verbose) {
      console.error(`    ❌ Failed: ${error.message}`);
    }
    return { success: false, error: error.message };
  }
}

// =============================================================================
// Check Functions
// =============================================================================

/**
 * Check if a resource is properly installed
 * @param {string} resourceName - Resource name from config
 * @param {Object} options - Check options
 * @param {string} options.platforms - 'current' or 'all'
 * @param {boolean} options.verify - Run verification command if available
 * @param {boolean} options.verbose - Show detailed output
 * @returns {{ success: boolean, platforms: Object }}
 */
function checkResource(resourceName, options = {}) {
  const { platforms = 'current', verify = true, verbose = false } = options;
  
  const resource = getResource(resourceName);
  if (!resource) {
    throw new Error(`Unknown resource: ${resourceName}`);
  }
  
  // Check skip environment variable
  if (process.env[resource.skipEnvVar] === 'true') {
    console.log(`⚠️  ${resource.skipEnvVar} is set, skipping ${resource.name} check`);
    return { success: true, skipped: true, platforms: {} };
  }
  
  // Determine which platforms to check
  let platformList;
  if (platforms === 'current') {
    const current = getCurrentPlatform();
    if (!current) {
      throw new Error('Could not detect current platform');
    }
    platformList = [current];
  } else {
    platformList = getAllPlatforms().filter(p => resource.platforms[p]);
  }
  
  // Check each platform
  const results = {};
  for (const platform of platformList) {
    results[platform] = checkResourcePlatform(resourceName, platform, { verify, verbose });
  }
  
  const allSuccess = Object.values(results).every(r => r.exists);
  return { success: allSuccess, platforms: results };
}

/**
 * Check a resource for a single platform
 * @private
 */
function checkResourcePlatform(resourceName, platform, options = {}) {
  const { verify = true, verbose = false } = options;
  
  const resource = getResource(resourceName);
  const targetDir = path.join(PATHS.resourcesDir, resource.resourceDir, platform.replace('-', '/'));
  const primaryBinaryPath = path.join(targetDir, resource.primaryBinary(platform));
  
  const result = {
    exists: fileExists(primaryBinaryPath),
    path: primaryBinaryPath,
    verified: null,
    version: null,
  };
  
  // Verify if requested and binary exists
  if (result.exists && verify && resource.verifyCommand) {
    try {
      const cmd = resource.verifyCommand(primaryBinaryPath);
      const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      result.verified = true;
      result.version = output.split('\n')[0];
    } catch {
      result.verified = false;
    }
  }
  
  return result;
}

/**
 * Check all resources
 * @param {Object} options - Check options
 * @returns {{ success: boolean, resources: Object }}
 */
function checkAllResources(options = {}) {
  const resourceNames = getAllResourceNames();
  const results = {};
  let allSuccess = true;
  
  for (const name of resourceNames) {
    results[name] = checkResource(name, options);
    if (!results[name].success) {
      allSuccess = false;
    }
  }
  
  return { success: allSuccess, resources: results };
}

// =============================================================================
// Bundle Functions
// =============================================================================

/**
 * Bundle a resource into the app bundle
 * @param {string} resourceName - Resource name
 * @param {string} bundlePath - Path to bundle's Resources directory
 * @param {Object} options - Bundle options
 * @returns {{ success: boolean, error?: string }}
 */
function bundleResource(resourceName, bundlePath, options = {}) {
  const resource = getResource(resourceName);
  if (!resource) {
    return { success: false, error: `Unknown resource: ${resourceName}` };
  }
  
  const sourcePath = path.join(PATHS.resourcesDir, resource.resourceDir);
  const targetPath = path.join(bundlePath, resource.resourceDir);
  
  // Check if source exists
  if (!fileExists(sourcePath)) {
    return { success: false, error: `Resource not found: ${sourcePath}` };
  }
  
  // Remove existing
  if (fileExists(targetPath)) {
    removeDir(targetPath);
  }
  
  // Copy
  try {
    copyDirRecursive(sourcePath, targetPath);
  } catch (error) {
    return { success: false, error: `Copy failed: ${error.message}` };
  }
  
  // Sign on macOS
  if (isMacOS()) {
    const signResults = signDirectory(targetPath, PATHS.entitlements, { verbose: true });
    console.log(`  📊 Signing: ${signResults.success} succeeded, ${signResults.failed} failed`);
  }
  
  return { success: true };
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  setupResource,
  checkResource,
  checkAllResources,
  bundleResource,
  // Re-export config helpers
  getResource,
  getAllResourceNames,
};
