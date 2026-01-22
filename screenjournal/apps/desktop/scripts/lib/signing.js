/**
 * ============================================================================
 * Code Signing Utilities
 * ============================================================================
 * 
 * macOS code signing utilities for bundled binaries.
 * Uses Developer ID certificate when available, falls back to ad-hoc signing.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { isMacOS, fileExists } = require('./utils');

// =============================================================================
// Certificate Detection
// =============================================================================

/**
 * Get the signing identity to use (Developer ID or ad-hoc)
 * @returns {string} Signing identity name or "-" for ad-hoc
 */
function getSigningIdentity() {
  // Check for Developer ID certificate
  const developerIdCert = "Developer ID Application: Chomtana CHANJARASWICHAI (2N4Z8N5N6A)";
  
  try {
    // Try to verify the certificate exists and is accessible
    execSync(
      `security find-certificate -c "${developerIdCert}" -p ~/Library/Keychains/login.keychain-db > /dev/null 2>&1`,
      { stdio: 'pipe' }
    );
    return developerIdCert;
  } catch (error) {
    // Fall back to ad-hoc signing if certificate not found
    return "-";
  }
}

// =============================================================================
// Signing Functions
// =============================================================================

/**
 * Sign a single binary (macOS only)
 * @param {string} binaryPath - Path to binary
 * @param {string} entitlementsPath - Path to entitlements.plist
 * @param {string} signingIdentity - Optional signing identity (defaults to auto-detect)
 * @returns {{ success: boolean, error?: string }}
 */
function signBinary(binaryPath, entitlementsPath, signingIdentity = null) {
  // Only sign on macOS
  if (!isMacOS()) {
    return { success: true, skipped: true };
  }
  
  // Verify binary exists
  if (!fileExists(binaryPath)) {
    return { success: false, error: `Binary not found: ${binaryPath}` };
  }
  
  // Verify entitlements exists
  if (!fileExists(entitlementsPath)) {
    return { success: false, error: `Entitlements not found: ${entitlementsPath}` };
  }
  
  // Get signing identity if not provided
  const identity = signingIdentity || getSigningIdentity();
  const identityFlag = identity === "-" ? "-" : `"${identity}"`;
  
  try {
    execSync(
      `codesign --force --sign ${identityFlag} --entitlements "${entitlementsPath}" --deep "${binaryPath}"`,
      { stdio: 'pipe' }
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Sign all executables in a directory (macOS only)
 * @param {string} dir - Directory containing binaries
 * @param {string} entitlementsPath - Path to entitlements.plist
 * @param {Object} options - Options
 * @param {boolean} options.verbose - Log each file being signed
 * @returns {{ success: number, failed: number, skipped: number }}
 */
function signDirectory(dir, entitlementsPath, options = {}) {
  const { verbose = false, signingIdentity = null } = options;
  const results = { success: 0, failed: 0, skipped: 0 };
  
  // Only sign on macOS
  if (!isMacOS()) {
    return results;
  }
  
  // Verify directory exists
  if (!fileExists(dir)) {
    console.warn(`  ⚠ Directory not found: ${dir}`);
    return results;
  }
  
  // Verify entitlements exists
  if (!fileExists(entitlementsPath)) {
    console.warn(`  ⚠ Entitlements not found: ${entitlementsPath}`);
    return results;
  }
  
  // Get signing identity once for all binaries in this directory
  const identity = signingIdentity || getSigningIdentity();
  if (verbose && identity !== "-") {
    console.log(`  🔑 Using signing identity: ${identity}`);
  }
  
  // Find all executable binaries recursively
  try {
    const findCommand = `find "${dir}" -type f -perm +111`;
    const output = execSync(findCommand, { encoding: 'utf8' });
    const binaries = output.trim().split('\n').filter(f => {
      // Filter out non-binary files
      return f && !f.includes('.json') && !f.includes('.txt') && !f.includes('.md');
    });
    
    for (const binaryPath of binaries) {
      const result = signBinary(binaryPath, entitlementsPath, identity);
      
      if (result.skipped) {
        results.skipped++;
      } else if (result.success) {
        if (verbose) {
          console.log(`  ✓ Signed: ${path.basename(binaryPath)}`);
        }
        results.success++;
      } else {
        if (verbose) {
          console.warn(`  ⚠ Failed: ${path.basename(binaryPath)}: ${result.error}`);
        }
        results.failed++;
      }
    }
  } catch (findError) {
    console.warn(`  ⚠ Failed to find binaries: ${findError.message}`);
  }
  
  return results;
}

/**
 * Sign specific binaries by path list (macOS only)
 * @param {string[]} binaryPaths - Array of binary paths to sign
 * @param {string} entitlementsPath - Path to entitlements.plist
 * @param {Object} options - Options
 * @param {boolean} options.verbose - Log each file being signed
 * @returns {{ success: number, failed: number, skipped: number }}
 */
function signBinaries(binaryPaths, entitlementsPath, options = {}) {
  const { verbose = false, signingIdentity = null } = options;
  const results = { success: 0, failed: 0, skipped: 0 };
  
  // Only sign on macOS
  if (!isMacOS()) {
    return results;
  }
  
  // Get signing identity once for all binaries
  const identity = signingIdentity || getSigningIdentity();
  if (verbose && identity !== "-") {
    console.log(`  🔑 Using signing identity: ${identity}`);
  }
  
  for (const binaryPath of binaryPaths) {
    if (!fileExists(binaryPath)) {
      if (verbose) {
        console.log(`  ⊘ Skipped: ${path.basename(binaryPath)} (not found)`);
      }
      results.skipped++;
      continue;
    }
    
    const result = signBinary(binaryPath, entitlementsPath, identity);
    
    if (result.success) {
      if (verbose) {
        console.log(`  ✓ Signed: ${path.basename(binaryPath)}`);
      }
      results.success++;
    } else {
      if (verbose) {
        console.warn(`  ⚠ Failed: ${path.basename(binaryPath)}: ${result.error}`);
      }
      results.failed++;
    }
  }
  
  return results;
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  signBinary,
  signDirectory,
  signBinaries,
  getSigningIdentity,
};
