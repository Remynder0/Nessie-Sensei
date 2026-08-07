<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { buildTeam, getTeamArchetype, checkSpecialSynergies, evaluateTeam, type Legend, type SpecialSynergy } from '../../logic/composer'
import { legendsData, antiSynergiesData, specialSynergiesData, historyData, saveMatchResult } from '../../logic/store'
import LegendCard from '../LegendCard.vue'

const currentTeam = ref<Legend[]>([])
const currentArchetype = ref<string>('')
const currentSpecialSynergies = ref<SpecialSynergy[]>([])
const currentScore = ref<number>(0)
const teamSize = ref<number>(3)

const placementInput = ref<number | null>(null)
const saveSuccess = ref(false)

function generateTeam() {
  if (legendsData.value.length === 0) return
  
  currentTeam.value = buildTeam(legendsData.value, antiSynergiesData.value, teamSize.value, historyData.value)
  const evalResult = evaluateTeam(currentTeam.value)
  currentScore.value = evalResult.totalSynergyScore
  currentArchetype.value = getTeamArchetype(evalResult.teamStats)
  currentSpecialSynergies.value = checkSpecialSynergies(currentTeam.value, specialSynergiesData.value)
  
  placementInput.value = null
  saveSuccess.value = false
}

function handleSaveResult() {
    if (placementInput.value !== null && placementInput.value >= 1 && placementInput.value <= 20) {
        saveMatchResult(currentTeam.value.map(l => l.Name), placementInput.value);
        saveSuccess.value = true;
    }
}

onMounted(() => {
    if (currentTeam.value.length === 0 && legendsData.value.length > 0) {
        generateTeam();
    }
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex justify-between items-end mb-6">
      <div>
        <h2 class="text-3xl font-black text-white tracking-tighter uppercase font-display">
          <span class="text-titan-cyan mr-2">>></span>Liaison & Déploiement
        </h2>
        <p class="text-gray-400 text-sm font-mono mt-1">Générateur tactique d'escouade</p>
      </div>
      
      <div class="flex items-center gap-4">
        <div id="tour-teamgen-format" class="glass-panel titan-beveled px-4 py-2 flex items-center gap-2">
          <span class="text-titan-orange font-bold text-xs uppercase tracking-wider font-mono">Format :</span>
          <div class="flex gap-1">
            <button @click="teamSize = 2; generateTeam()" :class="teamSize === 2 ? 'bg-titan-cyan text-black' : 'text-gray-400 hover:text-white'" class="px-3 py-1 text-xs font-bold font-mono transition-colors">DUOS</button>
            <button @click="teamSize = 3; generateTeam()" :class="teamSize === 3 ? 'bg-titan-cyan text-black' : 'text-gray-400 hover:text-white'" class="px-3 py-1 text-xs font-bold font-mono transition-colors">TRIOS</button>
          </div>
        </div>

        <button @click="generateTeam" class="bg-titan-orange hover:bg-orange-500 text-black font-black py-3 px-6 titan-beveled transition-all transform active:scale-95 flex items-center gap-2 font-mono uppercase tracking-wider">
          Initialiser Déploiement
        </button>
      </div>
    </div>

    <div v-if="currentTeam.length > 0" class="flex-1 flex flex-col overflow-y-auto custom-scrollbar pr-2 pb-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0">
        <LegendCard 
          v-for="(legend, index) in currentTeam" 
          :key="legend.Name" 
          :legend="legend" 
          :class="teamSize === 2 && index === 1 ? 'md:col-start-2' : ''"
        />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div id="tour-teamgen-profile" class="glass-panel titan-beveled p-6 relative md:col-span-2 flex flex-col justify-center">
            <div class="absolute top-0 left-0 w-2 h-full bg-titan-cyan"></div>
            
            <div class="flex justify-between items-center mb-2 pl-4">
                <div>
                    <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest font-display mb-1">Rapport d'Analyse</h3>
                    <div class="text-3xl font-black text-white font-mono uppercase">
                        Profil : <span class="text-titan-cyan">{{ currentArchetype }}</span>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-gray-400 text-xs uppercase font-mono block mb-1">Efficacité Synergique</span>
                    <span class="text-3xl font-bold text-titan-orange font-mono">{{ currentScore.toFixed(1) }}</span>
                </div>
            </div>

            <div v-if="currentSpecialSynergies.length > 0" class="space-y-2 pl-4 mt-4">
              <div v-for="syn in currentSpecialSynergies" :key="syn.name" class="bg-titan-orange/10 border-l-2 border-titan-orange p-3">
                <h4 class="font-bold text-titan-orange text-sm uppercase font-display flex items-center gap-2">
                  <span class="w-2 h-2 bg-titan-orange inline-block"></span> {{ syn.name }}
                </h4>
                <p class="text-xs text-gray-300 mt-1 font-mono ml-4">{{ syn.description }}</p>
              </div>
            </div>
          </div>

          <!-- Historic Logger -->
          <div id="tour-teamgen-save" class="glass-panel titan-beveled p-6 relative flex flex-col justify-center">
              <div class="absolute top-0 right-0 w-2 h-full bg-titan-orange"></div>
              <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest font-display mb-3">Enregistrer Résultat</h3>
              
              <div v-if="saveSuccess" class="bg-green-500/20 border border-green-500 text-green-400 p-3 text-sm font-mono uppercase text-center">
                  Données sauvegardées.<br/>L'algorithme s'adapte.
              </div>
              <div v-else>
                  <p class="text-xs text-gray-500 font-mono mb-4 leading-tight">Saisissez votre classement final pour affiner les probabilités de la matrice.</p>
                  <div class="flex items-center gap-2">
                      <span class="text-white font-mono text-xl font-bold">#</span>
                      <input 
                        v-model="placementInput" 
                        type="number" min="1" max="20" placeholder="1-20"
                        class="bg-black/50 border border-titan-border text-white px-3 py-2 w-full font-mono focus:outline-none focus:border-titan-orange text-center text-xl"
                      />
                  </div>
                  <button @click="handleSaveResult" :disabled="!placementInput || placementInput < 1 || placementInput > 20" class="w-full mt-4 bg-titan-panel border border-titan-border hover:border-titan-orange text-titan-orange disabled:opacity-50 disabled:cursor-not-allowed font-bold py-2 font-mono uppercase transition-colors">
                      Sauvegarder
                  </button>
              </div>
          </div>
      </div>
    </div>
  </div>
</template>
