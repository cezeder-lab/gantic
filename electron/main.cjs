const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');

const STATE_FILE_NAME = 'gantic-data.json';

// This edition keeps its own profile folder so it never reads or overwrites
// the data of the standard Gantic app if both are installed on one machine.
// Must run before anything touches userData. GANTIC_USER_DATA overrides it
// (used to run two instances side by side when testing sync).
app.setPath(
  'userData',
  process.env.GANTIC_USER_DATA || path.join(app.getPath('appData'), 'Gantic Measurement Team'),
);

function configFile() {
  return path.join(app.getPath('userData'), 'gantic-config.json');
}

function defaultDataFolder() {
  return path.join(app.getPath('userData'), 'data');
}

function readConfig() {
  try {
    return JSON.parse(fsSync.readFileSync(configFile(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fsSync.writeFileSync(configFile(), JSON.stringify(config, null, 2), 'utf-8');
}

// Resolves the folder Gantic currently saves project data into (the
// user-chosen one if set, otherwise a default inside the app's own profile
// data), creating it (and its attachments subfolder) if needed.
function getDataFolder() {
  const config = readConfig();
  const folder = config.dataFolder || defaultDataFolder();
  fsSync.mkdirSync(folder, { recursive: true });
  fsSync.mkdirSync(path.join(folder, 'attachments'), { recursive: true });
  return folder;
}

async function copyFolderContents(oldFolder, newFolder) {
  await fs.mkdir(newFolder, { recursive: true });
  await fs.mkdir(path.join(newFolder, 'attachments'), { recursive: true });

  const stateSrc = path.join(oldFolder, STATE_FILE_NAME);
  if (fsSync.existsSync(stateSrc)) {
    await fs.copyFile(stateSrc, path.join(newFolder, STATE_FILE_NAME));
  }

  const attachSrcDir = path.join(oldFolder, 'attachments');
  if (fsSync.existsSync(attachSrcDir)) {
    const files = await fs.readdir(attachSrcDir);
    for (const file of files) {
      await fs.copyFile(path.join(attachSrcDir, file), path.join(newFolder, 'attachments', file));
    }
  }
}

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const devServerUrl = process.env.ELECTRON_START_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
}

ipcMain.handle('data:getFolder', () => getDataFolder());

ipcMain.handle('data:chooseFolder', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
    title: "Choose Gantic's project data folder",
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const newFolder = result.filePaths[0];
  const oldFolder = getDataFolder();
  if (path.resolve(newFolder) !== path.resolve(oldFolder)) {
    await copyFolderContents(oldFolder, newFolder);
  }
  writeConfig({ ...readConfig(), dataFolder: newFolder });
  return newFolder;
});

ipcMain.handle('data:readState', async () => {
  const file = path.join(getDataFolder(), STATE_FILE_NAME);
  try {
    return await fs.readFile(file, 'utf-8');
  } catch {
    return null;
  }
});

// Every store change triggers its own write; without serializing them, two
// overlapping writes racing on the same tmp file can corrupt gantic-data.json
// (one write's open()/truncate landing mid-way through another's). Chaining
// onto a shared promise forces each write (and its rename) to fully finish
// before the next one starts.
let writeQueue = Promise.resolve();

ipcMain.handle('data:writeState', (_event, content) => {
  const thisWrite = writeQueue.then(async () => {
    const folder = getDataFolder();
    const file = path.join(folder, STATE_FILE_NAME);
    const tmpFile = `${file}.tmp`;
    await fs.writeFile(tmpFile, content, 'utf-8');
    await fs.rename(tmpFile, file);
  });
  // Keep the chain alive even if this write fails, so one transient error
  // doesn't permanently break every write after it.
  writeQueue = thisWrite.catch(() => {});
  return thisWrite;
});

// Ids reach these handlers from other people's log entries once a workspace
// is shared, so never let one escape the folder it's meant for.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function attachmentsDir() {
  if (workspaceFolder) {
    const dir = path.join(workspaceFolder, 'attachments');
    fsSync.mkdirSync(dir, { recursive: true });
    return dir;
  }
  return path.join(getDataFolder(), 'attachments');
}

ipcMain.handle('data:readAttachment', async (_event, id) => {
  if (!SAFE_ID.test(id)) return null;
  try {
    const buf = await fs.readFile(path.join(attachmentsDir(), id));
    return buf.toString('base64');
  } catch {
    return null;
  }
});

ipcMain.handle('data:writeAttachment', async (_event, id, base64) => {
  if (!SAFE_ID.test(id)) throw new Error('Invalid attachment id');
  await fs.writeFile(path.join(attachmentsDir(), id), Buffer.from(base64, 'base64'));
});

ipcMain.handle('data:deleteAttachments', async (_event, ids) => {
  // In a shared workspace a file may still be referenced by someone's undo
  // or by the activity history, so shared attachments are never deleted.
  if (workspaceFolder) return;
  const dir = attachmentsDir();
  for (const id of ids) {
    if (!SAFE_ID.test(id)) continue;
    try {
      await fs.unlink(path.join(dir, id));
    } catch {
      // Already gone — nothing to do.
    }
  }
});

// ---------------------------------------------------------------------------
// Shared team workspace
//
// A workspace is any folder everyone can reach (a synced SharePoint/Teams
// library, a network drive…). Gantic never edits a file another client
// writes: each client appends its changes to its own log files
//   log/<clientId>/<YYYY-MM>.jsonl
// and writes its own presence heartbeat
//   presence/<clientId>.json
// so the folder-sync tool never sees two machines editing the same file.
// Every client reads everyone's logs and merges them (see src/lib/sync).
// ---------------------------------------------------------------------------

const WORKSPACE_MARKER = 'gantic-workspace.json';
let workspaceFolder = null;
let logOffsets = new Map(); // file path -> bytes already read
let appendQueue = Promise.resolve();

function logFileFor(clientId) {
  const month = new Date().toISOString().slice(0, 7);
  return path.join(workspaceFolder, 'log', clientId, `${month}.jsonl`);
}

async function listLogFiles() {
  const root = path.join(workspaceFolder, 'log');
  const files = [];
  let clientDirs = [];
  try {
    clientDirs = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const dir of clientDirs) {
    if (!dir.isDirectory()) continue;
    let entries = [];
    try {
      entries = await fs.readdir(path.join(root, dir.name));
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name.endsWith('.jsonl')) files.push(path.join(root, dir.name, name));
    }
  }
  return files;
}

