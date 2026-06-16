const { ipcRenderer } = require('electron');

// ─── State ───────────────────────────────────────────────────────────────────
const S = {
  playing: false, time: 0, dur: 120, zoom: 100,
  tool: 'seç', selClip: null, vol: 80, spd: 1,
  loop: false, inPt: null, outPt: null,
  hist: [], redo: [],
  tracks: [
    { type: 'video', name: 'Video 1', muted: false, clips: [
      { id: 'v1', name: 'Açılış Sahnesi', start: 0, dur: 25, color: '#2d1060', e: '🎬' },
      { id: 'v2', name: 'Ana Sahne', start: 27, dur: 40, color: '#3a0f70', e: '🎥' },
      { id: 'v3', name: 'Kapanış', start: 69, dur: 20, color: '#1e0d58', e: '🎞' },
    ]},
    { type: 'video', name: 'B-Roll', muted: false, clips: [
      { id: 'v4', name: 'Drone Çekimi', start: 12, dur: 16, color: '#082850', e: '📹' },
    ]},
    { type: 'ses', name: 'Müzik', muted: false, clips: [
      { id: 'a1', name: 'Arka Plan Müziği', start: 0, dur: 90, color: '#051848', e: '🎵' },
    ]},
    { type: 'ses', name: 'Ses Efektleri', muted: false, clips: [
      { id: 'a2', name: 'Kapı Sesi', start: 5, dur: 3, color: '#071a38', e: '🔊' },
      { id: 'a3', name: 'Ambiyans', start: 30, dur: 12, color: '#071a38', e: '🎙' },
    ]},
    { type: 'metin', name: 'Altyazı', muted: false, clips: [
      { id: 't1', name: 'Başlık', start: 2, dur: 8, color: '#062010', e: 'T' },
      { id: 't2', name: 'Alt Yazı', start: 28, dur: 14, color: '#041a0c', e: 'T' },
    ]},
  ],
  media: [
    { n: 'sahne_01.mp4', sz: '245 MB', d: '00:32', e: '🎬', path: null },
    { n: 'mulakat.mp4', sz: '1.2 GB', d: '08:14', e: '🎥', path: null },
    { n: 'drone_cekim.mp4', sz: '890 MB', d: '04:22', e: '📹', path: null },
    { n: 'muzik_arkaplan.mp3', sz: '8.4 MB', d: '03:45', e: '🎵', path: null },
    { n: 'efekt_paketi.wav', sz: '12 MB', d: '00:05', e: '🔊', path: null },
    { n: 'logo_animasyon.mov', sz: '45 MB', d: '00:08', e: '✨', path: null },
  ]
};

const PPS = 8;
let playItv = null, toastItv = null, scopeItv = null;
let curRTab = 'renk';

// ─── Splash ───────────────────────────────────────────────────────────────────
const splashMsgs = ['Modüller yükleniyor...', 'Ses motoru başlatılıyor...', 'Zaman çizelgesi hazırlanıyor...', 'Efektler yükleniyor...', 'Hazır!'];
let si = 0;
const splashItv = setInterval(() => {
  const pct = (si / (splashMsgs.length - 1)) * 100;
  document.getElementById('splashFill').style.width = pct + '%';
  document.getElementById('splashMsg').textContent = splashMsgs[si];
  si++;
  if (si >= splashMsgs.length) {
    clearInterval(splashItv);
    setTimeout(() => {
      const splash = document.getElementById('splash');
      splash.style.opacity = '0';
      setTimeout(() => { splash.style.display = 'none'; document.getElementById('app').style.display = 'grid'; init(); }, 500);
    }, 400);
  }
}, 400);

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  renderPanel('medya');
  renderRightPanel('renk');
  renderTL();
  renderRuler();
  updateTime();
  startScopes();
  setupKeyboard();
  setupIPC();
  setToolActive('tool_sec');
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
function setupIPC() {
  ipcRenderer.on('menu', (e, cmd) => {
    const map = { undo: doUndo, redo: doRedo, split: splitClip, delete: delClip, duplicate: dupClip,
      play: togglePlay, gostart: goStart, goend: goEnd, back5: goBack, fwd5: goFwd,
      markin: markIn, markout: markOut, export: exportDialog,
      'zoomin': () => zoomTL(1), 'zoomout': () => zoomTL(-1),
      shortcuts: () => { document.getElementById('shortcutModal').style.display = 'flex'; },
      'tab-efekt': () => switchTabByName('efekt'), 'tab-gecis': () => switchTabByName('gecis'), 'tab-metin': () => switchTabByName('metin')
    };
    if (map[cmd]) map[cmd]();
  });
  ipcRenderer.on('import-media', (e, paths) => {
    paths.forEach(p => {
      const parts = p.split(/[/\\]/);
      const name = parts[parts.length - 1];
      const ext = name.split('.').pop().toLowerCase();
      const isVid = ['mp4','mov','avi','mkv','webm','wmv'].includes(ext);
      const isSes = ['mp3','wav','aac','flac','ogg','m4a'].includes(ext);
      const e2 = isVid ? '🎬' : isSes ? '🎵' : '🖼';
      S.media.push({ n: name, sz: '—', d: '—', e: e2, path: p });
      if (isVid) showPreviewBg();
    });
    renderPanel('medya');
    toast(`${paths.length} dosya içeri aktarıldı`);
  });
}

