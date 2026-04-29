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
set REACT_ENV=%REACT_DIR%\.env

:: ─────────────────────────────────────────────────────────────
:: 0. Detection de l'IP Locale (Wi-Fi)
:: ─────────────────────────────────────────────────────────────
echo [0/4] Recherche de votre adresse IP locale...

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
:: 1. Mise a jour de l'URL API dans le .env React
:: ─────────────────────────────────────────────────────────────
echo [1/4] Configuration de l'API dans React/.env...

if exist "%REACT_ENV%" (
    powershell -Command "(gc '%REACT_ENV%') -replace 'EXPO_PUBLIC_API_URL=.*', 'EXPO_PUBLIC_API_URL=http://%MY_IP%:8000' | Out-File -encoding utf8 '%REACT_ENV%'"
    echo      OK : EXPO_PUBLIC_API_URL mis a jour -> http://%MY_IP%:8000
) else (
    echo      Fichier React/.env introuvable, creation...
    echo # Supabase > "%REACT_ENV%"
    echo EXPO_PUBLIC_SUPABASE_URL=https://aluviwrteldhoqcpzmwr.supabase.co/ >> "%REACT_ENV%"
    echo EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_E120uPgfVeFkNjC-vDS45w_MUePJ91C >> "%REACT_ENV%"
    echo. >> "%REACT_ENV%"
    echo # Backend FastAPI >> "%REACT_ENV%"
    echo EXPO_PUBLIC_API_URL=http://%MY_IP%:8000 >> "%REACT_ENV%"
)

:: ─────────────────────────────────────────────────────────────
:: 2. Installation des dependances
:: ─────────────────────────────────────────────────────────────
echo [2/4] Installation des dependances...

:: Frontend React — toujours sync pour installer les packages manquants
cd /d "%REACT_DIR%"
echo      Synchronisation npm (packages manquants)...
call npm install

:: Backend Python
cd /d "%FASTAPI_DIR%"
if not exist "venv" (
    echo      Creation du venv Python...
    python -m venv venv
)

echo      Installation des packages Python (requirements.txt)...
call venv\Scripts\activate && pip install -r requirements.txt --quiet
echo      OK : packages Python installes

:: ─────────────────────────────────────────────────────────────
:: 3. Lancement des serveurs
:: ─────────────────────────────────────────────────────────────
echo [3/4] Lancement des serveurs...

:: Lancer FastAPI (Host 0.0.0.0 est CRUCIAL pour etre vu sur le reseau local)
start "AgroPilot-BACKEND" cmd /k "cd /d %FASTAPI_DIR% && venv\Scripts\activate && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Lancer Expo en mode LAN avec --clear pour vider le cache Metro (fix logo)
start "AgroPilot-FRONTEND" cmd /k "cd /d %REACT_DIR% && npx expo start --lan --clear"

:: ─────────────────────────────────────────────────────────────
:: 4. Resume
:: ─────────────────────────────────────────────────────────────
echo.
echo  =======================================================
echo   PRET POUR LA DEMO !
echo   - Serveur API : http://%MY_IP%:8000
echo   - Docs API    : http://%MY_IP%:8000/docs
echo   - Mode : LAN (telephone et PC sur le MEME Wi-Fi)
echo  =======================================================
echo.
pause
