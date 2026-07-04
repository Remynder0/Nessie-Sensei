<script setup lang="ts">
import { ref, computed } from 'vue'
import { calculatePickProbabilities, type ProbResult } from '../../logic/composer'
import { legendsData, antiSynergiesData, historyData } from '../../logic/store'

const probTarget = ref<string>('')
const probResults = ref<ProbResult[]>([])

function updateProbs() {
  if (!probTarget.value) {
    probResults.value = []
    return
  }
  probResults.value = calculatePickProbabilities(probTarget.value, legendsData.value, antiSynergiesData.value, historyData.value)
}

const targetLegend = computed(() => {
    return legendsData.value.find(l => l.Name === probTarget.value);
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="mb-6">
        <h2 class="text-3xl font-black text-white tracking-tighter uppercase font-mono">
          <span class="text-titan-cyan mr-2">>></span>Analyse Prédictive
        </h2>
        <p class="text-gray-400 text-sm font-mono mt-1">Calculateur de probabilités d'association réseau</p>
    </div>

    <div class="glass-panel titan-beveled p-6 mb-6 relative">
        <div class="absolute top-0 left-0 w-full h-1 bg-titan-cyan"></div>
        <div class="flex flex-col md:flex-row gap-6 items-center">
            <div id="tour-prob-select" class="w-full md:w-1/3">
                <label class="block text-titan-cyan text-xs font-bold font-mono uppercase tracking-widest mb-2">Sujet d'Analyse :</label>
                <select id="prob-select-input" v-model="probTarget" @change="updateProbs" class="w-full bg-titan-panel/50 border border-titan-border text-white rounded p-3 font-mono focus:outline-none focus:border-titan-cyan transition-colors">
                    <option value="">-- SÉLECTIONNER --</option>
                    <option v-for="l in legendsData" :key="l.Name" :value="l.Name">{{ l.Name }}</option>
                </select>
            </div>
            <div class="w-full md:w-2/3 text-gray-400 text-sm font-mono border-l border-titan-border pl-6">
                Sélectionnez un sujet cible. L'algorithme simulera des milliers de requêtes de déploiement pour déterminer avec quelles autres unités ce sujet a le plus de chances d'être déployé, en tenant compte des synergies matricielles et en excluant les conflits critiques.
            </div>
        </div>
    </div>

    <div id="tour-prob-results" v-if="probResults.length > 0" class="flex-1 overflow-hidden flex flex-col">
        <h3 class="text-white font-mono text-xl uppercase mb-4 flex items-center gap-2">
            <span class="w-3 h-3 bg-titan-orange inline-block"></span>
            Résultats pour {{ targetLegend?.Name }}
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto custom-scrollbar pr-2 pb-4">
            <div v-for="res in probResults" :key="res.name" class="bg-black/40 border border-titan-border p-4 relative group hover:border-titan-cyan transition-colors">
                <div class="absolute top-0 left-0 w-1 h-full bg-titan-border group-hover:bg-titan-cyan transition-colors"></div>
                <div class="flex flex-col ml-2">
                    <span class="font-bold text-gray-200 font-sans uppercase text-lg">{{ res.name }}</span>
                    <span class="text-titan-cyan font-mono text-xl font-bold">{{ res.prob.toFixed(1) }}%</span>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>
