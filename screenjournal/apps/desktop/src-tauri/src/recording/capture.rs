/**
 * ============================================================================
 * RECORDING CAPTURE MODULE
 * ============================================================================
 * 
 * PURPOSE: Multi-display screen capture and MP4 encoding using scap + FFmpeg
 * 
 * FUNCTIONALITY:
 * - Check platform support and permissions
 * - Enumerate all available displays
 * - Capture frames from multiple displays simultaneously
 * - Pipe BGRA frames to bundled FFmpeg for H.264 MP4 encoding
 * 
 * OUTPUT FORMAT:
 * - One MP4 file per display with H.264 video codec
 * - JSON sidecar: Metadata including dimensions, framerate, frame count
 * 
 * REQUIREMENTS:
 * - FFmpeg binary must be bundled in resources/ffmpeg/{platform}/{arch}/
 * - Call init_ffmpeg_path() on app startup to initialize the path
 * 
 * ============================================================================
 */

use crate::recording::types::MonitorInfo;
use once_cell::sync::Lazy;
use scap::{
    capturer::{Capturer, Options},
    frame::{Frame, FrameType},
    Target,
};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

// =============================================================================
// FFmpeg Path Management
// =============================================================================

// Global FFmpeg binary path - initialized on app startup
static FFMPEG_PATH: Lazy<Mutex<Option<PathBuf>>> = Lazy::new(|| Mutex::new(None));

// Get platform-specific FFmpeg binary name and subdirectory
fn ffmpeg_platform_info() -> (&'static str, &'static str) {
    #[cfg(target_os = "windows")]
    {
        ("windows/x86_64", "ffmpeg.exe")
    }
    #[cfg(target_os = "macos")]
    {
        #[cfg(target_arch = "aarch64")]
        {
            ("darwin/aarch64", "ffmpeg")
        }
        #[cfg(target_arch = "x86_64")]
        {
            ("darwin/x86_64", "ffmpeg")
        }
    }
    #[cfg(target_os = "linux")]
    {
        ("linux/x86_64", "ffmpeg")
    }
}

// Resolve the bundled FFmpeg binary path
// 
// Searches in order:
// 1. DEV: src-tauri/resources/ffmpeg/{platform}/{arch}/ffmpeg
// 2. DEV: resources/ffmpeg/{platform}/{arch}/ffmpeg (when cwd is src-tauri)
// 3. PROD: {resource_dir}/ffmpeg/{platform}/{arch}/ffmpeg
fn resolve_ffmpeg_path(app: &AppHandle) -> PathBuf {
    let (platform_subdir, bin_name) = ffmpeg_platform_info();
    
    // Helper to build path from a root
    let build_path = |root: PathBuf| -> PathBuf {
        root.join(platform_subdir).join(bin_name)
    };
    
    // DEV: Try project paths first
    if cfg!(debug_assertions) {
        // 1) src-tauri/resources/ffmpeg path from project root
        let candidate1 = build_path(
            PathBuf::from("src-tauri")
                .join("resources")
                .join("ffmpeg"),
        );
        if candidate1.exists() {
            log::info!("FFmpeg found at dev path: {:?}", candidate1);
            return candidate1;
        }
        
        // 2) resources/ffmpeg path when cwd is src-tauri
        let candidate2 = build_path(PathBuf::from("resources").join("ffmpeg"));
        if candidate2.exists() {
            log::info!("FFmpeg found at dev path: {:?}", candidate2);
            return candidate2;
        }
        
        // 3) Try Tauri resource resolver
        if let Ok(p) = app.path().resolve(
            format!("ffmpeg/{}/{}", platform_subdir, bin_name),
            tauri::path::BaseDirectory::Resource,
        ) {
            if p.exists() {
                log::info!("FFmpeg found via Tauri resolver: {:?}", p);
                return p;
            }
        }
    }
    
    // PROD: Use packaged resource dir
    let prod_path = build_path(
        app.path()
            .resource_dir()
            .expect("resource_dir available")
            .join("ffmpeg"),
    );
    
    log::info!("FFmpeg path (prod): {:?}", prod_path);
    prod_path
}

