use tauri::Manager;

pub mod activitywatch;
pub mod recording;
pub mod collector;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            // ActivityWatch commands
            crate::activitywatch::manager::start_server,
            crate::activitywatch::manager::get_server_status,
            crate::activitywatch::manager::get_server_info,
            crate::activitywatch::manager::stop_server,
            crate::activitywatch::manager::start_watcher,
            crate::activitywatch::manager::stop_watcher,
            crate::activitywatch::manager::get_watchers_status,
            crate::activitywatch::manager::get_buckets,
            crate::activitywatch::manager::get_bucket_events,
            crate::activitywatch::manager::get_current_status,
            crate::activitywatch::manager::get_events_by_date_range,
            crate::activitywatch::manager::get_daily_metrics,
            crate::activitywatch::manager::get_app_usage_breakdown,
            // Recording commands (multi-display MP4 capture)
            crate::recording::manager::start_recording,
            crate::recording::manager::stop_recording,
            crate::recording::manager::get_recording_status,
            crate::recording::manager::get_recording_config,
            crate::recording::manager::update_recording_config,
            crate::recording::manager::get_display_count,
            crate::recording::manager::get_recordings_by_date_range,
            // Gemini AI integration commands
            crate::recording::manager::has_gemini_api_key,
            crate::recording::manager::get_gemini_config,
            crate::recording::manager::update_gemini_config,
            crate::recording::manager::get_gemini_queue_status,
            // Collector commands
            crate::collector::manager::start_collector,
            crate::collector::manager::stop_collector,
            crate::collector::manager::get_collector_status,
            crate::collector::manager::update_collector_config,
            crate::collector::manager::get_collector_config,
            crate::collector::manager::test_collector_connection,
            crate::collector::manager::update_collector_app_jwt_token,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Warn)
                        // Set specific levels for modules
                        .level_for("app_lib::collector", log::LevelFilter::Warn)
                        .level_for("app_lib::activitywatch", log::LevelFilter::Warn)
                        .level_for("app_lib::recording", log::LevelFilter::Warn)
                        .build(),
                )?;
            }
            
            // Initialize recording system
            // 1. Initialize FFmpeg path (must be done before any recording operations)
            crate::recording::capture::init_ffmpeg_path(&app.handle());
            
            // 2. Load recording config on startup
            let recording_config = crate::recording::config::load_config(&app.handle())
                .unwrap_or_default();
            crate::recording::manager::init_config(recording_config);
            
            // 3. Initialize Gemini queue
            let gemini_config = crate::recording::config::load_gemini_config(&app.handle())
                .unwrap_or_default();
            crate::recording::gemini::init_queue(&app.handle(), gemini_config);
            
            // Load collector config and auto-start if enabled
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match crate::collector::config::load_config(&app_handle) {
                    Ok(collector_config) => {
                        if collector_config.enabled {
                            log::info!("Collector is enabled in config, starting automatically...");
                            if let Err(e) = crate::collector::manager::start_collector(
                                app_handle,
                                collector_config,
                            ).await {
                                log::error!("Failed to auto-start collector: {}", e);
                            } else {
                                log::info!("Collector auto-started successfully");
                            }
                        } else {
                            log::info!("Collector is disabled in config, not auto-starting");
                        }
                    }
                    Err(e) => {
                        log::warn!("Failed to load collector config on startup: {}", e);
                    }
                }
            });
            
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Only trigger graceful shutdown when the MAIN window is closed
                // Other windows (like settings) should close without affecting the app
                let window_label = window.label();
                
                if window_label != "main" {
                    log::info!("Window '{}' closed, app continues running", window_label);
                    return;
                }
                
                // Handle graceful shutdown when main window is closing
                log::info!("Main window close requested, performing graceful shutdown...");
                
                // Stop server and watchers
                tauri::async_runtime::block_on(async {
                    if let Err(e) = crate::activitywatch::manager::stop_server().await {
                        log::error!("Failed to stop server during shutdown: {}", e);
                    } else {
                        log::info!("✓ Server stopped gracefully");
                    }
                });
                
                // Stop recording
                let app_handle = window.app_handle().clone();
                tauri::async_runtime::block_on(async {
                    if let Err(e) = crate::recording::manager::stop_recording(app_handle).await {
                        log::error!("Failed to stop recording during shutdown: {}", e);
                    } else {
                        log::info!("✓ Recording stopped gracefully");
                    }
                });
                
                // Stop collector
                tauri::async_runtime::block_on(async {
                    if let Err(e) = crate::collector::manager::stop_collector().await {
                        log::error!("Failed to stop collector during shutdown: {}", e);
                    } else {
                        log::info!("✓ Collector stopped gracefully");
                    }
                });
                
                // Stop Gemini queue
                tauri::async_runtime::block_on(async {
                    crate::recording::gemini::shutdown_queue().await;
                    log::info!("✓ Gemini queue stopped gracefully");
                });
                
                log::info!("Graceful shutdown complete");
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
