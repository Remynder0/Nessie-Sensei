<script setup lang="ts">
import { ref, computed } from 'vue'
import { calculateAccountLevelPacks, calculateSeasonPacks, generateSeasons } from '../../logic/packCalculator'
import type { SeasonData } from '../../logic/packCalculator'

// State
const accountLevel = ref<number>(500)
const prestige = ref<number>(0)
const purchasedPacks = ref<number>(0)
const treasurePacks = ref<number>(0)
const eventPacks = ref<number>(0)
const seasons = ref<SeasonData[]>(generateSeasons())

// Computed Packs
const levelPacks = computed(() => calculateAccountLevelPacks(accountLevel.value, prestige.value))
const bpPacks = computed(() => seasons.value.reduce((acc, season) => acc + calculateSeasonPacks(season.id, season.level, season.purchased, season.maxLevel), 0))
const bonusPacks = computed(() => treasurePacks.value + eventPacks.value)
const totalPacks = computed(() => levelPacks.value + bpPacks.value + purchasedPacks.value + bonusPacks.value)

const isHeirloomGuaranteed = computed(() => totalPacks.value >= 500)

// Breakdown
const levelPacksPercent = computed(() => Math.min((levelPacks.value / 500) * 100, 100))
const bpPacksPercent = computed(() => Math.min((bpPacks.value / 500) * 100, 100 - levelPacksPercent.value))
const bonusPacksPercent = computed(() => Math.min((bonusPacks.value / 500) * 100, 100 - levelPacksPercent.value - bpPacksPercent.value))
const purchasedPacksPercent = computed(() => Math.min((purchasedPacks.value / 500) * 100, 100 - levelPacksPercent.value - bpPacksPercent.value - bonusPacksPercent.value))

const maxSeason = (index: number) => {
    seasons.value[index].level = seasons.value[index].maxLevel;
}

const resetSeason = (index: number) => {
    seasons.value[index].level = 0;
}

const togglePurchased = (index: number) => {
    seasons.value[index].purchased = !seasons.value[index].purchased;
}
</script>

