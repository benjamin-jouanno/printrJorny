# Printr Jorny

Printr Jorny is a desktop app for tracking 3D printing history, filament inventory, print outcomes, and cost over time. It is built with Angular and Tauri, so it runs as a lightweight desktop application while keeping the interface fast and local-first.

Current version: `0.2.0`

## What It Does

- Create and switch between multiple printer profiles.
- Track each profile's own print history and filament inventory.
- Add, edit, and delete prints.
- Record print status, filament used, cost in euros, duration, and notes.
- Link prints to filament spools so inventory quantities update automatically.
- See filament remaining quantity and percentage left.
- Get notified when a filament spool reaches zero.
- View dashboard stats for total filament, total cost, successful prints, failed prints, and poorly done prints.
- Review charted filament usage and cost over time.
- Browse long print histories in a calendar view with week, month, and year modes.
- Create projects with images, descriptions, start dates, and project-specific tasks.
- Track project tasks on a kanban board with to do, doing, on hold, ready for review, done, and discontinued states.
- Drag tasks between kanban columns, add rich task descriptions, attach task pictures, edit tasks, and delete projects or tasks.
- Import and export full profiles with their print history, filament inventory, and projects.
- Open printer details from the dashboard header.
- Configure optional Bambu local live status for Bambu printer profiles.
- Show printer reachability in the header, with progress UI ready when print progress data is available.
- Use dark or light theme.
- Use a custom frameless desktop titlebar and matching Printr Jorny app icon.

## Data Storage

The app stores profile, print, theme, filament inventory, and project data locally in browser storage through the Tauri webview. There is no account system or external backend.

Profiles can be exported as `.printrjorny` files from the profile settings menu, then imported from the profile selection screen. Exports include print history, filament inventory, and projects, which is useful for backups or moving a profile to another computer.

## Bambu Live Status

Bambu printer profiles can optionally store local connection settings:

- Printer IP address
- MQTT port, usually `8883`
- Printer serial
- LAN access code

The first live-status version checks whether the printer is reachable from the installed desktop app and displays that state in the header printer card. Detailed values like active print state, progress, and remaining time are prepared in the UI and can be shown when richer Bambu MQTT parsing is added.

Live status requires the Tauri desktop app. It will show as desktop-only when running the Angular app directly in a browser.

## Installation

Currently the application support only windows, you can go ahead and download the installer here:

[Printr-Jorny-v0.2.0-en-US](link)

## Version 0.2.0

This release adds the projects feature: project cards, an animated projects view, per-project kanban boards, rich task details, drag-and-drop task status updates, task editing, and project/task deletion.

## Development

Install dependencies:

```bash
npm install
```

Run the Angular development server:

```bash
npm run start
```

Build the Angular app:

```bash
npm run build
```

Build the desktop app with Tauri:

```bash
npm run tauri -- build
```

Regenerate the app icon assets:

```powershell
powershell -ExecutionPolicy Bypass -File tools/generate-printer-icon.ps1
```

## Desktop Builds

After a successful Tauri build, Windows installers are generated under:

```text
src-tauri/target/release/bundle/
```

Common outputs include an `.msi` installer and an `.exe` setup file.


## Tech Stack

- Angular
- Chart.js
- Tauri
- TypeScript
- Rust
