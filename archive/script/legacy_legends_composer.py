import json
import sys
from random import choice, choices, shuffle

# Forcer l'encodage UTF-8 pour afficher correctement les émojis dans la console Windows
sys.stdout.reconfigure(encoding='utf-8')

# ---------------------------------------------------------------------------
# Chargement des données
# ---------------------------------------------------------------------------

HISTORY_FILE = "history.json"

def load_history():
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_history(history):
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=4, ensure_ascii=False)

def get_data(path="Legends.json"):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        legends = data.get("Legends", [])
        synergies = data.get("SPECIAL_SYNERGIES", [])
        anti_synergies = data.get("ANTI_SYNERGIES", [])
        if not legends:
            raise ValueError("Aucune légende trouvée dans le fichier.")
        return legends, synergies, anti_synergies
    except FileNotFoundError:
        raise SystemExit(f"Erreur : '{path}' introuvable.")
    except json.JSONDecodeError:
        raise SystemExit(f"Erreur : '{path}' n'est pas un JSON valide.")


# ---------------------------------------------------------------------------
# Analyse d'une légende
# ---------------------------------------------------------------------------

COMPLEMENTARITY_MATRIX = {
    # Fortement complémentaires (1.0)
    ("barrier", "repositioning"): 1.0,
    ("scanning", "damage"): 1.0,
    ("control", "shield"): 1.0,
    ("control", "healing"): 1.0,
    ("repositioning", "damage"): 1.0,
    # Moyennement complémentaires (0.5)
    ("barrier", "map_info"): 0.5,
    ("map_info", "repositioning"): 0.5,
    ("control", "damage"): 0.5,
}

def get_complementarity(stat1, stat2):
    return COMPLEMENTARITY_MATRIX.get((stat1, stat2), 
           COMPLEMENTARITY_MATRIX.get((stat2, stat1), 0.0))

# ---------------------------------------------------------------------------
# Évaluation d'une équipe
# ---------------------------------------------------------------------------

def evaluate_team(team):
    """
    Évalue une équipe en calculant les synergies par complémentarité.
    """
    total_mobility_score = sum(l.get("stats", {}).get("mobility", 0) for l in team)
    avg_mobility = total_mobility_score / len(team) if team else 0

    # Cumul des stats de l'équipe
    team_stats = {}
    for legend in team:
        for stat, value in legend.get("stats", {}).items():
            team_stats[stat] = team_stats.get(stat, 0) + value

    synergies_found = []
    total_synergy_score = 0.0

    # On évalue les paires de stats complémentaires présentes dans l'équipe
    stats_keys = list(team_stats.keys())
    for i in range(len(stats_keys)):
        for j in range(i + 1, len(stats_keys)):
            stat1 = stats_keys[i]
            stat2 = stats_keys[j]
            coeff = get_complementarity(stat1, stat2)
            if coeff > 0:
                score = (team_stats[stat1] * team_stats[stat2] * coeff) / 10.0
                if score > 0:
                    synergies_found.append({
                        "pair": (stat1, stat2),
                        "score": score
                    })
                    total_synergy_score += score

    synergies_found.sort(key=lambda x: x["score"], reverse=True)

    # Déterminer les "manques" suggérés
    suggestions = []
    for stat, value in team_stats.items():
        if value >= 5: # Si l'équipe excelle dans une stat
            for (s1, s2), coeff in COMPLEMENTARITY_MATRIX.items():
                complement = s2 if s1 == stat else (s1 if s2 == stat else None)
                if complement:
                    if team_stats.get(complement, 0) < 4:
                        suggestion = f"Besoin de '{complement}' pour compléter votre forte capacité en '{stat}'"
                        if suggestion not in suggestions:
                            suggestions.append(suggestion)

    return {
        "suggestions": suggestions,
        "synergies": synergies_found,
        "total_synergy_score": total_synergy_score,
        "avg_mobility": avg_mobility,
        "team_stats": team_stats
    }


# ---------------------------------------------------------------------------
# Sélection d'un coéquipier synergique
# ---------------------------------------------------------------------------

