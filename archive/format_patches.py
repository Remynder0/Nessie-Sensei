import os
import json
import requests
import time

# Optional but strongly recommended: pip install json-repair
# Falls back to a regex-only cleanup if the library isn't installed.
try:
    from json_repair import repair_json
    HAS_JSON_REPAIR = True
except ImportError:
    HAS_JSON_REPAIR = False

RAW_PATCHES_FILE = "public/data/raw_patches.json"
STRUCTURED_PATCHES_FILE = "public/data/structured_patches.json"

# RECOMMENDED LLMs for 10GB/12GB VRAM via LM Studio:
# - Llama-3-8B-Instruct (excellent at JSON and reasoning)
# - Qwen2.5-7B-Instruct (very strong instruction following)
# - Mistral-Nemo-12B-Instruct (if you have 12GB VRAM, very smart)
# Make sure to load a Q4 or Q5 quantized GGUF version.
LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions"

SYSTEM_PROMPT = """You are an expert data parser. Your job is to read Apex Legends patch notes and extract the exact changes made to each Legend into a strictly structured JSON format.
You must return ONLY a JSON array, nothing else. Do not wrap in markdown tags like ```json.
CRITICAL: Your output must be 100% valid JSON. Do NOT use unescaped double quotes inside your string values. If you need quotes inside a string, use single quotes (') or escape them properly (\"). 

For each legend mentioned in the text, extract:
- name: The legend's name.
- changes: A list of changes. Each change should have:
  - ability: The ability modified (e.g., "Passive", "Tactical", "Ultimate", "Perks", or "Base").
  - perk_name: If the ability modified is a "Perk", extract the exact name of the perk being modified (e.g. "Double Dose", "Piercing Vision"). If not a perk, leave as empty string.
  - type: Classify the change as exactly one of: "Buff", "Nerf", "Rework", or "Adjust".
  - detail: A short summary of the overall change in one sentence.
  - stats_changes: A dictionary of specific stat changes. Keys can be anything relevant (e.g., "cooldown", "damage", "projectile speed", "snare duration", "shield regen", "charges"). Values should be the change (e.g., "10s -> 15s" or "Increased by 10%"). Leave empty {} if no exact numbers or stats changed.
  - raw_text: The exact original text of the change from the patch notes.

Example Output:
[
  {
    "name": "Ash",
    "changes": [
      {
        "ability": "Tactical",
        "perk_name": "",
        "type": "Buff",
        "detail": "Snare duration and max distance increased, but cooldown is longer.",
        "stats_changes": {
          "snare duration": "3s -> 5s",
          "max distance": "increased to 50m",
          "cooldown": "20s -> 25s"
        },
        "raw_text": "Arc Snare duration increased to 5 seconds. Max distance increased. Cooldown increased to 25s."
      }
    ]
  }
]
"""

import re

def _extract_json_array(content):
    """Strip markdown fences and isolate the JSON array from the raw model output."""
    json_str = content.strip()
    if json_str.startswith("```json"):
        json_str = json_str[7:]
    if json_str.startswith("```"):
        json_str = json_str[3:]
    if json_str.endswith("```"):
        json_str = json_str[:-3]
    json_str = json_str.strip()

    # Extract everything between the first [ and the last ]
    match = re.search(r'\[.*\]', json_str, re.DOTALL)
    if match:
        json_str = match.group(0)

    # Fix common JSON error: trailing commas
    json_str = re.sub(r',\s*([\]}])', r'\1', json_str)
    return json_str


def _parse_json_with_fallback(json_str):
    """Try strict parsing first, then fall back to json-repair for malformed output."""
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


def call_llm(markdown_text, locale, retries=2):
    prompt = SYSTEM_PROMPT
    if locale == "fr-fr":
        prompt += "\nIMPORTANT: The original patch notes might be in English. You MUST translate the 'detail', 'stats_changes' values, and 'raw_text' into French before outputting the JSON."

    payload = {
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"Parse the following patch notes:\n\n{markdown_text}"}
        ],
        "temperature": 0.1,
        "max_tokens": 8192,
        "stream": False
    }

    last_error = None
    for attempt in range(1, retries + 1):
        content = None
        try:
            response = requests.post(LM_STUDIO_URL, json=payload, timeout=600)
            response.raise_for_status()
            result = response.json()
            content = result['choices'][0]['message']['content']

            json_str = _extract_json_array(content)
            return _parse_json_with_fallback(json_str)

        except Exception as e:
            last_error = e
            print(f"  Attempt {attempt}/{retries} failed: {e}")
            if content is not None and 'Expecting' in str(e):
                print("  --- Problematic Output (truncated) ---")
                print(content[:500] + "...\n" if len(content) > 500 else content)
            if attempt < retries:
                time.sleep(2)

    print(f"Error calling LLM or parsing JSON after {retries} attempts: {last_error}")
    return None

def main():
    if not os.path.exists(RAW_PATCHES_FILE):
        print(f"File {RAW_PATCHES_FILE} not found. Run ea_patch_scraper.py first.")
        return
        
    with open(RAW_PATCHES_FILE, 'r', encoding='utf-8') as f:
        raw_patches = json.load(f)
        
    structured_patches = {}
    
    for slug, patch in raw_patches.items():
        print(f"Processing patch: {slug}")
        structured_patches[slug] = {
            "date": patch["date"],
            "locales": {}
        }
        
        if "en-us" not in patch["locales"]:
            continue
            
        data = patch["locales"]["en-us"]
        raw_markdown = data["raw_markdown"]
        if not raw_markdown.strip():
            continue
            
        for target_locale in ["en-us", "fr-fr"]:
            print(f"  Sending text to LM Studio for {target_locale} formatting...")
            structured_data = call_llm(raw_markdown, target_locale)

            if structured_data is not None:
                structured_patches[slug]["locales"][target_locale] = {
                    "title": data["title"],
                    "legends": structured_data
                }
                print(f"  Successfully parsed {len(structured_data)} legends for {target_locale}.")
            else:
                print(f"  Failed to parse text for {target_locale}.")
                structured_patches[slug]["locales"][target_locale] = {
                    "title": data["title"],
                    "legends": [],
                    "raw_markdown_failed": raw_markdown
                }
                
            time.sleep(1)
            
    with open(STRUCTURED_PATCHES_FILE, 'w', encoding='utf-8') as f:
        json.dump(structured_patches, f, indent=2, ensure_ascii=False)
        
    print(f"Structured patches saved to {STRUCTURED_PATCHES_FILE}. Please review them manually before applying!")

if __name__ == "__main__":
    main()
