#!/usr/bin/env node

/**
 * Manual Notarization Script
 * 
 * This script manually notarizes the app bundle after all binaries have been signed.
 * This is necessary because Tauri's automatic notarization happens before we can
 * sign all the nested binaries.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { findAppBundle } = require('./sign-app');

function notarizeApp() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Manual Notarization Script                                ║
╚════════════════════════════════════════════════════════════╝
`);

  // Only run on macOS
  if (process.platform !== 'darwin') {
    console.log('ℹ️  Not on macOS, skipping notarization');
    return 0;
  }

  // Check for notarization credentials
  const apiIssuer = process.env.APPLE_API_ISSUER;
  const apiKey = process.env.APPLE_API_KEY;
  const apiKeyPath = process.env.APPLE_API_KEY_PATH;

  if (!apiIssuer || !apiKey || !apiKeyPath) {
    console.log('⚠️  Notarization credentials not found, skipping notarization');
    console.log('   Set APPLE_API_ISSUER, APPLE_API_KEY, and APPLE_API_KEY_PATH to enable');
    return 0;
  }

  // Find the app bundle
  const appBundlePath = findAppBundle();
  if (!appBundlePath) {
    console.error('❌ Failed to locate app bundle');
    return 1;
  }

  console.log(`📦 App bundle: ${path.basename(appBundlePath)}`);
  console.log(`📍 Location: ${appBundlePath}\n`);

  // Create a zip file for notarization
  const zipPath = path.join(path.dirname(appBundlePath), `${path.basename(appBundlePath, '.app')}.zip`);
  console.log('📦 Creating zip file for notarization...');
  try {
    // Remove existing zip if it exists
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    
    // Create zip (must be in the parent directory)
    const appName = path.basename(appBundlePath);
    const parentDir = path.dirname(appBundlePath);
    execSync(`cd "${parentDir}" && zip -r "${path.basename(zipPath)}" "${appName}"`, { stdio: 'inherit' });
    console.log(`✅ Created: ${zipPath}\n`);
  } catch (error) {
    console.error(`❌ Failed to create zip: ${error.message}`);
    return 1;
  }

  // Submit for notarization
  console.log('🚀 Submitting for notarization...');
  try {
    const notarytoolCmd = [
      'xcrun notarytool',
      'submit',
      `"${zipPath}"`,
      '--key', `"${apiKeyPath}"`,
      '--key-id', apiKey,
      '--issuer', apiIssuer,
      '--wait'
    ].join(' ');

    execSync(notarytoolCmd, { stdio: 'inherit' });
    console.log('✅ Notarization successful!\n');
  } catch (error) {
    console.error(`❌ Notarization failed: ${error.message}`);
    return 1;
  }

  // Staple the notarization ticket
  console.log('📎 Stapling notarization ticket...');
  try {
    execSync(`xcrun stapler staple "${appBundlePath}"`, { stdio: 'inherit' });
    console.log('✅ Ticket stapled successfully!\n');
  } catch (error) {
    console.error(`❌ Failed to staple ticket: ${error.message}`);
    return 1;
  }

  console.log(`
╔════════════════════════════════════════════════════════════╗
║  ✅ Notarization Complete!                                 ║
╚════════════════════════════════════════════════════════════╝

📦 Notarized bundle: ${appBundlePath}
🔒 Your app is now ready for distribution!
`);

  return 0;
}

// Run the script
if (require.main === module) {
  const exitCode = notarizeApp();
  process.exit(exitCode);
}

module.exports = { notarizeApp };

