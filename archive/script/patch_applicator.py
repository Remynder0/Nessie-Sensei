import os
import json
import re
import argparse
import requests
from glob import glob

LEGENDS_DIR = "public/data/legends"
SEASONS_DIR = "src/data/seasons"
LLM_URL = "http://127.0.0.1:1234/v1/chat/completions"
LLM_MODEL = "lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF"

def get_season_sort_key(filename):
    basename = os.path.basename(filename)
    match = re.search(r'season_(\d+)(?:_(\d+))?', basename)
    if match:
        major = int(match.group(1))
        minor = int(match.group(2)) if match.group(2) else 0
        return (major, minor)
    return (999, 999)

def clean_abilities_descriptions(abilities):
    for key in abilities:
        if "description" in abilities[key]:
            desc = abilities[key]["description"]
            clean_desc = re.sub(r'\n\n\[Patch.*?$', '', desc, flags=re.MULTILINE | re.DOTALL)
            abilities[key]["description"] = clean_desc
    return abilities

def _extract_json_object(content):
    json_str = content.strip()
    if json_str.startswith("```json"): json_str = json_str[7:]
    if json_str.startswith("```"): json_str = json_str[3:]
    if json_str.endswith("```"): json_str = json_str[:-3]
    match = re.search(r'\{.*\}', json_str.strip(), re.DOTALL)
    if match: json_str = match.group(0)
    json_str = re.sub(r',\s*([\]}])', r'\1', json_str)
    return json_str

def call_llm_update(legend_name, abilities, perks, patch_name, patch_details):
    sys_prompt = """You are an Apex Legends data updater.
Your task is to update a legend's abilities and perks based on new patch notes.
Rewrite the descriptions cleanly to incorporate the new values (damage, cooldowns, durations, etc).
Do NOT add [Patch...] tags. Integrate the changes naturally into the existing text.
If a cooldown is changed, update the "cooldown" field.

You MUST return ONLY a valid JSON object matching the exact structure below, with no markdown formatting, no code blocks, and no extra text.
{
  "abilities": {
    "passive": { "name": "...", "description": "...", "cooldown": "..." },
    "tactical": { "name": "...", "description": "...", "cooldown": "..." },
    "ultimate": { "name": "...", "description": "...", "cooldown": "..." }
  },
  "perks": {
    "level_2": {
      "left": { "name": "...", "description": "...", "recommended": true },
      "right": { "name": "...", "description": "...", "recommended": false }
    },
    "level_3": {
      "left": { "name": "...", "description": "...", "recommended": true },
      "right": { "name": "...", "description": "...", "recommended": false }
    }
  }
}"""

    user_prompt = f"""Legend: {legend_name}
Current Abilities:
{json.dumps(abilities, indent=2)}

Current Perks:
{json.dumps(perks, indent=2)}

New Patch ({patch_name}):
{json.dumps(patch_details, indent=2)}

Return the updated JSON object."""

    try:
        response = requests.post(
            LLM_URL,
            json={
                "model": LLM_MODEL,
                "messages": [
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.1,
                "max_tokens": 8192
            },
            timeout=600
        )
        if response.status_code == 400:
            print(f"  [LLM Error] 400 Bad Request. Try increasing context size in LM Studio.")
            return None
        response.raise_for_status()
        result = response.json()
        content = result['choices'][0]['message']['content'].strip()
        
        extracted_json = _extract_json_object(content)
        return json.loads(extracted_json)
    except Exception as e:
        print(f"  [LLM Error] Failed to update {legend_name}: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Apply patches to legends chronologically")
    parser.add_argument("--test-legend", type=str, help="Run only for a specific legend (e.g. Seer) for testing")
    args = parser.parse_args()

    legends = {}
    for filepath in glob(os.path.join(LEGENDS_DIR, "*.json")):
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            name = data.get("name", os.path.basename(filepath).replace('.json', '').capitalize())
            legends[name] = data
            legends[name]["_filepath"] = filepath
            legends[name]["patch_history"] = []
            if "abilities" in legends[name]:
                legends[name]["abilities"] = clean_abilities_descriptions(legends[name]["abilities"])

    season_files = glob(os.path.join(SEASONS_DIR, "*.json"))
    season_files.sort(key=get_season_sort_key)

    print(f"Found {len(season_files)} seasons. Processing chronologically...")

    for s_file in season_files:
        with open(s_file, "r", encoding="utf-8") as f:
            s_data = json.load(f)
        
        s_name = s_data.get("name", os.path.basename(s_file).replace('.json', ''))
        patches = s_data.get("patches", {})
        
        if not patches:
            continue
            
        print(f"--- Applying Season: {s_name} ({os.path.basename(s_file)}) ---")
        
        for leg_name, patch_list in patches.items():
            if args.test_legend and leg_name.lower() != args.test_legend.lower():
                continue
                
            if leg_name not in legends:
                print(f"  Warning: Legend '{leg_name}' not found in {LEGENDS_DIR}. Skipping.")
                continue
                
            # We combine all patches from the same season to avoid duplicate season names
            combined_details = []
            for patch_event in patch_list:
                if isinstance(patch_event, dict):
                    combined_details.extend(patch_event.get("details", []))
                
            if not combined_details:
                continue
                
            season_id = s_data.get("season", os.path.basename(s_file).replace('.json', '').replace('season_', ''))
            
            base_season = season_id.split('_')[0]
            if str(season_id).endswith('_2'):
                formatted_patch_name = f"Season {base_season} : {s_name} (Midseason)"
            else:
                formatted_patch_name = f"Season {base_season} : {s_name}"
            
            legends[leg_name]["patch_history"].append({
                "patch": formatted_patch_name,
                "details": combined_details
            })
            
            current_abilities = legends[leg_name].get("abilities", {})
            current_perks = legends[leg_name].get("tactics", {}).get("perks", {})
            
            updated_data = call_llm_update(
                leg_name,
                current_abilities,
                current_perks,
                formatted_patch_name,
                combined_details
            )
            
            if updated_data:
                if "abilities" in updated_data:
                    legends[leg_name]["abilities"] = updated_data["abilities"]
                if "perks" in updated_data and "tactics" in legends[leg_name]:
                    legends[leg_name]["tactics"]["perks"] = updated_data["perks"]

    print("Saving updated legends...")
    for leg_name, data in legends.items():
        if args.test_legend and leg_name.lower() != args.test_legend.lower():
            continue
            
        filepath = data.pop("_filepath")
        
        # The user requested Season 29 at the top, Season 1 at the bottom
        data["patch_history"].reverse()
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
    print("Done!")

if __name__ == "__main__":
    main()
