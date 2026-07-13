"""
EA Patch Scraper (Step 1)
=========================

Ce script a pour but d'extraire les notes de mise à jour officielles d'Apex Legends
directement depuis le site d'EA (Electronic Arts).

Comment ça marche :
-------------------
1. Chargement des Saisons : Il lit les dates de début et de fin de chaque saison
   depuis les fichiers JSON locaux dans `src/data/seasons/`.
2. Calcul des Périodes : Pour chaque saison (ou demi-saison), il calcule une fenêtre
   de temps (ex: 7 jours avant le début de la saison jusqu'à quelques jours avant la fin)
   pour cibler les patch notes correspondants.
3. Scraping de l'Index EA : Il parcourt les pages d'actualités d'EA 
   (`.../news?type=game-updates`). Le site EA étant une application web dynamique, 
   les données ne sont pas dans le texte HTML classique, mais cachées sous forme de JSON 
   dans les balises `<script>`. Le script extrait ce JSON pour trouver les dates 
   et les liens (slugs) des articles.
4. Scraping des Articles : Si un article tombe dans la bonne période temporelle, il télécharge
   la page de l'article, extrait le corps du texte (toujours via le JSON de la page), et isole 
   uniquement les sections concernant les "Légendes" en analysant les titres Markdown 
   (ex: `# LÉGENDES`).
5. Sauvegarde : Le texte brut extrait est sauvegardé dans le dossier `debug/` sous 
   le nom `season_{id}_ea.txt`.

Ce script est idéal pour récupérer les textes "officiels" et exhaustifs des développeurs.
"""
import os
import json
import argparse
import requests
import re
from datetime import datetime, timedelta
from bs4 import BeautifulSoup

# Dossiers d'entrée (les saisons) et de sortie (les fichiers txt générés)
SEASONS_DIR = "src/data/seasons"
DEBUG_DIR = "debug"

# En-tête HTTP classique pour se faire passer pour un navigateur standard
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

# Crée le dossier debug s'il n'existe pas encore
os.makedirs(DEBUG_DIR, exist_ok=True)

def load_json(filepath):
    # Charge un fichier JSON s'il existe, retourne None sinon
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def parse_date(date_str):
    # EA utilise parfois des suffixes anglais (1st, 2nd, 3rd, 4th). 
    # Cette Regex (expression régulière) retire ces lettres pour nettoyer la date.
    try:
        clean_date = re.sub(r'(?<=\d)(st|nd|rd|th)\b', '', date_str)
        # Convertit la chaîne de caractères nettoyée en un vrai objet "datetime" Python
        return datetime.strptime(clean_date, "%B %d, %Y")
    except Exception as e:
        return None

def extract_ea_legends_section(markdown):
    # Divise le texte markdown complet en un tableau de lignes
    lines = markdown.split('\n')
    extracted = []
    in_legends = False
    level = 0
    
    for line in lines:
        upper = line.upper()
        # Détecte si la ligne est un titre Markdown (commence par '#')
        if line.startswith('#'):
            # Calcule le niveau du titre (le nombre de '#')
            lvl = len(line) - len(line.lstrip('#'))
            
            # Si on était déjà dans la section Légendes, et qu'on rencontre 
            # un titre de niveau supérieur ou égal (ex: on passe de ### à ##), 
            # ça veut dire qu'on sort de la section Légendes.
            if in_legends and lvl <= level:
                in_legends = False
                
            # Si le titre contient "LEGEND" ou "LÉGENDE", on y entre !
            # "APEX" n'est pas autorisé pour éviter "Apex Legends" en titre global
            if ('LEGEND' in upper or 'LÉGENDE' in upper) and 'APEX' not in upper:
                in_legends = True
                level = lvl
                extracted.append(line)
                continue
                
        # Si on est à l'intérieur de la section Légendes, on sauvegarde la ligne
        if in_legends:
            extracted.append(line)
            
    # Rejoint toutes les lignes extraites en un seul gros texte
    return '\n'.join(extracted)

