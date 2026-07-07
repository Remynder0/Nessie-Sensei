import subprocess
import json
import os
import re
import time
import random
from bs4 import BeautifulSoup

# Paths to Chromium-based browsers on Windows
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]

def get_html_with_edge(url):
    """Fetches the page content using headless Edge/Chrome with a custom User-Agent and retry logic to bypass Cloudflare."""
    browser_path = None
    if os.path.exists(EDGE_PATH):
        browser_path = EDGE_PATH
    else:
        for path in CHROME_PATHS:
            if os.path.exists(path):
                browser_path = path
                break
                
    if not browser_path:
        raise RuntimeError("No Chromium-based browser (Edge or Chrome) was found in standard locations.")

    args = [
        browser_path,
        "--headless",
        "--disable-gpu",
        "--dump-dom",
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-extensions",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        url
    ]
    
    # Retry loop with backoff on Cloudflare detection
    for attempt in range(1, 4):
        result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="ignore")
        if result.returncode != 0:
            print(f"    -> Browser error on attempt {attempt}: {result.stderr.strip()[:100]}")
            time.sleep(5)
            continue
            
        stdout = result.stdout
        # Check if we were blocked by Cloudflare
        if "Just a second..." in stdout or "Un instant..." in stdout or "403 Forbidden" in stdout or "Access denied" in stdout:
            wait_time = attempt * 10
            print(f"    -> Cloudflare detected (attempt {attempt}/3). Sleeping {wait_time}s and retrying...")
            time.sleep(wait_time)
        else:
            return stdout
            
    raise RuntimeError("Failed to bypass Cloudflare challenge after 3 attempts.")

def clean_text(text):
    """Cleans up text by replacing consecutive whitespaces/newlines with a single space."""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def extract_rich_text(cell):
    items = []
    current_parts = []
    
    for elem in cell.descendants:
        if getattr(elem, 'name', None) in ['br', 'hr', 'li', 'p']:
            if current_parts:
                items.append(clean_text(" ".join(current_parts)))
                current_parts = []
        elif type(elem).__name__ == 'NavigableString':
            text = str(elem).strip()
            if text and text not in current_parts:
                current_parts.append(text)
        elif getattr(elem, 'name', None) == 'a' and elem.has_attr('title'):
            title = elem['title'].strip()
            if title and title not in current_parts:
                current_parts.append(title)
        elif getattr(elem, 'name', None) == 'img' and elem.has_attr('alt'):
            alt = elem['alt'].strip()
            if alt == 'Apex Pack' and 'Apex Pack' not in current_parts:
                current_parts.append('Apex Pack')
                
    if current_parts:
        items.append(clean_text(" ".join(current_parts)))
        
    return items

def parse_battle_pass_tables(html):
    """Finds and parses all battle pass tables in the HTML page."""
    soup = BeautifulSoup(html, 'html.parser')
    tables = soup.find_all('table')
    bp_tables = []
    
    for table in tables:
        # Get cells of the first row to determine headers
        first_row = table.find('tr')
        if not first_row:
            continue
        headers = [cell.text.lower().strip() for cell in first_row.find_all(['th', 'td'])]
        
        # Check if any header contains battle pass keywords
        if len(headers) >= 2 and (any('premium' in h for h in headers) or any('free' in h for h in headers) or any('rewards' in h for h in headers)):
            # Check if there's a reasonable number of rows
            rows = table.find_all('tr')
            if len(rows) > 15:
                bp_tables.append((headers, table))
                
    results = []
    for headers, table in bp_tables:
        # Detect column indices
        level_idx = -1
        premium_idx = -1
        free_idx = -1
        
        for idx, h in enumerate(headers):
            if 'level' in h or h == '':
                if level_idx == -1:  # Prefer the first matching column
                    level_idx = idx
            elif 'premium' in h:
                premium_idx = idx
            elif 'free' in h:
                free_idx = idx
                
        # Default to standard indices if not clearly detected
        if level_idx == -1: level_idx = 0
        if premium_idx == -1: premium_idx = 1
        if free_idx == -1: free_idx = 2
        
        rewards = []
        rows = table.find_all('tr')
        for row in rows:
            cells = row.find_all(['td', 'th'])
            if len(cells) <= max(level_idx, premium_idx, free_idx):
                continue
                
            # Skip header row if it contains text instead of numbers
            level_text = cells[level_idx].text.strip()
            if not re.match(r'^\d+$', level_text):
                continue
                
            premium_text = extract_rich_text(cells[premium_idx]) if premium_idx < len(cells) else ""
            free_text = extract_rich_text(cells[free_idx]) if free_idx < len(cells) else ""
            
            rewards.append({
                "Level": level_text,
                "Premium Rewards": premium_text,
                "Free Rewards": free_text
            })
            
        if rewards:
            results.append(rewards)
            
    return results

def main():
    all_seasons_data = {}
    output_filename = "archive/apex_battle_pass_wiki_gg.json"
    
    print("==================================================")
    print("STARTING APEX LEGENDS BATTLE PASS SCRAPER")
    print("==================================================")
    
    for season in range(1, 30):
        print(f"Scraping Season {season} from wiki.gg...")
        url = f"https://apexlegends.wiki.gg/wiki/Season_{season}"
        
        try:
            html = get_html_with_edge(url)
            parsed_tables = parse_battle_pass_tables(html)
            
            if not parsed_tables:
                print(f"  -> WARNING: No battle pass rewards table found for Season {season}.")
                all_seasons_data[f"Season_{season}"] = []
            # If there's more than one table, it's likely a split-based season (Seasons 22+)
            elif len(parsed_tables) > 1:
                print(f"  -> Found {len(parsed_tables)} splits/tables for Season {season}.")
                for idx, rewards in enumerate(parsed_tables):
                    split_num = idx + 1
                    key = f"Season_{season}_{split_num}"
                    all_seasons_data[key] = rewards
                    print(f"    -> Saved Split {split_num}: {len(rewards)} levels.")
            else:
                rewards = parsed_tables[0]
                all_seasons_data[f"Season_{season}"] = rewards
                print(f"  -> Saved Season {season}: {len(rewards)} levels.")
                
        except Exception as e:
            print(f"  -> ERROR: Failed to process Season {season}: {e}")
            all_seasons_data[f"Season_{season}"] = []
            
        # Polite delay to prevent Cloudflare bans (random between 4.0 and 7.0 seconds)
        delay = random.uniform(4.0, 7.0)
        time.sleep(delay)
            
    # Save the output file
    os.makedirs(os.path.dirname(output_filename), exist_ok=True)
    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(all_seasons_data, f, indent=4, ensure_ascii=False)
        
    print("==================================================")
    print(f"SUCCESS: Scraping complete. Data saved in: {output_filename}")

if __name__ == "__main__":
    main()