// ─── Klavye ───────────────────────────────────────────────────────────────────
function setupKeyboard() {
  document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    const map = {
      ' ': togglePlay, 'Home': goStart, 'End': goEnd,
      'ArrowLeft': goBack, 'ArrowRight': goFwd,
      'i': markIn, 'o': markOut, 'Delete': delClip,
      'v': () => setTool('seç', null), 'c': () => setTool('kes', null),
      'p': () => setTool('kalem', null)
    };
    if (e.ctrlKey) {
      if (e.key === 'z') { e.preventDefault(); doUndo(); }
      else if (e.key === 'y') { e.preventDefault(); doRedo(); }
      else if (e.key === 'k') { e.preventDefault(); splitClip(); }
      else if (e.key === 'd') { e.preventDefault(); dupClip(); }
      else if (e.key === 'i') { e.preventDefault(); importMediaDialog(); }
      else if (e.key === 'e') { e.preventDefault(); exportDialog(); }
      else if (e.key === '=') { e.preventDefault(); zoomTL(1); }
      else if (e.key === '-') { e.preventDefault(); zoomTL(-1); }
      return;
    }
    if (map[e.key]) { e.preventDefault(); map[e.key](); }
  });
}

// ─── Panel ────────────────────────────────────────────────────────────────────
function switchTab(tab, btn) {
  document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderPanel(tab);
}

function switchTabByName(tab) {
  const tabs = { medya: 0, efekt: 1, gecis: 2, metin: 3, renk: 4 };
  const btns = document.querySelectorAll('.ptab');
  btns.forEach(b => b.classList.remove('active'));
  if (btns[tabs[tab]]) btns[tabs[tab]].classList.add('active');
  renderPanel(tab);
}

function renderPanel(tab) {
  const pc = document.getElementById('panelContent');
  if (tab === 'medya') {
    let h = `<button class="add-btn" onclick="importMediaDialog()">+ Medya İçeri Aktar (Ctrl+I)</button><div class="media-grid">`;
    S.media.forEach((m, i) => {
      h += `<div class="mi" id="mi${i}" onclick="selMedia(${i})" ondblclick="addToTL(${i})">
        <div class="mi-thumb">${m.e}<span class="mi-dur">${m.d}</span></div>
        <div class="mi-info"><div class="mi-name" title="${m.n}">${m.n}</div><div class="mi-sz">${m.sz}</div></div>
      </div>`;
    });
    h += `</div>`;
    pc.innerHTML = h;
  } else if (tab === 'efekt') {
    const fx = [
      ['💫', 'Bulanıklaştır', 'Görüntü'], ['🔷', 'Keskinleştir', 'Görüntü'],
      ['🌈', 'Renkli Filtre', 'Renk'], ['⬛', 'Siyah-Beyaz', 'Renk'],
      ['🟫', 'Sepya', 'Renk'], ['🎭', 'Vinyete', 'Görüntü'],
      ['⚡', 'Glitch', 'Bozulma'], ['📡', 'Film Tanesi', 'Bozulma'],
      ['☀', 'Işık Sızıntısı', 'Işık'], ['💡', 'Aydınlatma', 'Işık'],
      ['🌑', 'Gölge', 'Işık'], ['🔄', 'Yamultma', 'Dönüştür'],
      ['🌊', 'Dalga Efekti', 'Bozulma'], ['🎇', 'Parıltı', 'Işık'],
      ['🖼', 'Renk Anahtarı', 'Renk'], ['🌀', 'Dönme Bulanıklığı', 'Bozulma'],
    ];
    pc.innerHTML = `<div class="fx-list">${fx.map(([ic, nm, cat]) => `<div class="fx-item" onclick="applyFX('${nm}')"><span style="font-size:16px">${ic}</span><span>${nm}</span><span class="fx-badge">${cat}</span></div>`).join('')}</div>`;
  } else if (tab === 'gecis') {
    const tr = [
      ['✂', 'Kesme'], ['💧', 'Çözülme'], ['←', 'Sola Kaydır'],
      ['→', 'Sağa Kaydır'], ['↑', 'Yukarı Kaydır'], ['↓', 'Aşağı Kaydır'],
      ['🔍', 'Yakınlaş'], ['🔎', 'Uzaklaş'], ['🔄', 'Döndür'],
      ['🌫', 'Solma'], ['💥', 'Işık Patla'], ['🚪', 'Kapı'],
      ['📖', 'Kitap Çevir'], ['⭕', 'Daire Aç'], ['💠', 'Elmas'], ['🌀', 'Spiral'],
    ];
    pc.innerHTML = `<div class="tr-grid">${tr.map(([ic, nm]) => `<div class="tr-item" onclick="applyTransition('${nm}')"><div class="tr-icon">${ic}</div>${nm}</div>`).join('')}</div>`;
  } else if (tab === 'metin') {
    pc.innerHTML = `<div style="display:flex;flex-direction:column;gap:5px">
      <div class="sec-title" style="margin-top:0">✏ Yeni Metin</div>
      <input type="text" class="txt-inp" id="txtIn" placeholder="Metin yazın...">
      <select class="sel-inp" id="fontSel">
        <option>Varsayılan</option><option>Arial</option><option>Georgia</option>
        <option>Impact</option><option>Courier New</option><option>Tahoma</option>
        <option>Verdana</option><option>Times New Roman</option>
      </select>
      <div class="prow"><span class="plbl">Boyut</span><div class="psw"><input type="range" min="12" max="120" value="36" id="txtSz" oninput="uv('txtSz','vTxtSz')"><span class="pvb" id="vTxtSz">36</span></div></div>
      <div class="prow"><span class="plbl">Renk</span><input type="color" value="#ffffff" id="txtCol" style="height:26px;border-radius:4px;border:1px solid #2d2d5e;background:#1a1a38;cursor:pointer;flex:1"></div>
      <div class="prow"><span class="plbl">Arka Plan</span><input type="color" value="#000000" id="txtBg" style="height:26px;border-radius:4px;border:1px solid #2d2d5e;background:#1a1a38;cursor:pointer;flex:1"></div>
      <div class="trow"><span class="tlbl">Kalın</span><div class="tog on" onclick="this.classList.toggle('on')"></div></div>
      <div class="trow"><span class="tlbl">Metin Gölgesi</span><div class="tog on" onclick="this.classList.toggle('on')"></div></div>
      <div class="trow"><span class="tlbl">Arka Plan Kutusu</span><div class="tog" onclick="this.classList.toggle('on')"></div></div>
      <button class="btn-pr" onclick="addText()">+ Metin Ekle</button>
      <div class="sec-title">📝 Hazır Stiller</div>
      ${['Büyük Başlık', 'Küçük Başlık', 'Alt Yazı', 'Çağrı Metni', 'Damga', 'Kredi Metni'].map(s => `<button class="btn-sc" onclick="addPreset('${s}')">${s}</button>`).join('')}
    </div>`;
  } else if (tab === 'renk') {
    const luts = [
      { name: 'Doğal', c1: '#6a8a5a', c2: '#8ab070' },
      { name: 'Sinematik', c1: '#2a3a6a', c2: '#3a4a8a' },
      { name: 'Sıcak', c1: '#8a4a1a', c2: '#aa6a2a' },
      { name: 'Soğuk', c1: '#1a4a8a', c2: '#2a5aaa' },
      { name: 'Fade', c1: '#6a6a7a', c2: '#7a7a8a' },
      { name: 'Vintage', c1: '#7a5a2a', c2: '#8a6a3a' },
      { name: 'Moody', c1: '#3a2a4a', c2: '#4a3a5a' },
      { name: 'Teal&Orange', c1: '#1a6a5a', c2: '#8a4a1a' },
    ];
    pc.innerHTML = `<div class="sec-title" style="margin-top:0">🎨 LUT Renk Şemaları</div>
      <div class="lut-grid">${luts.map(l => `<div class="lut-item" onclick="applyLUT('${l.name}')">
        <div class="lut-preview" style="background:linear-gradient(90deg,${l.c1},${l.c2})"></div>
        ${l.name}
      </div>`).join('')}</div>`;
  }
}

