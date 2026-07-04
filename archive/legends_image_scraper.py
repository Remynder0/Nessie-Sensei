import os
import json
import time
import requests
import sys
from bs4 import BeautifulSoup

BASE_URL = "https://apexlegends.wiki.gg"
DATA_FILE = "public/Legends.json"
OUT_DIR_PORTRAITS = "public/images/legends/portraits"
OUT_DIR_ABILITIES = "public/images/legends/abilities"

os.makedirs(OUT_DIR_PORTRAITS, exist_ok=True)
os.makedirs(OUT_DIR_ABILITIES, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://apexlegends.wiki.gg/'
}

def download_image(url, out_path):
    if not url:
        return False
    if url.startswith('/'):
        url = BASE_URL + url
    
    try:
        r = requests.get(url, headers=HEADERS, stream=True)
        if r.status_code == 200:
            with open(out_path, 'wb') as f:
                for chunk in r.iter_content(1024):
                    f.write(chunk)
            return True
        else:
            print(f"Failed to download {url}: {r.status_code}")
            return False
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False

OUT_DIR_ICONS = "public/images/legends/icons"
os.makedirs(OUT_DIR_ICONS, exist_ok=True)

def scrape_legends():
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        legends = json.load(f)['Legends']
        
    for idx, legend in enumerate(legends):
        name = legend['Name']
        print(f"[{idx+1}/{len(legends)}] Processing {name}...")
            
        url_name = name.replace(' ', '_')
        url = f"{BASE_URL}/wiki/{url_name}"
        
        try:
            r = requests.get(url, headers=HEADERS)
            html = r.text
        except Exception as e:
            print(f"Failed to get HTML for {name}: {e}")
            continue
            
        soup = BeautifulSoup(html, 'html.parser')
        
        # 1. Download Icon (from the top right or infobox)
        # Icons are usually named "Portrait {Name} square.png" or "{Name}_Icon.png"
        icon_img = soup.find('img', alt=f"Portrait {name} square.png")
        if not icon_img:
            icon_img = soup.find('img', alt=f"{name} Icon.png")
            
        if icon_img:
            icon_path = os.path.join(OUT_DIR_ICONS, f"{name.lower().replace(' ', '_')}.png")
            if not os.path.exists(icon_path):
                if download_image(icon_img.get('src'), icon_path):
                    print(f"  Downloaded icon for {name}")
        else:
            print(f"  Could not find icon for {name}")

        infobox = soup.find(class_='infobox')
        if not infobox:
            print(f"No infobox found for {name}")
            continue
            
        images = infobox.find_all('img')
        if not images:
            print(f"No images in infobox for {name}")
            continue
            
        # 2. Portrait (usually first image in infobox)
        portrait_img = images[0]
        portrait_ext = '.png' if '.png' in portrait_img.get('src', '').lower() else '.jpg'
        portrait_path = os.path.join(OUT_DIR_PORTRAITS, f"{name.lower().replace(' ', '_')}{portrait_ext}")
        if not os.path.exists(portrait_path):
            if download_image(portrait_img.get('src'), portrait_path):
                print(f"  Downloaded portrait for {name}")
            
        # 3. Class & Abilities
        ability_idx = 1
        for img in images[1:]:
            alt = img.get('alt', '')
            src = img.get('src', '')
            
          
            if ability_idx <= 3:
                ext = '.png' if '.png' in src.lower() else '.jpg' if '.jpg' in src.lower() else '.svg'
                ability_path = os.path.join(OUT_DIR_ABILITIES, f"{name.lower().replace(' ', '_')}_ability_{ability_idx}{ext}")
                if not os.path.exists(ability_path):
                    if download_image(src, ability_path):
                        print(f"  Downloaded ability {ability_idx} for {name}")
                ability_idx += 1

if __name__ == "__main__":
    scrape_legends()
    print("Scraping complete.")
