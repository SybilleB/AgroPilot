#!/bin/bash

# =============================================================
#  AgroPilot — Script d'installation complet (Linux / macOS)
#  Usage : chmod +x setup.sh && ./setup.sh
# =============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REACT_DIR="$SCRIPT_DIR/React"
FASTAPI_DIR="$SCRIPT_DIR/FastAPI"
REACT_ENV="$REACT_DIR/.env"

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       🌾  AgroPilot — Setup           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
echo ""

# ─────────────────────────────────────────────────────────────
# 0. Vérification des outils requis
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[0/4] Vérification des outils...${NC}"

check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}✗ '$1' n'est pas installé.${NC}"
    case "$1" in
      node) echo "    → https://nodejs.org" ;;
      python3) echo "    → https://python.org" ;;
    esac
    exit 1
  else
    echo -e "${GREEN}✓ $1 $(command "$1" --version 2>&1 | head -1)${NC}"
  fi
}

check_command node
check_command npm
check_command python3

echo ""

# ─────────────────────────────────────────────────────────────
# 1. Configuration IP dans React/.env
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[1/4] Configuration de l'IP dans React/.env...${NC}"

# Détecter l'IP locale Wi-Fi (macOS / Linux)
MY_IP=""
if command -v ipconfig &> /dev/null; then
  # macOS
  MY_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
elif command -v ip &> /dev/null; then
  # Linux
  MY_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}' || echo "")
fi

if [ -z "$MY_IP" ]; then
  echo -e "${YELLOW}    IP non détectée automatiquement.${NC}"
  read -p "    Entrez votre IP locale (ex: 192.168.1.10) : " MY_IP
fi
echo -e "${GREEN}    ✓ IP détectée : $MY_IP${NC}"

if [ -f "$REACT_ENV" ]; then
  # Remplace EXPO_PUBLIC_API_URL avec la nouvelle IP
  sed -i.bak "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=http://$MY_IP:8000|" "$REACT_ENV" && rm -f "$REACT_ENV.bak"
  echo -e "${GREEN}    ✓ EXPO_PUBLIC_API_URL → http://$MY_IP:8000${NC}"
else
  echo "# Supabase"                                                               > "$REACT_ENV"
  echo "EXPO_PUBLIC_SUPABASE_URL=https://aluviwrteldhoqcpzmwr.supabase.co/"     >> "$REACT_ENV"
  echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_E120uPgfVeFkNjC-vDS45w_MUePJ91C" >> "$REACT_ENV"
  echo ""                                                                         >> "$REACT_ENV"
  echo "# Backend FastAPI"                                                        >> "$REACT_ENV"
  echo "EXPO_PUBLIC_API_URL=http://$MY_IP:8000"                                  >> "$REACT_ENV"
  echo -e "${GREEN}    ✓ React/.env créé${NC}"
fi

echo ""

# ─────────────────────────────────────────────────────────────
# 2. Frontend React Native / Expo
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/4] Installation des packages npm (React)...${NC}"
cd "$REACT_DIR"
npm install
echo -e "${GREEN}✓ Frontend installé${NC}"
echo ""

# ─────────────────────────────────────────────────────────────
# 3. Backend FastAPI
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/4] Installation du backend FastAPI...${NC}"
cd "$FASTAPI_DIR"

if [ ! -f "venv/bin/activate" ]; then
  echo -e "${YELLOW}    → Création du venv Python...${NC}"
  python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip --quiet
echo -e "${YELLOW}    → Installation des packages Python (requirements.txt)...${NC}"
pip install -r requirements.txt --quiet
deactivate
echo -e "${GREEN}✓ Backend installé${NC}"
echo ""

# ─────────────────────────────────────────────────────────────
# 3b. Vérification du .env FastAPI (clés API)
# ─────────────────────────────────────────────────────────────
FASTAPI_ENV="$FASTAPI_DIR/.env"
if [ ! -f "$FASTAPI_ENV" ]; then
  echo -e "${RED}⚠  FastAPI/.env introuvable !${NC}"
  echo -e "${YELLOW}    Créez le fichier FastAPI/.env avec ces clés :${NC}"
  echo "      GROQ_API_KEY=...      (console.groq.com — gratuit)"
  echo "      TAVILY_API_KEY=...    (app.tavily.com — gratuit)"
  echo "      GOOGLE_API_KEY=...    (aistudio.google.com — fallback optionnel)"
  echo ""
  read -p "    Appuyez sur Entrée pour continuer quand même... " _
else
  MISSING=""
  grep -q "GROQ_API_KEY"   "$FASTAPI_ENV" || MISSING="$MISSING GROQ_API_KEY"
  grep -q "TAVILY_API_KEY" "$FASTAPI_ENV" || MISSING="$MISSING TAVILY_API_KEY"
  if [ -n "$MISSING" ]; then
    echo -e "${YELLOW}⚠  Clés manquantes dans FastAPI/.env :$MISSING${NC}"
  else
    echo -e "${GREEN}✓ FastAPI/.env présent et complet${NC}"
  fi
fi
echo ""

# ─────────────────────────────────────────────────────────────
# 4. Lancement des serveurs
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[4/4] Lancement des serveurs...${NC}"

# Backend dans un terminal séparé
cd "$FASTAPI_DIR"
if command -v gnome-terminal &> /dev/null; then
  gnome-terminal -- bash -c "source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload; exec bash"
elif command -v osascript &> /dev/null; then
  # macOS
  osascript -e "tell app \"Terminal\" to do script \"cd '$FASTAPI_DIR' && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload\""
else
  echo -e "${YELLOW}    Lance manuellement le backend :${NC}"
  echo "    cd FastAPI && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
fi

# Frontend avec --clear pour vider le cache (fix logo Expo)
cd "$REACT_DIR"
if command -v gnome-terminal &> /dev/null; then
  gnome-terminal -- bash -c "npx expo start --lan --clear; exec bash"
elif command -v osascript &> /dev/null; then
  osascript -e "tell app \"Terminal\" to do script \"cd '$REACT_DIR' && npx expo start --lan --clear\""
else
  echo -e "${YELLOW}    Lance manuellement le frontend :${NC}"
  echo "    cd React && npx expo start --lan --clear"
fi

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              PRÊT POUR LA DÉMO !                     ║${NC}"
echo -e "${BLUE}║                                                       ║${NC}"
echo -e "${BLUE}║${NC}  Serveur API  : ${GREEN}http://$MY_IP:8000${NC}               ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  Docs API     : ${GREEN}http://$MY_IP:8000/docs${NC}           ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  Mode : LAN (téléphone et PC sur le même Wi-Fi)   ${BLUE}║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