// Initialize FFmpeg path on app startup
// 
// Must be called from the Tauri setup hook before recording is used.
pub fn init_ffmpeg_path(app: &AppHandle) {
    let path = resolve_ffmpeg_path(app);
    log::info!("Initializing FFmpeg path: {:?}", path);
    
    let mut ffmpeg_path = FFMPEG_PATH.lock().unwrap();
    *ffmpeg_path = Some(path);
}

// Get the stored FFmpeg binary path
fn get_ffmpeg_path() -> Result<PathBuf, String> {
    let path_guard = FFMPEG_PATH.lock().unwrap();
    path_guard.clone().ok_or_else(|| {
        "FFmpeg path not initialized. Call init_ffmpeg_path() on app startup.".to_string()
    })
}

// =============================================================================
// Platform Support Checks
// =============================================================================

// Check if screen capture is supported on this platform
pub fn is_supported() -> bool {
    scap::is_supported()
}

// Check if we have screen recording permission
pub fn has_permission() -> bool {
    scap::has_permission()
}

// Request screen recording permission (opens system dialog on macOS)
pub fn request_permission() -> bool {
    scap::request_permission()
}

// Check if bundled FFmpeg is available and working
pub fn check_ffmpeg() -> Result<(), String> {
    let ffmpeg_path = get_ffmpeg_path()?;
    
    // Check if binary exists
    if !ffmpeg_path.exists() {
        return Err(format!(
            "FFmpeg binary not found at {:?}. Run 'npm run setup-ffmpeg' to install.",
            ffmpeg_path
        ));
    }
    
    // Try to run it
    Command::new(&ffmpeg_path)
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|e| format!("FFmpeg failed to execute: {}. Path: {:?}", e, ffmpeg_path))?;
    
    log::info!("FFmpeg check passed: {:?}", ffmpeg_path);
    Ok(())
}

// =============================================================================
// Display Enumeration
// =============================================================================

// Get information about all available displays
pub fn get_all_displays() -> Result<Vec<MonitorInfo>, String> {
    let targets = scap::get_all_targets();
    
    let monitors: Vec<MonitorInfo> = targets
        .iter()
        .enumerate()
        .filter_map(|(idx, target)| {
            if let Target::Display(_) = target {
                Some(MonitorInfo {
                    id: idx as u32,
                    // Dimensions determined at capture time from first frame
                    width: 0,
                    height: 0,
                    x: 0,
                    y: 0,
                    scale_factor: 1.0,
                    is_primary: idx == 0,
                })
            } else {
                None
            }
        })
        .collect();
    
    log::info!("Found {} display(s)", monitors.len());
    for monitor in &monitors {
        log::info!("  Display {} (primary: {})", monitor.id, monitor.is_primary);
    }
    
    Ok(monitors)
}

// Get all display targets for capture
pub fn get_display_targets() -> Vec<Target> {
    scap::get_all_targets()
        .into_iter()
        .filter(|t| matches!(t, Target::Display(_)))
        .collect()
}

// Get display count
pub fn get_display_count() -> usize {
    get_display_targets().len()
}

// =============================================================================
// Capture Result
// =============================================================================

// Result from capture operation for a single display
#[derive(Debug, Clone)]
pub struct CaptureResult {
    pub display_index: u32,
    pub width: u32,
    pub height: u32,
    pub frame_count: u64,
    pub file_size: u64,
}

// =============================================================================
// TODO: Future enhancement - composite multiple displays into single video
// =============================================================================
// This would combine _d0.mp4 and _d1.mp4 side-by-side for unified Gemini analysis.
// 
// Implementation approach:
// 1. After all capture threads complete in manager.rs finalize_current_segment()
// 2. Use FFmpeg to composite videos: ffmpeg -i d0.mp4 -i d1.mp4 -filter_complex hstack output.mp4
// 3. Optionally delete individual display files after composite
// 4. Update metadata to reference composite file
//
// Benefits:
// - Single file upload to Gemini instead of multiple
// - Unified timeline view across all displays
// - Reduced API calls and simpler processing pipeline
// =============================================================================

// =============================================================================
// FFmpeg Process Management
// =============================================================================

