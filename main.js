const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'ViEdit — Türkçe Video Editör',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    show: false,
    titleBarStyle: 'default'
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  // Türkçe menü
  const menuTemplate = [
    {
      label: 'Dosya',
      submenu: [
        { label: 'Yeni Proje', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu', 'yeni') },
        { label: 'Proje Aç...', accelerator: 'CmdOrCtrl+O', click: () => openProject() },
        { label: 'Kaydet', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu', 'kaydet') },
        { label: 'Farklı Kaydet...', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow.webContents.send('menu', 'farklikaydet') },
        { type: 'separator' },
        { label: 'Medya İçeri Aktar...', accelerator: 'CmdOrCtrl+I', click: () => importMedia() },
        { type: 'separator' },
        { label: 'Dışa Aktar...', accelerator: 'CmdOrCtrl+E', click: () => mainWindow.webContents.send('menu', 'export') },
        { type: 'separator' },
        { label: 'Çıkış', accelerator: 'Alt+F4', click: () => app.quit() }
      ]
    },
    {
      label: 'Düzenle',
      submenu: [
        { label: 'Geri Al', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow.webContents.send('menu', 'undo') },
        { label: 'Tekrar', accelerator: 'CmdOrCtrl+Y', click: () => mainWindow.webContents.send('menu', 'redo') },
        { type: 'separator' },
        { label: 'Kes', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Kopyala', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Yapıştır', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { type: 'separator' },
        { label: 'Klip Böl', accelerator: 'CmdOrCtrl+K', click: () => mainWindow.webContents.send('menu', 'split') },
        { label: 'Klip Sil', accelerator: 'Delete', click: () => mainWindow.webContents.send('menu', 'delete') },
        { label: 'Klip Kopyala', accelerator: 'CmdOrCtrl+D', click: () => mainWindow.webContents.send('menu', 'duplicate') },
        { type: 'separator' },
        { label: 'Tümünü Seç', accelerator: 'CmdOrCtrl+A', click: () => mainWindow.webContents.send('menu', 'selectall') }
      ]
    },
    {
      label: 'Görünüm',
      submenu: [
        { label: 'Tam Ekran', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { label: 'Yakınlaştır', accelerator: 'CmdOrCtrl+Plus', click: () => mainWindow.webContents.send('menu', 'zoomin') },
        { label: 'Uzaklaştır', accelerator: 'CmdOrCtrl+-', click: () => mainWindow.webContents.send('menu', 'zoomout') },
        { type: 'separator' },
        { label: 'Geliştirici Araçları', accelerator: 'F12', click: () => mainWindow.webContents.openDevTools() }
      ]
    },
    {
      label: 'Sekans',
      submenu: [
        { label: 'Oynat / Duraklat', accelerator: 'Space', click: () => mainWindow.webContents.send('menu', 'play') },
        { label: 'Başa Git', accelerator: 'Home', click: () => mainWindow.webContents.send('menu', 'gostart') },
        { label: 'Sona Git', accelerator: 'End', click: () => mainWindow.webContents.send('menu', 'goend') },
        { label: '5 Saniye Geri', accelerator: 'Left', click: () => mainWindow.webContents.send('menu', 'back5') },
        { label: '5 Saniye İleri', accelerator: 'Right', click: () => mainWindow.webContents.send('menu', 'fwd5') },
        { type: 'separator' },
        { label: 'Giriş Noktası İşaretle', accelerator: 'I', click: () => mainWindow.webContents.send('menu', 'markin') },
        { label: 'Çıkış Noktası İşaretle', accelerator: 'O', click: () => mainWindow.webContents.send('menu', 'markout') }
      ]
    },
    {
      label: 'Efektler',
      submenu: [
        { label: 'Renk Düzeltme', click: () => mainWindow.webContents.send('menu', 'tab-efekt') },
        { label: 'Geçişler', click: () => mainWindow.webContents.send('menu', 'tab-gecis') },
        { label: 'Metin & Altyazı', click: () => mainWindow.webContents.send('menu', 'tab-metin') }
      ]
    },
    {
      label: 'Yardım',
      submenu: [
        { label: 'ViEdit Hakkında', click: () => showAbout() },
        { label: 'Klavye Kısayolları', accelerator: 'CmdOrCtrl+Shift+?', click: () => mainWindow.webContents.send('menu', 'shortcuts') }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

function openProject() {
  dialog.showOpenDialog(mainWindow, {
    title: 'Proje Aç',
    filters: [{ name: 'ViEdit Projesi', extensions: ['vep'] }, { name: 'Tümü', extensions: ['*'] }]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      mainWindow.webContents.send('open-project', result.filePaths[0]);
    }
  });
}

function importMedia() {
  dialog.showOpenDialog(mainWindow, {
    title: 'Medya İçeri Aktar',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v'] },
      { name: 'Ses', extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma'] },
      { name: 'Görüntü', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] },
      { name: 'Tüm Medya', extensions: ['mp4', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'jpg', 'png'] }
    ]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      mainWindow.webContents.send('import-media', result.filePaths);
    }
  });
}

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'ViEdit Hakkında',
    message: 'ViEdit v1.0.0',
    detail: 'Türkçe Video Editör\n\nElectron ile yapılmıştır.\n© 2026 ViEdit'
  });
}

// IPC handlers
ipcMain.handle('import-media-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Medya İçeri Aktar',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v'] },
      { name: 'Ses', extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma'] },
      { name: 'Görüntü', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
      { name: 'Tüm Medya', extensions: ['mp4', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'jpg', 'png'] }
    ]
  });
  return result;
});

ipcMain.handle('export-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Videoyu Dışa Aktar',
    defaultPath: 'video_cikti.mp4',
    filters: [
      { name: 'MP4 Video', extensions: ['mp4'] },
      { name: 'WebM Video', extensions: ['webm'] },
      { name: 'GIF', extensions: ['gif'] },
      { name: 'MP3 Ses', extensions: ['mp3'] }
    ]
  });
  return result;
});

ipcMain.handle('save-project-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Projeyi Kaydet',
    defaultPath: 'projem.vep',
    filters: [{ name: 'ViEdit Projesi', extensions: ['vep'] }]
  });
  return result;
});

ipcMain.handle('show-toast', (event, msg) => { /* handled in renderer */ });

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