<template>
  <div class="h-full flex flex-col space-y-6 overflow-hidden">
    <!-- Header & Progress Bar -->
    <div class="border-b border-titan-border pb-4 shrink-0 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-black font-mono text-white tracking-widest uppercase flex items-center gap-3">
            <span class="w-3 h-3 bg-titan-cyan block"></span>
            HEIRLOOM TRACKER
          </h2>
          <p class="text-gray-400 font-mono text-sm mt-1">Calculez précisément votre progression vers le pack 500</p>
        </div>
        <div class="text-right">
          <div v-if="isHeirloomGuaranteed" class="text-titan-orange font-bold font-mono text-sm animate-pulse mt-1">
            HEIRLOOM GARANTI !
          </div>
          <div v-else class="text-gray-400 font-mono text-sm mt-1">
            Encore {{ 500 - totalPacks > 0 ? 500 - totalPacks : 0 }} packs restants
          </div>
        </div>
      </div>

      <!-- Breakdown Progress Bar -->
      <div>
        <div class="flex justify-between items-end text-xs font-mono mb-2">
          <div class="text-titan-cyan flex gap-4">
            <span class="flex items-center gap-1"><span class="w-2 h-2 bg-titan-cyan block"></span> Niveaux</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 bg-purple-500 block"></span> Pass</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 bg-yellow-500 block"></span> Bonus (Trésor/Évnts)</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 bg-titan-orange block"></span> Achetés</span>
          </div>
          <div class="text-white text-2xl font-black font-mono leading-none tracking-tighter">
            {{ totalPacks }} <span class="text-gray-500 text-sm">/ 500</span>
          </div>
        </div>
        <div class="h-4 bg-black border border-titan-border relative flex overflow-hidden">
          <div class="h-full bg-titan-cyan transition-all duration-300" :style="{ width: `${levelPacksPercent}%` }"></div>
          <div class="h-full bg-purple-500 transition-all duration-300" :style="{ width: `${bpPacksPercent}%` }"></div>
          <div class="h-full bg-yellow-500 transition-all duration-300" :style="{ width: `${bonusPacksPercent}%` }"></div>
          <div class="h-full bg-titan-orange transition-all duration-300" :style="{ width: `${purchasedPacksPercent}%` }"></div>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
      
      <!-- Left Column: Level & Misc -->
      <div class="space-y-6">
        <!-- Account Level Card -->
        <div id="tour-pack-input" class="bg-titan-panel border border-titan-border p-5 relative group overflow-hidden">
          <div class="absolute top-0 left-0 w-1 h-full bg-titan-cyan transition-all group-hover:w-2"></div>
          <h3 class="text-lg font-bold font-mono text-white mb-4 pl-4 border-b border-titan-border/50 pb-2 flex justify-between">
            <span>NIVEAU DE COMPTE</span>
            <span class="text-titan-cyan">{{ levelPacks }} PACKS</span>
          </h3>
          
          <div class="pl-4 space-y-4">
            <div>
              <label class="block text-xs font-mono text-gray-400 mb-1">PRESTIGE (PALIER)</label>
              <div class="flex gap-2">
                <button 
                  v-for="p in [0, 1, 2, 3]" :key="p"
                  @click="prestige = p"
                  class="flex-1 py-2 font-mono text-sm border transition-colors"
                  :class="prestige === p ? 'bg-titan-cyan/20 border-titan-cyan text-titan-cyan font-bold' : 'bg-black/50 border-titan-border text-gray-400 hover:border-gray-500'"
                >
                  {{ p === 0 ? 'BASE' : 'P' + p }}
                </button>
              </div>
            </div>
            <div>
              <label class="block text-xs font-mono text-gray-400 mb-1">NIVEAU ACTUEL (1-500)</label>
              <input 
                type="number" 
                v-model.number="accountLevel" 
                min="1" max="500"
                class="w-full bg-black/50 border border-titan-border text-white font-mono p-2 focus:outline-none focus:border-titan-cyan transition-colors"
              />
            </div>
          </div>
        </div>

        <!-- Purchased & Treasure Packs Card -->
        <div class="bg-titan-panel border border-titan-border p-5 relative group overflow-hidden">
          <div class="absolute top-0 left-0 w-1 h-full bg-titan-orange transition-all group-hover:w-2"></div>
          <h3 class="text-lg font-bold font-mono text-white mb-4 pl-4 border-b border-titan-border/50 pb-2 flex justify-between">
            <span>AUTRES PACKS</span>
            <span class="text-titan-orange">{{ purchasedPacks + bonusPacks }} PACKS</span>
          </h3>
          
          <div class="pl-4 space-y-4">
            <div>
              <label class="block text-xs font-mono text-gray-400 mb-1">PACKS ACHETÉS (Boutique)</label>
              <input 
                type="number" 
                v-model.number="purchasedPacks" 
                min="0"
                class="w-full bg-black/50 border border-titan-border text-white font-mono p-2 focus:outline-none focus:border-titan-orange transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-mono text-gray-400 mb-1">PACKS DE TRÉSOR (Saisons 5-21 uniquement)</label>
              <input 
                type="number" 
                v-model.number="treasurePacks" 
                min="0"
                class="w-full bg-black/50 border border-titan-border text-white font-mono p-2 focus:outline-none focus:border-titan-orange transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-mono text-gray-400 mb-1">PACKS D'ÉVÉNEMENTS (Anniversaires, etc.)</label>
              <input 
                type="number" 
                v-model.number="eventPacks" 
                min="0"
                class="w-full bg-black/50 border border-titan-border text-white font-mono p-2 focus:outline-none focus:border-titan-orange transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Battle Passes -->
      <div id="tour-pack-seasons" class="bg-titan-panel border border-titan-border p-5 relative flex flex-col min-h-[400px]">
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-titan-cyan"></div>
        <h3 class="text-lg font-bold font-mono text-white mb-4 border-b border-titan-border/50 pb-2 flex justify-between shrink-0">
          <span>PASS DE COMBAT</span>
          <span class="text-white">{{ bpPacks }} PACKS</span>
        </h3>
        
        <div class="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
          <div 
            v-for="(season, index) in seasons" 
            :key="season.id"
            class="flex items-center justify-between p-3 bg-black/30 border border-titan-border/50 hover:border-purple-500/50 transition-colors"
          >
            <div class="flex flex-col w-36">
              <span class="font-mono text-sm text-gray-300">{{ season.name }}</span>
              <span class="font-mono text-[10px] text-gray-500 truncate" :title="season.weaponSkin">{{ season.weaponSkin }}</span>
            </div>
            
            <!-- Checkbox Premium -->
            <button 
              @click="togglePurchased(index)"
              class="w-8 h-8 flex-shrink-0 flex items-center justify-center border transition-colors mr-3"
              :class="season.purchased ? 'bg-purple-500/20 border-purple-500 text-purple-500' : 'bg-black/50 border-titan-border text-gray-600 hover:border-gray-500'"
              title="Pass Premium acheté"
            >
              <svg v-if="season.purchased" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </button>

            <!-- Slider Level -->
            <div class="flex-1 px-2 flex items-center gap-2">
              <span class="text-xs font-mono text-gray-500">LVL</span>
              <input 
                type="range" 
                v-model.number="season.level" 
                min="0" 
                :max="season.maxLevel"
                class="w-full accent-purple-500"
              />
            </div>

            <!-- Values and Max/Rst -->
            <div class="flex items-center gap-2 w-32 justify-end">
              <div class="font-mono text-purple-400 text-sm w-14 text-right">
                {{ season.level }}
              </div>
              <div class="font-mono text-titan-cyan text-xs w-10 text-right">
                (+{{ calculateSeasonPacks(season.id, season.level, season.purchased, season.maxLevel) }})
              </div>
              <button 
                v-if="season.level < season.maxLevel"
                @click="maxSeason(index)"
                class="text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2 py-1 hover:bg-purple-500 hover:text-white transition-colors"
              >
                MAX
              </button>
              <button 
                v-else
                @click="resetSeason(index)"
                class="text-[10px] font-mono bg-apex-red/10 text-apex-red border border-apex-red/30 px-2 py-1 hover:bg-apex-red hover:text-white transition-colors"
              >
                RST
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3); 
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #2a313a; 
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #8b5cf6; /* purple-500 */
}
</style>
