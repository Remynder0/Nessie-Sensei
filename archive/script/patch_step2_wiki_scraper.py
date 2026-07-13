"""
Wiki.gg Patch Scraper (Step 2)
==============================

Ce script a pour but d'extraire l'historique des modifications (patch notes)
pour chaque Légende directement depuis le wiki communautaire (apexlegends.wiki.gg).

Comment ça marche :
-------------------
1. Chargement des Légendes : Il liste toutes les légendes existantes à partir 
   des fichiers JSON locaux dans `public/data/legends/`.
2. API MediaWiki : Au lieu de simuler un navigateur (ce qui risquerait de 
   déclencher les protections anti-bot Cloudflare), le script interroge directement 
   l'API `parse` native de MediaWiki pour obtenir le code HTML brut de la page.
3. Analyse HTML (BeautifulSoup) : Il cherche spécifiquement la section "Patches" 
   ou "Patch History" de la page. Il parcourt ensuite les listes et tableaux 
   historiques pour extraire les noms/dates des patchs et la liste à puces des détails.
4. Répartition par Saison : Tout comme le scraper EA, il lit les dates des saisons 
   dans `src/data/seasons/` et filtre tous les patchs récupérés pour les trier 
   dans la bonne fenêtre de temps correspondant à la saison.
5. Sauvegarde : Les patchs récupérés et formatés sont sauvegardés dans le dossier `debug/` 
   sous le nom `season_{id}_wiki.txt`.

Ce script est particulièrement utile car la communauté du Wiki "nettoie" 
le texte brut d'EA en changements de statistiques très clairs (ex: cooldown 10s -> 15s).
"""
import os
import json
import re
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from bs4 import BeautifulSoup
import time

# Définition des chemins
LEGENDS_DIR = "public/data/legends"
SEASONS_DIR = "src/data/seasons"
DEBUG_DIR = "debug"

# Crée le dossier debug s'il manque
os.makedirs(DEBUG_DIR, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
}

def load_json(filepath):
    # Charge le fichier JSON en dictionnaire Python
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def parse_date(date_str):
    try:
        # Nettoie "1st", "2nd", etc...
        clean_date = re.sub(r'(?<=\d)(st|nd|rd|th)\b', '', date_str)
        # Parse la date au format Mois Jour, Année
        return datetime.strptime(clean_date, "%B %d, %Y")
    except Exception:
        # Tente un second essai en cas d'erreur
        try:
             return datetime.strptime(clean_date, "%B %d, %Y")
        except Exception:
             return None

def get_legend_names():
    # Lit le dossier public/data/legends pour obtenir la liste dynamique des légendes
    legends = []
    for filename in os.listdir(LEGENDS_DIR):
        if not filename.endswith('.json'): continue
        data = load_json(os.path.join(LEGENDS_DIR, filename))
        if data:
            # Utilise la clé "name" si dispo, sinon le nom du fichier
            name = data.get('name', filename.split('.')[0])
            # Le Wiki requiert parfois une capitalisation précise (ex: Mad_Maggie)
            legends.append(name)
    return legends

def scrape_wiki_patch_history(legend_name):
    # Encodage du nom pour l'URL (ex: "Mad Maggie" devient "Mad_Maggie")
    encoded_name = urllib.parse.quote(legend_name.replace(' ', '_'))
    
    # URL magique : Utilise l'API de MediaWiki (action=parse) au lieu de charger la page web complète.
    # Cela permet de récupérer le HTML brut sans bloquer sur le vérificateur Cloudflare.
    url = f"https://apexlegends.wiki.gg/api.php?action=parse&page={encoded_name}&format=json"
    
    print(f"Scraping wiki for {legend_name}...")
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read()
            data = json.loads(html)
            
            # Vérifie si l'API a bien trouvé la page
            if 'parse' not in data or 'text' not in data['parse']:
                print(f"  [!] Failed to get parse text for {legend_name}")
                return []
            
            # Récupère le contenu HTML de la réponse de l'API
            html_content = data['parse']['text']['*']
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Recherche un en-tête HTML ayant l'ID "Patches" ou "Patch_History"
            patches_header = soup.find(id=re.compile(r'Patch(es|_History)'))
            if not patches_header:
                print(f"  [!] No Patches section found for {legend_name}")
                return []
                
            # La balise parent de l'ID est généralement le <h2>. On cherche la balise <table> qui le suit.
            h_tag = patches_header.parent
            table = h_tag.find_next_sibling('table')
            if not table:
                print(f"  [!] No table found under Patches for {legend_name}")
                return []
                
            patches = []
            
            # Dans ce tableau, chaque patch est généralement déclaré via une balise <p>, <dt>, <h3> ou <h4>
            for p_tag in table.find_all(['p', 'dt', 'h3', 'h4']):
                patch_name = p_tag.text.strip()
                # Nettoie les caractères invisibles bizarres (zero-width spaces) souvent présents sur les Wikis
                patch_name = re.sub(r'[\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069]', '', patch_name)
                
                # Retire le mot " Patch" pour ne garder que la date et la parser
                date_part = patch_name.replace(" Patch", "").strip()
                p_date = parse_date(date_part)
                if not p_date:
                    continue
                
                # Les changements réels (buffs/nerfs) sont listés dans la balise <ul> qui SUIT le titre du patch
                ul = p_tag.find_next_sibling('ul')
                # Parfois, la structure HTML est différente (balises de définitions dt/dd)
                if not ul and p_tag.name == 'dt':
                    ul = p_tag.parent.find_next_sibling('ul')
                    
                details = []
                if ul:
                    # Pour chaque puce (<li>) dans cette liste
                    for li in ul.find_all('li', recursive=False):
                        text = li.text.strip()
                        # Remplace les retours à la ligne internes par un tiret indenté propre
                        text = re.sub(r'\n+', '\n  - ', text)
                        details.append(text)
                
                # Ajoute cet ensemble de patch au tableau final
                patches.append({
                    'legend': legend_name,
                    'date': p_date,
                    'patch_name': patch_name,
                    'details': details
                })
                
            print(f"  -> Found {len(patches)} patches.")
            return patches
            
    except Exception as e:
        print(f"  [Error] Failed to scrape {legend_name}: {e}")
        return []

