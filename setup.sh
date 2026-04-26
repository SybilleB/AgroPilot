#!/bin/bash

# =============================================================
#  AgroPilot — Script d'installation complet
#  Usage : chmod +x setup.sh && ./setup.sh
# =============================================================

set -e  # Arrête le script si une commande échoue

# ── Couleurs ──────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       🌾  AgroPilot — Setup           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
echo ""

# ─────────────────────────────────────────────────────────────
# 0. Vérification des outils requis
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[0/3] Vérification des outils...${NC}"

check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}✗ '$1' n'est pas installé. Installe-le puis relance ce script.${NC}"
    case "$1" in
      node) echo "    → https://nodejs.org" ;;
      python3) echo "    → https://python.org" ;;
      npm) echo "    → Inclus avec Node.js" ;;
    esac
    exit 1
  else
    echo -e "${GREEN}✓ $1 ($(command "$1" --version 2>&1 | head -1))${NC}"
  fi
}

check_command node
check_command npm
check_command python3

echo ""

# ─────────────────────────────────────────────────────────────
# 1. Frontend React Native / Expo
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[1/3] Installation du frontend React (Expo)...${NC}"

REACT_DIR="$SCRIPT_DIR/React"

if [ ! -d "$REACT_DIR" ]; then
  echo -e "${RED}✗ Dossier React/ introuvable.${NC}"
  exit 1
fi

# Créer le .env si absent
if [ ! -f "$REACT_DIR/.env" ]; then
  echo -e "${YELLOW}    → Fichier .env manquant, création depuis la racine...${NC}"
  if [ -f "$SCRIPT_DIR/.env" ]; then
    cp "$SCRIPT_DIR/.env" "$REACT_DIR/.env"
    echo -e "${GREEN}    ✓ .env copié dans React/${NC}"
  else
    echo -e "${RED}    ✗ Aucun .env trouvé. Crée React/.env avec :${NC}"
    echo "         EXPO_PUBLIC_SUPABASE_URL=..."
    echo "         EXPO_PUBLIC_SUPABASE_ANON_KEY=..."
  fi
else
  echo -e "${GREEN}    ✓ .env déjà présent${NC}"
fi

# Installer les dépendances npm
echo -e "${YELLOW}    → Installation des packages npm...${NC}"
cd "$REACT_DIR"
npm install
echo -e "${GREEN}✓ Frontend installé${NC}"
echo ""

# ─────────────────────────────────────────────────────────────
# 2. Backend FastAPI
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/3] Installation du backend FastAPI...${NC}"

FASTAPI_DIR="$SCRIPT_DIR/FastAPI"

if [ ! -d "$FASTAPI_DIR" ]; then
  echo -e "${RED}✗ Dossier FastAPI/ introuvable.${NC}"
  exit 1
fi

cd "$FASTAPI_DIR"

# Recréer le venv s'il est vide ou absent
if [ ! -f "venv/bin/activate" ]; then
  echo -e "${YELLOW}    → Création du venv Python...${NC}"
  python3 -m venv venv
fi

# Activer le venv et installer les dépendances
echo -e "${YELLOW}    → Activation du venv et installation des packages...${NC}"
source venv/bin/activate
pip install --upgrade pip --quiet

# Supprimer les packages Windows-only incompatibles avec macOS/Linux
python3 -c "
import sys
path = 'requirements.txt'
lines = open(path).readlines()
windows_only = ['pywinpty']
clean = [l for l in lines if not any(l.startswith(p + '==') for p in windows_only)]
removed = len(lines) - len(clean)
open(path, 'w').writelines(clean)
if removed: print(f'  → {removed} package(s) Windows-only ignoré(s)')
"

pip install -r requirements.txt --quiet
deactivate
echo -e "${GREEN}✓ Backend installé${NC}"
echo ""

# ─────────────────────────────────────────────────────────────
# 3. Résumé & commandes de lancement
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/3] Installation terminée !${NC}"
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Commandes pour lancer le projet          ║${NC}"
echo -e "${BLUE}╠═══════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}Frontend (Expo)${NC}                                       ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}    cd React && npx expo start                          ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}                                                        ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}Backend (FastAPI)${NC}                                     ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}    cd FastAPI                                           ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}    source venv/bin/activate                             ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}    uvicorn main:app --reload                            ${BLUE}║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  API docs disponibles sur : ${GREEN}http://localhost:8000/docs${NC}"
echo ""
