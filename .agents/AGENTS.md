# Nessie Sensei — AI Agent Guidelines

This file contains the global rules AI agents must follow when working on this Vue 3 project.

## Stack & Architecture
- **Framework**: Vue 3 with the Composition API (`<script setup lang="ts">`).
- **Styling**: Tailwind CSS + custom utility classes (`src/style.css`).
- **Typing**: strict TypeScript.
- **Routing**: no `vue-router` for now — navigation is handled by dynamic components driven by local state in `App.vue` (tab-based system).

## Front-End Development Rules

### 1. Design System & Aesthetics (Titanfall / Apex)
The interface must be striking, dark and cyberpunk, inspired by *Titanfall*'s system UIs.
- Always favor the configured Tailwind palette: `titan-cyan`, `titan-orange`, `titan-panel`, `titan-border`, `apex-red`, `apex-darker`.
- Use the **monospace** font (`font-mono`) for titles, numbers, technical labels, and any UI element meant to feel like a "terminal" or "OS".
- Use the utility classes defined in `src/style.css`, such as `.titan-beveled` (cut-corner button effect) and `.glass-panel` (semi-transparent glass effect), for containers.
- Always render important headings in uppercase (`uppercase tracking-widest`).

### 2. Internationalization (i18n)
- **Absolute rule**: NEVER hardcode user-facing strings in templates.
- Always use `$t('key.path')` inside Vue templates.
- Use `i18n.global.t('key.path')` inside TypeScript code (e.g. in `tutorial.ts`).
- Any new text key must be added **simultaneously** to `src/locales/fr.json` and `src/locales/en.json`.

### 3. Data Management
- The project relies on several JSON files containing game statistics and data (`public/Legends.json`, `public/data/legends/`, `public/data/seasons/`). These files are potentially generated/updated by external scrapers (see `archive/` and `legends_composer/`).
- Business logic (`src/logic/composer.ts`, `src/logic/packCalculator.ts`, `src/logic/syncService.ts`, etc.) must remain pure and isolated from visual components — no direct DOM/Vue dependency.

### 4. Components
- Favor small, reusable components.
- Pay close attention to animations (micro-interactions, `hover:`, `transition-all`) to keep the interface feeling "alive" (smooth transitions, border changes, subtle blinking).

### 5. Commits
- Follow the **Conventional Commits** convention documented in the project [README](../README.md#commit-convention).
- Use the scope that matches the module you're touching (`team-gen`, `legends`, `pack-calculator`, `battle-pass`, `probabilities`, `simulation`, `stats`, `sort`, `sync`, `tutorial`, `feedback`, `scraper`, `composer`).
- Use the `data` type for any change to game data files, and `i18n` for translation-only changes.
