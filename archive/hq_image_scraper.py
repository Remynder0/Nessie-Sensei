import os
import json
import time
import requests
import subprocess
from bs4 import BeautifulSoup

BASE_URL = "https://apexlegends.wiki.gg"
DATA_FILE = "public/Legends.json"
OUT_DIR_ICONS = "public/images/legends/icons"
OUT_DIR_PORTRAITS = "public/images/legends/portraits"

os.makedirs(OUT_DIR_ICONS, exist_ok=True)
os.makedirs(OUT_DIR_PORTRAITS, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://apexlegends.wiki.gg/'
}

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

def get_html_with_edge(url):
    args = [
        EDGE_PATH,
        "--headless",
        "--disable-gpu",
        "--dump-dom",
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-extensions",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        url
    ]
    for attempt in range(1, 4):
        result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="ignore")
        if result.returncode != 0:
            time.sleep(2)
            continue
        stdout = result.stdout
        # If it doesn't contain standard mediawiki content div, it's likely a Cloudflare block
        if "mw-content-text" not in stdout:
            print(f"    -> Cloudflare challenge hit (attempt {attempt}/3). Retrying...")
            time.sleep(10)
        else:
            return stdout
    return ""

def get_hq_url(src):
    if not src: return ""
    if "/thumb/" in src:
        hq_src = src.replace("/thumb", "")
        hq_src = hq_src.rsplit("/", 1)[0]
        return hq_src
    return src

def download_image(url, out_path):
    if not url: return False
    if url.startswith('/'): url = BASE_URL + url
    try:
        r = requests.get(url, headers=HEADERS, stream=True)
        if r.status_code == 200:
            with open(out_path, 'wb') as f:
                for chunk in r.iter_content(1024):
                    f.write(chunk)
            return True
        else:
            print(f"Failed {r.status_code}: {url}")
            return False
    except Exception as e:
        print(f"Error: {e}")
        return False

def main():
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        legends = json.load(f)['Legends']
        
    for idx, legend in enumerate(legends):
        name = legend['Name']
        print(f"[{idx+1}/{len(legends)}] Processing {name}...")
        
        url_name = name.replace(' ', '_')
        url = f"{BASE_URL}/wiki/{url_name}"
        html = get_html_with_edge(url)
        if not html:
            print(f"  Failed to get HTML for {name}")
            continue
            
        soup = BeautifulSoup(html, 'html.parser')
        
        # 1. Icon
        icon_img = soup.find('img', alt=f"Portrait {name} square.png")
        if not icon_img:
            icon_img = soup.find('img', alt=f"{name} Icon.png")
            
        if icon_img:
            hq_src = get_hq_url(icon_img.get('src'))
            icon_path = os.path.join(OUT_DIR_ICONS, f"{name.lower().replace(' ', '_')}.png")
            if download_image(hq_src, icon_path):
                print(f"  -> Downloaded HQ icon: {hq_src}")
        else:
            print(f"  -> Could not find icon for {name}")

        # 2. Portrait
        infobox = soup.find(class_='infobox')
        if infobox:
            images = infobox.find_all('img')
            if images:
                portrait_img = images[0]
                hq_src = get_hq_url(portrait_img.get('src'))
                portrait_ext = '.png' if '.png' in hq_src.lower() else '.jpg'
                portrait_path = os.path.join(OUT_DIR_PORTRAITS, f"{name.lower().replace(' ', '_')}{portrait_ext}")
                if download_image(hq_src, portrait_path):
                    print(f"  -> Downloaded HQ portrait: {hq_src}")

if __name__ == "__main__":
    main()
