import os
import json
import requests

DATA_FILE = "public/Legends.json"
OUT_DIR_ICONS = "public/images/legends/icons"
OUT_DIR_PORTRAITS = "public/images/legends/portraits"

os.makedirs(OUT_DIR_ICONS, exist_ok=True)
os.makedirs(OUT_DIR_PORTRAITS, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def get_fandom_image_url(filename):
    """Queries Fandom API to get the direct high-resolution image URL."""
    api_url = f"https://apexlegends.fandom.com/api.php?action=query&prop=imageinfo&titles=File:{filename}&iiprop=url&format=json"
    try:
        r = requests.get(api_url, headers=HEADERS)
        data = r.json()
        pages = data.get('query', {}).get('pages', {})
        for page_id, page_info in pages.items():
            if page_id == "-1":  # Missing file
                return None
            image_info = page_info.get('imageinfo', [])
            if image_info:
                return image_info[0].get('url')
    except Exception as e:
        print(f"API Error for {filename}: {e}")
    return None

def download_image(url, out_path):
    if not url: return False
    try:
        r = requests.get(url, headers=HEADERS, stream=True)
        if r.status_code == 200:
            with open(out_path, 'wb') as f:
                for chunk in r.iter_content(1024):
                    f.write(chunk)
            return True
    except Exception as e:
        print(f"Download Error: {e}")
    return False

def main():
    print("Démarrage du téléchargement des images HQ depuis Fandom API...")
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        legends = json.load(f)['Legends']
        
    for idx, legend in enumerate(legends):
        name = legend['Name']
        print(f"[{idx+1}/{len(legends)}] Processing {name}...")
        
        # Format names (e.g. Mad Maggie -> Mad_Maggie)
        url_name = name.replace(' ', '_')
        
        # 1. PORTRAIT HQ (The user requested 'Portrait_Name_square.png' for portraits)
        portrait_filename = f"Portrait_{url_name}_square.png"
        portrait_url = get_fandom_image_url(portrait_filename)
        
        if portrait_url:
            portrait_path = os.path.join(OUT_DIR_PORTRAITS, f"{name.lower().replace(' ', '_')}.png")
            if download_image(portrait_url, portrait_path):
                print(f"  -> Téléchargé Portrait HQ: {portrait_filename}")
            else:
                print(f"  -> Échec du téléchargement Portrait HQ")
        else:
            print(f"  -> Impossible de trouver le portrait pour {name} sur Fandom")

        # 2. ICON HQ
        icon_filename = f"{url_name}_Icon.png"
        icon_url = get_fandom_image_url(icon_filename)
        
        # Fallback to the square portrait if Icon doesn't exist
        if not icon_url:
            icon_url = portrait_url
            icon_filename = portrait_filename
            
        if icon_url:
            icon_path = os.path.join(OUT_DIR_ICONS, f"{name.lower().replace(' ', '_')}.png")
            if download_image(icon_url, icon_path):
                print(f"  -> Téléchargé Icône HQ: {icon_filename}")
            else:
                print(f"  -> Échec du téléchargement Icône HQ")
        else:
            print(f"  -> Impossible de trouver l'icône pour {name} sur Fandom")

if __name__ == "__main__":
    main()
