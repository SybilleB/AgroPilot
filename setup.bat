@echo off
setlocal enabledelayedexpansion

echo.
echo  ===========================================
echo   AgroPilot - Local Wi-Fi Demo Setup
echo  ===========================================
echo.

set SCRIPT_DIR=%~dp0
set REACT_DIR=%SCRIPT_DIR%React
set FASTAPI_DIR=%SCRIPT_DIR%FastAPI
set API_FILE=%REACT_DIR%\constants\Api.ts

:: ─────────────────────────────────────────────────────────────
:: 0. Detection de l'IP Locale (Wi-Fi)
:: ─────────────────────────────────────────────────────────────
echo [0/4] Recherche de votre adresse IP locale...

:: On cherche l'IP 192.168.x.x ou 10.x.x.x
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4" ^| findstr "192.168. 10."') do (
    set RAW_IP=%%i
    set MY_IP=!RAW_IP: =!
    goto :found_ip
)

:found_ip
if "%MY_IP%"=="" (
    echo  X Impossible de detecter votre IP Wi-Fi automatiquement.
    set /p MY_IP="Veuillez entrer votre IP locale manuellement (ex: 192.168.1.16) : "
)
echo  OK : Votre IP est %MY_IP%

:: ─────────────────────────────────────────────────────────────
:: 1. Mise a jour automatique de l'IP dans le Code
:: ─────────────────────────────────────────────────────────────
echo [1/4] Configuration de l'API (AgroPilot-FRONTEND)...

if exist "%API_FILE%" (
    echo      Mise a jour de constants/Api.ts -> http://%MY_IP%:8000
    :: Utilise PowerShell pour remplacer l'URL sans toucher au reste du fichier
    powershell -Command "(gc '%API_FILE%') -replace 'http://[^:]+:8000', 'http://%MY_IP%:8000' | Out-File -encoding utf8 '%API_FILE%'"
)

:: ─────────────────────────────────────────────────────────────
:: 2. Installation & Lancement
:: ─────────────────────────────────────────────────────────────
echo [2/4] Verification des dependances...

:: Installation silencieuse d'AsyncStorage pour le cache si manquant
cd /d "%REACT_DIR%"
if not exist "node_modules" (
    echo      Installation initiale de npm...
    call npm install
)
call npx expo install @react-native-async-storage/async-storage --quiet

:: Backend
cd /d "%FASTAPI_DIR%"
if not exist "venv" python -m venv venv

echo [3/4] Lancement des serveurs...

:: Lancer FastAPI (Host 0.0.0.0 est CRUCIAL pour etre vu par l'iPhone)
start "AgroPilot-BACKEND" cmd /k "cd /d %FASTAPI_DIR% && venv\Scripts\activate && python -m uvicorn main:app --host 0.0.0.0 --port 8000"

:: Lancer Expo en mode LAN (Reseau Local)
start "AgroPilot-FRONTEND" cmd /k "cd /d %REACT_DIR% && npx expo start --lan --web"

:: ─────────────────────────────────────────────────────────────
:: 4. Resume
:: ─────────────────────────────────────────────────────────────
echo.
echo  =======================================================
echo   PRET POUR LA DEMO !
echo   - Serveur API : http://%MY_IP%:8000
echo   - Mode : LAN (iPhone et PC sur le MEME Wi-Fi)
echo  =======================================================
echo.
pause