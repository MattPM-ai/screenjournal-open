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
    // Try to find the certificate in any accessible keychain
    // This works for both local (login keychain) and CI (temporary keychain)
    const result = execSync(
      `security find-identity -v -p codesigning 2>/dev/null | grep "${developerIdCert}" || true`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    
    if (result.trim().includes(developerIdCert)) {
      return developerIdCert;
    }
    
    // Fall back to ad-hoc signing if certificate not found
    return "-";
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
  
  // For notarization, we need:
  // - Hardened runtime (--options runtime)
  // - Secure timestamp (--timestamp)
  // - No --deep (deprecated, sign nested binaries separately)
  const isDeveloperId = identity !== "-";
  const runtimeOptions = isDeveloperId ? "--options runtime" : "";
  const timestamp = isDeveloperId ? "--timestamp" : "";
  
  try {
    // Build codesign command with required flags for notarization
    const codesignCmd = [
      "codesign",
      "--force",
      "--sign", identityFlag,
      "--entitlements", `"${entitlementsPath}"`,
      runtimeOptions,
      timestamp,
      `"${binaryPath}"`
    ].filter(Boolean).join(" ");
    
    execSync(codesignCmd, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Recursively find all files in a directory
 */
function findAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        // Skip .git and other hidden/system directories
        if (!file.startsWith('.')) {
          findAllFiles(filePath, fileList);
        }
      } else if (stat.isFile()) {
        fileList.push(filePath);
      }
    } catch (e) {
      // Skip files we can't access
    }
  }
  return fileList;
}

/**
 * Check if a file is a Mach-O binary that needs signing
 */
function isBinaryFile(filePath) {
  try {
    // Check by extension first (fast)
    const ext = path.extname(filePath);
    const basename = path.basename(filePath);
    if (ext === '.dylib' || ext === '.so' || basename === 'Python') {
      return true;
    }
    
    // Check if it has execute permissions
    const stat = fs.statSync(filePath);
    if (stat.mode & parseInt('111', 8)) {
      // Has execute bit, check if it's actually a binary
      try {
        const fileOutput = execSync(`file -b "${filePath}"`, { encoding: 'utf8', stdio: 'pipe' });
        return fileOutput.includes('Mach-O');
      } catch (e) {
        // If file command fails, assume it's a binary if it has execute bit
        return true;
      }
    }
    
    // Check using file command for other potential binaries
    try {
      const fileOutput = execSync(`file -b "${filePath}"`, { encoding: 'utf8', stdio: 'pipe' });
      return fileOutput.includes('Mach-O');
    } catch (e) {
      return false;
    }
  } catch (e) {
    return false;
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
  
  try {
    // Find all files recursively
    const allFiles = findAllFiles(dir);
    
    // Filter to only binaries
    const binaries = allFiles.filter(filePath => {
      // Skip non-binary files by extension
      const ext = path.extname(filePath);
      const basename = path.basename(filePath);
      if (['.json', '.txt', '.md', '.pyc', '.py', '.plist', '.html', '.css', '.js', '.ts'].includes(ext)) {
        return false;
      }
      // Check if it's a binary
      return isBinaryFile(filePath);
    });
    
    // Sort to sign in consistent order
    binaries.sort();
    
    if (verbose) {
      console.log(`  📋 Found ${binaries.length} binaries to sign`);
    }
    
    for (const binaryPath of binaries) {
      try {
        const result = signBinary(binaryPath, entitlementsPath, identity);
        
        if (result.skipped) {
          results.skipped++;
        } else if (result.success) {
          if (verbose) {
            console.log(`  ✓ Signed: ${path.relative(dir, binaryPath)}`);
          }
          results.success++;
        } else {
          if (verbose) {
            console.warn(`  ⚠ Failed: ${path.relative(dir, binaryPath)}: ${result.error}`);
          }
          results.failed++;
        }
      } catch (err) {
        if (verbose) {
          console.warn(`  ⚠ Error signing ${path.relative(dir, binaryPath)}: ${err.message}`);
        }
        results.failed++;
      }
    }
  } catch (error) {
    console.warn(`  ⚠ Failed to sign directory: ${error.message}`);
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