// ─── Sağ Panel ────────────────────────────────────────────────────────────────
function switchRTab(tab, btn) {
  curRTab = tab;
  document.querySelectorAll('.rtab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderRightPanel(tab);
}

function renderRightPanel(tab) {
  const rc = document.getElementById('rightContent');
  if (tab === 'renk') {
    rc.innerHTML = `
      <div class="sec-title">🎨 Renk Düzeltme</div>
      ${slider('sB','vB','Parlaklık',-100,100,0)}
      ${slider('sC','vC','Kontrast',-100,100,0)}
      ${slider('sS','vS','Doygunluk',-100,100,0)}
      ${slider('sH','vH','Ton',-180,180,0)}
      ${slider('sT','vT','Sıcaklık',-100,100,0)}
      ${slider('sSh','vSh','Keskinlik',0,100,0)}
      ${slider('sEx','vEx','Pozlama',-100,100,0)}
      ${slider('sHi','vHi','Yüksek Işıklar',-100,100,0)}
      ${slider('sSd','vSd','Gölgeler',-100,100,0)}
      ${slider('sWh','vWh','Beyazlar',-100,100,0)}
      ${slider('sBl','vBl','Siyahlar',-100,100,0)}
      <button class="btn-pr" onclick="applyColorGrade()">✓ Renk Düzeltmeyi Uygula</button>
      <button class="btn-sc" onclick="resetColor()">↺ Sıfırla</button>`;
    setupSliders();
  } else if (tab === 'donustur') {
    rc.innerHTML = `
      <div class="sec-title">🎬 Dönüştür</div>
      ${slider('sSc','vSc','Ölçek %',10,300,100)}
      ${slider('sR','vR','Döndür °',-180,180,0)}
      ${slider('sOp','vOp','Opaklık %',0,100,100)}
      ${slider('sPX','vPX','Konum X',-300,300,0)}
      ${slider('sPY','vPY','Konum Y',-300,300,0)}
      <div class="sec-title">✂ Kırpma</div>
      ${slider('sCrT','vCrT','Üst',0,50,0)}
      ${slider('sCrB','vCrB','Alt',0,50,0)}
      ${slider('sCrL','vCrL','Sol',0,50,0)}
      ${slider('sCrR','vCrR','Sağ',0,50,0)}
      <button class="btn-pr" onclick="applyTransform()">✓ Uygula</button>
      <button class="btn-sc" onclick="resetTransform()">↺ Sıfırla</button>`;
    setupSliders();
  } else if (tab === 'ses') {
    rc.innerHTML = `
      <div class="sec-title">🔊 Ses Ayarları</div>
      ${slider('sAG','vAG','Ses Seviyesi',0,200,100)}
      ${slider('sFI','vFI','Fade Giriş',0,100,0)}
      ${slider('sFO','vFO','Fade Çıkış',0,100,0)}
      ${slider('sAB','vAB','Bas',-20,20,0)}
      ${slider('sAM','vAM','Orta',-20,20,0)}
      ${slider('sAT','vAT','Tiz',-20,20,0)}
      <div class="sec-title">Seçenekler</div>
      <div class="trow"><span class="tlbl">Sesi Kapat (Mute)</span><div class="tog" onclick="this.classList.toggle('on')"></div></div>
      <div class="trow"><span class="tlbl">Gürültü Azaltma</span><div class="tog on" onclick="this.classList.toggle('on')"></div></div>
      <div class="trow"><span class="tlbl">Stereo Genişlet</span><div class="tog" onclick="this.classList.toggle('on')"></div></div>
      <div class="trow"><span class="tlbl">Normalleştir</span><div class="tog on" onclick="this.classList.toggle('on')"></div></div>
      <button class="btn-pr" onclick="toast('Ses ayarları uygulandı')">✓ Uygula</button>`;
    setupSliders();
  } else if (tab === 'hiz') {
    rc.innerHTML = `
      <div class="sec-title">⏱ Hız & Süre</div>
      ${slider('sSpd','vSpd','Klip Hızı %',10,400,100)}
      <div class="trow"><span class="tlbl">Ters Oynat</span><div class="tog" onclick="this.classList.toggle('on');toast('Ters oynatma değiştirildi')"></div></div>
      <div class="trow"><span class="tlbl">Stabilizasyon</span><div class="tog on" onclick="this.classList.toggle('on')"></div></div>
      <div class="trow"><span class="tlbl">Hareketli Bulanıklık</span><div class="tog" onclick="this.classList.toggle('on')"></div></div>
      <div class="trow"><span class="tlbl">Çerçeve Karıştır</span><div class="tog" onclick="this.classList.toggle('on')"></div></div>
      <div class="trow"><span class="tlbl">Optik Akış</span><div class="tog on" onclick="this.classList.toggle('on')"></div></div>
      <div class="sec-title">⌛ Hız Rampa</div>
      ${slider('sRampS','vRampS','Başlangıç',10,400,100)}
      ${slider('sRampE','vRampE','Bitiş',10,400,100)}
      <button class="btn-pr" onclick="toast('Hız değişiklikleri uygulandı')">✓ Uygula</button>`;
    setupSliders();
  }
}

function slider(id, vid, lbl, mn, mx, val) {
  return `<div class="prow"><span class="plbl">${lbl}</span><div class="psw">
    <input type="range" min="${mn}" max="${mx}" value="${val}" id="${id}" oninput="uv('${id}','${vid}');doFilter()">
    <span class="pvb" id="${vid}">${val}</span></div></div>`;
}

function setupSliders() {
  document.querySelectorAll('#rightContent input[type=range]').forEach(s => {
    s.oninput = function() { uv(this.id, 'v' + this.id.slice(1)); doFilter(); };
  });
}

function uv(sid, vid) {
  const el = document.getElementById(sid);
  const vel = document.getElementById(vid);
  if (el && vel) vel.textContent = el.value;
}

// ─── Önizleme & Filtreler ─────────────────────────────────────────────────────
function doFilter() {
  const pi = document.getElementById('previewInner');
  const get = id => { const el = document.getElementById(id); return el ? +el.value : 0; };
  const b = 1 + get('sB') / 100;
  const c = 1 + get('sC') / 100;
  const s = 1 + get('sS') / 100;
  const h = get('sH');
  pi.style.filter = `brightness(${b}) contrast(${c}) saturate(${s}) hue-rotate(${h}deg)`;
  const sc = get('sSc') || 100;
  const r = get('sR') || 0;
  const op = get('sOp') !== undefined ? get('sOp') : 100;
  const px = get('sPX') || 0;
  const py = get('sPY') || 0;
  pi.style.transform = `scale(${sc / 100}) rotate(${r}deg) translate(${px}px,${py}px)`;
  pi.style.opacity = op / 100;
}

function applyColorGrade() { doFilter(); toast('Renk düzeltme uygulandı ✓'); }
function applyTransform() { doFilter(); toast('Dönüştürme uygulandı ✓'); }
function resetColor() {
  ['sB','sC','sS','sH','sT','sSh','sEx','sHi','sSd','sWh','sBl'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = 0; uv(id, 'v' + id.slice(1)); }
  });
  doFilter(); toast('Renk düzeltme sıfırlandı');
}
function resetTransform() {
  ['sSc','sR','sOp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = id === 'sSc' || id === 'sOp' ? 100 : 0; uv(id, 'v' + id.slice(1)); }
  });
  ['sPX','sPY','sCrT','sCrB','sCrL','sCrR'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = 0; uv(id, 'v' + id.slice(1)); }
  });
  doFilter(); toast('Dönüştürme sıfırlandı');
}

