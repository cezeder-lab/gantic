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

## Build

```bash
npm run build
```
