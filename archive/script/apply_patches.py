import os
import json
import requests
import time
import re

# Optional but strongly recommended: pip install json-repair
try:
    from json_repair import repair_json
    HAS_JSON_REPAIR = True
except ImportError:
    HAS_JSON_REPAIR = False

STRUCTURED_PATCHES_FILE = "public/data/structured_patches.json"
LEGENDS_DIR = "public/data/legends"

LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions"

SEASONS_MAP = {
    "wild frontier": 1, "battle charge": 2, "meltdown": 3, "assimilation": 4, 
    "fortune's favor": 5, "boosted": 6, "ascension": 7, "mayhem": 8, 
    "legacy": 9, "emergence": 10, "escape": 11, "defiance": 12, 
    "saviors": 13, "hunted": 14, "eclipse": 15, "revelry": 16, 
    "arsenal": 17, "resurrection": 18, "ignite": 19, "breakout": 20, 
    "upheaval": 21, "shockwave": 22, "overclocked": 29
}

SYSTEM_PROMPT = """You are an expert game data analyst for Apex Legends.
Your task is to merge new patch notes into the existing JSON data of a Legend.
You will be provided with a JSON object containing the legend's CURRENT data ('abilities', 'tactics' which contains perks, and 'patch_history'), and a list of new patch changes to apply.

INSTRUCTIONS:
1. ABILITY REWRITING: For any ability or perk modified in the patch, rewrite its "description", "name" or "cooldown" naturally to reflect the new state (e.g. if cooldown changed from 20s to 25s, just update the cooldown value or mention it naturally in the text). Do NOT append a log like "[Patch X: Buff]" inside the description field itself. Make it read like the official current in-game description.
2. PATCH HISTORY: Prepend the new patch to the "patch_history" array. Ensure the changes are summarized professionally. If the patch already exists in the history, just add the new details to its "details" array without duplicating.
3. PRESERVATION: Do NOT delete, alter, or remove any abilities or perks that were NOT mentioned in the patch notes. Return them exactly as they were.

OUTPUT FORMAT:
Return ONLY a valid JSON object matching the input structure. It MUST contain exactly these keys at the root: "abilities", "tactics", and "patch_history".
Do NOT wrap the output in markdown (no ```json). Output raw valid JSON only. Use proper escaping for quotes.
"""

def load_json(filepath):
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def format_patch_name(title):
    t_lower = title.lower()
    midseason = "(Midseason)" if "midseason" in t_lower else ""
    
    found_season_name = None
    found_season_num = None
    
    for name, num in SEASONS_MAP.items():
        if name in t_lower:
            found_season_name = name.capitalize()
            found_season_num = num
            break
            
    if found_season_name:
        base = f"Saison {found_season_num} : {found_season_name}"
        if midseason:
            base += f" {midseason}"
        return base
        
    clean_title = title.replace("Apex Legends™:", "").replace("Apex Legends:", "").strip()
    clean_title = clean_title.replace("Patch Notes", "").replace("- EA Officiel", "").strip()
    
    if midseason and "midseason" not in clean_title.lower():
        clean_title += f" {midseason}"
        
    return clean_title.strip()

def _extract_json_object(content):
    json_str = content.strip()
    if json_str.startswith("```json"):
        json_str = json_str[7:]
    if json_str.startswith("```"):
        json_str = json_str[3:]
    if json_str.endswith("```"):
        json_str = json_str[:-3]
    json_str = json_str.strip()

    # Extract everything between the first { and the last }
    match = re.search(r'\{.*\}', json_str, re.DOTALL)
    if match:
        json_str = match.group(0)

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

def call_llm(legend_name, existing_data_subset, new_changes, patch_title, retries=2):
    formatted_patch = format_patch_name(patch_title)
    
    user_prompt = f"""Legend: {legend_name}
New Patch Name to add to history: "{formatted_patch}"

--- NEW PATCH CHANGES TO APPLY ---
{json.dumps(new_changes, indent=2, ensure_ascii=False)}

--- CURRENT LEGEND DATA (NEEDS UPDATING) ---
{json.dumps(existing_data_subset, indent=2, ensure_ascii=False)}

Please output the updated CURRENT LEGEND DATA JSON."""

    payload = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 8192,
        "stream": False
    }

    last_error = None
    for attempt in range(1, retries + 1):
        content = None
        try:
            print(f"    -> LLM Request Attempt {attempt}...")
            response = requests.post(LM_STUDIO_URL, json=payload, timeout=600)
            response.raise_for_status()
            result = response.json()
            content = result['choices'][0]['message']['content']

            json_str = _extract_json_object(content)
            parsed_data = _parse_json_with_fallback(json_str)
            
            # Basic validation
            if not isinstance(parsed_data, dict) or "abilities" not in parsed_data:
                raise ValueError("LLM did not return a valid JSON object with 'abilities'.")
                
            return parsed_data

        except Exception as e:
            last_error = e
            print(f"    -> Failed: {e}")
            if attempt < retries:
                time.sleep(2)

    print(f"Error calling LLM or parsing JSON after {retries} attempts: {last_error}")
    return None

def main():
    patches_data = load_json(STRUCTURED_PATCHES_FILE)
    if not patches_data:
        print(f"No structured patches found at {STRUCTURED_PATCHES_FILE}")
        return

    updated_count = 0
    
    for slug, patch in patches_data.items():
        locales = patch.get("locales", {})
        
        # Prefer French locale if available for patching
        locale_data = locales.get("fr-fr") or locales.get("en-us")
        if not locale_data:
            continue
            
        title = locale_data.get("title", slug)
        legends_changes = locale_data.get("legends", [])
        
        if not isinstance(legends_changes, list):
            continue
            
        print(f"Processing patch: {title}")
        
        for legend_update in legends_changes:
            name = legend_update.get("name", "").strip()
            changes = legend_update.get("changes", [])
            
            if not name or not changes:
                continue
                
            filename = name.lower().replace(' ', '_') + ".json"
            filepath = os.path.join(LEGENDS_DIR, filename)
            
            legend_data = load_json(filepath)
            if legend_data:
                print(f"  Updating {name}...")
                
                # Extract subset of data to send to LLM
                subset_data = {
                    "abilities": legend_data.get("abilities", {}),
                    "tactics": legend_data.get("tactics", {}),
                    "patch_history": legend_data.get("patch_history", [])
                }
                
                updated_subset = call_llm(name, subset_data, changes, title)
                
                if updated_subset:
                    # Merge back into original data
                    legend_data["abilities"] = updated_subset.get("abilities", legend_data["abilities"])
                    legend_data["tactics"] = updated_subset.get("tactics", legend_data["tactics"])
                    legend_data["patch_history"] = updated_subset.get("patch_history", legend_data["patch_history"])
                    
                    save_json(filepath, legend_data)
                    print(f"  [SUCCESS] Applied patch '{title}' to {name}")
                    updated_count += 1
                else:
                    print(f"  [FAILED] Could not apply patch to {name} via LLM.")

    print(f"Finished applying patches. Updated {updated_count} legend files.")

if __name__ == "__main__":
    main()
