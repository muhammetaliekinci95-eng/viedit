# ✦ ViEdit — Türkçe Video Editör

## 🚀 .EXE Kurulum Dosyası Almak (GitHub Actions ile ÜCRETSİZ)

### Adım 1 — GitHub'a Yükle

1. https://github.com → Yeni hesap aç veya giriş yap
2. Sağ üst **+** → **New repository** → adı: `viedit` → **Create**
3. **"uploading an existing file"** linkine tıkla
4. ZIP içindeki TÜM dosyaları sürükle-bırak ile yükle
5. **Commit changes**

### Adım 2 — Build Başlat

1. Repository'de **Actions** sekmesi
2. Sol: **ViEdit Build & Release**
3. **Run workflow** → Version: `1.0.0` → **Run workflow**
4. ⏱️ 5-10 dakika bekle

### Adım 3 — .exe İndir

1. Actions'ta yeşil tik gösteren build'e tıkla
2. Sayfanın altında **Artifacts** → **ViEdit-Windows-Setup** indir
3. ZIP'ten `ViEdit Setup 1.0.0.exe` çıkar
4. Çift tıkla → Kur → Masaüstünden Aç! 🎬

---

## Geliştirici Olarak Çalıştırmak

```bash
npm install
npm start
```

## Klavye Kısayolları

| Kısayol | İşlem |
|---------|-------|
| Space | Oynat / Duraklat |
| Ctrl+Z / Y | Geri Al / Tekrar |
| Ctrl+K | Klip Böl |
| Delete | Klip Sil |
| Ctrl+I | Medya İçeri Aktar |
| I / O | Giriş / Çıkış Noktası |
| F11 | Tam Ekran |