def get_historical_bonus(candidate, current_team, history):
    """Calcule un bonus ou malus basé sur les classements passés (top 1 = +9.5, top 20 = -9.5)."""
    if not history:
        return 0
        
    bonus = 0
    matches = 0
    
    for record in history:
        record_team = set(record["team"])
        placement = record["placement"]
        
        # On regarde la synergie historique entre le candidat et chaque membre actuel
        for member in current_team:
            if candidate["Name"] in record_team and member["Name"] in record_team:
                bonus += (10.5 - placement)
                matches += 1
                
    if matches > 0:
        return (bonus / matches) * 0.5  # Modérateur d'impact sur le score global
    return 0

def score_candidate(candidate, current_team, history=None):
    """
    Score un candidat selon les synergies de complémentarité qu'il apporte à l'équipe actuelle.
    """
    eval_before = evaluate_team(current_team)
    eval_after  = evaluate_team(current_team + [candidate])

    synergy_gain = eval_after["total_synergy_score"] - eval_before["total_synergy_score"]

    mob_bonus = 0
    if eval_before["avg_mobility"] < 4:
        mob_bonus = candidate.get("stats", {}).get("mobility", 0) / 2.0

    STACKABLE = {"scanning", "damage", "control", "shield", "healing"}
    stack_bonus = 0
    candidate_stats = candidate.get("stats", {})
    team_stats = eval_before["team_stats"]
    
    for stat in STACKABLE:
        if candidate_stats.get(stat, 0) >= 5 and team_stats.get(stat, 0) >= 5:
            stack_bonus += 2

    if synergy_gain < 1 and stack_bonus == 0:
        base_score = -1
    else:
        base_score = synergy_gain * 2 + mob_bonus + stack_bonus
    
    if history is not None:
        base_score += get_historical_bonus(candidate, current_team, history)
        
    return base_score


def pick_synergic(current_team, legends_list, anti_synergies, history=None):
    """Choisit une légende pour compléter l'équipe via un tirage aléatoire pondéré (aléatoire biaisé)."""
    team_names = {l["Name"] for l in current_team}
    
    # Filtrer les candidats qui n'ont pas d'anti-synergie avec l'équipe actuelle
    valid_pool = []
    for candidate in legends_list:
        if candidate["Name"] in team_names:
            continue
            
        candidate_name = candidate["Name"]
        is_anti = False
        for anti in anti_synergies:
            if set(anti["legends"]).issubset(team_names | {candidate_name}):
                is_anti = True
                break
        
        if not is_anti:
            valid_pool.append(candidate)

    if not valid_pool:
        return None

    # Score chaque candidat
    scored = [(score_candidate(c, current_team, history), c) for c in valid_pool]

    # Convertir les scores en poids pour un tirage aléatoire biaisé
    # On décale les scores et on les élève au carré pour favoriser fortement les meilleures synergies
    min_score = min(s for s, _ in scored)
    weights = [(s - min_score + 1) ** 2 for s, _ in scored]
    candidates = [c for _, c in scored]

    return choices(candidates, weights=weights, k=1)[0]


# ---------------------------------------------------------------------------
# Synergies spéciales
# ---------------------------------------------------------------------------

def check_special_synergies(team, special_synergies):
    """Retourne la liste des synergies spéciales présentes dans l'équipe."""
    team_names = {l["Name"] for l in team}
    found = []
    for synergy in special_synergies:
        if set(synergy["legends"]).issubset(team_names):
            found.append(synergy)
    return found

def check_anti_synergies(team, anti_synergies):
    """Retourne la liste des anti-synergies présentes dans l'équipe."""
    team_names = {l["Name"] for l in team}
    found = []
    for anti in anti_synergies:
        if set(anti["legends"]).issubset(team_names):
            found.append(anti)
    return found


# ---------------------------------------------------------------------------
# Affichage
# ---------------------------------------------------------------------------

def legend_summary(legend, role_label):
    name     = legend["Name"]
    cls      = legend["Class"]
    stats    = legend.get("stats", {})
    
    top_stats = sorted([(k, v) for k, v in stats.items() if v > 0], key=lambda x: x[1], reverse=True)
    stats_str = ", ".join([f"{k}:{v}" for k, v in top_stats])
    if not stats_str:
        stats_str = "Aucune"

    return (
        f"  {role_label} : {name} ({cls})\n"
        f"    Stats       : {stats_str}"
    )

def print_team(team, title="COMPOSITION"):
    if len(team) == 2:
        roles = ["Joueur 1", "Joueur 2"]
    else:
        roles = ["Joueur 1", "Joueur 2", "Flex    "]
    print(f"\n{'-'*45}")
    print(f"  {title}")
    print(f"{'-'*45}")
    for legend, role in zip(team, roles):
        print(legend_summary(legend, role))
    print()

