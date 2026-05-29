use serde::{Deserialize, Serialize};
use std::fs;
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrinterConnectionConfig {
    host: String,
    port: Option<u16>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PrinterLiveStatus {
    state: String,
    label: String,
    detail: String,
    is_live: bool,
}

#[tauri::command]
fn get_bambu_printer_status(config: PrinterConnectionConfig) -> Result<PrinterLiveStatus, String> {
    let host = config.host.trim();

    if host.is_empty() {
        return Err("Printer host is required.".into());
    }

    let port = config.port.unwrap_or(8883);
    let address = format!("{host}:{port}");
    let addresses = address
        .to_socket_addrs()
        .map_err(|_| "Printer address could not be resolved.".to_string())?;

    for socket_address in addresses {
        if TcpStream::connect_timeout(&socket_address, Duration::from_millis(1200)).is_ok() {
            return Ok(PrinterLiveStatus {
                state: "reachable".into(),
                label: "Reachable".into(),
                detail: format!("Bambu local port {port} is responding."),
                is_live: true,
            });
        }
    }

    Ok(PrinterLiveStatus {
        state: "offline".into(),
        label: "Offline".into(),
        detail: "No response from the printer on the local network.".into(),
        is_live: false,
    })
}

#[tauri::command]
fn write_export_file(path: String, contents: String) -> Result<(), String> {
    fs::write(path, contents).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_bambu_printer_status,
            write_export_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
