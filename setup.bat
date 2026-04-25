@echo off
echo ===========================================
echo   INSTALLATION DES DEPENDANCES D'AGROPILOT
echo ===========================================


echo [1/4] Acces au dossier fastAPI
cd fastAPI

echo [2/4] Creation de l'environnement virtuel
python -m venv venv

echo [3/4] Installation des librairies (cela peut prendre une minute)
call .\venv\Scripts\activate
pip install -r requirements.txt

echo.
echo ===========================================
echo   INSTALLATION TERMINEE
echo   Le serveur va se lancer
echo   1. Verifiez : http://localhost:8000
echo   2. Swagger Docs : http://127.0.0.1:8000/docs
echo ===========================================
echo.

echo [4/4] Lancement du serveur
uvicorn main:app --reload --host 0.0.0.0 --port 8000