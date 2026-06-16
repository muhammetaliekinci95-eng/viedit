const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');

let mainWindow;

function getFFmpegPath() {
  if (!app.isPackaged) return process.platform === 'win32' ? 'ffmpeg' : 'ffmpeg';
  const ext = process.platform === 'win32' ? '.exe' : '';
  return path.join(process.resourcesPath, 'ffmpeg', `ffmpeg${ext}`);
}

function getFFprobePath() {
  if (!app.isPackaged) return 'ffprobe';
  const ext = process.platform === 'win32' ? '.exe' : '';
  return path.join(process.resourcesPath, 'ffmpeg', `ffprobe${ext}`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1100, minHeight: 700,
    title: 'ViEdit v2 — Türkçe Video Editör',
    backgroundColor: '#1a1a2e',
    webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false },
    show: false
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => { mainWindow.show(); mainWindow.maximize(); });
  buildMenu();
}

function buildMenu() {
  const t = [
    { label: 'Dosya', submenu: [
      { label: 'Medya İçeri Aktar...', accelerator: 'CmdOrCtrl+I', click: () => importMediaDialog() },
      { type: 'separator' },
      { label: 'Dışa Aktar...', accelerator: 'CmdOrCtrl+E', click: () => mainWindow.webContents.send('menu','export') },
      { type: 'separator' },
      { label: 'Çıkış', click: () => app.quit() }
    ]},
    { label: 'Düzenle', submenu: [
      { label: 'Geri Al', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow.webContents.send('menu','undo') },
      { label: 'Tekrar', accelerator: 'CmdOrCtrl+Y', click: () => mainWindow.webContents.send('menu','redo') },
      { type: 'separator' },
      { label: 'Klip Böl', accelerator: 'CmdOrCtrl+K', click: () => mainWindow.webContents.send('menu','split') },
      { label: 'Klip Sil', accelerator: 'Delete', click: () => mainWindow.webContents.send('menu','delete') },
      { label: 'Klip Kopyala', accelerator: 'CmdOrCtrl+D', click: () => mainWindow.webContents.send('menu','duplicate') }
    ]},
    { label: 'Görünüm', submenu: [
      { label: 'Tam Ekran', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
      { label: 'Geliştirici Araçları', accelerator: 'F12', click: () => mainWindow.webContents.openDevTools() }
    ]},
    { label: 'Sekans', submenu: [
      { label: 'Oynat / Duraklat', accelerator: 'Space', click: () => mainWindow.webContents.send('menu','play') },
      { label: 'Başa Git', accelerator: 'Home', click: () => mainWindow.webContents.send('menu','gostart') },
      { label: 'Sona Git', accelerator: 'End', click: () => mainWindow.webContents.send('menu','goend') },
      { label: '5s Geri', accelerator: 'Left', click: () => mainWindow.webContents.send('menu','back5') },
      { label: '5s İleri', accelerator: 'Right', click: () => mainWindow.webContents.send('menu','fwd5') }
    ]},
    { label: 'Yardım', submenu: [
      { label: 'ViEdit v2 Hakkında', click: () => dialog.showMessageBox(mainWindow,{type:'info',title:'ViEdit v2',message:'ViEdit v2.0.0',detail:'Türkçe Video Editör\nGerçek FFmpeg render motoru\n© 2026 ViEdit'}) },
      { label: 'FFmpeg Durumu', click: () => checkFFmpeg() }
    ]}
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}

function checkFFmpeg() {
  execFile(getFFmpegPath(), ['-version'], (err, stdout) => {
    if (err) dialog.showMessageBox(mainWindow,{type:'error',title:'FFmpeg',message:'FFmpeg bulunamadı!',detail:String(err)});
    else dialog.showMessageBox(mainWindow,{type:'info',title:'FFmpeg Hazır ✓',message:'FFmpeg çalışıyor',detail:stdout.split('\n')[0]});
  });
}

async function importMediaDialog() {
  const r = await dialog.showOpenDialog(mainWindow,{
    title:'Medya İçeri Aktar', properties:['openFile','multiSelections'],
    filters:[
      {name:'Video',extensions:['mp4','mov','avi','mkv','webm','wmv','flv','m4v']},
      {name:'Ses',extensions:['mp3','wav','aac','flac','ogg','m4a']},
      {name:'Görüntü',extensions:['jpg','jpeg','png','gif','bmp','webp']},
      {name:'Tüm Medya',extensions:['mp4','mov','avi','mkv','mp3','wav','jpg','png','webm']}
    ]
  });
  if (!r.canceled) mainWindow.webContents.send('import-media', r.filePaths);
}

ipcMain.handle('import-media-dialog', async () => {
  return await dialog.showOpenDialog(mainWindow,{
    title:'Medya İçeri Aktar', properties:['openFile','multiSelections'],
    filters:[
      {name:'Video',extensions:['mp4','mov','avi','mkv','webm','wmv','flv','m4v']},
      {name:'Ses',extensions:['mp3','wav','aac','flac','ogg','m4a']},
      {name:'Görüntü',extensions:['jpg','jpeg','png','gif','bmp','webp']},
      {name:'Tüm Medya',extensions:['mp4','mov','avi','mkv','mp3','wav','jpg','png']}
    ]
  });
});

ipcMain.handle('export-dialog', async (e, opts) => {
  return await dialog.showSaveDialog(mainWindow,{
    title:'Videoyu Dışa Aktar',
    defaultPath: opts && opts.defaultName ? opts.defaultName : 'video_cikti.mp4',
    filters:[
      {name:'MP4 Video (H.264)',extensions:['mp4']},
      {name:'WebM Video',extensions:['webm']},
      {name:'GIF Animasyon',extensions:['gif']},
      {name:'MP3 Ses',extensions:['mp3']},
      {name:'WAV Ses',extensions:['wav']}
    ]
  });
});

ipcMain.handle('get-media-info', async (e, filePath) => {
  return new Promise((resolve) => {
    execFile(getFFprobePath(),['-v','quiet','-print_format','json','-show_format','-show_streams',filePath],(err,stdout) => {
      if (err) { resolve(null); return; }
      try { resolve(JSON.parse(stdout)); } catch { resolve(null); }
    });
  });
});

ipcMain.handle('render-video', async (e, job) => {
  const { outputPath, clips, settings } = job;
  const ffmpeg = getFFmpegPath();

  return new Promise((resolve, reject) => {
    const validClips = (clips||[]).filter(c => c.path && fs.existsSync(c.path));
    if (validClips.length === 0) {
      reject(new Error('Geçerli video dosyası bulunamadı.\nLütfen önce medya dosyalarını içeri aktarın ve zaman çizelgesine ekleyin.'));
      return;
    }

    const resMap = {'1920x1080':{w:1920,h:1080},'3840x2160':{w:3840,h:2160},'1280x720':{w:1280,h:720},'854x480':{w:854,h:480}};
    const res = resMap[settings.resolution] || {w:1920,h:1080};
    const fps = parseInt(settings.fps)||30;
    const ext = path.extname(outputPath).toLowerCase();
    const crf = settings.quality==='yüksek'?'18':settings.quality==='düşük'?'28':'23';

    let args = [];

    if (validClips.length === 1) {
      const c = validClips[0];
      args = ['-i', c.path];
      if (c.clipStart > 0) args.push('-ss', String(c.clipStart));
      if (c.dur)           args.push('-t',  String(c.dur));

      const vf = [];
      const b = settings.brightness||0, co = settings.contrast||0, s = settings.saturation||0;
      if (b||co||s) vf.push(`eq=brightness=${b/100}:contrast=${1+co/100}:saturation=${1+s/100}`);
      if (settings.hue) vf.push(`hue=h=${settings.hue}`);
      if (settings.speed && settings.speed!==1) vf.push(`setpts=${1/settings.speed}*PTS`);
      vf.push(`scale=${res.w}:${res.h}:force_original_aspect_ratio=decrease,pad=${res.w}:${res.h}:(ow-iw)/2:(oh-ih)/2`);
      vf.push(`fps=${fps}`);
      args.push('-vf', vf.join(','));

      if (ext==='.gif')  args.push('-loop','0');
      else if (ext==='.webm') args.push('-c:v','libvpx-vp9','-b:v','2M','-c:a','libopus');
      else if (ext==='.mp3')  args.push('-vn','-c:a','libmp3lame','-q:a','2');
      else if (ext==='.wav')  args.push('-vn','-c:a','pcm_s16le');
      else args.push('-c:v','libx264','-crf',crf,'-preset','medium','-c:a','aac','-b:a','192k','-movflags','+faststart');
    } else {
      const listFile = path.join(app.getPath('temp'), 'viedit_concat.txt');
      fs.writeFileSync(listFile, validClips.map(c=>`file '${c.path.replace(/\\/g,'/')}'`).join('\n'));
      args = [
        '-f','concat','-safe','0','-i',listFile,
        '-vf',`scale=${res.w}:${res.h}:force_original_aspect_ratio=decrease,pad=${res.w}:${res.h}:(ow-iw)/2:(oh-ih)/2,fps=${fps}`,
        '-c:v','libx264','-crf',crf,'-preset','medium',
        '-c:a','aac','-b:a','192k','-movflags','+faststart',
        '-y',outputPath
      ];
    }
    args.push('-y', outputPath);

    const proc = spawn(ffmpeg, args);
    let duration = 0;
    proc.stderr.on('data', data => {
      const txt = data.toString();
      const dm = txt.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
      if (dm) duration = +dm[1]*3600 + +dm[2]*60 + parseFloat(dm[3]);
      const tm = txt.match(/time=(\d+):(\d+):(\d+\.?\d*)/);
      if (tm && duration > 0) {
        const cur = +tm[1]*3600 + +tm[2]*60 + parseFloat(tm[3]);
        mainWindow.webContents.send('render-progress',{percent:Math.min(Math.round(cur/duration*100),99),cur,duration});
      }
    });
    proc.on('close', code => {
      if (code===0) { mainWindow.webContents.send('render-progress',{percent:100,done:true}); resolve({success:true,outputPath}); }
      else reject(new Error('FFmpeg render hatası (kod '+code+')'));
    });
    proc.on('error', err => reject(new Error('FFmpeg bulunamadı: '+err.message)));
    ipcMain.once('cancel-render', () => { proc.kill(); reject(new Error('Render iptal edildi')); });
  });
});

ipcMain.handle('open-file', (e, p) => shell.openPath(p));
ipcMain.handle('show-in-folder', (e, p) => shell.showItemInFolder(p));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform!=='darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length===0) createWindow(); });
