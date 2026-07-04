export interface LegendStats {
    mobility: number;
    damage: number;
    map_info: number;
    scanning: number;
    control: number;
    barrier: number;
    shield: number;
    healing: number;
    repositioning: number;
    looting: number;
    boost: number;
    [key: string]: number;
}

export interface Legend {
    Name: string;
    Class: string;
    stats: LegendStats;
}

export interface SpecialSynergy {
    name: string;
    legends: string[];
    description: string;
}

export interface AntiSynergy {
    legends: string[];
    name: string;
    description: string;
}

export interface HistoryRecord {
    team: string[];
    placement: number;
}

export interface EvaluationResult {
    totalSynergyScore: number;
    avgMobility: number;
    teamStats: Record<string, number>;
}

const COMPLEMENTARITY_MATRIX: Record<string, number> = {
    "barrier,repositioning": 1.0,
    "scanning,damage": 1.0,
    "control,shield": 1.0,
    "control,healing": 1.0,
    "repositioning,damage": 1.0,
    "barrier,map_info": 0.5,
    "map_info,repositioning": 0.5,
    "control,damage": 0.5,
};

export function getComplementarity(stat1: string, stat2: string): number {
    return COMPLEMENTARITY_MATRIX[`${stat1},${stat2}`] || COMPLEMENTARITY_MATRIX[`${stat2},${stat1}`] || 0.0;
}

export function evaluateTeam(team: Legend[]): EvaluationResult {
    let totalMobility = 0;
    const teamStats: Record<string, number> = {};

    team.forEach(legend => {
        totalMobility += legend.stats.mobility || 0;
        for (const [stat, value] of Object.entries(legend.stats)) {
            teamStats[stat] = (teamStats[stat] || 0) + (value as number);
        }
    });

    const avgMobility = team.length > 0 ? totalMobility / team.length : 0;
    
    let totalSynergyScore = 0.0;
    const statsKeys = Object.keys(teamStats);

    for (let i = 0; i < statsKeys.length; i++) {
        for (let j = i + 1; j < statsKeys.length; j++) {
            const stat1 = statsKeys[i];
            const stat2 = statsKeys[j];
            const coeff = getComplementarity(stat1, stat2);
            if (coeff > 0) {
                const score = (teamStats[stat1] * teamStats[stat2] * coeff) / 10.0;
                totalSynergyScore += score;
            }
        }
    }

    return { totalSynergyScore, avgMobility, teamStats };
}

export function getHistoricalBonus(candidate: Legend, currentTeam: Legend[], history: HistoryRecord[]): number {
    if (!history || history.length === 0) return 0;
    
    let bonus = 0;
    let matches = 0;
    
    for (const record of history) {
        const recordTeam = new Set(record.team);
        const placement = record.placement;
        
        for (const member of currentTeam) {
            if (recordTeam.has(candidate.Name) && recordTeam.has(member.Name)) {
                bonus += (10.5 - placement);
                matches += 1;
            }
        }
    }
    
    if (matches > 0) {
        return (bonus / matches) * 0.5;
    }
    return 0;
}

export function scoreCandidate(candidate: Legend, currentTeam: Legend[], history: HistoryRecord[] = []): number {
    const evalBefore = evaluateTeam(currentTeam);
    const evalAfter = evaluateTeam([...currentTeam, candidate]);

    const synergyGain = evalAfter.totalSynergyScore - evalBefore.totalSynergyScore;

    let mobBonus = 0;
    if (evalBefore.avgMobility < 4) {
        mobBonus = (candidate.stats.mobility || 0) / 2.0;
    }

    const STACKABLE = new Set(["scanning", "damage", "control", "shield", "healing"]);
    let stackBonus = 0;
    for (const stat of Object.keys(candidate.stats)) {
        if (STACKABLE.has(stat)) {
            const val = candidate.stats[stat] || 0;
            if (val >= 6) {
                stackBonus += val * 0.3;
            }
        }
    }

    const histBonus = getHistoricalBonus(candidate, currentTeam, history);

    return synergyGain + mobBonus + stackBonus + histBonus;
}

