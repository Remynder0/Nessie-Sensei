<script setup lang="ts">
import { ref, computed } from 'vue'
import { legendsData } from '../../logic/store'

const ALL_STATS = [
    "mobility", "damage", "map_info", "scanning", "control", 
    "barrier", "shield", "healing", "repositioning", "looting", "boost"
]

const selectedStat = ref<string>('mobility')

const sortedLegends = computed(() => {
    return [...legendsData.value]
        .filter(l => (l.stats[selectedStat.value] || 0) > 0)
        .sort((a, b) => (b.stats[selectedStat.value] || 0) - (a.stats[selectedStat.value] || 0))
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="mb-6">
        <h2 class="text-3xl font-black text-white tracking-tighter uppercase font-mono">
          <span class="text-titan-cyan mr-2">>></span>Tri Tactique
        </h2>
        <p class="text-gray-400 text-sm font-mono mt-1">Filtrage des unités par spécialité</p>
    </div>

    <div class="glass-panel titan-beveled p-6 mb-6">
        <label class="block text-titan-cyan text-xs font-bold font-mono uppercase tracking-widest mb-2">Paramètre de Tri :</label>
        <div class="flex flex-wrap gap-2">
            <button 
                v-for="stat in ALL_STATS" :key="stat"
                @click="selectedStat = stat"
                class="px-3 py-1 font-mono text-xs uppercase transition-colors border"
                :class="selectedStat === stat ? 'bg-titan-cyan text-black border-titan-cyan font-bold' : 'bg-titan-panel border-titan-border text-gray-400 hover:border-gray-500'"
            >
                {{ stat.replace('_', ' ') }}
            </button>
        </div>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
        <div class="space-y-2">
            <div v-for="(legend, index) in sortedLegends" :key="legend.Name" class="bg-black/40 border border-titan-border p-3 flex items-center">
                <div class="w-8 text-center text-gray-600 font-mono text-xl font-bold mr-4">#{{ index + 1 }}</div>
                <div class="flex-1 flex justify-between items-center">
                    <span class="font-bold text-white text-lg uppercase font-sans">{{ legend.Name }}</span>
                    <div class="flex items-center gap-4">
                        <div class="w-32 bg-titan-panel h-2 overflow-hidden border border-titan-border hidden md:block">
                            <div class="h-full bg-titan-orange" :style="{ width: `${(legend.stats[selectedStat] || 0) * 10}%` }"></div>
                        </div>
                        <span class="text-titan-orange font-mono text-xl font-bold w-6 text-right">{{ legend.stats[selectedStat] }}</span>
                    </div>
                </div>
            </div>
            <div v-if="sortedLegends.length === 0" class="text-center text-gray-500 font-mono py-10">
                Aucune unité ne possède de statistiques valides pour ce paramètre.
            </div>
        </div>
    </div>
  </div>
</template>
