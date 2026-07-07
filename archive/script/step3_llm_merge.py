import os
import json
import argparse
import requests
import re
import time
from datetime import datetime, timedelta

try:
    from json_repair import repair_json
    HAS_JSON_REPAIR = True
except ImportError:
    HAS_JSON_REPAIR = False

SEASONS_DIR = "src/data/seasons"
DEBUG_DIR = "debug"

LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions"

def load_json(filepath):
    if not os.path.exists(filepath): return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def parse_date(date_str):
    try:
        clean_date = re.sub(r'(?<=\d)(st|nd|rd|th)\b', '', date_str)
        return datetime.strptime(clean_date, "%B %d, %Y")
    except:
        return None

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
            if response.status_code == 400:
                print(f"    -> LLM returned 400 Bad Request. Check LM Studio context settings.")
                return None
            response.raise_for_status()
            return response.json()['choices'][0]['message']['content']
        except Exception as e:
            print(f"    -> Failed: {e}")
            time.sleep(2)
    return None

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
            except:
                pass
        raise e

def merge_season_patches(season_name, target_start, target_end, ea_text, wiki_text):
    sys_prompt = f"""You are an expert game data analyst for Apex Legends.
Your task is to analyze raw patch notes from EA and the Wiki for a specific season, and merge them into a strict, structured JSON format.

INSTRUCTIONS:
1. STRICT TIMEFRAME RULE: ONLY include patches published between {target_start.date()} and {target_end.date()}. Do NOT include patches from the next season. This is the exact same rule used by the scraper.
2. Extract ALL legend ability/perk changes (Buffs, Nerfs, Adjusts, Fixes).
3. CLASSIFICATION BY ABILITY NAME: You must classify changes as [Passive], [Tactical], or [Ultimate] by recognizing the ACTUAL IN-GAME NAME of the ability (e.g., if you see "Double Time" for Bangalore, you must know it is her [Passive]). Early patch notes do not explicitly say "Passive", so rely on your Apex Legends knowledge to identify them from the ability names.
4. CLASSIFYING PERKS: The word "Upgrades" in the patch notes explicitly means "Perks". If a change modifies a Legend Upgrade/Perk (added in Season 20), classify it as [Perks]. You MUST recognize it by the word "Upgrades", the actual NAME of the upgrade, or the level (e.g., "Level 2"). Do NOT classify something as a Perk just because the word "perk" appears in older patch notes (e.g. the old "Low Profile" or "Fortified" traits), those are [Base] or [Passive] traits.
5. Merge the data from EA and the Wiki to avoid duplicates.
6. Group the changes by Legend name.
7. Format the output STRICTLY as a JSON object containing a "patches" key. 

EXPECTED FORMAT:
{{
  "patches": {{
    "Ballistic": [
      {{
        "patch": "Nom du patch (ex: Saison X, ou Takeover)",
        "details": [
          "[Base] Buff -> Le niveau de base a été amélioré.",
          "[Passive] Nerf -> Double Time : réduction de vitesse.",
          "[Ultimate] Buff -> L'ultime accorde un bonus de vitesse.",
          "[Perks] Adjust -> [Nom du Perk] : description du changement."
        ]
      }}
    ]
  }}
}}
"""
    user_prompt = f"""Target Season: {season_name}
Valid Timeframe: {target_start.date()} to {target_end.date()}

--- EA RAW DATA ---
{ea_text if ea_text.strip() else "No EA data found."}

--- WIKI RAW DATA ---
{wiki_text if wiki_text.strip() else "No Wiki data found."}

IMPORTANT: If both EA and Wiki data are empty or contain "No data found", you MUST output exactly {{"patches": {{}}}} and nothing else. Do not hallucinate patch notes.

Please output ONLY the merged JSON object."""

    content = call_llm([
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_prompt}
    ])
    
    if not content: return None
    
    with open(f"{DEBUG_DIR}/llm_raw_output.txt", "w", encoding="utf-8") as f:
        f.write(content)
        
    try:
        return _parse_json_with_fallback(_extract_json_object(content))
    except Exception as e:
        print(f"Failed to parse LLM JSON output: {e}")
        return None

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
        
        ea_file = os.path.join(DEBUG_DIR, f"season_{season_id}_ea.txt")
        wiki_file = os.path.join(DEBUG_DIR, f"season_{season_id}_wiki.txt")
        
        ea_text = ""
        wiki_text = ""
        
        if os.path.exists(ea_file):
            with open(ea_file, "r", encoding="utf-8") as f:
                ea_text = f.read()
        if os.path.exists(wiki_file):
            with open(wiki_file, "r", encoding="utf-8") as f:
                wiki_text = f.read()
                
        print(f"[Step 3 - LLM Merge] Merging EA and Wiki data for Season {season_id}...")
        merged_data = merge_season_patches(season_data.get("name"), target_start, target_end, ea_text, wiki_text)
        
        if not merged_data or not isinstance(merged_data, dict):
            print(f"[FAILED] LLM failed to return a valid JSON object for Season {season_id}.\n")
            continue
            
        patches = merged_data.get("patches", {})
        season_data["patches"] = patches
        save_json(season_file, season_data)
        
        print(f"[SUCCESS] Saved patches for {len(patches.keys())} legends into {season_file}!\n")

if __name__ == "__main__":
    main()