def get_team_archetype(team_stats):
    # La somme des deux types de mouvements pour la mobilité globale de l'équipe
    mob_repo = team_stats.get("mobility", 0) + team_stats.get("repositioning", 0)
    
    # On utilise min() pour s'assurer que l'équipe possède véritablement les DEUX piliers de l'archétype.
    # L'archétype est défini par son "maillon le plus faible".
    info_rota_score = min(team_stats.get("map_info", 0), mob_repo)
    fight_control_score = min(team_stats.get("scanning", 0), max(team_stats.get("control", 0), team_stats.get("damage", 0)))
    dive_score = min(mob_repo, team_stats.get("damage", 0))
    bunker_score = min(team_stats.get("barrier", 0), team_stats.get("control", 0))
    sustain_score = min(team_stats.get("healing", 0), team_stats.get("shield", 0))

    scores = {
        "Info & Rota 🧭": info_rota_score,
        "Fight Control 🎯": fight_control_score,
        "Dive / Aggro ⚔️": dive_score,
        "Bunker / Zone 🛡️": bunker_score,
        "Sustain / Usure 💉": sustain_score
    }
    
    best_archetype = max(scores, key=scores.get)
    max_score = scores[best_archetype]
    
    # Il faut qu'au moins 8 points cumulés soient présents dans les deux piliers pour définir l'équipe
    if max_score < 8:
        return "Hybride / Flex ⚖️"
        
    return best_archetype