// Spawn FFmpeg process for encoding with configurable quality settings
// 
// # Arguments
// * `width` - Input frame width
// * `height` - Input frame height
// * `output_width` - Target output width (height calculated to maintain aspect, with letterbox/pillarbox)
// * `fps` - Target framerate
// * `crf` - Constant Rate Factor (0-51, lower = better quality, higher = smaller files)
// * `preset` - FFmpeg encoding preset (ultrafast, superfast, veryfast, faster, fast, medium, slow)
// * `output_path` - Path to write the MP4 file
fn spawn_ffmpeg(
    width: u32,
    height: u32,
    output_width: u32,
    fps: u8,
    crf: u8,
    preset: &str,
    output_path: &PathBuf,
) -> Result<Child, String> {
    let ffmpeg_path = get_ffmpeg_path()?;
    
    // Calculate output height maintaining 16:9 aspect ratio for standardized output
    let output_height = (output_width * 9) / 16;
    // Ensure height is even (required for yuv420p)
    let output_height = if output_height % 2 == 1 { output_height + 1 } else { output_height };
    
    // Build scale filter with letterbox/pillarbox to maintain aspect ratio
    // This scales the input to fit within output dimensions, then pads to exact size
    let scale_filter = format!(
        "scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black",
        output_width, output_height, output_width, output_height
    );
    
    log::info!(
        "Spawning FFmpeg: {}x{} -> {}x{} @ {} fps, CRF {}, preset {} -> {:?}",
        width, height, output_width, output_height, fps, crf, preset, output_path
    );
    log::info!("FFmpeg binary: {:?}", ffmpeg_path);
    
    Command::new(&ffmpeg_path)
        .args([
            "-y",                           // Overwrite output
            "-f", "rawvideo",               // Input format
            "-pix_fmt", "bgra",             // Input pixel format
            "-s", &format!("{}x{}", width, height),  // Input size
            "-r", &fps.to_string(),         // Input framerate
            "-i", "pipe:0",                 // Read from stdin
            "-vf", &scale_filter,           // Scale and letterbox/pillarbox filter
            "-c:v", "libx264",              // H.264 codec
            "-preset", preset,              // Encoding preset (configurable)
            "-crf", &crf.to_string(),       // Quality (configurable)
            "-tune", "stillimage",          // Optimized for screen content
            "-pix_fmt", "yuv420p",          // Output pixel format (MP4 compatibility)
            "-movflags", "+faststart",      // Enable streaming
        ])
        .arg(output_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())              // Discard stderr to prevent buffer blocking
        .spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg at {:?}: {}", ffmpeg_path, e))
}

// =============================================================================
// Main Capture Function
// =============================================================================

