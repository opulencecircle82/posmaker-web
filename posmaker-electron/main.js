const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

const FIRST_RUN_URL = 'https://posmaker.ggff.net/login.html';

// Config lives next to the exe (production) or in __dirname (dev)
const configPath = app.isPackaged
  ? path.join(path.dirname(process.execPath), 'posmaker-config.json')
  : path.join(__dirname, 'posmaker-config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (_) {}
  return null;
}

let mainWin;

function createPosWindow(url) {
  mainWin = new BrowserWindow({
    width: 1280, height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  mainWin.maximize();
  mainWin.setMenuBarVisibility(false);
  mainWin.loadURL(url);
}

// First-run: save URL from setup screen and reload as POS
ipcMain.on('save-config', (event, url) => {
  fs.writeFileSync(configPath, JSON.stringify({ url }), 'utf8');
  mainWin.close();
  createPosWindow(url);
});

// Silent print — hidden window, no dialog, no flash
ipcMain.on('print-receipt', (event, html) => {
  const pw = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true }
  });
  pw.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  pw.webContents.once('did-finish-load', () => {
    pw.webContents.print({ silent: true, printBackground: true }, () => {
      pw.destroy();
    });
  });
});

app.whenReady().then(() => {
  const cfg = loadConfig();
  createPosWindow(cfg && cfg.url ? cfg.url : FIRST_RUN_URL);
});

app.on('window-all-closed', () => app.quit());
