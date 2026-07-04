import os
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://apexlegends.wiki.gg"
WEAPONS_URL = f"{BASE_URL}/wiki/Weapons"
OUT_DIR_WEAPONS = "public/images/weapons"

os.makedirs(OUT_DIR_WEAPONS, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://apexlegends.wiki.gg/'
}

def download_image(url, out_path):
    if not url:
        return False
    if url.startswith('/'):
        url = BASE_URL + url
    
    # Remove query params from url if any for the download? No, wiki needs them sometimes or they are cache busters, either is fine.
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

def scrape_weapons():
    print(f"Fetching {WEAPONS_URL}...")
    try:
        r = requests.get(WEAPONS_URL, headers=HEADERS)
        html = r.text
    except Exception as e:
        print(f"Failed to get HTML: {e}")
        return
        
    soup = BeautifulSoup(html, 'html.parser')
    
    # Find all images that have _Icon.svg in their src
    imgs = soup.find_all('img')
    downloaded = set()
    
    for img in imgs:
        src = img.get('src', '')
        # It looks like: /images/HAVOC_Rifle_Icon.svg?69a525
        if '_Icon.svg' in src or 'Icon.svg' in src:
            # Extract the weapon name from the src or alt
            alt = img.get('alt', '')
            if 'Icon.svg' in alt:
                # E.g., "HAVOC Rifle Icon.svg" -> "HAVOC Rifle"
                name = alt.replace(' Icon.svg', '').replace('Icon.svg', '').strip()
                formatted_name = name.lower().replace(' ', '_')
                
                # Some SVGs might be legends or something else? Let's assume all on this page are weapons if they match.
                # Avoid duplicates
                if formatted_name in downloaded:
                    continue
                    
                out_path = os.path.join(OUT_DIR_WEAPONS, f"{formatted_name}.svg")
                if not os.path.exists(out_path):
                    print(f"Downloading {name} ({formatted_name}.svg)...")
                    if download_image(src, out_path):
                        downloaded.add(formatted_name)
                else:
                    downloaded.add(formatted_name)

if __name__ == "__main__":
    scrape_weapons()
    print("Scraping complete.")
