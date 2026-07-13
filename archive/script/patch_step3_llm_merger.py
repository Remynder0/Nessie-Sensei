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

LEGENDS_DIR = "public/data/legends"
SEASONS_DIR = "src/data/seasons"
DEBUG_DIR = "debug"

LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions"

def get_all_legends_context():
    context = {}
    if not os.path.exists(LEGENDS_DIR): return context
    
    for filename in os.listdir(LEGENDS_DIR):
        if not filename.endswith('.json'): continue
        filepath = os.path.join(LEGENDS_DIR, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                name = data.get('name', filename.replace('.json', '').capitalize())
                abilities = data.get('abilities', {})
                tactics = data.get('tactics', {})
                perks = tactics.get('perks', {})
                
                context[name] = {
                    "passive": abilities.get("passive", {}).get("name", "Unknown"),
                    "tactical": abilities.get("tactical", {}).get("name", "Unknown"),
                    "ultimate": abilities.get("ultimate", {}).get("name", "Unknown")
                }
                
                perk_names = []
                for level, choices in perks.items():
                    for choice_key, choice_data in choices.items():
                        if "name" in choice_data:
                            perk_names.append(choice_data["name"])
                
                if perk_names:
                    context[name]["perks"] = perk_names
        except Exception:
            pass
    return context

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
        "max_tokens": 2000,
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

def merge_season_patches(season_name, target_start, target_end, ea_text, wiki_text, legends_context_dict):
    sys_prompt = f"""You are an expert game data analyst for Apex Legends.
Your task is to analyze raw patch notes from EA and the Wiki for a specific season, and merge them into a strict, structured JSON format.

INSTRUCTIONS:
1. STRICT TIMEFRAME RULE: ONLY include patches published between {target_start.date()} and {target_end.date()}. Do NOT include patches from the next season.
2. Extract ALL legend ability/perk changes. Possible actions are: Buff, Nerf, Adjust, Fix, New, Rework.
3. CLASSIFICATION: You must classify changes EXACTLY as [Passive], [Tactical], [Ultimate], [Perks], or [Base].
   To do this, use the provided LEGENDS ABILITIES DICTIONARY. Find the name of the ability in the dictionary to know exactly what category it belongs to! Do not guess!
4. REMOVE THE ABILITY NAME FROM THE TAG: Do not output "[Ability Name] Buff". The tag must be strictly the category. Format the text IN ENGLISH as: `[Category] Action -> Ability Name: Description of what changed.`
5. "INTRODUCED" vs "REWORK": If a patch says a legend was released, format it EXACTLY as: `[Base] Introduced -> Legend released this season.`
   HOWEVER, if it is a major REWORK (like Revenant in Season 18 or Lifeline in Season 22), do NOT use "Introduced". Instead, use `[Base] Rework -> Legend was completely reworked this season.` or `[Category] Rework -> Ability Name: (description)`.
6. CLASSIFYING PERKS: The word "Upgrades" or "Level 2/3" explicitly means "Perks". If a change modifies a Legend Upgrade/Perk, classify it as [Perks].
7. Format the output STRICTLY as a JSON object containing a "patches" key. Group changes by Legend name.
8. ALL OUTPUT TEXT MUST BE IN ENGLISH.

EXPECTED FORMAT:
{{
  "patches": {{
    "Ballistic": [
      {{
        "patch": "Patch Name (e.g. Season 18 Patch)",
        "details": [
          "Introduced -> Legend released this season.",
          "Rework -> Legend was completely reworked this season.",
          "[Passive] Nerf -> Double Time: Movement speed reduced.",
          "[Ultimate] Rework -> Forged Shadows: Replaced previous ultimate.",
          "[Tactical] New -> Shadow Pounce: New ability added.",
          "[Perks] Adjust -> Perk Name: Description of the change."
        ]
      }}
    ]
  }}
}}
"""
    
    # Filter the context dictionary to only include legends mentioned in the text to save tokens
    combined_text = (ea_text + " " + wiki_text).lower()
    relevant_context = {
        name: data for name, data in legends_context_dict.items()
        if name.lower() in combined_text
    }
    
    user_prompt = f"""Target Season: {season_name}
Valid Timeframe: {target_start.date()} to {target_end.date()}

--- LEGENDS ABILITIES DICTIONARY ---
{json.dumps(relevant_context, indent=2)}

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
    legends_context_dict = get_all_legends_context()
    
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
        merged_data = merge_season_patches(season_data.get("name"), target_start, target_end, ea_text, wiki_text, legends_context_dict)
        
        if not merged_data or not isinstance(merged_data, dict):
            print(f"[FAILED] LLM failed to return a valid JSON object for Season {season_id}.\n")
            continue
            
        patches = merged_data.get("patches", {})
        season_data["patches"] = patches
        save_json(season_file, season_data)
        
        print(f"[SUCCESS] Saved patches for {len(patches.keys())} legends into {season_file}!\n")

if __name__ == "__main__":
    main()
