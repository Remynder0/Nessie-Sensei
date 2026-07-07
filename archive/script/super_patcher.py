import os
import json
import time
import requests
import re
import argparse
import subprocess
from bs4 import BeautifulSoup
from datetime import datetime

try:
    from json_repair import repair_json
    HAS_JSON_REPAIR = True
except ImportError:
    HAS_JSON_REPAIR = False

# Paths
LEGENDS_DIR = "public/data/legends"
SEASONS_DIR = "src/data/seasons"

# LLM Configuration
LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions"

# Browser paths for Wiki scraping
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

# ---------------------------------------------------------
# UTILS
# ---------------------------------------------------------

def load_json(filepath):
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def _extract_json_array(content):
    json_str = content.strip()
    if json_str.startswith("```json"): json_str = json_str[7:]
    if json_str.startswith("```"): json_str = json_str[3:]
    if json_str.endswith("```"): json_str = json_str[:-3]
    match = re.search(r'\[.*\]', json_str.strip(), re.DOTALL)
    if match: json_str = match.group(0)
    json_str = re.sub(r',\s*([\]}])', r'\1', json_str)
    return json_str

def _extract_json_object(content):
    json_str = content.strip()
    if json_str.startswith("```json"): json_str = json_str[7:]
    if json_str.startswith("```"): json_str = json_str[3:]
    if json_str.endswith("```"): json_str = json_str[:-3]
    match = re.search(r'\{.*\}', json_str.strip(), re.DOTALL)
    if match: json_str = match.group(0)
    json_str = re.sub(r',\s*([\]}])', r'\1', json_str)
    return json_str

def _parse_json_with_fallback(json_str):
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        if HAS_JSON_REPAIR:
            try:
                repaired = repair_json(json_str)
                return json.loads(repaired)
            except Exception:
                pass
        raise e

# ---------------------------------------------------------
# LLM QUERIES
# ---------------------------------------------------------

def call_llm(messages, temperature=0.1):
    payload = {
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 8192,
        "stream": False
    }
    
    for attempt in range(1, 4):
        try:
            print(f"    -> LLM Request Attempt {attempt}...")
            response = requests.post(LM_STUDIO_URL, json=payload, timeout=600)
            response.raise_for_status()
            return response.json()['choices'][0]['message']['content']
        except Exception as e:
            print(f"    -> Failed: {e}")
            time.sleep(2)
    return None

def extract_modified_legends(raw_text):
    prompt = "You are an expert Apex Legends data parser. Read the following patch notes and return ONLY a JSON array of strings containing the exact names of the Legends that received changes (Buff, Nerf, Adjust, Rework, or Bug Fixes to their abilities/perks). Ignore weapons and general changes.\n\nExample Output:\n[\"Ash\", \"Alter\", \"Lifeline\"]\n\nRaw Patch Notes:\n"
    content = call_llm([
        {"role": "system", "content": "You output ONLY valid JSON arrays."},
        {"role": "user", "content": prompt + raw_text}
    ])
    if not content: return []
    try:
        return _parse_json_with_fallback(_extract_json_array(content))
    except Exception as e:
        print(f"    -> [ERROR] Could not parse modified-legends list: {e}")
        return []

def extract_legend_changes(legend_name, raw_text):
    sys_prompt = f"""You are an expert data parser. Extract the exact changes made to {legend_name} from the patch notes into a strictly structured JSON format.
You must return ONLY a JSON array of change objects.

Each change object MUST have:
- ability: The ability modified (e.g., "Passive", "Tactical", "Ultimate", "Perks", or "Base").
- perk_name: If the ability modified is a "Perk", extract the exact name of the perk. Otherwise, leave empty "".
- type: Exactly one of: "Buff", "Nerf", "Rework", "Adjust", or "Fix".
- detail: A short summary of the overall change, in English.
- stats_changes: A dictionary of specific stat changes (e.g., {{"cooldown": "20s -> 25s"}}). CRITICAL: If the raw text contains numbers changing, YOU MUST extract them here! Do NOT leave this empty if numbers are present.
- raw_text: The exact original text of the change, in English (do not translate).

Output a JSON array only. No markdown formatting.
"""
    content = call_llm([
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": f"Extract changes for {legend_name} from these notes:\n\n{raw_text}"}
    ])
    if not content: return []
    try:
        return _parse_json_with_fallback(_extract_json_array(content))
    except Exception as e:
        print(f"    -> [ERROR] Could not parse changes for {legend_name}: {e}")
        return []