function showPreviewBg() {
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('previewBg').style.display = 'flex';
}

// ─── Oynatma ──────────────────────────────────────────────────────────────────
function togglePlay() {
  S.playing = !S.playing;
  document.getElementById('playBtn').textContent = S.playing ? '⏸' : '▶';
  if (S.playing) {
    playItv = setInterval(() => {
      S.time += 0.1 * S.spd;
      const end = S.outPt || S.dur;
      if (S.time >= end) {
        if (S.loop) S.time = S.inPt || 0;
        else { S.time = end; S.playing = false; document.getElementById('playBtn').textContent = '▶'; clearInterval(playItv); }
      }
      updateTime();
    }, 100);
  } else clearInterval(playItv);
}

function updateTime() {
  const pct = S.time / S.dur;
  document.getElementById('timeDsp').textContent = fmt(S.time) + ' / ' + fmt(S.dur);
  document.getElementById('progFill').style.width = (pct * 100) + '%';
  if (S.inPt !== null) {
    const im = document.getElementById('inMark');
    im.style.display = 'block'; im.style.left = (S.inPt / S.dur * 100) + '%';
  }
  if (S.outPt !== null) {
    const om = document.getElementById('outMark');
    om.style.display = 'block'; om.style.left = (S.outPt / S.dur * 100) + '%';
  }
  updatePH();
}

function updatePH() {
  const x = S.time * PPS * (S.zoom / 100);
  document.getElementById('playhead').style.left = x + 'px';
}

function seekTo(e) {
  const b = document.getElementById('progBar');
  const r = b.getBoundingClientRect();
  S.time = Math.max(0, Math.min(S.dur, ((e.clientX - r.left) / r.width) * S.dur));
  updateTime();
}

function goStart() { S.time = S.inPt || 0; updateTime(); }
function goEnd() { S.time = S.outPt || S.dur; updateTime(); }
function goBack() { S.time = Math.max(0, S.time - 5); updateTime(); }
function goFwd() { S.time = Math.min(S.dur, S.time + 5); updateTime(); }
function setSpd(v) { S.spd = parseFloat(v); }
function toggleLoop() { S.loop = !S.loop; document.getElementById('loopBtn').style.color = S.loop ? '#a78bfa' : ''; toast('Döngü: ' + (S.loop ? 'Açık' : 'Kapalı')); }
function markIn() { S.inPt = S.time; updateTime(); toast('Giriş noktası: ' + fmt(S.time)); }
function markOut() { S.outPt = S.time; updateTime(); toast('Çıkış noktası: ' + fmt(S.time)); }
function toggleFS() { const el = document.getElementById('previewBox'); if (!document.fullscreenElement) el.requestFullscreen(); else document.exitFullscreen(); }