// Capture frames from a specific display to an MP4 file
// 
// This function captures frames from one display and pipes them to FFmpeg.
// It will run until either:
// - The shutdown signal is set (primary termination method)
// - The safety_timeout is reached (fallback if shutdown signal fails)
// 
// # Arguments
// * `display_index` - Index of the display to capture
// * `fps` - Target framerate
// * `output_width` - Target output width (height calculated to maintain 16:9 aspect)
// * `crf` - Constant Rate Factor for quality (0-51, lower = better quality)
// * `preset` - FFmpeg encoding preset
// * `output_path` - Path to write MP4 file
// * `safety_timeout` - Safety timeout (segment_duration + buffer), only triggers if shutdown signal fails
// * `shutdown` - Shutdown signal
pub fn capture_display_to_file(
    display_index: u32,
    fps: u8,
    output_width: u32,
    crf: u8,
    preset: &str,
    output_path: &PathBuf,
    safety_timeout: Duration,
    shutdown: Arc<AtomicBool>,
) -> Result<CaptureResult, String> {
    log::info!(
        "Starting capture for display {} to {:?} ({} fps, {}px wide, CRF {}, preset {}, safety_timeout {:?})",
        display_index, output_path, fps, output_width, crf, preset, safety_timeout
    );
    
    // Check FFmpeg availability
    check_ffmpeg()?;
    
    // Check platform support
    if !scap::is_supported() {
        return Err("Screen capture not supported on this platform".to_string());
    }
    
    // Check permission
    if !scap::has_permission() {
        return Err(
            "Screen recording permission not granted. On macOS, enable in System Preferences > Privacy & Security > Screen Recording".to_string()
        );
    }
    
    // Get specific display target
    let targets = get_display_targets();
    let target = targets
        .into_iter()
        .nth(display_index as usize)
        .ok_or_else(|| format!("Display {} not found", display_index))?;
    
    log::info!("Creating capturer for display {}", display_index);
    
    // Configure capture options for this specific display
    let options = Options {
        fps: fps as u32,
        target: Some(target),
        show_cursor: true,
        show_highlight: false,
        excluded_targets: None,
        output_type: FrameType::BGRAFrame,
        output_resolution: scap::capturer::Resolution::Captured,
        ..Default::default()
    };
    
    // Create and start capturer
    let mut capturer = Capturer::build(options)
        .map_err(|e| format!("Failed to create capturer for display {}: {:?}", display_index, e))?;
    
    capturer.start_capture();
    
    // Wait briefly for capturer to initialize
    std::thread::sleep(Duration::from_millis(100));
    
    // Get first frame to determine dimensions
    log::info!("Display {}: Waiting for first frame...", display_index);
    let (width, height, first_frame_data) = wait_for_first_frame(&mut capturer, display_index)?;
    
    log::info!("Display {}: Capture initialized: {}x{}", display_index, width, height);
    
    // Spawn FFmpeg process with encoding configuration
    let mut ffmpeg = spawn_ffmpeg(width, height, output_width, fps, crf, preset, output_path)?;
    let mut stdin = ffmpeg.stdin.take()
        .ok_or_else(|| "Failed to get FFmpeg stdin".to_string())?;
    
    // Write first frame
    stdin.write_all(&first_frame_data)
        .map_err(|e| format!("Failed to write frame to FFmpeg: {}", e))?;
    
    // Capture loop - primary exit via shutdown signal, safety_timeout is fallback
    let start_time = Instant::now();
    let mut frame_count: u64 = 1; // Already wrote first frame
    let expected_frame_size = (width * height * 4) as usize; // BGRA = 4 bytes per pixel
    
    // Frame buffer for handling empty frames from scap
    let mut last_good_frame: Vec<u8> = first_frame_data;
    let mut empty_frame_count: u64 = 0;
    let mut wrong_size_count: u64 = 0;
    
    while !shutdown.load(Ordering::SeqCst) && start_time.elapsed() < safety_timeout {
        match capturer.get_next_frame() {
            Ok(frame) => {
                let data = match frame {
                    Frame::BGRA(bgra_frame) => bgra_frame.data,
                    Frame::BGR0(bgr_frame) => bgr_frame.data,
                    Frame::RGB(rgb_frame) => rgb_frame.data,
                    Frame::RGBx(rgbx_frame) => rgbx_frame.data,
                    Frame::XBGR(xbgr_frame) => xbgr_frame.data,
                    Frame::BGRx(bgrx_frame) => bgrx_frame.data,
                    _ => {
                        log::warn!("Display {}: Unexpected frame type, skipping", display_index);
                        continue;
                    }
                };
                
                // Handle frame data - reuse buffer for empty frames from scap
                let frame_data: &[u8] = if data.len() == expected_frame_size {
                    // Valid frame - update buffer
                    last_good_frame = data;
                    &last_good_frame
                } else if data.is_empty() {
                    // Empty frame from scap - reuse last good frame
                    empty_frame_count += 1;
                    &last_good_frame
                } else {
                    // Wrong size (not empty, not correct) - skip to prevent FFmpeg desync
                    wrong_size_count += 1;
                    if wrong_size_count <= 3 {
                        log::warn!(
                            "Display {}: Wrong frame size! Expected {} bytes, got {} bytes",
                            display_index, expected_frame_size, data.len()
                        );
                    }
                    continue;
                };
                
                // Write frame to FFmpeg
                if let Err(e) = stdin.write_all(frame_data) {
                    log::error!("Display {}: Failed to write frame to FFmpeg: {}", display_index, e);
                    break;
                }
                
                frame_count += 1;
                
                // Log progress periodically
                if frame_count % (fps as u64 * 10) == 0 {
                    log::info!(
                        "Display {}: Captured {} frames ({:.1}s)",
                        display_index,
                        frame_count,
                        start_time.elapsed().as_secs_f32()
                    );
                }
            }
            Err(e) => {
                log::error!("Display {}: Capture error: {:?}", display_index, e);
                std::thread::sleep(Duration::from_millis(10));
            }
        }
    }
    
    // Log frame statistics
    if empty_frame_count > 0 {
        log::info!(
            "Display {}: Reused previous frame {} times (empty frames from scap)",
            display_index, empty_frame_count
        );
    }
    if wrong_size_count > 0 {
        log::warn!(
            "Display {}: Skipped {} frames with wrong size",
            display_index, wrong_size_count
        );
    }
    
    // Stop capture
    capturer.stop_capture();
    
    // Close stdin to signal EOF to FFmpeg
    drop(stdin);
    
    // Wait for FFmpeg to finish
    log::info!("Display {}: Waiting for FFmpeg to finish encoding...", display_index);
    let ffmpeg_result = ffmpeg.wait()
        .map_err(|e| format!("Failed to wait for FFmpeg: {}", e))?;
    
    if !ffmpeg_result.success() {
        return Err(format!("FFmpeg exited with error: {:?}", ffmpeg_result.code()));
    }
    
    // Get file size
    let file_size = std::fs::metadata(output_path)
        .map(|m| m.len())
        .unwrap_or(0);
    
    let actual_fps = if start_time.elapsed().as_secs_f64() > 0.0 {
        frame_count as f64 / start_time.elapsed().as_secs_f64()
    } else {
        0.0
    };
    
    log::info!(
        "Display {}: Capture finished: {} frames in {:.1}s ({:.1} fps), {} bytes MP4",
        display_index,
        frame_count,
        start_time.elapsed().as_secs_f64(),
        actual_fps,
        file_size
    );
    
    Ok(CaptureResult {
        display_index,
        width,
        height,
        frame_count,
        file_size,
    })
}

