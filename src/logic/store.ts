import { ref } from 'vue';
import type { Legend, AntiSynergy, SpecialSynergy, HistoryRecord } from './composer';
import { syncToCloud } from './syncService';

export const legendsData = ref<Legend[]>([]);
export const antiSynergiesData = ref<AntiSynergy[]>([]);
export const specialSynergiesData = ref<SpecialSynergy[]>([]);
export const historyData = ref<HistoryRecord[]>([]);
export const isLoaded = ref(false);

export async function loadGameData() {
    if (isLoaded.value) return;
    try {
        const response = await fetch('/Legends.json');
        const data = await response.json();
        legendsData.value = data.Legends;
        specialSynergiesData.value = data.SPECIAL_SYNERGIES || [];
        antiSynergiesData.value = data.ANTI_SYNERGIES || [];
        
        // Charger l'historique initial
        try {
            const histResponse = await fetch('/history.json');
            if (histResponse.ok) {
                const hist = await histResponse.json();
                historyData.value = hist;
            }
        } catch (e) {
            console.log("No initial history.json found");
        }

        // Fusionner avec le localStorage
        const localHist = localStorage.getItem('apex_composer_history');
        if (localHist) {
            const parsed = JSON.parse(localHist);
            // On pourrait fusionner de manière plus intelligente, mais pour l'instant on écrase ou on concatène
            historyData.value = parsed;
        }

        isLoaded.value = true;
    } catch (e) {
        console.error("Failed to load game data", e);
    }
}

export function saveMatchResult(teamNames: string[], placement: number) {
    historyData.value.push({ team: teamNames, placement });
    localStorage.setItem('apex_composer_history', JSON.stringify(historyData.value));
    syncToCloud();
}

export interface LegendDetails {
    name: string;
    lore: {
        real_name: string;
        age: string;
        home_world: string;
        gender: string;
        bio: string;
    };
    abilities: {
        passive: { name: string; description: string; cooldown?: string; };
        tactical: { name: string; description: string; cooldown?: string; };
        ultimate: { name: string; description: string; cooldown?: string; };
    };
    patch_history: any[];
    tactics?: {
        playstyle: string;
        weapons: string[];
        perks: {
            level_2: {
                left: { name: string; description: string; recommended: boolean };
                right: { name: string; description: string; recommended: boolean };
            };
            level_3: {
                left: { name: string; description: string; recommended: boolean };
                right: { name: string; description: string; recommended: boolean };
            };
        };
    };
}

export const currentLegendDetails = ref<LegendDetails | null>(null);
export const currentLegendPatchHistory = ref<any[]>([]);
export const isLoadingLegendDetails = ref(false);

const seasonModules = import.meta.glob('../data/seasons/*.json');

function parseSeasonSortKey(path: string): number[] {
    const match = path.match(/season_(\d+)(?:_(\d+))?\.json$/);
    if (match) {
        const major = parseInt(match[1]);
        const minor = match[2] ? parseInt(match[2]) : 0;
        return [major, minor];
    }
    return [0, 0];
}

export async function loadLegendDetails(legendName: string) {
    isLoadingLegendDetails.value = true;
    currentLegendDetails.value = null;
    currentLegendPatchHistory.value = [];
    
    const formattedName = legendName.toLowerCase().replace(/ /g, '_');
    try {
        const response = await fetch(`/data/legends/${formattedName}.json`);
        if (response.ok) {
            currentLegendDetails.value = await response.json();
        } else {
            console.error(`Failed to load details for ${legendName}`);
        }

        // Dynamically build patch history from seasons
        const history: any[] = [];
        for (const path in seasonModules) {
            const mod: any = await seasonModules[path]();
            const seasonData = mod.default || mod;
            
            // To handle casing differences, we check case-insensitively
            const legendKey = Object.keys(seasonData.patches || {}).find(
                k => k.toLowerCase() === legendName.toLowerCase()
            );

            if (legendKey && seasonData.patches[legendKey]) {
                const combined_details: string[] = [];
                for (const patchEvent of seasonData.patches[legendKey]) {
                    if (patchEvent.details) {
                        combined_details.push(...patchEvent.details);
                    }
                }

                if (combined_details.length > 0) {
                    const seasonStr = String(seasonData.season || '');
                    const baseSeason = seasonStr.split('_')[0];
                    const isMidSeason = seasonStr.endsWith('_2');
                    
                    const patchName = isMidSeason 
                        ? `Season ${baseSeason} : ${seasonData.name} (Midseason)`
                        : `Season ${baseSeason} : ${seasonData.name}`;

                    history.push({
                        patch: patchName,
                        details: combined_details,
                        _sortKey: parseSeasonSortKey(path)
                    });
                }
            }
        }

        // Sort descending (newest first)
        history.sort((a, b) => {
            if (a._sortKey[0] !== b._sortKey[0]) {
                return b._sortKey[0] - a._sortKey[0];
            }
            return b._sortKey[1] - a._sortKey[1];
        });

        currentLegendPatchHistory.value = history;

    } catch (e) {
        console.error(`Error loading details for ${legendName}`, e);
    } finally {
        isLoadingLegendDetails.value = false;
    }
}
