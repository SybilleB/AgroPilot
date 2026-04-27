# Architecture AgroPilot — Guide complet pour l'équipe

## C'est quoi AgroPilot ?

Une app mobile React Native (Expo) + backend Python (FastAPI).  
Ce guide couvre uniquement le **frontend React Native** dans le dossier `React/`.

---

## Structure des dossiers

```
React/
│
├── app/                          ← Tous les écrans de l'app (Expo Router)
│   │
│   ├── _layout.tsx               ← Racine : garde d'auth + navigation globale
│   ├── index.tsx                 ← Landing page (non connecté)
│   ├── profile-setup.tsx         ← Wizard configuration profil (3 étapes)
│   │
│   ├── (auth)/                   ← Écrans de connexion/inscription (pas de tab bar)
│   │   ├── _layout.tsx           ← Stack navigation pour auth
│   │   ├── login.tsx             ← Connexion
│   │   └── register.tsx          ← Inscription
│   │
│   └── (app)/                    ← Zone protégée avec tab bar en bas
│       ├── _layout.tsx           ← Définit les 5 onglets du tab bar
│       ├── index.tsx             ← Tableau de bord (accueil)
│       ├── rentabilite.tsx       ← Simulation de rentabilité
│       ├── meteo.tsx             ← Météo
│       ├── subventions.tsx       ← Subventions
│       └── profile.tsx           ← Profil + sécurité + déconnexion
│
├── components/
│   └── ui/                       ← Composants réutilisables AgroPilot
│       ├── Button.tsx            ← Bouton (primary / outline / ghost + loading)
│       ├── Card.tsx              ← Carte conteneur (default / highlight / flat)
│       ├── Input.tsx             ← Champ texte avec label et message d'erreur
│       ├── PillSelect.tsx        ← Sélecteur pill (mono ou multi-sélection)
│       ├── icon-symbol.tsx       ← Icônes (SF Symbols iOS / MaterialIcons Android)
│       └── haptic-tab.tsx        ← Bouton onglet avec retour haptique
│
├── constants/
│   ├── Colors.ts                 ← Palette couleurs AgroPilot (SEULE source de vérité)
│   └── Api.ts                    ← Routes FastAPI (à compléter quand le backend sera prêt)
│
├── hooks/
│   ├── useAuth.ts                ← Session Supabase → { session, user, loading }
│   └── useProfile.ts             ← Profil complet → { fullProfile, isComplete, refresh }
│
├── services/
│   ├── supabase.ts               ← Client Supabase (singleton, à ne jamais dupliquer)
│   ├── auth.service.ts           ← register / login / logout / changeEmail / changePassword
│   ├── profile.service.ts        ← getFullProfile / saveExploitation / saveCultures
│   └── meteo.service.ts          ← À implémenter (Kelyan + Maïlys)
│
└── types/
    └── index.ts                  ← Toutes les interfaces TypeScript (Profile, Exploitation…)
```

---

## Comprendre `_layout.tsx`

**C'est une contrainte Expo Router, pas un choix.** Ce fichier s'appelle obligatoirement `_layout.tsx` — c'est comme ça que le framework sait que c'est un fichier de mise en page et non un écran normal.

| Fichier | Rôle |
|---------|------|
| `app/_layout.tsx` | Racine de l'app : garde d'auth, gestion de la session |
| `app/(auth)/_layout.tsx` | Empile login et register dans un stack (navigation arrière) |
| `app/(app)/_layout.tsx` | Définit les 5 onglets du tab bar en bas d'écran |

Les autres fichiers (`login.tsx`, `index.tsx`, etc.) sont de vrais écrans et ont des noms libres.

---

### Garde d'authentification (`app/_layout.tsx`)

```
Démarrage
    ↓
Session Supabase chargée ?
    ├── NON → écran de chargement (spinner)
    ├── Session active + sur landing/auth → redirige vers /(app)
    └── Pas de session + dans zone protégée → redirige vers /
```

**Règle importante :** après un logout, NE PAS appeler `router.replace('/')` manuellement. Le guard le fait automatiquement dès qu'il détecte que la session est nulle.

---

## Base de données (Supabase)

Schéma complet dans `../reset_schema.sql`. 4 tables :

| Table | Description |
|-------|-------------|
| `profiles` | Données personnelles (prénom, nom, téléphone, situation familiale…) |
| `exploitations` | Données de l'exploitation (surface, type, méthode, localisation…) |
| `cultures_exploitation` | Assolement : culture + surface ha + rendement moyen t/ha |
| `simulations_rentabilite` | Simulations sauvegardées (calculées par FastAPI) |

**Pour réinitialiser en dev :** coller `reset_schema.sql` dans Supabase → SQL Editor → Exécuter.

### Champs saisis par l'utilisateur vs générés par l'IA

| Champ | Qui le renseigne ? |
|-------|--------------------|
| `surface_ha` (par culture) | Utilisateur (étape 3 du wizard) |
| `rendement_moyen` (t/ha) | **Utilisateur** — il connaît ses rendements historiques. L'IA pourra les affiner plus tard en les comparant aux moyennes régionales. |
| `marge_brute`, `marge_nette` | Calculés par FastAPI à partir des données utilisateur |
| `eligible` (subventions) | Calculé par l'IA à partir du profil |

---

## Ajouter un nouvel écran

1. Créer `app/(app)/mon-ecran.tsx` (nom en **minuscules**)
2. Ajouter dans `app/(app)/_layout.tsx` :
   ```tsx
   <Tabs.Screen name="mon-ecran" options={{ title: 'Mon écran', tabBarIcon: ... }} />
   ```
3. Si besoin de nouveaux types → `types/index.ts`
4. Si besoin d'appels API → créer `services/mon-feature.service.ts`

---

## Lancer le projet

```bash
cd React/
npm install
npx expo start
```

Si VS Code affiche des erreurs rouges JSX après l'install :  
→ `Cmd+Shift+P` → **TypeScript: Restart TS Server**
