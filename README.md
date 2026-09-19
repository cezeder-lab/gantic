# Gantic

An Instagantt-style Gantt chart editor with support for multiple projects.

## Features

- **Multiple projects**: create, rename, duplicate, color and delete as many projects as you need from the sidebar.
- **Editable task table**: name, start/end dates, duration, progress and assignee, with hierarchy (phases/subtasks), indent/outdent and reordering.
- **Interactive Gantt timeline**: drag to move and resize bars with the mouse, drag the progress handle, milestones (diamonds), summary bars for task groups.
- **Dependencies**: link tasks by dragging from a bar's handle to another bar; rendered as arrows.
- **Task details**: click a task to open a side panel with a free-text description and file attachments (documents, spreadsheets, PDFs, images…).
- **Per-project team**: maintain a member list per project and assign tasks from a dropdown.
- **Zoom**: Day / Week / Month, with a "today" marker and weekend shading.
- **Local persistence**: task data is saved automatically to your browser's `localStorage`; file attachments are stored in `IndexedDB`. Nothing is sent to a server.

## Development

```bash
npm install
npm run dev
```

## Build (web)

```bash
npm run build
```

## Desktop app (Windows/macOS/Linux)

Gantic can also be packaged as a standalone desktop app with Electron — no
Node/npm needed to run it afterwards, and no browser tab.

Run the app in an Electron window during development:

```bash
npm run electron:dev
```

Build an installable/portable desktop app (run this **on the target OS**,
e.g. run it on Windows to get a Windows build):

```bash
npm run dist:win     # Windows: installer (.exe) + portable .exe, in release/
npm run dist         # builds for the current OS (mac: .dmg, linux: .AppImage)
```

The output lands in `release/`. On Windows you'll get two files:
- `Gantic Setup <version>.exe` — a regular installer
- `Gantic <version>.exe` (portable) — a single file you can copy anywhere and
  double-click to run, no installation required

The app's data (projects, tasks, attachments) is stored locally on the
machine it runs on, same as the web version — nothing is synced between
machines.