// ─── Zaman Çizelgesi ──────────────────────────────────────────────────────────
function renderTL() {
  const labels = document.getElementById('tlLabels');
  const rows = document.getElementById('trackRows');
  const totalW = S.dur * PPS * (S.zoom / 100);
  let lh = '<div class="tl-ruler-placeholder"></div>', rh = '';

  S.tracks.forEach((tr, ti) => {
    const ic = tr.type === 'video' ? '🎬' : tr.type === 'ses' ? '🔊' : 'T';
    lh += `<div class="tl-lbl">${ic} <span style="flex:1;overflow:hidden;text-overflow:ellipsis">${tr.name}</span>
      <button class="mute-b" onclick="toggleMute(${ti})" title="${tr.muted ? 'Sesi Aç' : 'Sessiz'}">${tr.muted ? '🔇' : '🔈'}</button></div>`;
    let row = `<div class="track-row" id="tr${ti}" style="min-width:${Math.max(totalW, 1200)}px" onclick="trClick(event,${ti})">`;
    tr.clips.forEach(c => {
      const l = c.start * PPS * (S.zoom / 100);
      const w = Math.max(c.dur * PPS * (S.zoom / 100), 20);
      const tc = tr.type === 'video' ? 'clip-v' : tr.type === 'ses' ? 'clip-a' : 'clip-t';
      const sel = S.selClip === c.id ? 'sel' : '';
      row += `<div class="clip ${tc} ${sel}" id="cl_${c.id}" style="left:${l}px;width:${w}px;background:${c.color}" onclick="selClip('${c.id}',event)" title="${c.name}">
        <div class="ch l"></div>${c.e} ${c.name}<div class="ch r"></div></div>`;
    });
    row += `</div>`; rh += row;
  });
  labels.innerHTML = lh;
  rows.innerHTML = rh;
  updatePH();
}

function renderRuler() {
  const r = document.getElementById('ruler');
  const totalW = S.dur * PPS * (S.zoom / 100);
  r.style.minWidth = Math.max(totalW, 1200) + 'px';
  let h = '';
  for (let s = 0; s <= S.dur; s += 10) {
    const x = s * PPS * (S.zoom / 100);
    h += `<div class="r-mark" style="left:${x}px">${fmt(s)}</div>`;
  }
  r.innerHTML = h;
}

function fmt(s) {
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sc = String(Math.floor(s % 60)).padStart(2, '0');
  const fr = String(Math.floor((s % 1) * 30)).padStart(2, '0');
  return `${h}:${m}:${sc}:${fr}`;
}

function selClip(id, e) {
  e.stopPropagation();
  S.selClip = id;
  let found = null;
  S.tracks.forEach(t => t.clips.forEach(c => { if (c.id === id) found = c; }));
  if (found) {
    document.getElementById('ccName').textContent = found.name;
    document.getElementById('ccMeta').textContent = `Süre: ${found.dur}s  •  Başlangıç: ${found.start}s  •  ID: ${id}`;
    showPreviewBg();
    document.getElementById('previewLabel').textContent = found.e + ' ' + found.name;
  }
  renderTL();
}

function addTrack(type) {
  const nm = { video: 'Video', ses: 'Ses', metin: 'Metin' };
  const cnt = S.tracks.filter(t => t.type === type).length + 1;
  saveHist();
  S.tracks.push({ type, name: `${nm[type]} ${cnt + 1}`, muted: false, clips: [] });
  renderTL(); toast(`${nm[type]} parçası eklendi`);
}

function toggleMute(ti) {
  S.tracks[ti].muted = !S.tracks[ti].muted;
  renderTL();
  toast(`"${S.tracks[ti].name}": ${S.tracks[ti].muted ? 'Sessiz' : 'Açık'}`);
}

function setTool(t, btn) {
  S.tool = t;
  document.querySelectorAll('.tl-btn').forEach(b => b.classList.remove('act'));
  if (btn) btn.classList.add('act');
  setToolActive(t === 'seç' ? 'tool_sec' : t === 'kes' ? 'tool_kes' : 'tool_kal');
}

function setToolActive(id) {
  ['tool_sec', 'tool_kes', 'tool_kal'].forEach(i => { const el = document.getElementById(i); if (el) el.style.color = ''; });
  const el = document.getElementById(id);
  if (el) el.style.color = '#a78bfa';
}

function trClick(e, ti) {
  if (S.tool === 'kalem') {
    const x = e.offsetX;
    const startS = x / (PPS * (S.zoom / 100));
    const tr = S.tracks[ti];
    saveHist();
    tr.clips.push({ id: 'c' + Date.now(), name: 'Yeni Klip', start: Math.floor(startS), dur: 10, color: tr.type === 'video' ? '#2d1060' : tr.type === 'ses' ? '#082050' : '#082a10', e: tr.type === 'video' ? '🎬' : tr.type === 'ses' ? '🔊' : 'T' });
    renderTL(); toast('Yeni klip oluşturuldu');
  }
}

function splitClip() {
  if (!S.selClip) { toast('Önce bir klip seçin'); return; }
  saveHist();
  S.tracks.forEach(t => {
    const idx = t.clips.findIndex(c => c.id === S.selClip);
    if (idx === -1) return;
    const c = t.clips[idx];
    const splitAt = S.time - c.start;
    if (splitAt <= 0 || splitAt >= c.dur) { toast('Zaman imlecini klip üzerine getirin'); return; }
    const c2 = { ...c, id: 'c' + Date.now(), start: c.start + splitAt, dur: c.dur - splitAt };
    c.dur = splitAt;
    t.clips.splice(idx + 1, 0, c2);
  });
  renderTL(); toast('Klip bölündü');
}