// Returns complete lines appended to any log file since the last call. A
// half-synced trailing line (no newline yet) is left for the next read.
async function readNewLines() {
  const lines = [];
  for (const file of await listLogFiles()) {
    let handle;
    try {
      handle = await fs.open(file, 'r');
      const { size } = await handle.stat();
      let offset = logOffsets.get(file) ?? 0;
      if (size < offset) offset = 0; // replaced by the sync tool — re-read, duplicates are ignored
      if (size === offset) continue;
      const buf = Buffer.alloc(size - offset);
      await handle.read(buf, 0, buf.length, offset);
      const lastNewline = buf.lastIndexOf(0x0a);
      if (lastNewline === -1) continue;
      for (const line of buf.subarray(0, lastNewline).toString('utf-8').split('\n')) {
        if (line.trim()) lines.push(line);
      }
      logOffsets.set(file, offset + lastNewline + 1);
    } catch {
      // File mid-sync or temporarily locked — try again on the next poll.
    } finally {
      await handle?.close();
    }
  }
  return lines;
}

ipcMain.handle('ws:choose', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose the shared team workspace folder',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('ws:open', async (_event, folder) => {
  try {
    const stat = await fs.stat(folder);
    if (!stat.isDirectory()) return { ok: false, error: 'That path is not a folder.' };
    const markerPath = path.join(folder, WORKSPACE_MARKER);
    let marker;
    try {
      marker = JSON.parse(await fs.readFile(markerPath, 'utf-8'));
    } catch {
      marker = { format: 1, name: path.basename(folder), createdAt: Date.now() };
      await fs.writeFile(markerPath, JSON.stringify(marker, null, 2), 'utf-8');
    }
    await fs.mkdir(path.join(folder, 'log'), { recursive: true });
    await fs.mkdir(path.join(folder, 'presence'), { recursive: true });
    await fs.mkdir(path.join(folder, 'attachments'), { recursive: true });
    workspaceFolder = folder;
    logOffsets = new Map();
    return { ok: true, name: marker.name ?? path.basename(folder) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('ws:close', () => {
  workspaceFolder = null;
  logOffsets = new Map();
});

ipcMain.handle('ws:readNew', async () => {
  if (!workspaceFolder) throw new Error('No workspace open');
  return readNewLines();
});

ipcMain.handle('ws:append', (_event, clientId, lines) => {
  if (!workspaceFolder) return Promise.reject(new Error('No workspace open'));
  if (!SAFE_ID.test(clientId)) return Promise.reject(new Error('Invalid client id'));
  const file = logFileFor(clientId);
  const thisAppend = appendQueue.then(async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, lines.map((l) => `${l}\n`).join(''), 'utf-8');
  });
  appendQueue = thisAppend.catch(() => {});
  return thisAppend;
});

// Last-chance write while the window is closing, when async IPC may not finish.
ipcMain.on('ws:appendSync', (event, clientId, lines) => {
  try {
    if (!workspaceFolder || !SAFE_ID.test(clientId) || lines.length === 0) {
      event.returnValue = false;
      return;
    }
    const file = logFileFor(clientId);
    fsSync.mkdirSync(path.dirname(file), { recursive: true });
    fsSync.appendFileSync(file, lines.map((l) => `${l}\n`).join(''), 'utf-8');
    event.returnValue = true;
  } catch {
    event.returnValue = false;
  }
});

ipcMain.handle('ws:writePresence', async (_event, clientId, entry) => {
  if (!workspaceFolder || !SAFE_ID.test(clientId)) return;
  const file = path.join(workspaceFolder, 'presence', `${clientId}.json`);
  await fs.writeFile(file, JSON.stringify(entry), 'utf-8');
});

ipcMain.handle('ws:readPresence', async () => {
  if (!workspaceFolder) return [];
  const dir = path.join(workspaceFolder, 'presence');
  const out = [];
  let names = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      out.push(JSON.parse(await fs.readFile(path.join(dir, name), 'utf-8')));
    } catch {
      // Mid-sync — skip this round.
    }
  }
  return out;
});

