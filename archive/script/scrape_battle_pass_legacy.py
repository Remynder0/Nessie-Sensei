import cloudscraper
from bs4 import BeautifulSoup
import json
import time
import re

all_seasons_data = {}

# Scraper pour passer Cloudflare
scraper = cloudscraper.create_scraper(browser={
    'browser': 'chrome',
    'platform': 'windows',
    'desktop': True
})

for season in range(1, 23): # De la saison 1 à 22
    print(f"Récupération de la Saison {season}...")
    url = f"https://apexlegends.fandom.com/wiki/Season_{season}"
    
    try:
        response = scraper.get(url)
        season_rewards = []
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            tables = soup.find_all('table')
            bp_table = None
            
            # Détection du tableau : On cherche un tableau qui contient un mélange 
            # de mots-clés du passe de combat OU qui est tout simplement très long.
            for table in tables:
                text_content = table.get_text().lower()
                # On ratisse large pour être sûr de l'attraper (anciennes et nouvelles saisons)
                if ('premium' in text_content or 'free' in text_content) and len(table.find_all('tr')) > 30:
                    bp_table = table
                    break
            
            if bp_table:
                rows = bp_table.find_all('tr')
                
                for row in rows:
                    cells = row.find_all(['th', 'td'])
                    if not cells:
                        continue
                    
                    # On va chercher quelle colonne contient le numéro du niveau.
                    # Au lieu de supposer que c'est la colonne 0, on les teste.
                    level_num = None
                    premium_text = ""
                    free_text = ""
                    
                    for i, cell in enumerate(cells):
                        # Nettoyage brutal de la case pour extraire juste le texte
                        cell_text = cell.get_text(separator=' ', strip=True)
                        cell_text = re.sub(r'\s+', ' ', cell_text).strip()
                        
                        # Si on n'a pas encore trouvé le niveau, on regarde si cette case en est un
                        if not level_num:
                            match = re.search(r'^(\d+)', cell_text)
                            if match:
                                num = int(match.group(1))
                                if 1 <= num <= 110: # On s'assure que c'est bien un niveau de Passe
                                    level_num = str(num)
                                    
                                    # Une fois le niveau trouvé, les colonnes suivantes sont les loots
                                    # S'il y a une case d'icône "Obtained", ça décale, donc on prend i+1 et i+2
                                    if i + 1 < len(cells):
                                        premium_text = cells[i+1].get_text(separator=' ', strip=True)
                                        premium_text = re.sub(r'\s+', ' ', premium_text).strip()
                                    if i + 2 < len(cells):
                                        free_text = cells[i+2].get_text(separator=' ', strip=True)
                                        free_text = re.sub(r'\s+', ' ', free_text).strip()
                                    break # On a trouvé le niveau et les loots, on passe à la ligne suivante
                    
                    if level_num:
                        season_rewards.append({
                            "Level": level_num,
                            "Premium Rewards": premium_text,
                            "Free Rewards": free_text
                        })
                        
            all_seasons_data[f"Season_{season}"] = season_rewards
            
            if not season_rewards:
                print(f" -> ⚠️ Avertissement : Le tableau a été trouvé mais aucune donnée de niveau (1-110) n'a été lue pour la saison {season}.")
            else:
                print(f" -> ✅ {len(season_rewards)} niveaux récupérés avec succès.")
                
        else:
            print(f" -> ❌ Erreur HTTP {response.status_code}")
            
    except Exception as e:
        print(f" -> ❌ Erreur : {e}")
        
    # Pause longue pour la stabilité (5 secondes)
    time.sleep(5)

output_filename = "apex_battle_pass_full.json"
with open(output_filename, "w", encoding="utf-8") as f:
    json.dump(all_seasons_data, f, indent=4, ensure_ascii=False)

print(f"\n🎉 Terminé ! Les données ont été sauvegardées dans le fichier : {output_filename}")