def translate_changes_to_french(changes):
    """Translate only the human-readable fields of already-structured English
    change objects into French. Kept as a separate pass from extraction so
    the small local model isn't asked to structure AND translate at once."""
    if not changes:
        return changes

    sys_prompt = """You are a professional French video game localization translator.
You will receive a JSON array of Apex Legends patch change objects, written in English.

Translate ONLY the "detail" and "raw_text" string values into natural, professional French.
Do NOT translate or alter: JSON keys, "ability", "perk_name", "type", or anything inside "stats_changes"
(numbers, units like "s"/"m", and stat names should stay as-is).
Preserve the exact same array structure, same number of objects, same key order.

Return ONLY the translated JSON array. No markdown formatting, no commentary.
"""
    content = call_llm([
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": json.dumps(changes, indent=2, ensure_ascii=False)}
    ])
    if not content:
        print("    -> [WARN] Translation call failed, keeping English changes.")
        return changes

    try:
        translated = _parse_json_with_fallback(_extract_json_array(content))
        if isinstance(translated, list) and len(translated) == len(changes):
            return translated
        print("    -> [WARN] Translation output shape mismatch, keeping English changes.")
        return changes
    except Exception as e:
        print(f"    -> [ERROR] Could not parse translated changes: {e}")
        return changes

def apply_legend_changes(legend_name, existing_data, new_changes, patch_name):
    sys_prompt = """You are an expert game data analyst for Apex Legends.
Your task is to merge new patch notes into the existing JSON data of a Legend.
INSTRUCTIONS:
1. ABILITY REWRITING: For any ability or perk modified, rewrite its "description", "name" or "cooldown" naturally to reflect the new state. Do NOT append logs like "[Patch X: Buff]".
2. PATCH HISTORY: Insert the new patch as an object into the "patch_history" array. Ensure you place it in the correct chronological order based on the season number, or update an existing entry if the patch name matches exactly. Do NOT just blindly prepend it if it's an older patch, and do NOT create duplicate or empty entries.
3. PRESERVATION: Do NOT delete or alter any abilities/perks NOT mentioned in the patch.
OUTPUT FORMAT: Return ONLY a valid JSON object with "abilities", "tactics", and "patch_history" keys.
"""
    user_prompt = f"""Legend: {legend_name}
New Patch Name to add to history: "{patch_name}"

--- NEW PATCH CHANGES ---
{json.dumps(new_changes, indent=2, ensure_ascii=False)}

--- CURRENT LEGEND DATA ---
{json.dumps(existing_data, indent=2, ensure_ascii=False)}

Please output the updated CURRENT LEGEND DATA JSON."""

    content = call_llm([
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_prompt}
    ])
    if not content: return None
    try:
        return _parse_json_with_fallback(_extract_json_object(content))
    except Exception as e:
        print(f"    -> [ERROR] Could not parse merged data for {legend_name}: {e}")
        return None

# ---------------------------------------------------------
# SCRAPERS
# ---------------------------------------------------------

def scrape_ea_news(season_name):
    print(f"[EA Scraper] Searching for patch notes related to '{season_name}'...")
    page = 1
    target_body = ""
    while page <= 3:
        url = f"https://www.ea.com/en-us/games/apex-legends/news?page={page}"
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            r.encoding = r.apparent_encoding
            soup = BeautifulSoup(r.text, 'html.parser')
            for s in soup.find_all('script'):
                if s.string and '"props":' in s.string:
                    data = json.loads(s.string)
                    items = data['props']['pageProps']['newsDataFallback'].get('items', [])
                    for item in items:
                        title = item.get('title', '').lower()
                        slug_lower = item.get('slug', '').lower()
                        # Same filter as the base EA scraper: don't require the
                        # word "patch" in the title — event-style updates (e.g.
                        # "Winter Wipeout") carry real legend changes too but
                        # never say "patch" anywhere in their title.
                        is_update_article = (
                            item.get('type') == 'Game Updates' or 'patch' in slug_lower
                        )
                        season_matches = season_name.lower() in title or season_name.lower() in slug_lower
                        if is_update_article and season_matches:
                            slug = item.get('slug')
                            print(f"[EA Scraper] Found matching article: {slug}")
                            
                            # Fetch article body
                            article_url = f"https://www.ea.com/en-us/games/apex-legends/news/{slug}"
                            ar = requests.get(article_url, headers=HEADERS, timeout=30)
                            ar.encoding = ar.apparent_encoding
                            asoup = BeautifulSoup(ar.text, 'html.parser')
                            for as_script in asoup.find_all('script'):
                                if as_script.string and '"props":' in as_script.string:
                                    adata = json.loads(as_script.string)
                                    target_body = adata['props']['pageProps']['articleDetailsFallback']['body']
                                    return extract_ea_legends_section(target_body)
        except Exception as e:
            print(f"[EA Scraper] Error on page {page}: {e}")
        page += 1
        time.sleep(0.5)
    print("[EA Scraper] No matching EA article found.")
    return ""

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