export function pickSynergic(currentTeam: Legend[], legendsList: Legend[], antiSynergies: AntiSynergy[], history: HistoryRecord[] = []): Legend | null {
    const teamNames = new Set(currentTeam.map(l => l.Name));
    
    const validPool = legendsList.filter(candidate => {
        if (teamNames.has(candidate.Name)) return false;
        
        let isAnti = false;
        for (const anti of antiSynergies) {
            const requiredSet = new Set(anti.legends);
            const currentPlusCandidate = new Set([...teamNames, candidate.Name]);
            
            let isSubset = true;
            for (const req of requiredSet) {
                if (!currentPlusCandidate.has(req)) {
                    isSubset = false;
                    break;
                }
            }
            if (isSubset) {
                isAnti = true;
                break;
            }
        }
        return !isAnti;
    });

    if (validPool.length === 0) return null;

    const scored = validPool.map(c => ({ score: scoreCandidate(c, currentTeam, history), legend: c }));
    const minScore = Math.min(...scored.map(s => s.score));
    
    const weights = scored.map(s => Math.pow(s.score - minScore + 1, 2));
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            return scored[i].legend;
        }
    }
    
    return scored[scored.length - 1].legend;
}

export function getTeamArchetype(teamStats: Record<string, number>): string {
    const mob = teamStats.mobility || 0;
    const repo = teamStats.repositioning || 0;
    const mobRepo = mob + repo;
    
    const infoRota = Math.min(teamStats.map_info || 0, mobRepo);
    const fightControl = Math.min(teamStats.scanning || 0, Math.max(teamStats.control || 0, teamStats.damage || 0));
    const dive = Math.min(mobRepo, teamStats.damage || 0);
    const bunker = Math.min(teamStats.barrier || 0, teamStats.control || 0);
    const sustain = Math.min(teamStats.healing || 0, teamStats.shield || 0);

    const scores: Record<string, number> = {
        "Info & Rota 🧭": infoRota,
        "Fight Control 🎯": fightControl,
        "Dive / Aggro ⚔️": dive,
        "Bunker / Zone 🛡️": bunker,
        "Sustain / Usure 💉": sustain
    };
    
    let bestArchetype = "Hybride / Flex ⚖️";
    let maxScore = -1;
    
    for (const [arch, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            bestArchetype = arch;
        }
    }
    
    if (maxScore < 8) {
        return "Hybride / Flex ⚖️";
    }
    return bestArchetype;
}

export function buildTeam(legendsList: Legend[], antiSynergies: AntiSynergy[], size: number = 3, history: HistoryRecord[] = []): Legend[] {
    const shuffled = [...legendsList].sort(() => 0.5 - Math.random());
    const p1 = shuffled[0];
    const team = [p1];
    
    const p2 = pickSynergic(team, legendsList, antiSynergies, history);
    if (p2) team.push(p2);
    
    if (size === 3) {
        const p3 = pickSynergic(team, legendsList, antiSynergies, history);
        if (p3) team.push(p3);
    }
    
    return team;
}

export function checkSpecialSynergies(team: Legend[], specialSynergies: SpecialSynergy[]): SpecialSynergy[] {
    const teamNames = new Set(team.map(l => l.Name));
    return specialSynergies.filter(synergy => {
        for (const legend of synergy.legends) {
            if (!teamNames.has(legend)) return false;
        }
        return true;
    });
}

export interface ProbResult {
    name: string;
    prob: number;
}

export function calculatePickProbabilities(targetLegendName: string, legendsList: Legend[], antiSynergies: AntiSynergy[], history: HistoryRecord[] = []): ProbResult[] {
    const targetLegend = legendsList.find(l => l.Name.toLowerCase() === targetLegendName.toLowerCase());
    if (!targetLegend) return [];

    const validPool = legendsList.filter(candidate => {
        if (candidate.Name === targetLegend.Name) return false;
        
        let isAnti = false;
        for (const anti of antiSynergies) {
            const requiredSet = new Set(anti.legends);
            const currentPlusCandidate = new Set([targetLegend.Name, candidate.Name]);
            
            let isSubset = true;
            for (const req of requiredSet) {
                if (!currentPlusCandidate.has(req)) {
                    isSubset = false;
                    break;
                }
            }
            if (isSubset) {
                isAnti = true;
                break;
            }
        }
        return !isAnti;
    });

    if (validPool.length === 0) return [];

    const currentTeam = [targetLegend];
    const scored = validPool.map(c => ({ score: scoreCandidate(c, currentTeam, history), legend: c }));
    const minScore = Math.min(...scored.map(s => s.score));
    
    let totalWeight = 0;
    const weights: Record<string, number> = {};
    
    for (const s of scored) {
        const weight = Math.pow(s.score - minScore + 1, 2);
        weights[s.legend.Name] = weight;
        totalWeight += weight;
    }
    
    const results: ProbResult[] = [];
    for (const name in weights) {
        results.push({ name, prob: (weights[name] / totalWeight) * 100 });
    }
    
    return results.sort((a, b) => b.prob - a.prob);
}