// Moves the attachment files of projects brought into the workspace from
// this machine's local data, so teammates can open them too.
ipcMain.handle('ws:importAttachments', async (_event, ids) => {
  if (!workspaceFolder) return;
  const from = path.join(getDataFolder(), 'attachments');
  const to = attachmentsDir();
  for (const id of ids) {
    if (!SAFE_ID.test(id)) continue;
    try {
      await fs.copyFile(path.join(from, id), path.join(to, id), fsSync.constants.COPYFILE_EXCL);
    } catch {
      // Missing locally or already there.
    }
  }
});

// Auto-update via electron-updater, fed from GitHub Releases (see the
// `publish` block in package.json). Downloads happen automatically once an
// update is found; the renderer is only asked to prompt for a restart once
// the new version is fully downloaded and ready to install.
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function sendUpdateEvent(payload) {
  mainWindow?.webContents.send('update:event', payload);
}

autoUpdater.on('checking-for-update', () => sendUpdateEvent({ status: 'checking' }));
autoUpdater.on('update-available', (info) => sendUpdateEvent({ status: 'available', version: info.version }));
autoUpdater.on('update-not-available', () => sendUpdateEvent({ status: 'not-available' }));
autoUpdater.on('error', (err) =>
  sendUpdateEvent({ status: 'error', message: err instanceof Error ? err.message : String(err) }),
);
autoUpdater.on('download-progress', (progress) => sendUpdateEvent({ status: 'downloading', percent: progress.percent }));
autoUpdater.on('update-downloaded', (info) => sendUpdateEvent({ status: 'downloaded', version: info.version }));

// Off in the Measurement Team edition: the release feed in package.json is the
// standard Gantic one, so checking it would "update" this edition into the
// standard app.
const UPDATES_ENABLED = false;

ipcMain.handle('update:check', async () => {
  if (!UPDATES_ENABLED) return { skipped: true, reason: 'Automatic updates are off in this edition.' };
  if (!app.isPackaged) return { skipped: true, reason: 'Updates only run in a packaged build.' };
  try {
    await autoUpdater.checkForUpdates();
    return { skipped: false };
  } catch (err) {
    return { skipped: true, reason: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('update:quitAndInstall', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('update:getVersion', () => app.getVersion());

app.whenReady().then(() => {
  createWindow();

  // A quiet check shortly after launch — the renderer only hears about it if
  // there's actually something to report (available/downloaded/error).
  if (UPDATES_ENABLED && app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
