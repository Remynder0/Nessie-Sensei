import os
import json
import re
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from bs4 import BeautifulSoup
import time

LEGENDS_DIR = "public/data/legends"
SEASONS_DIR = "src/data/seasons"
DEBUG_DIR = "debug"

os.makedirs(DEBUG_DIR, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
}

def load_json(filepath):
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def parse_date(date_str):
    try:
        clean_date = re.sub(r'(?<=\d)(st|nd|rd|th)\b', '', date_str)
        # Parse formats like "May 5, 2026"
        return datetime.strptime(clean_date, "%B %d, %Y")
    except Exception:
        # Some dates might be "May 06, 2025" or have bad formatting
        try:
             return datetime.strptime(clean_date, "%B %d, %Y")
        except Exception:
             return None

def get_legend_names():
    legends = []
    for filename in os.listdir(LEGENDS_DIR):
        if not filename.endswith('.json'): continue
        data = load_json(os.path.join(LEGENDS_DIR, filename))
        if data:
            name = data.get('name', filename.split('.')[0])
            # Wiki sometimes requires specific casing like "Newcastle", "Mad_Maggie", etc.
            legends.append(name)
    return legends

def scrape_wiki_patch_history(legend_name):
    # Fandom moved to wiki.gg
    # Use the mediawiki parse API to bypass standard Cloudflare blocking
    encoded_name = urllib.parse.quote(legend_name.replace(' ', '_'))
    url = f"https://apexlegends.wiki.gg/api.php?action=parse&page={encoded_name}&format=json"
    
    print(f"Scraping wiki for {legend_name}...")
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read()
            data = json.loads(html)
            if 'parse' not in data or 'text' not in data['parse']:
                print(f"  [!] Failed to get parse text for {legend_name}")
                return []
            
            html_content = data['parse']['text']['*']
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Find the patches header (id="Patches" or "Patch_History")
            patches_header = soup.find(id=re.compile(r'Patch(es|_History)'))
            if not patches_header:
                print(f"  [!] No Patches section found for {legend_name}")
                return []
                
            h_tag = patches_header.parent
            table = h_tag.find_next_sibling('table')
            if not table:
                print(f"  [!] No table found under Patches for {legend_name}")
                return []
                
            patches = []
            
            # The patches are usually listed in <p> or <dt> inside the table
            for p_tag in table.find_all(['p', 'dt', 'h3', 'h4']):
                patch_name = p_tag.text.strip()
                # Clean zero-width characters
                patch_name = re.sub(r'[\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069]', '', patch_name)
                
                date_part = patch_name.replace(" Patch", "").strip()
                p_date = parse_date(date_part)
                if not p_date:
                    continue
                
                # Find the next ul which contains the details
                ul = p_tag.find_next_sibling('ul')
                if not ul and p_tag.name == 'dt':
                    ul = p_tag.parent.find_next_sibling('ul')
                    
                details = []
                if ul:
                    for li in ul.find_all('li', recursive=False):
                        # Use .text to get all nested text correctly formatted
                        text = li.text.strip()
                        # Clean up multiple newlines or tabs
                        text = re.sub(r'\n+', '\n  - ', text)
                        details.append(text)
                
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
    
    for legend in legends:
        # Sleep slightly to avoid rate-limiting
        time.sleep(0.5)
        patches = scrape_wiki_patch_history(legend)
        all_patches.extend(patches)
        
    return all_patches

def main():
    print("[Step 2 - Wiki Scraper] Starting full wiki scrape...")
    all_patches = scrape_all_legends()
    print(f"\nExtracted a total of {len(all_patches)} patches from the Wiki.")
    
    print("\nDistributing patches into seasons...")
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
        
        # Calculate time boundaries to group patches
        if filename.endswith('_1.json'):
            target_start = start_date - timedelta(days=7)
            target_end = mid_date
        elif filename.endswith('_2.json'):
            target_start = mid_date + timedelta(days=1)
            target_end = end_date - timedelta(days=2)
        else:
            target_start = start_date - timedelta(days=7)
            target_end = end_date - timedelta(days=2)
        
        # Filter patches for this season
        valid_patches = [p for p in all_patches if target_start <= p['date'] <= target_end]
        
        # Group by legend for output formatting
        legends_in_season = {}
        for p in valid_patches:
            leg = p['legend']
            if leg not in legends_in_season:
                legends_in_season[leg] = []
            legends_in_season[leg].append(p)
            
        # Build text format
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
        
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(out_text)
            
        print(f"[SUCCESS] Season {season_id} ({len(valid_patches)} patches) -> {out_path}")

if __name__ == "__main__":
    main()
