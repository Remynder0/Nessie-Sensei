import os
import json
import argparse
import requests
import re
from datetime import datetime, timedelta
from bs4 import BeautifulSoup

SEASONS_DIR = "src/data/seasons"
DEBUG_DIR = "debug"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

os.makedirs(DEBUG_DIR, exist_ok=True)

def load_json(filepath):
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def parse_date(date_str):
    try:
        clean_date = re.sub(r'(?<=\d)(st|nd|rd|th)\b', '', date_str)
        return datetime.strptime(clean_date, "%B %d, %Y")
    except Exception as e:
        return None

def extract_ea_legends_section(markdown):
    lines = markdown.split('\n')
    extracted = []
    in_legends = False
    level = 0
    
    for line in lines:
        upper = line.upper()
        if line.startswith('#'):
            lvl = len(line) - len(line.lstrip('#'))
            if in_legends and lvl <= level:
                in_legends = False
            if ('LEGEND' in upper or 'LÉGENDE' in upper) and 'APEX' not in upper:
                in_legends = True
                level = lvl
                extracted.append(line)
                continue
        if in_legends:
            extracted.append(line)
    return '\n'.join(extracted)

def scrape_ea_season_patches(target_start, target_end):
    print(f"[Step 1 - EA Scraper] Searching Game Updates between {target_start.date()} and {target_end.date()}...")
    
    page = 1
    gathered_texts = []
    
    while page <= 20:
        url = f"https://www.ea.com/en-us/games/apex-legends/news?page={page}&type=game-updates"
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            r.encoding = r.apparent_encoding
            soup = BeautifulSoup(r.text, 'html.parser')
            
            found_any = False
            for s in soup.find_all('script'):
                if s.string and '"props":' in s.string:
                    data = json.loads(s.string)
                    items = data.get('props', {}).get('pageProps', {}).get('newsDataFallback', {}).get('items', [])
                    
                    for item in items:
                        pub_date_str = item.get('publishingDate')
                        if not pub_date_str: continue
                        
                        try:
                            pub_date = datetime.strptime(pub_date_str[:10], "%Y-%m-%d")
                        except:
                            continue
                            
                        if pub_date < target_start:
                            print(f"[EA Scraper] Reached older articles ({pub_date.date()}). Stopping.")
                            return "\n\n".join(gathered_texts)
                            
                        if target_start <= pub_date <= target_end:
                            title = item.get('title', '')
                            slug = item.get('slug')
                            print(f"[EA Scraper] Found matching patch: '{title}' ({pub_date.date()})")
                            
                            ar = requests.get(f"https://www.ea.com/en-us/games/apex-legends/news/{slug}", headers=HEADERS)
                            ar.encoding = ar.apparent_encoding
                            asoup = BeautifulSoup(ar.text, 'html.parser')
                            for as_script in asoup.find_all('script'):
                                if as_script.string and '"props":' in as_script.string:
                                    adata = json.loads(as_script.string)
                                    target_body = adata['props']['pageProps']['articleDetailsFallback']['body']
                                    legends_section = extract_ea_legends_section(target_body)
                                    if legends_section.strip():
                                        gathered_texts.append(f"--- EA Patch: {title} ({pub_date.date()}) ---\n{legends_section}")
                            found_any = True
        except Exception as e:
            print(f"[EA Scraper] Error on page {page}: {e}")
        page += 1
        
    return "\n\n".join(gathered_texts)

def main():
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
        if filename.endswith('_1.json'):
            target_start = start_date - timedelta(days=7)
            target_end = mid_date
        elif filename.endswith('_2.json'):
            target_start = mid_date + timedelta(days=1)
            target_end = end_date - timedelta(days=2)
        else:
            target_start = start_date - timedelta(days=7)
            target_end = end_date - timedelta(days=2)
        
        ea_text = scrape_ea_season_patches(target_start, target_end)
        out_path = os.path.join(DEBUG_DIR, f"season_{season_id}_ea.txt")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(ea_text)
        print(f"[SUCCESS] EA raw data saved to {out_path}\n")

if __name__ == "__main__":
    main()
