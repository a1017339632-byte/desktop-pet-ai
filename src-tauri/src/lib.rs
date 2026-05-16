use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use std::sync::{Arc, Mutex};
use serde::Serialize;

#[derive(Default)]
struct PetBounds {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

#[tauri::command]
fn open_panel(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("panel") {
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }

    let panel = WebviewWindowBuilder::new(&app, "panel", WebviewUrl::App("index.html".into()))
        .title("Pety · 控制台")
        .inner_size(960.0, 640.0)
        .min_inner_size(800.0, 540.0)
        .decorations(false)
        .transparent(true)
        .build();

    #[cfg(target_os = "windows")]
    if let Ok(ref win) = panel {
        use window_vibrancy::apply_acrylic;
        let _ = apply_acrylic(win, Some((40, 30, 20, 120)));
    }
}

#[tauri::command]
fn update_pet_bounds(state: tauri::State<'_, Arc<Mutex<PetBounds>>>, x: f64, y: f64, w: f64, h: f64) {
    if let Ok(mut bounds) = state.lock() {
        bounds.x = x;
        bounds.y = y;
        bounds.w = w;
        bounds.h = h;
    }
}

#[derive(Serialize)]
struct WindowInfo {
    process: String,
    title: String,
}

#[derive(Serialize)]
struct ScreenInfo {
    foreground: Option<WindowInfo>,
    windows: Vec<WindowInfo>,
}

#[tauri::command]
fn get_screen_info() -> ScreenInfo {
    #[cfg(target_os = "windows")]
    {
        get_windows_screen_info()
    }
    #[cfg(not(target_os = "windows"))]
    {
        ScreenInfo { foreground: None, windows: vec![] }
    }
}

#[cfg(target_os = "windows")]
fn get_windows_screen_info() -> ScreenInfo {
    use std::process::Command;

    let fg = Command::new("powershell")
        .args(["-NoProfile", "-Command", r#"
            Add-Type @"
            using System;
            using System.Runtime.InteropServices;
            using System.Text;
            public class WinAPI {
                [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
                [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
                [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
            }
"@
            $hwnd = [WinAPI]::GetForegroundWindow()
            $sb = New-Object System.Text.StringBuilder 256
            [WinAPI]::GetWindowText($hwnd, $sb, 256) | Out-Null
            $title = $sb.ToString()
            $pid = 0
            [WinAPI]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            "$($proc.ProcessName)|$title"
        "#])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| {
            let s = s.trim();
            let parts: Vec<&str> = s.splitn(2, '|').collect();
            WindowInfo {
                process: parts.first().unwrap_or(&"").to_string(),
                title: parts.get(1).unwrap_or(&"").to_string(),
            }
        });

    let windows_list = Command::new("powershell")
        .args(["-NoProfile", "-Command", r#"
            Get-Process | Where-Object { $_.MainWindowTitle -ne '' } |
            Select-Object ProcessName, MainWindowTitle |
            ForEach-Object { "$($_.ProcessName)|$($_.MainWindowTitle)" }
        "#])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| {
            s.lines()
                .filter_map(|line| {
                    let parts: Vec<&str> = line.trim().splitn(2, '|').collect();
                    if parts.len() == 2 {
                        Some(WindowInfo {
                            process: parts[0].to_string(),
                            title: parts[1].to_string(),
                        })
                    } else {
                        None
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    ScreenInfo {
        foreground: fg,
        windows: windows_list,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pet_bounds = Arc::new(Mutex::new(PetBounds::default()));

    tauri::Builder::default()
        .manage(pet_bounds.clone())
        .invoke_handler(tauri::generate_handler![open_panel, update_pet_bounds, get_screen_info])
        .setup(move |app| {
            let monitor = app.primary_monitor()?.unwrap();
            let size = monitor.size();
            let w = size.width as f64;
            let h = size.height as f64;

            let pet_win = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("pet-float.html".into()))
                .title("Pety")
                .position(0.0, 0.0)
                .inner_size(w, h)
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .build()?;

            // Start with ignore on
            let _ = pet_win.set_ignore_cursor_events(true);

            // Poll mouse position every 50ms, toggle click-through based on pet bounds
            let bounds = pet_bounds.clone();
            let win_handle = pet_win.clone();
            let mut was_over = false;
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(50));

                    let (mx, my) = get_cursor_pos();
                    let is_over = {
                        if let Ok(b) = bounds.lock() {
                            mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h
                        } else {
                            false
                        }
                    };

                    if is_over != was_over {
                        let _ = win_handle.set_ignore_cursor_events(!is_over);
                        was_over = is_over;
                    }
                }
            });

            // System tray
            let open_item = MenuItemBuilder::with_id("open_panel", "打开管理面板").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出桌宠").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&open_item, &quit_item])
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Pety · 桌宠")
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "open_panel" => { open_panel(app.clone()); },
                        "quit" => { app.exit(0); },
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        open_panel(app.clone());
                    }
                })
                .build(app)?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(target_os = "windows")]
fn get_cursor_pos() -> (f64, f64) {
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
    use windows::Win32::Foundation::POINT;
    let mut pt = POINT::default();
    unsafe { let _ = GetCursorPos(&mut pt); }
    (pt.x as f64, pt.y as f64)
}

#[cfg(not(target_os = "windows"))]
fn get_cursor_pos() -> (f64, f64) {
    (0.0, 0.0)
}