def scrape_all_legends():
    all_patches = []
    legends = get_legend_names()
    print(f"Found {len(legends)} legends to scrape.")
    
    # Boucle sur toutes les légendes
    for legend in legends:
        # Pause légère (0.5s) pour ne pas spammer le Wiki et éviter un blocage IP
        time.sleep(0.5)
        patches = scrape_wiki_patch_history(legend)
        all_patches.extend(patches)
        
    return all_patches

def main():
    print("[Step 2 - Wiki Scraper] Starting full wiki scrape...")
    
    # Étape 1 : Récupérer tous les patchs de l'historique complet du wiki
    all_patches = scrape_all_legends()
    print(f"\nExtracted a total of {len(all_patches)} patches from the Wiki.")
    
    print("\nDistributing patches into seasons...")
    
    # Étape 2 : Dispatcher ces patchs dans leurs fichiers de saison respectifs
    for filename in os.listdir(SEASONS_DIR):
        if not filename.endswith('.json'): continue
        season_file = os.path.join(SEASONS_DIR, filename)
        season_id = filename.replace('season_', '').replace('.json', '')
        
        season_data = load_json(season_file)
        if not season_data: continue
        
        start_date = parse_date(season_data.get("start_date", ""))
        end_date = parse_date(season_data.get("end_date", ""))
        if not start_date or not end_date: continue
        
        mid_date = start_date + (end_date - start_date) / 2
        
        # Calcul de la fenêtre temporelle exacte (identique au script EA)
        if filename.endswith('_1.json'):
            target_start = start_date - timedelta(days=7)
            target_end = mid_date
        elif filename.endswith('_2.json'):
            target_start = mid_date + timedelta(days=1)
            target_end = end_date - timedelta(days=2)
        else:
            target_start = start_date - timedelta(days=7)
            target_end = end_date - timedelta(days=2)
        
        # Garde seulement les patchs dont la date correspond à la fenêtre calculée
        valid_patches = [p for p in all_patches if target_start <= p['date'] <= target_end]
        
        # Regroupe les patchs par légende (ex: { "Ash": [patch1, patch2] })
        legends_in_season = {}
        for p in valid_patches:
            leg = p['legend']
            if leg not in legends_in_season:
                legends_in_season[leg] = []
            legends_in_season[leg].append(p)
            
        # Formate le tout dans une belle chaîne de texte
        gathered = []
        for leg, patches_for_leg in legends_in_season.items():
            text_block = f"--- WIKI PATCH HISTORY FOR {leg.upper()} ---\n"
            for vp in patches_for_leg:
                text_block += f"Patch Name: {vp['patch_name']}\n"
                for d in vp['details']:
                    text_block += f"- {d}\n"
            gathered.append(text_block)
            
        out_text = "\n\n".join(gathered)
        out_path = os.path.join(DEBUG_DIR, f"season_{season_id}_wiki.txt")
        
        # Écriture dans le fichier
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(out_text)
            
        print(f"[SUCCESS] Season {season_id} ({len(valid_patches)} patches) -> {out_path}")

if __name__ == "__main__":
    main()