// =============================================================================
// Helper Functions
// =============================================================================

// Wait for the first frame and return dimensions + data
fn wait_for_first_frame(capturer: &mut Capturer, display_index: u32) -> Result<(u32, u32, Vec<u8>), String> {
    let start = Instant::now();
    let timeout = Duration::from_secs(15);
    let mut attempt = 0;
    
    while start.elapsed() < timeout {
        attempt += 1;
        
        match capturer.get_next_frame() {
            Ok(frame) => {
                let (width, height, data) = match frame {
                    Frame::BGRA(f) => (f.width as u32, f.height as u32, f.data),
                    Frame::BGR0(f) => (f.width as u32, f.height as u32, f.data),
                    Frame::RGB(f) => (f.width as u32, f.height as u32, f.data),
                    Frame::RGBx(f) => (f.width as u32, f.height as u32, f.data),
                    Frame::XBGR(f) => (f.width as u32, f.height as u32, f.data),
                    Frame::BGRx(f) => (f.width as u32, f.height as u32, f.data),
                    _ => {
                        continue;
                    }
                };
                
                log::info!(
                    "Display {}: Got first frame after {} attempts: {}x{}, {} bytes",
                    display_index, attempt, width, height, data.len()
                );
                
                return Ok((width, height, data));
            }
            Err(_) => {
                if attempt % 50 == 0 {
                    log::warn!(
                        "Display {}: Still waiting for first frame (attempt {}, {:.1}s elapsed)",
                        display_index,
                        attempt,
                        start.elapsed().as_secs_f32()
                    );
                }
                std::thread::sleep(Duration::from_millis(20));
            }
        }
    }
    
    Err(format!(
        "Display {}: Timeout waiting for first frame after {:.1}s. Check screen recording permissions.",
        display_index,
        timeout.as_secs_f32()
    ))
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_supported() {
        let _ = is_supported();
    }

    #[test]
    fn test_has_permission() {
        let _ = has_permission();
    }

    #[test]
    fn test_ffmpeg_platform_info() {
        let (subdir, name) = ffmpeg_platform_info();
        assert!(!subdir.is_empty());
        assert!(!name.is_empty());
        #[cfg(target_os = "windows")]
        assert!(name.ends_with(".exe"));
    }

    #[test]
    fn test_get_display_count() {
        let count = get_display_count();
        assert!(count >= 0);
    }
}
