import os
import json

STRUCTURED_PATCHES_FILE = "public/data/structured_patches.json"
LEGENDS_DIR = "public/data/legends"

def load_json(filepath):
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def apply_patch_to_legend(legend_data, patch_name, changes):
    # Prepare details for patch_history
    details = []
    
    for change in changes:
        ability = str(change.get("ability", "Base")).lower()
        change_type = change.get("type", "Adjust")
        detail_text = change.get("detail", "")
        stats_changes = change.get("stats_changes", {})
        raw_text = change.get("raw_text", "")
        
        # 1. Add to patch history details
        hist_line = f"[{ability.capitalize()}] {change_type} -> {detail_text}"
        
        if stats_changes:
            stat_strings = [f"{k.capitalize()}: {v}" for k, v in stats_changes.items()]
            hist_line += f" ({', '.join(stat_strings)})"
            
        details.append(hist_line)
        
        # 2. Update the abilities object if it matches passive, tactical, or ultimate
        if ability in ["passive", "tactical", "ultimate"]:
            # Append note to description
            if "description" in legend_data["abilities"][ability]:
                # Avoid duplicating the same note if script is run multiple times
                if detail_text not in legend_data["abilities"][ability]["description"]:
                    update_str = f"\n\n[Patch {patch_name} - {change_type}]: {detail_text}"
                    if stats_changes:
                        stat_strings = [f"{k.capitalize()}: {v}" for k, v in stats_changes.items()]
                        update_str += f" ({', '.join(stat_strings)})"
                    legend_data["abilities"][ability]["description"] += update_str
            
            # If there's a cooldown change specifically, update the cooldown string
            if "cooldown" in stats_changes:
                legend_data["abilities"][ability]["cooldown"] = stats_changes["cooldown"]

    # Add to patch history if not already there
    patch_history = legend_data.get("patch_history", [])
    already_exists = any(p.get("patch") == patch_name for p in patch_history)
    
    if not already_exists and details:
        # Insert at the beginning (latest patch first)
        patch_history.insert(0, {
            "patch": patch_name,
            "details": details
        })
        legend_data["patch_history"] = patch_history
        return True
        
    return False

def main():
    patches_data = load_json(STRUCTURED_PATCHES_FILE)
    if not patches_data:
        print(f"No structured patches found at {STRUCTURED_PATCHES_FILE}")
        return

    updated_count = 0
    
    # We will prioritize applying the French locales for the patch_history if available,
    # or process both? Usually, the legend data is language-agnostic but the UI translates it.
    # Actually, patch_history is currently hardcoded in French in legends_data_scraper.py.
    # Let's use the fr-fr locale if it exists in the structured patch.
    
    for slug, patch in patches_data.items():
        date = patch.get("date", "")
        locales = patch.get("locales", {})
        
        # Prefer French for the final application if it exists, otherwise English
        locale_data = locales.get("fr-fr") or locales.get("en-us")
        if not locale_data:
            continue
            
        title = locale_data.get("title", slug)
        legends_changes = locale_data.get("legends", [])
        
        if not isinstance(legends_changes, list):
            print(f"Warning: legends data for {slug} is not a list. Skipping.")
            continue
            
        for legend_update in legends_changes:
            name = legend_update.get("name", "").strip()
            changes = legend_update.get("changes", [])
            
            if not name or not changes:
                continue
                
            filename = name.lower().replace(' ', '_') + ".json"
            filepath = os.path.join(LEGENDS_DIR, filename)
            
            legend_data = load_json(filepath)
            if legend_data:
                # Apply the patch
                changed = apply_patch_to_legend(legend_data, title, changes)
                if changed:
                    save_json(filepath, legend_data)
                    print(f"Applied patch '{title}' to {name}")
                    updated_count += 1
            else:
                print(f"Warning: Legend file for {name} ({filename}) not found.")

    print(f"Finished applying patches. Updated {updated_count} legend files.")

if __name__ == "__main__":
    main()
