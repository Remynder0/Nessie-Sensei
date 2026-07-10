# Guide de Référencement (SEO) - Nessie-Sensei

Ce document récapitule toutes les actions techniques déjà mises en place dans le code de l'application, ainsi que les étapes manuelles que vous devrez suivre pour lancer officiellement l'indexation de votre site sur Google.

---

## 1. Ce qui est DÉJÀ fait dans le code (Base technique)

L'application a été préparée pour être "Google-friendly" avec les éléments suivants :

- **`index.html`** : 
  - Le titre a été optimisé : `<title>Nessie-Sensei | Statistiques, Légendes et Patchs Apex Legends</title>`.
  - Ajout des balises `<meta name="description">` et `<meta name="keywords">`.
  - Ajout des balises **OpenGraph** et **Twitter Cards** pour que le logo du site s'affiche lors d'un partage de lien (sur Discord, Twitter, etc.).
- **`public/robots.txt`** : Fichier autorisant formellement les robots de Google à parcourir tout le site.
- **`public/sitemap.xml`** : Fichier listant l'URL principale pour orienter les robots.
- **`src/App.vue`** : Ajout d'une balise de texte cachée (via la classe CSS `.sr-only`) dans le grand titre `<h1>`. Cela permet d'inclure les mots clés importants "Apex Legends Tracker & Stats" pour Google sans altérer votre design.

> **Note :** Le `sitemap.xml` restera statique car le site fonctionne comme une "Single Page Application" (SPA) sur une URL unique. S'il y a un jour de vraies sous-pages (ex: `/legends/ash`), il faudra ajouter un générateur automatique de sitemap (comme `vite-plugin-sitemap`).

---

## 2. Ce qu'il vous reste à faire (Lancement Google)

Quand vous estimerez que votre site est **100% prêt à être utilisé par le public**, suivez ces étapes pour demander à Google d'indexer "Nessie-Sensei".

### Étape 1 : Connexion
1. Allez sur **[Google Search Console](https://search.google.com/search-console/)** et connectez-vous avec votre compte Google.

### Étape 2 : Ajouter la propriété
1. Google vous demandera d'ajouter une propriété. Choisissez l'encart de droite : **Préfixe de l'URL**.
2. Saisissez l'adresse exacte de votre site Vercel (ex: `https://nessie-sensei.vercel.app/`) et cliquez sur **Continuer**.
3. **Validation :** Étant hébergé sur Vercel, la validation est souvent automatique. S'il vous demande de prouver que le site est à vous, choisissez l'option **"Balise HTML"**, copiez le code fourni, et ajoutez-le dans le `<head>` de votre fichier `index.html` avant de faire un nouveau déploiement.

### Étape 3 : Soumettre le Sitemap
1. Dans le menu de gauche, cliquez sur **Sitemaps**.
2. Dans le champ *"Ajouter un sitemap"*, tapez simplement `sitemap.xml` (la première partie de l'URL est déjà remplie) et cliquez sur **Envoyer**.
3. Google va confirmer qu'il a bien lu le fichier et qu'il a trouvé 1 URL valide.

### Étape 4 : Forcer l'indexation (Le plus important)
1. Tout en haut de la page de la Search Console, utilisez la grande barre de recherche grisée *"Inspecter une URL"*.
2. Tapez l'adresse de votre site (ex: `https://nessie-sensei.vercel.app/`) et appuyez sur Entrée.
3. Après un court chargement, la page affichera sûrement *"L'URL n'est pas sur Google"*.
4. Cliquez sur le bouton gris **Demander l'indexation** (Request Indexing).
5. Google placera alors votre site dans sa file d'attente prioritaire pour l'analyser.

### Étape 5 : Patience
Il faut généralement entre **24 heures et une semaine** pour que Google ajoute officiellement le site à sa base de données. Vous pourrez alors tester en tapant "Nessie-Sensei" dans le moteur de recherche !

---

## 3. Limites et Serveur Vercel (Rappel)
- Le référencement naturel amènera potentiellement du trafic, mais l'offre gratuite "Hobby" de Vercel (100 Go de bande passante, 250 Mo de Vercel Blob) est largement suffisante pour des milliers de visites par mois.
- La règle ajoutée dans `vercel.json` annule automatiquement les compilations Vercel sur les branches de développement (nommées `dev` ou commençant par `dev*`), économisant ainsi vos heures de build.
