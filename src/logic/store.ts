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
}

export const currentLegendDetails = ref<LegendDetails | null>(null);
export const isLoadingLegendDetails = ref(false);

export async function loadLegendDetails(legendName: string) {
    isLoadingLegendDetails.value = true;
    currentLegendDetails.value = null;
    
    const formattedName = legendName.toLowerCase().replace(/ /g, '_');
    try {
        const response = await fetch(`/data/legends/${formattedName}.json`);
        if (response.ok) {
            currentLegendDetails.value = await response.json();
        } else {
            console.error(`Failed to load details for ${legendName}`);
        }
    } catch (e) {
        console.error(`Error loading details for ${legendName}`, e);
    } finally {
        isLoadingLegendDetails.value = false;
    }
}
