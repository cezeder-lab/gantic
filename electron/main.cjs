const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');

const STATE_FILE_NAME = 'gantic-data.json';

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

ipcMain.handle('data:readAttachment', async (_event, id) => {
  const file = path.join(getDataFolder(), 'attachments', id);
  try {
    const buf = await fs.readFile(file);
    return buf.toString('base64');
  } catch {
    return null;
  }
});

ipcMain.handle('data:writeAttachment', async (_event, id, base64) => {
  const file = path.join(getDataFolder(), 'attachments', id);
  await fs.writeFile(file, Buffer.from(base64, 'base64'));
});

ipcMain.handle('data:deleteAttachments', async (_event, ids) => {
  const dir = path.join(getDataFolder(), 'attachments');
  for (const id of ids) {
    try {
      await fs.unlink(path.join(dir, id));
    } catch {
      // Already gone — nothing to do.
    }
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
