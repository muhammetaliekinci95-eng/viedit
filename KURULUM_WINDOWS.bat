@echo off
chcp 65001 >nul
echo.
echo  ╔══════════════════════════════════════╗
echo  ║     ViEdit - Türkçe Video Editör     ║
echo  ║            Kurulum Sihirbazı          ║
echo  ╚══════════════════════════════════════╝
echo.

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [!] Node.js bulunamadi! https://nodejs.org adresinden kurun.
    pause
    start https://nodejs.org
    exit /b 1
)
echo  [OK] Node.js bulundu

echo  [*] Bagimlilıklar yukleniyor...
cd /d "%~dp0"
call npm install
if %ERRORLEVEL% NEQ 0 ( echo Hata: npm install basarisiz & pause & exit /b 1 )

echo  [OK] Kurulum tamamlandi!
echo.

set DESKTOP=%USERPROFILE%\Desktop
echo @echo off > "%DESKTOP%\ViEdit.bat"
echo cd /d "%~dp0" >> "%DESKTOP%\ViEdit.bat"
echo npx electron . >> "%DESKTOP%\ViEdit.bat"
echo  [OK] Masaustu kisayolu olusturuldu: ViEdit.bat

echo.
echo  ============================================
echo   Kurulum Basarili! Masaustundeki ViEdit.bat
echo   dosyasına cift tiklayarak acabilirsiniz.
echo  ============================================
echo.
set /p CHOICE= Simdi baslatilsin mi? (E/H): 
if /i "%CHOICE%"=="E" ( npx electron . )
pause
