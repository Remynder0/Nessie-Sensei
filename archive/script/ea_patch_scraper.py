import os
import json
import time
import requests
from bs4 import BeautifulSoup

OUTPUT_FILE = "archive/data/raw_patches.json"
LOCALES = ["en-us"]

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def get_news_index(locale):
    all_items = []
    page = 1
    while True:
        url = f"https://www.ea.com/{locale}/games/apex-legends/news?page={page}"
        print(f"Fetching news index from: {url}")
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            # requests guesses r.encoding from the HTTP headers, and EA's
            # responses don't always send a charset. That mismatch is what
            # causes accented characters (é, à, ç...) to come back as the
            # Unicode replacement character "�" once BeautifulSoup/json
            # re-parse the text. Sniffing the real encoding from the content
            # itself fixes it.
            r.encoding = r.apparent_encoding
            soup = BeautifulSoup(r.text, 'html.parser')
            items_found = False
            for s in soup.find_all('script'):
                if s.string and '"props":' in s.string:
                    try:
                        data = json.loads(s.string)
                        news_data = data['props']['pageProps']['newsDataFallback']
                        items = news_data.get('items', [])
                        
                        if page == 1 and news_data.get('featured'):
                            all_items.append(news_data['featured'])
                        
                        all_items.extend(items)
                        if items:
                            items_found = True
                    except Exception as e:
                        pass
            if not items_found:
                break
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            break
        page += 1
        time.sleep(0.5)
    return all_items

def get_article_body(locale, slug):
    url = f"https://www.ea.com/{locale}/games/apex-legends/news/{slug}"
    print(f"  Fetching article: {url}")
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.encoding = r.apparent_encoding
        soup = BeautifulSoup(r.text, 'html.parser')
        for s in soup.find_all('script'):
            if s.string and '"props":' in s.string:
                try:
                    data = json.loads(s.string)
                    body = data['props']['pageProps']['articleDetailsFallback']['body']
                    return body
                except Exception as e:
                    pass
    except Exception as e:
        print(f"Error fetching {url}: {e}")
    return None

def extract_legends_section(markdown):
    lines = markdown.split('\n')
    extracted = []
    in_legends_section = False
    current_level = 0
    
    for line in lines:
        upper_line = line.upper()
        
        # Check if line is a heading
        if line.startswith('#'):
            # Determine the heading level (number of '#' characters)
            level = len(line) - len(line.lstrip('#'))
            
            # If we are already extracting, check if we've reached a new section
            # of equal or higher importance (smaller or equal number of #).
            if in_legends_section and level <= current_level:
                in_legends_section = False
                extracted.append("\n") # Add spacing between disconnected sections
            
            # Start extracting if the heading contains LEGEND or LÉGENDE (ignoring APEX)
            if ('LEGEND' in upper_line or 'LÉGENDE' in upper_line) and 'APEX' not in upper_line:
                in_legends_section = True
                current_level = level
                extracted.append(line)
                continue
                
        if in_legends_section:
            extracted.append(line)
            
    return '\n'.join(extracted)

def main():
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    all_patches = {}
    
    for locale in LOCALES:
        articles = get_news_index(locale)
        # Filter for game updates/patch notes
        patch_articles = [a for a in articles if a and (a.get('type') == 'Game Updates' or 'patch' in a.get('slug', '').lower())]
        
        for article in patch_articles:
            slug = article.get('slug')
            if not slug: continue
            
            if slug not in all_patches:
                all_patches[slug] = {
                    "date": article.get('publishingDate'),
                    "locales": {}
                }
            
            body = get_article_body(locale, slug)
            legends_markdown = extract_legends_section(body)
            
            all_patches[slug]["locales"][locale] = {
                "title": article.get('title'),
                "raw_markdown": legends_markdown
            }
            time.sleep(0.5)
            
    # filter out empty ones
    filtered_patches = {}
    for slug, patch in all_patches.items():
        has_content = False
        for locale, data in patch["locales"].items():
            if data["raw_markdown"].strip():
                has_content = True
        if has_content:
            filtered_patches[slug] = patch

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(filtered_patches, f, indent=2, ensure_ascii=False)
        
    print(f"Scraped {len(filtered_patches)} patches with legend updates to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