function delClip() {
  if (!S.selClip) { toast('Önce bir klip seçin'); return; }
  saveHist();
  S.tracks.forEach(t => { t.clips = t.clips.filter(c => c.id !== S.selClip); });
  S.selClip = null;
  document.getElementById('ccName').textContent = 'Klip Seçilmedi';
  document.getElementById('ccMeta').textContent = 'Zaman çizelgesinden bir klip seçin';
  renderTL(); toast('Klip silindi');
}

function dupClip() {
  if (!S.selClip) { toast('Önce bir klip seçin'); return; }
  saveHist();
  S.tracks.forEach(t => {
    const c = t.clips.find(c => c.id === S.selClip);
    if (c) t.clips.push({ ...c, id: 'c' + Date.now(), start: c.start + c.dur + 0.5 });
  });
  renderTL(); toast('Klip kopyalandı');
}

function zoomTL(d) {
  S.zoom = Math.max(25, Math.min(400, S.zoom + d * 25));
  document.getElementById('zoomV').textContent = S.zoom + '%';
  document.getElementById('zoomSlider').value = S.zoom;
  renderTL(); renderRuler();
}

function setZoom(v) {
  S.zoom = +v;
  document.getElementById('zoomV').textContent = S.zoom + '%';
  renderTL(); renderRuler();
}

// ─── Medya ────────────────────────────────────────────────────────────────────
async function importMediaDialog() {
  const result = await ipcRenderer.invoke('import-media-dialog');
  if (!result.canceled && result.filePaths.length > 0) {
    result.filePaths.forEach(p => {
      const name = p.split(/[/\\]/).pop();
      const ext = name.split('.').pop().toLowerCase();
      const isVid = ['mp4','mov','avi','mkv','webm','wmv','flv'].includes(ext);
      const isSes = ['mp3','wav','aac','flac','ogg','m4a','wma'].includes(ext);
      const em = isVid ? '🎬' : isSes ? '🎵' : '🖼';
      S.media.push({ n: name, sz: '—', d: '—', e: em, path: p });
      if (isVid) showPreviewBg();
    });
    renderPanel('medya');
    toast(`${result.filePaths.length} dosya içeri aktarıldı`);
  }
}

function selMedia(i) {
  document.querySelectorAll('.mi').forEach((el, j) => el.classList.toggle('sel', i === j));
  const m = S.media[i];
  document.getElementById('ccName').textContent = m.n;
  document.getElementById('ccMeta').textContent = `Boyut: ${m.sz}  •  Süre: ${m.d}${m.path ? '\n' + m.path : ''}`;
  if (m.path) {
    const ext = m.n.split('.').pop().toLowerCase();
    if (['mp4','mov','avi','mkv','webm','wmv'].includes(ext)) {
      const vid = document.getElementById('mainVideo');
      vid.src = m.path;
      vid.style.display = 'block';
      document.getElementById('placeholder').style.display = 'none';
      document.getElementById('previewBg').style.display = 'none';
    } else showPreviewBg();
  }
}

function addToTL(i) {
  const m = S.media[i];
  const vt = S.tracks.find(t => t.type === 'video');
  if (vt) {
    const end = vt.clips.reduce((mx, c) => Math.max(mx, c.start + c.dur), 0);
    saveHist();
    vt.clips.push({ id: 'c' + Date.now(), name: m.n.split('.')[0], start: end + 0.5, dur: 15, color: '#2d1060', e: m.e, path: m.path });
    renderTL(); toast(`"${m.n}" zaman çizelgesine eklendi`);
    showPreviewBg();
  }
}

// ─── Metin Katmanı ────────────────────────────────────────────────────────────
function addText() {
  const txtEl = document.getElementById('txtIn');
  const txt = txtEl ? txtEl.value.trim() : '';
  if (!txt) { toast('Lütfen metin girin'); return; }
  const col = (document.getElementById('txtCol') || {}).value || '#fff';
  const sz = (document.getElementById('txtSz') || {}).value || 36;
  const font = (document.getElementById('fontSel') || {}).value || 'Varsayılan';
  const tl = document.getElementById('textLayer');
  const el = document.createElement('div');
  el.className = 'txt-el';
  el.textContent = txt;
  el.style.cssText = `color:${col};font-size:${sz}px;font-family:${font === 'Varsayılan' ? 'inherit' : font};top:20%;left:50%;transform:translateX(-50%);text-shadow:2px 2px 4px rgba(0,0,0,0.8);font-weight:700`;
  el.ondblclick = () => { if (confirm('Metni silmek istiyor musunuz?')) el.remove(); };
  tl.appendChild(el);
  makeDrag(el);
  if (txtEl) txtEl.value = '';
  toast('Metin eklendi — çift tıklayarak silebilirsiniz');
}

const presets = {
  'Büyük Başlık': { t: 'BÜYÜK BAŞLIK', sz: 52, c: '#fff', top: '15%' },
  'Küçük Başlık': { t: 'Küçük Başlık', sz: 28, c: '#f0f0f0', top: '20%' },
  'Alt Yazı': { t: 'Alt yazı metni buraya...', sz: 16, c: '#ffff00', top: 'auto', bot: '10%' },
  'Çağrı Metni': { t: 'HEMEN KAYDOL!', sz: 34, c: '#ff4444', top: '40%' },
  'Damga': { t: 'ÖNEMLİ', sz: 30, c: '#ff8800', top: '5%' },
  'Kredi Metni': { t: 'Yönetmen: Ad Soyad', sz: 13, c: '#cccccc', top: 'auto', bot: '5%' },
};

