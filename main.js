const { app, BrowserWindow, ipcMain, globalShortcut, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const os = require('os');

let mainWindow;
const shortcuts = new Map();
let tray = null;
let isQuitting = false;

// Express Server globals
let currentSounds = [];
let serverUrl = '';
let qrDataURI = '';

const expressApp = express();
expressApp.use(cors());

expressApp.get('/', (req, res) => {
  let buttonsHtml = '';
  currentSounds.forEach(sound => {
    buttonsHtml += `
      <button class="sound-btn" onclick="playSound(${sound.id})">
        ${sound.filename}
      </button>
    `;
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
      <title>Soundboard Remote</title>
      <style>
        body {
          background-color: #0c0f14;
          background-image: radial-gradient(circle at 50% -20%, #1a2235, transparent 50%);
          color: #ffffff;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        h1 { margin-bottom: 30px; text-shadow: 0 0 15px rgba(255, 255, 255, 0.1); font-size: 24px; text-align: center; }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 15px;
          width: 100%;
          max-width: 600px;
          padding-bottom: 50px;
        }
        .sound-btn {
          background: rgba(0, 240, 255, 0.1);
          border: 1px solid #00f0ff;
          color: #fff;
          padding: 24px 10px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.2s, background 0.2s;
          box-shadow: 0 0 10px rgba(0, 240, 255, 0.1);
          word-break: break-word;
          user-select: none;
          outline: none;
          -webkit-tap-highlight-color: transparent;
        }
        .sound-btn:active {
          transform: scale(0.92);
          background: #00f0ff;
          color: #000;
          box-shadow: 0 0 25px rgba(0, 240, 255, 0.7);
        }
      </style>
    </head>
    <body>
      <h1>Remote Soundboard</h1>
      
      <!-- Mobile Panic Button -->
      <button class="sound-btn" style="width: 100%; max-width: 600px; background: rgba(255, 50, 50, 0.2); border-color: #ff3232; color: #ff3232; margin-bottom: 20px; font-size: 18px;" onclick="stopAll()">
        🛑 STOP ALL SOUNDS
      </button>

      <div class="grid">
        ${buttonsHtml}
      </div>
      <script>
        function playSound(id) {
          fetch('/play/' + id, { method: 'POST' }).catch(err => console.error(err));
          if (navigator.vibrate) navigator.vibrate(50);
        }
        function stopAll() {
          fetch('/stop', { method: 'POST' }).catch(err => console.error(err));
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }
      </script>
    </body>
    </html>
  `;
  res.send(html);
});

expressApp.post('/play/:id', (req, res) => {
  const id = Number(req.params.id);
  if (mainWindow) {
    mainWindow.webContents.send('play-sound', id);
  }
  res.sendStatus(200);
});

expressApp.post('/stop', (req, res) => {
  if (mainWindow) {
    mainWindow.webContents.send('stop-all');
  }
  res.sendStatus(200);
});

function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

expressApp.listen(8080, async () => {
  const ip = getLocalIp();
  serverUrl = `http://${ip}:8080`;
  try {
    // We generate a neon themed QR code
    qrDataURI = await qrcode.toDataURL(serverUrl, { 
      margin: 2, 
      color: { dark: '#00f0ff', light: '#0c0f14' } 
    });
  } catch (e) {
    console.error('QR code err:', e);
  }
});

ipcMain.handle('server:getQR', () => {
  return qrDataURI;
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required'
    },
    // Adding beautiful dark mode defaults
    backgroundColor: '#0f1115',
    autoHideMenuBar: true
  });

  mainWindow.on('close', function (event) {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.loadFile('index.html');
  
  // Register Global Panic Button
  globalShortcut.register('CommandOrControl+Shift+End', () => {
    mainWindow.webContents.send('stop-all');
  });
}

app.whenReady().then(() => {
  // Force grant all permissions so audio routing (setSinkId) has no blocks
  const { session } = require('electron');
  session.defaultSession.setPermissionCheckHandler(() => true);
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  createWindow();

  // Create System Tray
  const trayIconBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAQklEQVQ4T2NkYGD4z8DAwMgAMwBZMzIwinHxMTAwMPyH0mQwG4nLwMTEyIgbEEYzRhmg+JExhIFRgwE2mDGaMcoAAG7dEQP8L+8iAAAAAElFTkSuQmCC'; 
  tray = new Tray(nativeImage.createFromDataURL(trayIconBase64));
  tray.setToolTip('Global Soundboard');
  tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show Soundboard', click: () => mainWindow.show() },
      { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => mainWindow.show());

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handler to select an audio file
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }
    ]
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

// IPC handler to register a shortcut
ipcMain.handle('shortcut:register', (event, { id, shortcut, filePath }) => {
  // Unregister existing shortcut for this ID if any
  if (shortcuts.has(id)) {
    globalShortcut.unregister(shortcuts.get(id).shortcut);
  }

  try {
    const success = globalShortcut.register(shortcut, () => {
      // Tell renderer to play the sound
      mainWindow.webContents.send('play-sound', id);
    });

    if (success) {
      shortcuts.set(id, { shortcut, filePath });
      return { success: true };
    } else {
      return { success: false, error: 'Registration failed' };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Unregister when removing
ipcMain.handle('shortcut:unregister', (event, { id }) => {
  if (shortcuts.has(id)) {
    globalShortcut.unregister(shortcuts.get(id).shortcut);
    shortcuts.delete(id);
    return true;
  }
  return false;
});

app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
});

// Persistence Handlers
ipcMain.handle('config:save', (event, data) => {
  try {
    currentSounds = data;
    const configPath = path.join(__dirname, 'sounds.json');
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving config JSON:', err);
    return false;
  }
});

ipcMain.handle('config:load', (event) => {
  try {
    const configPath = path.join(__dirname, 'sounds.json');
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      currentSounds = JSON.parse(data);
      return currentSounds;
    }
  } catch (err) {
    console.error('Error loading config JSON:', err);
  }
  return [];
});
