/**
 * ============================================================================
 * RECORDING CONFIG MODULE
 * ============================================================================
 * 
 * PURPOSE: Configuration persistence for screen recording system
 * 
 * FUNCTIONALITY:
 * - Load/save recording configuration to disk
 * - Default configuration when none exists
 * - JSON-based storage in app data directory
 * 
 * ============================================================================
 */

use crate::recording::gemini::GeminiConfig;
use crate::recording::types::RecordingConfig;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

// Get config file path
fn config_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("app_data_dir available")
        .join("recording_config.json")
}

// Load configuration from disk
pub fn load_config(app: &AppHandle) -> Result<RecordingConfig, String> {
    let path = config_path(app);
    
    if !path.exists() {
        log::info!("No recording config found, using defaults");
        return Ok(RecordingConfig::default());
    }
    
    let contents =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read config: {}", e))?;
    
    let config: RecordingConfig =
        serde_json::from_str(&contents).map_err(|e| format!("Failed to parse config: {}", e))?;
    
    log::info!("Loaded recording config from {:?}", path);
    Ok(config)
}

// Save configuration to disk
pub fn save_config(app: &AppHandle, config: &RecordingConfig) -> Result<(), String> {
    let path = config_path(app);
    
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    
    let contents = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    std::fs::write(&path, contents).map_err(|e| format!("Failed to write config: {}", e))?;
    
    log::info!("Saved recording config to {:?}", path);
    Ok(())
}

// =============================================================================
// Gemini Configuration
// =============================================================================

// Get Gemini config file path
fn gemini_config_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("app_data_dir available")
        .join("gemini_config.json")
}

// Load Gemini configuration from disk
pub fn load_gemini_config(app: &AppHandle) -> Result<GeminiConfig, String> {
    let path = gemini_config_path(app);
    
    if !path.exists() {
        log::info!("No Gemini config found, using defaults");
        return Ok(GeminiConfig::default());
    }
    
    let contents =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read Gemini config: {}", e))?;
    
    let config: GeminiConfig =
        serde_json::from_str(&contents).map_err(|e| format!("Failed to parse Gemini config: {}", e))?;
    
    log::info!("Loaded Gemini config from {:?}", path);
    Ok(config)
}

// Save Gemini configuration to disk
pub fn save_gemini_config(app: &AppHandle, config: &GeminiConfig) -> Result<(), String> {
    let path = gemini_config_path(app);
    
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    
    let contents = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize Gemini config: {}", e))?;
    
    std::fs::write(&path, contents).map_err(|e| format!("Failed to write Gemini config: {}", e))?;
    
    log::info!("Saved Gemini config to {:?}", path);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_serialization() {
        let config = RecordingConfig::default();
        let json = serde_json::to_string_pretty(&config).unwrap();
        let parsed: RecordingConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config, parsed);
    }
}