function addPreset(s) {
  const p = presets[s] || { t: s, sz: 24, c: '#fff', top: '20%' };
  const tl = document.getElementById('textLayer');
  const el = document.createElement('div');
  el.className = 'txt-el';
  el.textContent = p.t;
  let css = `color:${p.c};font-size:${p.sz}px;left:50%;text-shadow:2px 2px 6px rgba(0,0,0,0.9);font-weight:700;`;
  if (p.top !== 'auto') css += `top:${p.top};transform:translateX(-50%);`;
  else css += `bottom:${p.bot};transform:translateX(-50%);`;
  el.style.cssText = css;
  el.ondblclick = () => { if (confirm('Silmek istiyor musunuz?')) el.remove(); };
  tl.appendChild(el);
  makeDrag(el);
  toast(`"${s}" stili eklendi`);
}

function makeDrag(el) {
  let ox = 0, oy = 0, mx = 0, my = 0;
  el.onmousedown = e => {
    e.preventDefault();
    mx = e.clientX; my = e.clientY;
    document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
    document.onmousemove = e2 => {
      ox = mx - e2.clientX; oy = my - e2.clientY; mx = e2.clientX; my = e2.clientY;
      el.style.top = (el.offsetTop - oy) + 'px';
      el.style.left = (el.offsetLeft - ox) + 'px';
      el.style.transform = 'none'; el.style.bottom = 'auto';
    };
  };
}

// ─── Efektler & Geçişler ──────────────────────────────────────────────────────
function applyFX(name) {
  if (!S.selClip) { toast('Efekt uygulamak için önce bir klip seçin'); return; }
  toast(`"${name}" efekti uygulandı`);
}

function applyTransition(name) { toast(`"${name}" geçişi eklendi`); }
function applyLUT(name) { toast(`"${name}" LUT renk şeması uygulandı`); }

// ─── Geri Al / Tekrar ─────────────────────────────────────────────────────────
function saveHist() {
  S.hist.push(JSON.stringify(S.tracks));
  S.redo = [];
  if (S.hist.length > 50) S.hist.shift();
}

function doUndo() {
  if (!S.hist.length) { toast('Geri alacak işlem yok'); return; }
  S.redo.push(JSON.stringify(S.tracks));
  S.tracks = JSON.parse(S.hist.pop());
  renderTL(); toast('Geri alındı');
}

function doRedo() {
  if (!S.redo.length) { toast('Tekrar edilecek işlem yok'); return; }
  S.hist.push(JSON.stringify(S.tracks));
  S.tracks = JSON.parse(S.redo.pop());
  renderTL(); toast('Tekrar edildi');
}

// ─── Dışa Aktar ──────────────────────────────────────────────────────────────
async function exportDialog() {
  const result = await ipcRenderer.invoke('export-dialog');
  if (!result.canceled && result.filePath) {
    toast(`Dışa aktarılıyor: ${result.filePath.split(/[/\\]/).pop()}`);
  }
}

// ─── Scopes (Sahte animasyon) ─────────────────────────────────────────────────
function startScopes() {
  drawScope();
  scopeItv = setInterval(drawScope, 800);
}

function drawScope() {
  drawWave(); drawHist(); drawVU();
}

