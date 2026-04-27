@echo off
setlocal enabledelayedexpansion

:: =============================================================
::  AgroPilot — Script d'installation (Windows)
::  Usage : double-clic sur setup.bat
:: =============================================================

echo.
echo  ===========================================
echo   AgroPilot - Setup Windows (IA & Cache)
echo  ===========================================
echo.

set SCRIPT_DIR=%~dp0
set REACT_DIR=%SCRIPT_DIR%React
set FASTAPI_DIR=%SCRIPT_DIR%FastAPI

:: ─────────────────────────────────────────────────────────────
:: 0. Verification des outils requis
:: ─────────────────────────────────────────────────────────────
echo [0/3] Verification des outils...

where node >nul 2>&1
if !errorlevel! neq 0 (
    echo  X Node.js n'est pas installe.
    echo    Telecharge-le sur : https://nodejs.org
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo  OK node %%v

where npm >nul 2>&1
if !errorlevel! neq 0 (
    echo  X npm n'est pas installe - normalement inclus avec Node.js.
    pause & exit /b 1
)
echo  OK npm

where python >nul 2>&1
if !errorlevel! neq 0 (
    echo  X Python n'est pas installe.
    echo    Telecharge-le sur : https://python.org
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('python --version') do echo  OK %%v

echo.

:: ─────────────────────────────────────────────────────────────
:: 1. Frontend React Native / Expo
:: ─────────────────────────────────────────────────────────────
echo [1/3] Installation du frontend React (Expo)...

if not exist "%REACT_DIR%" (
    echo  X Dossier React\ introuvable.
    pause & exit /b 1
)

:: Creer le .env si absent
if not exist "%REACT_DIR%\.env" (
    echo      Fichier .env manquant, creation depuis la racine...
    if exist "%SCRIPT_DIR%.env" (
        copy "%SCRIPT_DIR%.env" "%REACT_DIR%\.env" >nul
        echo      OK .env copie dans React\
    ) else (
        echo      X Aucun .env trouve. Cree React\.env avec Supabase.
    )
) else (
    echo      OK .env deja present
)

:: Installer les dependances npm
echo      Installation des packages npm...
cd /d "%REACT_DIR%"
call npm install
if !errorlevel! neq 0 (
    echo  X npm install a echoue.
    pause & exit /b 1
)

:: Installation specifique du Cache pour l'IA
echo      Installation du module de cache (AsyncStorage)...
call npx expo install @react-native-async-storage/async-storage

echo  OK Frontend installe avec support du Cache.
echo.

:: ─────────────────────────────────────────────────────────────
:: 2. Backend FastAPI
:: ─────────────────────────────────────────────────────────────
echo [2/3] Installation du backend FastAPI...

if not exist "%FASTAPI_DIR%" (
    echo  X Dossier FastAPI\ introuvable.
    pause & exit /b 1
)

cd /d "%FASTAPI_DIR%"

:: Creer le venv s'il est absent
if not exist "venv\Scripts\activate.bat" (
    echo      Creation du venv Python...
    python -m venv venv
    if !errorlevel! neq 0 (
        echo  X Impossible de creer le venv.
        pause & exit /b 1
    )
)

:: Activer le venv et installer les dependances
echo      Activation du venv et installation des packages...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
if !errorlevel! neq 0 (
    echo  X pip install a echoue.
    pause & exit /b 1
)
call venv\Scripts\deactivate.bat
echo  OK Backend installe
echo.

:: ─────────────────────────────────────────────────────────────
:: 3. Resume & commandes de lancement
:: ─────────────────────────────────────────────────────────────
echo [3/3] Installation terminee !
echo.
echo  =======================================================
echo   Commandes pour lancer le projet
echo  =======================================================
echo.
echo  1. Backend (FastAPI) - Mode Demo active :
echo     cd FastAPI
echo     venv\Scripts\activate
echo     python -m uvicorn main:app --host 0.0.0.0 --port 8000
echo.
echo  2. Frontend (Expo) - Cache AsyncStorage pret :
echo     cd React
echo     npx expo start --tunnel
echo.
echo  Note : L'option --tunnel est recommandee pour eviter 
echo  les problemes de reseau local sur mobile.
echo  =======================================================
echo.
pause