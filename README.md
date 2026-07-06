# Nessie Sensei

**Unofficial Community Terminal for Apex Legends** — team composition, synergy analysis, probability calculations, and Heirloom progression tracking, all wrapped in an interface inspired by the **Titanfall** universe.

> ⚠️ Independent community project. Not affiliated with, sponsored by, or endorsed by Electronic Arts Inc. or Respawn Entertainment. Apex Legends and related properties are trademarks of their respective owners.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Available Scripts](#available-scripts)
- [Internationalization](#internationalization)
- [Game Data](#game-data)
- [Commit Convention](#commit-convention)
- [Contributing](#contributing)

## Features

| Module | Description |
|---|---|
| **Link & Deploy** (Team Gen) | Automatically generates the most optimal Duo/Trio compositions based on game data and algorithmic synergy logic. |
| **Legends** | Detailed gallery and profiles of all legends (class, stats, special synergies, and anti-synergies). |
| **Predictive Analysis** (Probabilities) | Calculates the mathematical chances of obtaining a rare drop based on account stats. |
| **Heirloom Tracker** | Calculates the exact progression towards the 500th legendary pack, taking into account account level, prestige, and Battle Pass progression. |
| **Battle Pass** | Archival view of season data (items, tiers) organized by season. |
| **Simulation** | Simulates scenarios related to pack opening / progression. |
| **Data Logs** (Stats) | User data history and logging. |
| **Tactical Sort** | Sorting and filtering tools for game data. |
| **Interactive Onboarding** | Guided tour (`driver.js`) showcasing the terminal's features upon first login. |
| **Synchronization** | Device synchronization code system *(currently simulated client-side, pending a real backend)*. |
| **Internationalization** | Interface available in both French and English. |

## Tech Stack

- **[Vue 3](https://vuejs.org/)** — Composition API with `<script setup>`
- **[Vite](https://vitejs.dev/)** — Build tool and development server
- **[TypeScript](https://www.typescriptlang.org/)** — Strict typing
- **[Tailwind CSS](https://tailwindcss.com/)** — Custom "Titanfall" theme (glassmorphism, beveled edges)
- **[Vue I18n](https://vue-i18n.intlify.dev/)** — Translation management
- **[driver.js](https://driverjs.com/)** — Interactive onboarding tour

## Project Structure

The project strictly separates the interface (Vue components) from the business logic (pure TypeScript, testable independently of the framework).

```text
.
├── .agents/                  # AI agent guidelines for the project (AGENTS.md)
├── archive/                  # Python scraping scripts (excluded from web deployment)
├── public/
│   ├── data/
│   │   ├── legends/           # Raw data per legend
│   │   └── seasons/           # Raw data per Battle Pass season
│   ├── images/                # Assets (legends, weapons)
│   ├── Legends.json           # Consolidated legend and synergy data
│   └── history.json           # Initial history (ignored by git, generated/updated locally)
├── src/
│   ├── assets/                 # Static images and icons
│   ├── components/
│   │   ├── tabs/                # Main application views (one tab = one feature)
│   │   ├── LegendCard.vue       # Legend display card
│   │   ├── LegendGallery.vue    # Legend gallery
│   │   ├── SyncStatus.vue       # Synchronization status indicator
│   │   └── FeedbackBubble.vue   # User feedback widget
│   ├── locales/                 # i18n translation files (fr.json, en.json)
│   ├── logic/                   # Pure business logic, framework agnostic
│   │   ├── composer.ts          # Team composition and synergy algorithms
│   │   ├── packCalculator.ts    # Heirloom pack progression calculation
│   │   ├── syncService.ts       # Cross-device sync service
│   │   ├── store.ts             # Global application state (data loading)
│   │   └── tutorial.ts          # Guided tour orchestration
│   ├── App.vue                  # Root component (tab routing, global state)
│   ├── i18n.ts                  # vue-i18n configuration
│   ├── main.ts                  # Application entry point
│   └── style.css                # Tailwind configuration and "Titanfall" utility classes
└── legends_composer/          # Internal tool (Vue + Python scripts) for game data preparation/editing
```

## Installation

**Prerequisites**: [Node.js](https://nodejs.org/) ≥ 22 and npm.

```bash
# Clone the repository
git clone <repository-url>
cd Nessie-Sensei

# Install dependencies
npm install

# Start the development server
npm run dev
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite development server with Hot Module Replacement (HMR). |
| `npm run build` | Checks types (`vue-tsc`) and then generates the production build in `dist/`. |
| `npm run preview` | Locally serves the production build for verification. |

## Internationalization

Project rule: **no user-facing text strings should be hardcoded.**

- In Vue templates: `$t('text.key')`
- In TypeScript code: `i18n.global.t('text.key')`
- Any new key must be added **simultaneously** in `src/locales/fr.json` and `src/locales/en.json`.

## Game Data

Legend data (`public/data/legends/`) and season data (`public/data/seasons/`) are consolidated in `public/Legends.json`. They are prepared and updated via Python scripts located in `archive/` and `legends_composer/`, which are not part of the deployed bundle.

## Commit Convention

This project follows the **[Conventional Commits](https://www.conventionalcommits.org/)** convention, adapted to Nessie Sensei's functional domains.

```
<type>(<scope>): <description in present tense, lowercase, no trailing period>

[optional body]

[optional footer, e.g., BREAKING CHANGE: ..., Closes #12]
```

### Types

| Type | Usage |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change with no functional impact (neither addition nor fix) |
| `style` | Formatting, visual style, Tailwind, no logic impact |
| `perf` | Performance improvement |
| `data` | Addition/update of game data (legends, seasons, `Legends.json`, `history.json`) |
| `i18n` | Addition or modification of translations |
| `docs` | Documentation (README, AGENTS.md, comments) |
| `test` | Addition or modification of tests |
| `build` | Dependencies, Vite/Tailwind/TypeScript configuration |
| `ci` | Continuous integration/deployment |
| `chore` | Miscellaneous tasks not fitting any other category |

### Suggested Scopes

Based on the application's functional modules:

`team-gen` · `legends` · `pack-calculator` · `battle-pass` · `probabilities` · `simulation` · `stats` · `sort` · `sync` · `tutorial` · `feedback` · `scraper` · `composer` (for the `legends_composer/` tool)

### Examples

```
feat(team-gen): add anti-synergy weighting in the duo generator

fix(pack-calculator): fix prestige pack calculation beyond level 400

data(legends): update Conduit's stats for season 27

i18n(battle-pass): add English translations for season 29 tiers

refactor(sync): extract code generation into a pure function

docs: rewrite README with structure and commit conventions

chore(build): update vite to v8.1
```

### Breaking Changes

A breaking change is indicated either by a `!` after the type/scope, or by a `BREAKING CHANGE:` footer:

```
refactor(store)!: rename historyData to syncedHistory

BREAKING CHANGE: components consuming `historyData` must be updated to use `syncedHistory`.
```

## Branching Strategy & Environments

This project uses three main branches for its development lifecycle and deployment via Vercel:

- **`dev`** (Development): The active development branch. All feature branches (`feat/*`, `fix/*`) are merged here.
- **`beta`** (Preview/Testing): Used for stabilizing features and pre-production testing. Pushing to this branch triggers a **Preview** deployment on Vercel.
- **`prod`** (Production): The live production branch. Pushing to this branch triggers a **Production** deployment on Vercel.

### Branch Protection Rules (Solo / Small Team)
Pour un développeur solo, le flux de travail est allégé pour rester rapide, tout en protégeant les environnements clés :
1. **`dev`** : Les push directs sont autorisés pour le créateur du projet afin d'itérer rapidement sans la lourdeur d'une Pull Request.
2. **`beta` & `prod`** : **Restreindre les push directs**. Utilisez des Pull Requests pour fusionner de `dev` vers `beta`, puis de `beta` vers `prod`. Cela sert de point de contrôle (safety check) avant de déclencher les déploiements Vercel.
3. **Exiger le passage des tests (Status checks)** (ex: `npm run build`) avant de pouvoir fusionner vers `beta` et `prod`.

## Contributing

1. Créez une branche depuis `dev` (ou poussez directement sur `dev` si vous êtes le mainteneur principal) : `git checkout -b feat/feature-name`
2. Suivez la convention de commits détaillée ci-dessus.
3. Vérifiez toujours que `npm run build` passe sans erreur avant de pousser ou d'ouvrir une PR vers `dev`.
4. N'oubliez pas de mettre à jour **les deux** fichiers `fr.json` et `en.json` si votre changement introduit du texte visible.
