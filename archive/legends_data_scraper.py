import os
import json
import sys
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://apexlegends.wiki.gg"
DATA_FILE = "public/Legends.json"
OUT_DIR = "public/data/legends"

os.makedirs(OUT_DIR, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://apexlegends.wiki.gg/'
}



def scrape_legends_data():
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        legends = json.load(f)['Legends']
        
    for idx, legend in enumerate(legends):
        name = legend['Name']
        print(f"[{idx+1}/{len(legends)}] Processing Data for {name}...")
        
        url_name = name.replace(' ', '_')
        url = f"{BASE_URL}/wiki/{url_name}"
        
        try:
            r = requests.get(url, headers=HEADERS)
            html = r.text
        except Exception as e:
            print(f"Failed to get HTML for {name}: {e}")
            continue
            
        soup = BeautifulSoup(html, 'html.parser')
        infobox = soup.find(class_='infobox')
        
        data_extracted = {}
        if infobox:
            for tr in infobox.find_all('tr'):
                th = tr.find('th')
                td = tr.find('td')
                if th and td:
                    data_extracted[th.text.strip()] = td.text.strip()
        
        # Extract Lore
        bio_text = ""
        lore_heading = soup.find(id='Lore')
        if lore_heading and lore_heading.parent:
            curr = lore_heading.parent.find_next_sibling()
            bio_lines = []
            while curr and curr.name not in ['h2', 'h3']:
                if curr.name == 'table':
                    for td in curr.find_all('td'):
                        if td.text.strip() and len(td.text.strip()) > 20: # avoid short random chars
                            bio_lines.append(td.text.strip())
                elif curr.name == 'p':
                    if curr.text.strip():
                        bio_lines.append(curr.text.strip())
                curr = curr.find_next_sibling()
            bio_text = "\n\n".join(bio_lines)

        # Extract Abilities details
        ability_details = {
            "Passive": {"name": data_extracted.get("Passive Ability", ""), "description": "", "cooldown": ""},
            "Tactical": {"name": data_extracted.get("Tactical Ability", ""), "description": "", "cooldown": ""},
            "Ultimate": {"name": data_extracted.get("Ultimate Ability", ""), "description": "", "cooldown": ""}
        }

        for table in soup.find_all('table', class_='ability'):
            type_th = table.find('th', style=lambda value: value and 'text-transform:uppercase' in value.replace(' ', ''))
            if not type_th:
                # Some tables might not have the exact style, try by text
                type_th = table.find(lambda t: t.name == 'th' and t.text.strip() in ['Tactical', 'Passive', 'Ultimate'])
            
            if not type_th:
                continue
            
            a_type_raw = type_th.text.strip().lower()
            a_type = "Passive" if "passive" in a_type_raw else "Tactical" if "tactical" in a_type_raw else "Ultimate" if "ultimate" in a_type_raw else None
            
            if not a_type:
                continue
                
            rows = table.find_all('tr')
            for row in rows:
                th = row.find('th')
                td = row.find('td')
                
                # The name is often in a th spanning multiple columns with large font
                if th and not td and '1.5em' in th.get('style', ''):
                    ability_details[a_type]["name"] = th.text.strip()
                elif th and th.text.strip() == 'Description':
                    ability_details[a_type]["description"] = td.text.strip() if td else ''
                elif th and th.text.strip() in ['Cooldown', 'Charge time']:
                    cd_text = td.text.strip() if td else ''
                    if cd_text == '?':
                        cd_text = ''
                    ability_details[a_type]["cooldown"] = cd_text

        # Extract Patch History
        patch_history = []
        hist_heading = soup.find(id='History')
        if hist_heading and hist_heading.parent:
            hist_table = hist_heading.parent.find_next_sibling('table')
            if hist_table:
                dts = hist_table.find_all('dt')
                for dt in dts:
                    patch_name = dt.text.strip()
                    ul = dt.find_next_sibling('ul')
                    if not ul:
                        ul = dt.parent.find_next_sibling('ul')
                    
                    details = []
                    if ul:
                        for li in ul.find_all('li', recursive=False):
                            details.append(li.text.strip())
                            
                    if patch_name:
                        patch_history.append({
                            "patch": patch_name,
                            "details": details
                        })

        # Build the JSON object
        legend_data = {
            "name": name,
            "lore": {
                "real_name": data_extracted.get("Real Name", ""),
                "age": data_extracted.get("Age", ""),
                "home_world": data_extracted.get("Homeworld", ""),
                "gender": data_extracted.get("Gender", ""),
                "bio": bio_text
            },
            "abilities": {
                "passive": ability_details["Passive"],
                "tactical": ability_details["Tactical"],
                "ultimate": ability_details["Ultimate"]
            },
            "patch_history": patch_history
        }
        
        out_file = os.path.join(OUT_DIR, f"{name.lower().replace(' ', '_')}.json")
        with open(out_file, 'w', encoding='utf-8') as out_f:
            json.dump(legend_data, out_f, indent=2, ensure_ascii=False)
            
        print(f"  Saved {out_file}")

if __name__ == "__main__":
    scrape_legends_data()
    print("Scraping Data complete.")