function drawWave() {
  const c = document.getElementById('waveScope');
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0d0d1e'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#3a3a7a'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < c.width; x++) {
    const y = c.height / 2 + (Math.sin(x * 0.15 + Date.now() * 0.002) * 15 + (Math.random() - 0.5) * 8);
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawHist() {
  const c = document.getElementById('histScope');
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0d0d1e'; ctx.fillRect(0, 0, c.width, c.height);
  const colors = ['#ff3333', '#33ff33', '#3333ff'];
  colors.forEach((col, ci) => {
    ctx.strokeStyle = col; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < c.width; x++) {
      const h = (Math.sin(x * 0.08 + ci * 2 + Date.now() * 0.001) * 0.5 + 0.5) * c.height * 0.8 + Math.random() * 4;
      x === 0 ? ctx.moveTo(x, c.height - h) : ctx.lineTo(x, c.height - h);
    }
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

function drawVU() {
  const c = document.getElementById('vuScope');
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0d0d1e'; ctx.fillRect(0, 0, c.width, c.height);
  const lvl = 0.5 + Math.sin(Date.now() * 0.003) * 0.3 + Math.random() * 0.1;
  const h = lvl * c.height;
  const grad = ctx.createLinearGradient(0, c.height, 0, 0);
  grad.addColorStop(0, '#22cc44');
  grad.addColorStop(0.7, '#cccc22');
  grad.addColorStop(1, '#cc2222');
  ctx.fillStyle = grad;
  ctx.fillRect(8, c.height - h, 18, h);
  ctx.fillRect(32, c.height - h * 0.9, 18, h * 0.9);
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastT = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.style.opacity = '0'; }, 2400);
}

// ─── EXPORT MODAL ─────────────────────────────────────────────────────────────
function showExportModal() {
  const existing = document.getElementById('exportModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'exportModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:2000;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:#1a1a2e;border:1px solid #3d3d6e;border-radius:12px;padding:28px;width:460px;max-width:95vw">
      <h2 style="color:#a78bfa;margin-bottom:20px;font-size:16px">⬆ Video Dışa Aktar</h2>

      <div style="display:grid;gap:12px;margin-bottom:20px">
        <div>
          <label style="font-size:11px;color:#6060a0;display:block;margin-bottom:4px">Çözünürlük</label>
          <select id="expRes" style="width:100%;background:#1e1e40;border:1px solid #3d3d6e;border-radius:6px;color:#e0e0e0;padding:7px;font-size:12px">
            <option value="1920x1080" selected>1920×1080 — Full HD (1080p)</option>
            <option value="3840x2160">3840×2160 — Ultra HD (4K)</option>
            <option value="1280x720">1280×720 — HD (720p)</option>
            <option value="854x480">854×480 — SD (480p)</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:#6060a0;display:block;margin-bottom:4px">Kare Hızı</label>
          <select id="expFps" style="width:100%;background:#1e1e40;border:1px solid #3d3d6e;border-radius:6px;color:#e0e0e0;padding:7px;font-size:12px">
            <option value="24">24 FPS — Sinema</option>
            <option value="25">25 FPS — PAL</option>
            <option value="30" selected>30 FPS — Standart</option>
            <option value="60">60 FPS — Akıcı</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:#6060a0;display:block;margin-bottom:4px">Kalite</label>
          <select id="expQuality" style="width:100%;background:#1e1e40;border:1px solid #3d3d6e;border-radius:6px;color:#e0e0e0;padding:7px;font-size:12px">
            <option value="yüksek">Yüksek Kalite (büyük dosya)</option>
            <option value="orta" selected>Orta Kalite (dengeli)</option>
            <option value="düşük">Düşük Kalite (küçük dosya)</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:#6060a0;display:block;margin-bottom:4px">Format</label>
          <select id="expFormat" style="width:100%;background:#1e1e40;border:1px solid #3d3d6e;border-radius:6px;color:#e0e0e0;padding:7px;font-size:12px">
            <option value="mp4" selected>MP4 — H.264 (Evrensel)</option>
            <option value="webm">WebM — Web için</option>
            <option value="gif">GIF — Animasyon</option>
            <option value="mp3">MP3 — Yalnızca Ses</option>
          </select>
        </div>
      </div>

      <!-- İlerleme çubuğu -->
      <div id="expProgress" style="display:none;margin-bottom:16px">
        <div style="font-size:11px;color:#7070a0;margin-bottom:6px" id="expProgressLbl">Render başlatılıyor...</div>
        <div style="background:#252550;border-radius:4px;height:8px;overflow:hidden">
          <div id="expProgressBar" style="height:100%;background:linear-gradient(90deg,#7c3aed,#a78bfa);width:0%;transition:width 0.3s;border-radius:4px"></div>
        </div>
        <div style="font-size:10px;color:#5050a0;margin-top:4px" id="expProgressPct">%0</div>
      </div>

      <div style="display:flex;gap:8px">
        <button id="expStartBtn" onclick="startExport()" style="flex:1;padding:10px;background:#7c3aed;border:none;border-radius:6px;color:#fff;font-size:13px;font-weight:600;cursor:pointer">🎬 Dışa Aktar</button>
        <button onclick="document.getElementById('exportModal').remove()" style="padding:10px 16px;background:#1e1e40;border:1px solid #3d3d6e;border-radius:6px;color:#b0b0c0;font-size:12px;cursor:pointer">İptal</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function startExport() {
  const res      = document.getElementById('expRes').value;
  const fps      = document.getElementById('expFps').value;
  const quality  = document.getElementById('expQuality').value;
  const format   = document.getElementById('expFormat').value;

  const result = await ipcRenderer.invoke('export-dialog', { defaultName: `viedit_cikti.${format}` });
  if (result.canceled || !result.filePath) return;

  // Zaman çizelgesindeki klipleri topla
  const clips = [];
  S.tracks.forEach(t => {
    if (t.type === 'video') {
      t.clips.forEach(c => { if (c.path) clips.push({ path: c.path, clipStart: c.start, dur: c.dur }); });
    }
  });

  // İlerleme göster
  document.getElementById('expProgress').style.display = 'block';
  document.getElementById('expStartBtn').disabled = true;
  document.getElementById('expStartBtn').textContent = '⏳ Render ediliyor...';

  // İlerleme dinle
  ipcRenderer.on('render-progress', (e, data) => {
    document.getElementById('expProgressBar').style.width = data.percent + '%';
    document.getElementById('expProgressPct').textContent = '%' + data.percent;
    if (data.done) {
      document.getElementById('expProgressLbl').textContent = '✅ Tamamlandı!';
      document.getElementById('expProgressPct').textContent = '%100';
    } else {
      document.getElementById('expProgressLbl').textContent = `Render ediliyor... %${data.percent}`;
    }
  });

  try {
    const settings = { resolution: res, fps, quality,
      brightness: +( document.getElementById('sB')  || {value:0}).value || 0,
      contrast:   +( document.getElementById('sC')  || {value:0}).value || 0,
      saturation: +( document.getElementById('sS')  || {value:0}).value || 0,
      hue:        +( document.getElementById('sH')  || {value:0}).value || 0,
      speed:      +( document.getElementById('sSpd')|| {value:100}).value / 100 || 1,
    };

    await ipcRenderer.invoke('render-video', { outputPath: result.filePath, clips, settings });

    setTimeout(() => {
      document.getElementById('exportModal').remove();
      // Başarı bildirimi
      const n = document.createElement('div');
      n.style.cssText='position:fixed;bottom:230px;left:50%;transform:translateX(-50%);background:#1a4a2a;border:1px solid #2a8a4a;color:#4aff7a;padding:14px 24px;border-radius:10px;font-size:13px;z-index:9999;text-align:center';
      n.innerHTML = `✅ Video başarıyla dışa aktarıldı!<br><span style="font-size:11px;color:#2a8a4a;cursor:pointer" onclick="ipcRenderer.invoke('show-in-folder','${result.filePath.replace(/\\/g,'/')}')">${result.filePath.split(/[\\/]/).pop()} — Klasörü Aç</span>`;
      document.body.appendChild(n);
      setTimeout(() => n.remove(), 6000);
    }, 1000);

  } catch (err) {
    document.getElementById('expProgressLbl').textContent = '❌ Hata: ' + err.message;
    document.getElementById('expStartBtn').disabled = false;
    document.getElementById('expStartBtn').textContent = '🎬 Tekrar Dene';
  }
}

// Export butonunu override et
function exportDialog() { showExportModal(); }

// Menu'den export
ipcRenderer.on('menu', (e, cmd) => {
  if (cmd === 'export') showExportModal();
});