def scrape_ea_season_patches(target_start, target_end):
    print(f"[Step 1 - EA Scraper] Searching Game Updates between {target_start.date()} and {target_end.date()}...")
    
    page = 1
    gathered_texts = []
    
    # On va parcourir les pages de la liste des news EA, jusqu'à 20 pages max
    while page <= 20:
        url = f"https://www.ea.com/en-us/games/apex-legends/news?page={page}&type=game-updates"
        try:
            # Récupère le code de la page d'actualités
            r = requests.get(url, headers=HEADERS, timeout=30)
            r.encoding = r.apparent_encoding
            soup = BeautifulSoup(r.text, 'html.parser')
            
            found_any = False
            # Recherche dans toutes les balises <script> de la page
            for s in soup.find_all('script'):
                # Le site d'EA (Next.js) stocke toutes les métadonnées dans un gros objet JSON.
                if s.string and '"props":' in s.string:
                    data = json.loads(s.string)
                    # Navigue dans l'arborescence JSON pour atteindre les articles ('items')
                    items = data.get('props', {}).get('pageProps', {}).get('newsDataFallback', {}).get('items', [])
                    
                    # Pour chaque article trouvé sur cette page
                    for item in items:
                        pub_date_str = item.get('publishingDate')
                        if not pub_date_str: continue
                        
                        try:
                            # Tente de convertir la date de publication au format standard
                            pub_date = datetime.strptime(pub_date_str[:10], "%Y-%m-%d")
                        except:
                            continue
                            
                        # Si on est tombé sur des articles PLUS VIEUX que notre date de début ciblée, 
                        # on peut arrêter complètement la recherche, car les pages sont triées par date.
                        if pub_date < target_start:
                            print(f"[EA Scraper] Reached older articles ({pub_date.date()}). Stopping.")
                            return "\n\n".join(gathered_texts)
                            
                        # Si l'article tombe exactement dans notre fenêtre cible de la saison
                        if target_start <= pub_date <= target_end:
                            title = item.get('title', '')
                            slug = item.get('slug')
                            print(f"[EA Scraper] Found matching patch: '{title}' ({pub_date.date()})")
                            
                            # Télécharge la vraie page de l'article spécifique
                            ar = requests.get(f"https://www.ea.com/en-us/games/apex-legends/news/{slug}", headers=HEADERS)
                            ar.encoding = ar.apparent_encoding
                            asoup = BeautifulSoup(ar.text, 'html.parser')
                            
                            # Même logique : on trouve le composant script pour extraire le corps de texte (body)
                            for as_script in asoup.find_all('script'):
                                if as_script.string and '"props":' in as_script.string:
                                    adata = json.loads(as_script.string)
                                    target_body = adata['props']['pageProps']['articleDetailsFallback']['body']
                                    
                                    # Extrait seulement la section "Légendes" de ce grand texte
                                    legends_section = extract_ea_legends_section(target_body)
                                    if legends_section.strip():
                                        # Formate le titre et ajoute les notes trouvées
                                        gathered_texts.append(f"--- EA Patch: {title} ({pub_date.date()}) ---\n{legends_section}")
                            found_any = True
        except Exception as e:
            print(f"[EA Scraper] Error on page {page}: {e}")
            
        page += 1 # Passe à la page suivante (ex: page=2, page=3...)
        
    return "\n\n".join(gathered_texts)

def main():
    # Parcourt tous les fichiers JSON décrivant les saisons
    for filename in os.listdir(SEASONS_DIR):
        if not filename.endswith('.json'): continue
        season_file = os.path.join(SEASONS_DIR, filename)
        
        # Récupère l'ID de la saison (ex: "season_20.json" -> "20")
        season_id = filename.replace('season_', '').replace('.json', '')
        
        season_data = load_json(season_file)
        if not season_data: continue
        
        # Transforme les dates stockées dans le JSON en "datetime"
        start_date = parse_date(season_data.get("start_date", ""))
        end_date = parse_date(season_data.get("end_date", ""))
        if not start_date or not end_date: continue
        
        # Calcule le point médian de la saison pour la diviser en 2 "splits"
        mid_date = start_date + (end_date - start_date) / 2
        
        # Si c'est le "split 1" (ex: season_22_1.json)
        if filename.endswith('_1.json'):
            # On cherche les patchs de 7 jours AVANT le lancement, jusqu'au milieu de saison
            target_start = start_date - timedelta(days=7)
            target_end = mid_date
            
        # Si c'est le "split 2"
        elif filename.endswith('_2.json'):
            # On cherche du milieu de saison jusqu'à 2 jours avant la fin
            target_start = mid_date + timedelta(days=1)
            target_end = end_date - timedelta(days=2)
            
        # Si c'est une saison complète sans split
        else:
            target_start = start_date - timedelta(days=7)
            target_end = end_date - timedelta(days=2)
        
        # Lance le scraping avec cette fenêtre de temps
        ea_text = scrape_ea_season_patches(target_start, target_end)
        
        # Sauvegarde le résultat dans le dossier debug/
        out_path = os.path.join(DEBUG_DIR, f"season_{season_id}_ea.txt")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(ea_text)
            
        print(f"[SUCCESS] EA raw data saved to {out_path}\n")

if __name__ == "__main__":
    main()
