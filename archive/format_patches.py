import os
import json
import requests
import time

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

For each legend mentioned in the text, extract:
- name: The legend's name.
- changes: A list of changes. Each change should have:
  - ability: The ability modified (e.g., "Passive", "Tactical", "Ultimate", or "Base").
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

def call_llm(markdown_text):
    payload = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Parse the following patch notes:\n\n{markdown_text}"}
        ],
        "temperature": 0.1,
        "max_tokens": -1,
        "stream": False
    }
    
    try:
        response = requests.post(LM_STUDIO_URL, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        content = result['choices'][0]['message']['content']
        
        # Clean up markdown formatting if the model wrapped it in ```json
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
            
        return json.loads(content.strip())
    except Exception as e:
        print(f"Error calling LLM or parsing JSON: {e}")
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
        
        for locale, data in patch["locales"].items():
            raw_markdown = data["raw_markdown"]
            if not raw_markdown.strip():
                structured_patches[slug]["locales"][locale] = []
                continue
                
            print(f"  Sending {locale} text to LM Studio...")
            structured_data = call_llm(raw_markdown)
            
            if structured_data:
                structured_patches[slug]["locales"][locale] = {
                    "title": data["title"],
                    "legends": structured_data
                }
                print(f"  Successfully parsed {len(structured_data)} legends.")
            else:
                print(f"  Failed to parse {locale} text.")
                structured_patches[slug]["locales"][locale] = {
                    "title": data["title"],
                    "legends": [],
                    "raw_markdown_failed": raw_markdown
                }
                
            # Sleep slightly to not hammer the local GPU if processing multiple
            time.sleep(1)
            
    with open(STRUCTURED_PATCHES_FILE, 'w', encoding='utf-8') as f:
        json.dump(structured_patches, f, indent=2, ensure_ascii=False)
        
    print(f"Structured patches saved to {STRUCTURED_PATCHES_FILE}. Please review them manually before applying!")

if __name__ == "__main__":
    main()
