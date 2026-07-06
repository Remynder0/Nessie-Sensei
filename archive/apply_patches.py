import os
import json
import re

STRUCTURED_PATCHES_FILE = "public/data/structured_patches.json"
LEGENDS_DIR = "public/data/legends"

SEASONS_MAP = {
    "wild frontier": 1, "battle charge": 2, "meltdown": 3, "assimilation": 4, 
    "fortune's favor": 5, "boosted": 6, "ascension": 7, "mayhem": 8, 
    "legacy": 9, "emergence": 10, "escape": 11, "defiance": 12, 
    "saviors": 13, "hunted": 14, "eclipse": 15, "revelry": 16, 
    "arsenal": 17, "resurrection": 18, "ignite": 19, "breakout": 20, 
    "upheaval": 21, "shockwave": 22, "overclocked": 29
}

def load_json(filepath):
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

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

def strip_prefix(text):
    # Removes "[Ability] Type -> " prefix
    return re.sub(r'^\[.*?\]\s*.*?->\s*', '', text)

def normalize_text(text):
    return re.sub(r'[^a-z0-9]', '', text.lower())

def is_duplicate_detail(detail_text, existing_lines):
    norm_detail = normalize_text(strip_prefix(detail_text))
    if len(norm_detail) < 10:
        return False
        
    for existing_line in existing_lines:
        norm_exist = normalize_text(strip_prefix(existing_line))
        if norm_detail in norm_exist or norm_exist in norm_detail:
            return True
    return False

def format_legacy_history(patch_history):
    changed = False
    for p in patch_history:
        old_patch = p.get("patch", "")
        new_patch = format_patch_name(old_patch)
        if old_patch != new_patch:
            p["patch"] = new_patch
            changed = True
            
        details = p.get("details", [])
        new_details = []
        i = 0
        original_details = list(details)
        
        while i < len(details):
            line = details[i]
            if line.startswith("[") and line.endswith("]") and i + 1 < len(details) and not details[i+1].startswith("["):
                ability = line
                text = details[i+1]
                new_details.append(f"{ability} Adjust -> {text}")
                i += 2
            else:
                new_details.append(line)
                i += 1
                
        if new_details != original_details:
            p["details"] = new_details
            changed = True
            
    return changed

def apply_patch_to_legend(legend_data, raw_patch_name, changes):
    patch_name = format_patch_name(raw_patch_name)
    patch_history = legend_data.get("patch_history", [])
    
    changed = format_legacy_history(patch_history)
    new_details = []
    
    for change in changes:
        ability = str(change.get("ability", "Base")).lower()
        change_type = change.get("type", "Adjust")
        detail_text = change.get("detail", "")
        stats_changes = change.get("stats_changes", {})
        perk_name = change.get("perk_name", "")
        
        hist_ability = f"{ability.capitalize()} - {perk_name}" if ability == "perks" and perk_name else ability.capitalize()
        hist_line = f"[{hist_ability}] {change_type} -> {detail_text}"
        
        if stats_changes:
            stat_strings = [f"{k.capitalize()}: {v}" for k, v in stats_changes.items()]
            hist_line += f" ({', '.join(stat_strings)})"
            
        new_details.append(hist_line)
        
        # Update descriptions
        if ability in ["passive", "tactical", "ultimate"]:
            if "description" in legend_data["abilities"][ability]:
                if detail_text not in legend_data["abilities"][ability]["description"]:
                    update_str = f"\n\n[Patch {patch_name} - {change_type}]: {detail_text}"
                    if stats_changes:
                        stat_strings = [f"{k.capitalize()}: {v}" for k, v in stats_changes.items()]
                        update_str += f" ({', '.join(stat_strings)})"
                    legend_data["abilities"][ability]["description"] += update_str
            
            if "cooldown" in stats_changes:
                legend_data["abilities"][ability]["cooldown"] = stats_changes["cooldown"]

        if ability == "perks" and perk_name and "tactics" in legend_data and "perks" in legend_data["tactics"]:
            perks_obj = legend_data["tactics"]["perks"]
            for level in ["level_2", "level_3"]:
                if level in perks_obj:
                    for side in ["left", "right"]:
                        if side in perks_obj[level]:
                            if perks_obj[level][side].get("name", "").lower() == perk_name.lower():
                                if detail_text not in perks_obj[level][side].get("description", ""):
                                    update_str = f"\n\n[Patch {patch_name} - {change_type}]: {detail_text}"
                                    if stats_changes:
                                        stat_strings = [f"{k.capitalize()}: {v}" for k, v in stats_changes.items()]
                                        update_str += f" ({', '.join(stat_strings)})"
                                    perks_obj[level][side]["description"] += update_str
    
    if new_details:
        target_patch = None
        for p in patch_history:
            if p.get("patch") == patch_name:
                target_patch = p
                break
                
        if not target_patch:
            for p in patch_history:
                if patch_name.split(":")[0] == p.get("patch", "").split(":")[0]:
                    overlap = False
                    for new_line in new_details:
                        if is_duplicate_detail(new_line, p.get("details", [])):
                            overlap = True
                            break
                    if overlap:
                        target_patch = p
                        if "Midseason" in patch_name and "Midseason" not in p["patch"]:
                            p["patch"] = patch_name
                            changed = True
                        break
                        
        if target_patch:
            added_any = False
            for new_line in new_details:
                # Check globally across the entire history just to be absolutely sure
                global_dup = False
                for hist_p in patch_history:
                    if is_duplicate_detail(new_line, hist_p.get("details", [])):
                        global_dup = True
                        break
                if not global_dup:
                    target_patch["details"].append(new_line)
                    added_any = True
            if added_any:
                changed = True
        else:
            final_details = []
            for new_line in new_details:
                global_dup = False
                for hist_p in patch_history:
                    if is_duplicate_detail(new_line, hist_p.get("details", [])):
                        global_dup = True
                        break
                if not global_dup:
                    final_details.append(new_line)
                    
            if final_details:
                patch_history.insert(0, {
                    "patch": patch_name,
                    "details": final_details
                })
                changed = True
        
    legend_data["patch_history"] = patch_history
    return changed

def main():
    patches_data = load_json(STRUCTURED_PATCHES_FILE)
    if not patches_data:
        print(f"No structured patches found at {STRUCTURED_PATCHES_FILE}")
        return

    updated_count = 0
    
    for slug, patch in patches_data.items():
        date = patch.get("date", "")
        locales = patch.get("locales", {})
        
        locale_data = locales.get("fr-fr") or locales.get("en-us")
        if not locale_data:
            continue
            
        title = locale_data.get("title", slug)
        legends_changes = locale_data.get("legends", [])
        
        if not isinstance(legends_changes, list):
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
                changed = apply_patch_to_legend(legend_data, title, changes)
                if changed:
                    save_json(filepath, legend_data)
                    print(f"Applied patch '{title}' to {name}")
                    updated_count += 1

    print(f"Finished applying patches. Updated {updated_count} legend files.")

if __name__ == "__main__":
    main()
