# Printr Jorny

Printr Jorny is a desktop app for tracking 3D printing history, filament inventory, print outcomes, and cost over time. It is built with Angular and Tauri, so it runs as a lightweight desktop application while keeping the interface fast and local-first.

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
- Use dark or light theme.

## Data Storage

The app stores profile, print, theme, and filament inventory data locally in browser storage through the Tauri webview. There is no account system or external backend.

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
