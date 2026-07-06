import os
import json
import requests
from bs4 import BeautifulSoup

OUTPUT_FILE = "public/data/raw_patches.json"
LOCALES = ["en-us", "fr-fr"]

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def get_news_index(locale):
    url = f"https://www.ea.com/{locale}/games/apex-legends/news"
    print(f"Fetching news index from: {url}")
    try:
        r = requests.get(url, headers=HEADERS)
        soup = BeautifulSoup(r.text, 'html.parser')
        for s in soup.find_all('script'):
            if s.string and '"props":' in s.string:
                try:
                    data = json.loads(s.string)
                    news_data = data['props']['pageProps']['newsDataFallback']
                    return news_data.get('items', []) + ([news_data.get('featured')] if news_data.get('featured') else [])
                except Exception as e:
                    pass
    except Exception as e:
        print(f"Error fetching {url}: {e}")
    return []

def get_article_body(locale, slug):
    url = f"https://www.ea.com/{locale}/games/apex-legends/news/{slug}"
    print(f"  Fetching article: {url}")
    try:
        r = requests.get(url, headers=HEADERS)
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

def extract_legends_section(body):
    # Depending on language, the heading might be different, but usually markdown has ## LEGENDS or ## LÉGENDES
    if not body:
        return ""
    
    lines = body.split('\n')
    in_legends = False
    extracted = []
    
    for line in lines:
        upper_line = line.upper()
        # Find start of legends section
        if line.startswith('## ') and ('LEGEND' in upper_line or 'LÉGENDE' in upper_line):
            in_legends = True
            extracted.append(line)
            continue
            
        # If we hit another ## heading, we exit
        if in_legends and line.startswith('## ') and not ('LEGEND' in upper_line or 'LÉGENDE' in upper_line):
            break
            
        if in_legends:
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
