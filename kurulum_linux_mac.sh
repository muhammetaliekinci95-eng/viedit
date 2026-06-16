#!/bin/bash
echo ""
echo "╔══════════════════════════════════════╗"
echo "║    ViEdit - Türkçe Video Editör      ║"
echo "║          Kurulum Sihirbazı            ║"
echo "╚══════════════════════════════════════╝"
echo ""

if ! command -v node &> /dev/null; then
    echo "[!] Node.js bulunamadı! https://nodejs.org adresinden kurun."
    exit 1
fi
echo "[OK] Node.js: $(node --version)"

cd "$(dirname "$0")"
echo "[*] Bağımlılıklar yükleniyor..."
npm install
echo "[OK] Kurulum tamamlandı!"

# Masaüstü kısayolu (Linux)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    DESKTOP="$HOME/Desktop"
    mkdir -p "$DESKTOP"
    cat > "$DESKTOP/ViEdit.desktop" << EOF
[Desktop Entry]
Name=ViEdit
Comment=Türkçe Video Editör
Exec=bash -c "cd $(pwd) && npx electron ."
Icon=$(pwd)/assets/icon.png
Terminal=false
Type=Application
Categories=AudioVideo;Video;
EOF
    chmod +x "$DESKTOP/ViEdit.desktop"
    echo "[OK] Masaüstü kısayolu oluşturuldu"
fi

echo ""
echo "Başlatmak için: npm start"
echo ""
read -p "Şimdi başlatılsın mı? (e/h): " choice
if [[ "$choice" == "e" || "$choice" == "E" ]]; then
    npx electron .
fi
