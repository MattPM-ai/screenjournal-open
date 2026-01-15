#!/usr/bin/env node

/**
 * Sign App Bundle Script
 * 
 * This script signs the complete .app bundle after Tauri build completes.
 * It ensures the entire app bundle is properly signed with entitlements.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const bundlePathArg = args.includes('--bundle-path') ? args[args.indexOf('--bundle-path') + 1] : null;
const skipVerify = args.includes('--skip-verify');

function findAppBundle() {
  // If bundle path provided, use it
  if (bundlePathArg) {
    if (fs.existsSync(bundlePathArg)) {
      return bundlePathArg;
    }
    console.error(`❌ Provided bundle path not found: ${bundlePathArg}`);
    return null;
  }

  // Otherwise, search in standard location
  const bundleDir = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle', 'macos');
  
  if (!fs.existsSync(bundleDir)) {
    console.error('❌ macOS bundle directory not found');
    console.error(`   Expected at: ${bundleDir}`);
    return null;
  }

  const apps = fs.readdirSync(bundleDir).filter(f => f.endsWith('.app'));
  
  if (apps.length === 0) {
    console.error('❌ No .app bundle found in bundle directory');
    return null;
  }

  if (apps.length > 1) {
    console.warn(`⚠️  Multiple .app bundles found, using first: ${apps[0]}`);
  }

  return path.join(bundleDir, apps[0]);
}

function signAppBundle() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  App Bundle Signing Script                                 ║
╚════════════════════════════════════════════════════════════╝
`);

  // Only run on macOS
  if (process.platform !== 'darwin') {
    console.log('ℹ️  Not on macOS, skipping app signing');
    return 0;
  }

  // Find the app bundle
  const appBundlePath = findAppBundle();
  if (!appBundlePath) {
    console.error('❌ Failed to locate app bundle');
    return 1;
  }

  console.log(`📦 Found app bundle: ${path.basename(appBundlePath)}`);
  console.log(`📍 Location: ${appBundlePath}\n`);

  // Find entitlements file
  const entitlementsPath = path.join(__dirname, '..', 'src-tauri', 'entitlements.plist');
  if (!fs.existsSync(entitlementsPath)) {
    console.error(`❌ Entitlements file not found: ${entitlementsPath}`);
    return 1;
  }

  console.log(`🔑 Using entitlements: ${entitlementsPath}\n`);

  // Sign the app bundle
  try {
    console.log('🔏 Signing app bundle...');
    execSync(
      `codesign --force --deep --sign - --entitlements "${entitlementsPath}" "${appBundlePath}"`,
      { stdio: 'inherit' }
    );
    console.log('✅ App bundle signed successfully!\n');
  } catch (error) {
    console.error('❌ Failed to sign app bundle:', error.message);
    return 1;
  }

  // Verify signature (unless skipped)
  if (!skipVerify) {
    try {
      console.log('🔍 Verifying signature...');
      execSync(`codesign --verify --verbose "${appBundlePath}"`, { stdio: 'inherit' });
      console.log('✅ Signature verified!\n');
    } catch (error) {
      console.error('❌ Signature verification failed:', error.message);
      return 1;
    }

    // Display signature information
    try {
      console.log('📋 Signature details:');
      execSync(`codesign --display --verbose=4 "${appBundlePath}"`, { stdio: 'inherit' });
      console.log('');
    } catch (error) {
      console.warn('⚠️  Could not display signature details');
    }
  }

  console.log(`
╔════════════════════════════════════════════════════════════╗
║  ✅ Signing Complete!                                      ║
╚════════════════════════════════════════════════════════════╝

📦 Signed bundle: ${appBundlePath}

🔒 Your app is now properly signed with entitlements.
   Accessibility permissions should persist across launches.

💡 To verify signature manually:
   codesign --verify --verbose "${appBundlePath}"
   codesign --display --entitlements - "${appBundlePath}"
`);

  return 0;
}

// Run the script
if (require.main === module) {
  const exitCode = signAppBundle();
  process.exit(exitCode);
}

module.exports = { signAppBundle, findAppBundle };