def scrape_wiki_gg(start_date_str, end_date_str):
    print(f"[Wiki.gg Scraper] Searching for patches between {start_date_str} and {end_date_str}...")
    browser_path = EDGE_PATH if os.path.exists(EDGE_PATH) else CHROME_PATHS[0] if os.path.exists(CHROME_PATHS[0]) else None
    
    if not browser_path:
        print("[Wiki.gg Scraper] No supported browser found for headless scraping.")
        return ""
        
    def fetch_headless(url):
        args = [browser_path, "--headless", "--disable-gpu", "--dump-dom", "--no-sandbox", "--disable-extensions", url]
        for attempt in range(1, 4):
            res = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="ignore")
            if "Just a second..." in res.stdout or "403 Forbidden" in res.stdout:
                time.sleep(10 * attempt)
            else:
                return res.stdout
        return ""

    # Since wiki.gg structure is complex and we don't have a reliable date parser without knowing exact formats,
    # for this MVP we'll simply search the Patch Notes page for links that might contain the season name
    # OR we'll just skip Wiki.gg if date parsing gets too complex, but let's try a simple approach.
    
    # Actually, to keep it simple and robust, we'll focus on the EA data as primary, and let the user know Wiki.gg can be expanded.
    print("[Wiki.gg Scraper] (Placeholder) Wiki.gg scraping by date range is complex and will be added in a future update if EA data is insufficient.")
    return ""

# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Super Patcher - Multi-source LLM Patch Notes Extractor & Applier")
    parser.add_argument("--season", type=str, required=True, help="Season identifier (e.g. 29_1)")
    args = parser.parse_args()
    
    season_file = os.path.join(SEASONS_DIR, f"season_{args.season}.json")
    season_data = load_json(season_file)
    
    if not season_data:
        print(f"Error: Could not find {season_file}")
        return
        
    season_name = season_data.get("name")
    start_date = season_data.get("start_date")
    end_date = season_data.get("end_date")
    
    if not season_name:
        print(f"Error: {season_file} is missing the 'name' field. Please update your season scraper first.")
        return
        
    print(f"--- SUPER PATCHER ---")
    print(f"Season ID  : {args.season}")
    print(f"Season Name: {season_name}")
    print(f"Period     : {start_date} to {end_date}")
    print("---------------------\n")
    
    # 1. Scrape EA
    ea_text = scrape_ea_news(season_name)
    
    # 2. Scrape Wiki.gg (currently placeholder)
    wiki_text = scrape_wiki_gg(start_date, end_date)
    
    combined_raw = ea_text + "\n\n" + wiki_text
    
    if not combined_raw.strip():
        print("No patch notes found from sources.")
        return
        
    os.makedirs("debug", exist_ok=True)
    with open("debug/scraped_raw.txt", "w", encoding="utf-8") as f:
        f.write(combined_raw)
    print(f"[DEBUG] Scraped raw text saved to debug/scraped_raw.txt")
        
    print("\n[LLM] Identifying modified legends...")
    modified_legends = extract_modified_legends(combined_raw)
    print(f"Modified Legends Found: {modified_legends}\n")
    
    for legend in modified_legends:
        print(f"--- Processing {legend} ---")
        
        print(f"  [LLM] Extracting structured changes (English)...")
        changes = extract_legend_changes(legend, combined_raw)
        
        with open(f"debug/structured_{legend}_en.json", "w", encoding="utf-8") as f:
            json.dump(changes, f, indent=2, ensure_ascii=False)
        print(f"  [DEBUG] Structured (English) data saved to debug/structured_{legend}_en.json")
        
        if not changes:
            print(f"  No structured changes extracted for {legend}.")
            continue

        print(f"  [LLM] Translating changes to French...")
        changes = translate_changes_to_french(changes)

        with open(f"debug/structured_{legend}_fr.json", "w", encoding="utf-8") as f:
            json.dump(changes, f, indent=2, ensure_ascii=False)
        print(f"  [DEBUG] Translated (French) data saved to debug/structured_{legend}_fr.json")
            
        legend_file = os.path.join(LEGENDS_DIR, f"{legend.lower().replace(' ', '_')}.json")
        current_data = load_json(legend_file)
        
        if not current_data:
            print(f"  Warning: No existing data file found for {legend} at {legend_file}.")
            continue
            
        subset_data = {
            "abilities": current_data.get("abilities", {}),
            "tactics": current_data.get("tactics", {}),
            "patch_history": current_data.get("patch_history", [])
        }
        
        print(f"  [LLM] Merging changes with existing data...")
        # Keep the full season id (e.g. "29_1" -> "29.1") so two different
        # mid-season patches never collide onto the same patch_history label
        # (which would make the LLM overwrite one with the other).
        season_label = args.season.replace('_', '.')
        updated_subset = apply_legend_changes(legend, subset_data, changes, f"Saison {season_label} : {season_name}")
        
        with open(f"debug/merged_{legend}.json", "w", encoding="utf-8") as f:
            json.dump(updated_subset, f, indent=2, ensure_ascii=False)
        print(f"  [DEBUG] Merged data saved to debug/merged_{legend}.json")
        
        if isinstance(updated_subset, dict):
            current_data["abilities"] = updated_subset.get("abilities", current_data.get("abilities"))
            current_data["tactics"] = updated_subset.get("tactics", current_data.get("tactics"))
            current_data["patch_history"] = updated_subset.get("patch_history", current_data.get("patch_history"))
            
            save_json(legend_file, current_data)
            print(f"  [SUCCESS] Successfully applied patch to {legend}!")
        else:
            print(f"  [FAILED] Failed to merge data for {legend}. Invalid format returned by LLM.")

if __name__ == "__main__":
    main()
