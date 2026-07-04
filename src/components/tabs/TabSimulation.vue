<script setup lang="ts">
import { ref } from 'vue'
import { buildTeam } from '../../logic/composer'
import { legendsData, antiSynergiesData, historyData } from '../../logic/store'

const iterations = ref<number>(500)
const teamSize = ref<number>(3)
const isSimulating = ref(false)

interface PresenceResult {
    name: string;
    count: number;
    percentage: number;
}

const results = ref<PresenceResult[]>([])

function runSimulation() {
    if (iterations.value > 1500) iterations.value = 1500;
    if (iterations.value < 1) iterations.value = 1;
    
    isSimulating.value = true;
    results.value = [];
    
    // Pour ne pas bloquer le thread principal trop longtemps si l'itération est énorme
    setTimeout(() => {
        const counts: Record<string, number> = {};
        for (const l of legendsData.value) {
            counts[l.Name] = 0;
        }

        for (let i = 0; i < iterations.value; i++) {
            const team = buildTeam(legendsData.value, antiSynergiesData.value, teamSize.value, historyData.value);
            for (const member of team) {
                counts[member.Name]++;
            }
        }

        const sorted: PresenceResult[] = [];
        for (const [name, count] of Object.entries(counts)) {
            sorted.push({
                name,
                count,
                percentage: (count / iterations.value) * 100
            });
        }
        
        sorted.sort((a, b) => b.count - a.count);
        results.value = sorted;
        isSimulating.value = false;
    }, 50);
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="mb-6">
        <h2 class="text-3xl font-black text-white tracking-tighter uppercase font-mono">
          <span class="text-titan-cyan mr-2">>></span>Simulation de Présence
        </h2>
        <p class="text-gray-400 text-sm font-mono mt-1">Analyse du taux d'apparition par itérations massives</p>
    </div>

    <div class="glass-panel titan-beveled p-6 mb-6">
        <div class="flex flex-col md:flex-row gap-6 items-end">
            <div>
                <label class="block text-titan-cyan text-xs font-bold font-mono uppercase tracking-widest mb-2">Itérations :</label>
                <input v-model="iterations" type="number" min="1" max="1500" class="bg-black/50 border border-titan-border text-white px-4 py-2 font-mono focus:outline-none focus:border-titan-orange w-32" />
            </div>
            
            <div>
                <label class="block text-titan-cyan text-xs font-bold font-mono uppercase tracking-widest mb-2">Format :</label>
                <div class="flex gap-1 border border-titan-border bg-black/50 p-1">
                    <button @click="teamSize = 2" :class="teamSize === 2 ? 'bg-titan-cyan text-black' : 'text-gray-400 hover:text-white'" class="px-4 py-1 text-sm font-bold font-mono transition-colors">DUOS</button>
                    <button @click="teamSize = 3" :class="teamSize === 3 ? 'bg-titan-cyan text-black' : 'text-gray-400 hover:text-white'" class="px-4 py-1 text-sm font-bold font-mono transition-colors">TRIOS</button>
                </div>
            </div>

            <button @click="runSimulation" :disabled="isSimulating" class="bg-titan-orange hover:bg-orange-500 disabled:opacity-50 text-black font-black py-2 px-6 titan-beveled transition-all transform active:scale-95 flex items-center gap-2 font-mono uppercase tracking-wider h-10">
                <span v-if="isSimulating">Calcul en cours...</span>
                <span v-else>Lancer Simulation</span>
            </button>
        </div>
    </div>

    <div v-if="results.length > 0" class="flex-1 overflow-hidden flex flex-col">
        <h3 class="text-white font-mono text-xl uppercase mb-4 flex items-center gap-2">
            <span class="w-3 h-3 bg-titan-orange inline-block"></span>
            Taux de sélection de l'algorithme
        </h3>
        
        <div class="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4 space-y-2">
            <div v-for="(res, index) in results" :key="res.name" class="bg-black/40 border border-titan-border p-3 flex items-center group hover:border-titan-cyan transition-colors">
                <div class="w-8 text-center text-gray-600 font-mono text-lg font-bold mr-4">#{{ index + 1 }}</div>
                <div class="flex-1 flex justify-between items-center">
                    <span class="font-bold text-white text-lg uppercase font-sans">{{ res.name }}</span>
                    <div class="flex items-center gap-4">
                        <span class="text-gray-500 font-mono text-sm hidden md:inline-block">({{ res.count }} apparitions)</span>
                        <div class="w-32 bg-titan-panel h-2 overflow-hidden border border-titan-border hidden md:block">
                            <div class="h-full bg-titan-cyan transition-all" :style="{ width: `${res.percentage}%` }"></div>
                        </div>
                        <span class="text-titan-cyan font-mono text-xl font-bold w-16 text-right">{{ res.percentage.toFixed(1) }}%</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>