def print_evaluation(team, special_synergies, anti_synergies):
    result = evaluate_team(team)
    special = check_special_synergies(team, special_synergies)
    anti = check_anti_synergies(team, anti_synergies)

    if special:
        for s in special:
            print(f"  ⚡ SUPER SYNERGIE : « {s['name']} »")
            print(f"     {s['description']}")
        print()
        
    if anti:
        for a in anti:
            print(f"  ❌ ANTI-SYNERGIE : « {a['name']} »")
            print(f"     {a['description']}")
        print()

    archetype = get_team_archetype(result["team_stats"])
    print(f"  ARCHÉTYPE DE L'ÉQUIPE : {archetype}")

    mob_avg = result["avg_mobility"]
    mob_str = "élevée 🟢" if mob_avg >= 7 else "correcte 🟡" if mob_avg >= 4 else "faible 🔴"
    print(f"\n  Mobilité moyenne de l'équipe : {mob_avg:.1f}/10 ({mob_str})")
    print(f"{'-'*45}\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def build_team(legends_list, anti_synergies, size=3, history=None):
    """Construit une équipe de 2 ou 3 : P1 aléatoire, les suivants synergiques."""
    shuffle(legends_list)  # évite le biais lié à l'ordre du JSON
    p1 = choice(legends_list)
    p2 = pick_synergic([p1], legends_list, anti_synergies, history)
    if size == 2:
        return [p1, p2]
    flex = pick_synergic([p1, p2], legends_list, anti_synergies, history)
    return [p1, p2, flex]


def ask_team_size():
    """Demande la taille d'équipe souhaitée (2 ou 3)."""
    while True:
        choice_input = input("Taille de l'équipe (2 ou 3) : ").strip()
        if choice_input in ("2", "3"):
            return int(choice_input)
        print("  Entrez 2 ou 3.")

def list_legends_by_stat(legends_list, stat_name):
    """Affiche toutes les légendes dans l'ordre décroissant selon une statistique donnée."""
    sorted_legends = sorted(
        legends_list,
        key=lambda l: l.get("stats", {}).get(stat_name, 0),
        reverse=True
    )
    
    print(f"\n{'-'*45}")
    print(f"  CLASSEMENT PAR STATISTIQUE : {stat_name.upper()}")
    print(f"{'-'*45}")
    
    previous_value = None
    for legend in sorted_legends:
        name = legend["Name"]
        stat_value = legend.get("stats", {}).get(stat_name, 0)
        
        if previous_value is not None and stat_value != previous_value:
            print(f"  {'-'*20}")
            
        print(f"  {name:<15} : {stat_value}/10")
        previous_value = stat_value
        
    print(f"{'-'*45}\n")


def calculate_pick_probabilities(target_legend_name, legends_list, anti_synergies, history=None):
    """Calcule et affiche la probabilité de tirage de chaque légende pour accompagner une légende cible."""
    target_legend = next((l for l in legends_list if l["Name"].lower() == target_legend_name.lower()), None)
    if not target_legend:
        print(f"  Légende '{target_legend_name}' introuvable.")
        return

    current_team = [target_legend]
    team_names = {target_legend["Name"]}
    
    valid_pool = []
    for candidate in legends_list:
        if candidate["Name"] in team_names:
            continue
            
        candidate_name = candidate["Name"]
        is_anti = False
        for anti in anti_synergies:
            if set(anti["legends"]).issubset(team_names | {candidate_name}):
                is_anti = True
                break
        
        if not is_anti:
            valid_pool.append(candidate)

    if not valid_pool:
        print("  Aucune légende éligible à associer.")
        return

    scored = [(score_candidate(c, current_team, history), c) for c in valid_pool]
    min_score = min(s for s, _ in scored)
    
    weights_info = []
    total_weight = 0
    for s, c in scored:
        weight = (s - min_score + 1) ** 2
        total_weight += weight
        weights_info.append((weight, c))
    
    weights_info.sort(key=lambda x: x[0], reverse=True)
    
    print(f"\n{'-'*45}")
    print(f"  PROBABILITÉS D'ASSOCIATION AVEC {target_legend['Name'].upper()}")
    print(f"{'-'*45}")
    
    for weight, c in weights_info:
        prob = (weight / total_weight) * 100 if total_weight > 0 else 0
        print(f"  {c['Name']:<15} : {prob:>5.1f}%")
        
    print(f"{'-'*45}\n")


def generate_presence_stats(legends_list, anti_synergies, iterations=100, team_size=2, history=None):
    """Lance la génération d'équipe plusieurs fois et affiche les statistiques de présence."""
    presence_counts = {legend["Name"]: 0 for legend in legends_list}
    
    for _ in range(iterations):
        team = build_team(legends_list, anti_synergies, size=team_size, history=history)
        for legend in team:
            presence_counts[legend["Name"]] += 1
            
    print(f"\n{'-'*45}")
    print(f"  STATISTIQUES DE PRÉSENCE ({iterations} équipes de {team_size})")
    print(f"{'-'*45}")
    
    # Tri par ordre décroissant de présence
    sorted_presence = sorted(presence_counts.items(), key=lambda x: x[1], reverse=True)
    
    for name, count in sorted_presence:
        percentage = (count / iterations) * 100
        print(f"  {name:<15} : {percentage:>5.1f}% ({count} fois)")
    print(f"{'-'*45}\n")


def main():
    legends_list, special_synergies, anti_synergies = get_data()
    history = load_history()

    print("\n"+"="*45)
    print("   APEX LEGENDS — COMPOSITION ALÉATOIRE")
    print("="*45)

    size = ask_team_size()

    team = build_team(legends_list, anti_synergies, size, history)
    print_team(team)
    print_evaluation(team, special_synergies, anti_synergies)

    while True:
        place = input("Classement de la partie (1-20, ou 'Entrée' pour ignorer) : ").strip()
        if place.isdigit() and 1 <= int(place) <= 20:
            history.append({
                "team": [l["Name"] for l in team],
                "placement": int(place)
            })
            save_history(history)
            print("  [+] Résultat enregistré, l'algorithme s'adapte !\n")

        again = input("Nouvelle composition (Entrée), 'stats', 'sort <stat>', 'prob <legende>', ou 'n' pour quitter : ").strip().lower()
        if again == "":
            team = build_team(legends_list, anti_synergies, size, history)
            print_team(team)
            print_evaluation(team, special_synergies, anti_synergies)
        elif again == "stats":
            try:
                iters = int(input("Nombre d'itérations ? (défaut 100) : ") or "100")
                generate_presence_stats(legends_list, anti_synergies, iterations=iters, team_size=size, history=history)
            except ValueError:
                print("  Nombre invalide.")
        elif again.startswith("sort "):
            stat = again.split(" ", 1)[1]
            list_legends_by_stat(legends_list, stat)
        elif again.startswith("prob "):
            legend_name = again.split(" ", 1)[1]
            calculate_pick_probabilities(legend_name, legends_list, anti_synergies, history)
        elif again == "n":
            print("Bonne chance sur le terrain !\n")
            break


if __name__ == "__main__":
    main()