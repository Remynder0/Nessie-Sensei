<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { loadGameData, isLoaded } from './logic/store'

import TabTeamGen from './components/tabs/TabTeamGen.vue'
import TabLegends from './components/tabs/TabLegends.vue'
import TabPackCalculator from './components/tabs/TabPackCalculator.vue'
import TabProbabilities from './components/tabs/TabProbabilities.vue'
import TabSimulation from './components/tabs/TabSimulation.vue'
import TabStats from './components/tabs/TabStats.vue'
import TabSort from './components/tabs/TabSort.vue'
import TabSeason from './components/tabs/TabSeason.vue'
import SyncStatus from './components/SyncStatus.vue'
import FeedbackBubble from './components/FeedbackBubble.vue'
import { initSync } from './logic/syncService'
import { startTutorial } from './logic/tutorial'

const currentTab = ref('TeamGen')

// Le mode admin est actif si on est en dev local (npm run dev) OU si le localStorage l'indique
const isAdmin = ref(import.meta.env.DEV || localStorage.getItem('nessie_admin') === 'true')

const allTabs = [
  { id: 'TeamGen', nameKey: 'nav.teamGen', component: TabTeamGen },
  { id: 'Legends', nameKey: 'nav.legends', component: TabLegends },
  { id: 'PackCalculator', nameKey: 'nav.packCalculator', component: TabPackCalculator },
  { id: 'Season', nameKey: 'nav.season', component: TabSeason },
  { id: 'Probabilities', nameKey: 'nav.probabilities', component: TabProbabilities },
  { id: 'Simulation', nameKey: 'nav.simulation', component: TabSimulation, adminOnly: true },
  { id: 'Stats', nameKey: 'nav.stats', component: TabStats, adminOnly: true },
  { id: 'Sort', nameKey: 'nav.sort', component: TabSort, adminOnly: true },
]

// On filtre les onglets en fonction du mode admin
const tabs = computed(() => allTabs.filter(tab => !tab.adminOnly || isAdmin.value))

onMounted(async () => {
  // Check secret URL param to enable/disable admin mode
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('mode') === 'sensei') {
    localStorage.setItem('nessie_admin', 'true')
    isAdmin.value = true
    // Nettoie l'URL pour cacher le secret une fois activé
    window.history.replaceState({}, document.title, window.location.pathname)
  } else if (urlParams.get('mode') === 'user') {
    localStorage.removeItem('nessie_admin')
    isAdmin.value = false
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  await loadGameData()
  initSync()
  
  // Start tutorial if first time
  setTimeout(() => {
    startTutorial(false)
  }, 1000)
})
</script>

<template>
  <div class="flex h-screen bg-apex-darker overflow-hidden text-gray-200 font-sans">
    
    <!-- Sidebar -->
    <aside class="w-64 flex-shrink-0 bg-titan-panel border-r border-titan-border flex flex-col relative z-20 shadow-2xl">
      <div class="p-6 border-b border-titan-border">
        <div class="flex items-center gap-5">
          <img src="/nessie-sensei.png" alt="Nessie-Sensei" class="h-32 object-contain drop-shadow-md" />
          <h1 class="text-2xl font-black text-white font-display uppercase tracking-tighter leading-none">
            NESSIE<br/><span class="text-titan-orange">SENSEI</span>
          </h1>
        </div>
        <div class="flex justify-between items-center mt-2">
            <div class="text-titan-cyan text-[13px] font-mono tracking-widest uppercase">OS.Titan_Link // v2.0</div>
            
            <!-- Language Selector -->
            <select v-model="$i18n.locale" class="bg-black/50 border border-titan-border text-titan-cyan text-[13px] font-mono uppercase px-1 py-0.5 outline-none hover:border-titan-cyan transition-colors">
                <option value="fr">FR</option>
                <option value="en">EN</option>
            </select>
        </div>
      </div>

      <nav id="tour-navigation" class="flex-1 overflow-y-auto py-6 space-y-3 px-4">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          :id="'nav-' + tab.id"
          @click="currentTab = tab.id"
          class="w-full flex items-center justify-between text-left px-4 py-3 font-mono text-sm uppercase tracking-wider transition-all relative group titan-beveled"
          :class="currentTab === tab.id ? 'bg-titan-cyan text-black font-bold' : 'text-gray-400 bg-black/30 border border-titan-border hover:border-titan-cyan hover:text-white'"
        >
          <span v-if="currentTab === tab.id" class="absolute left-2 top-1/2 transform -translate-y-1/2 w-1.5 h-1.5 bg-black"></span>
          <span :class="currentTab === tab.id ? 'pl-3' : ''" class="transition-all">{{ $t(tab.nameKey) }}</span>
          <span v-if="tab.adminOnly" class="text-[13px] px-1 py-0.5 leading-none" :class="currentTab === tab.id ? 'text-black border-black border opacity-70' : 'text-apex-red border-apex-red border opacity-70'">ADM</span>
        </button>
      </nav>

      <SyncStatus />
    </aside>

    <!-- Main Content -->
    <main id="main-content" class="flex-1 relative z-10 flex flex-col h-full bg-black/20">
      <div v-if="!isLoaded" class="flex-1 flex items-center justify-center">
        <div class="text-titan-cyan font-mono text-xl animate-pulse flex items-center gap-4 border border-titan-cyan p-6 bg-titan-cyan/5">
            <span class="w-4 h-4 bg-titan-orange block"></span>
            {{ $t('app.connecting') }}
        </div>
      </div>
      
      <div v-else class="flex-1 p-8 overflow-hidden h-full flex flex-col">
        <div class="flex-1 min-h-0 relative">
          <KeepAlive>
              <component :is="tabs.find(t => t.id === currentTab)?.component" />
          </KeepAlive>
        </div>
        
        <footer class="mt-4 pt-2 border-t border-titan-border/30 text-center text-gray-500/70 text-[13px] font-mono leading-tight shrink-0 whitespace-pre-line">
          {{ $t('app.footer') }}
        </footer>
      </div>
    </main>

    <!-- Global Feedback Bubble -->
    <FeedbackBubble />
  </div>
</template>
