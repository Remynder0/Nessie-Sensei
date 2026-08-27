<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { weaponsData, currentWeaponDetails, loadWeaponDetails } from '../../logic/store'
import WeaponWorkbench from '../weapon/WeaponWorkbench.vue'
import { isMythicWeapon } from '../../logic/gunsmithCalculator'
import type { WeaponSummary } from '../../types/weapons'

type GroupByMode = 'type' | 'ammo'

const groupBy = ref<GroupByMode>('type')
const selectedCategory = ref<string>('Assault Rifle')
const selectedWeaponName = ref<string>('')

async function selectWeapon(name: string) {
    if (selectedWeaponName.value === name && currentWeaponDetails.value?.name === name) return
    selectedWeaponName.value = name
    await loadWeaponDetails(name)
}

function selectCategory(category: string) {
    selectedCategory.value = category
    const list = activeCategories.value[category] || []
    const exists = list.some(w => w.name === selectedWeaponName.value)
    if (!exists && list.length > 0) {
        selectWeapon(list[0].name)
    }
}

function setGroupBy(mode: GroupByMode) {
    if (groupBy.value === mode) return
    groupBy.value = mode
    const categories = Object.keys(activeCategories.value)
    if (categories.length > 0) {
        selectCategory(categories[0])
    }
}

const formatImgName = (name: string) => {
    let formatted = name.toLowerCase().replace(/ /g, '_').replace(/\//g, '_')
    if (formatted === 'sentinel') return 'sentinel_esr'
    return formatted
}

function handleImgError(event: Event, fallbackName: string) {
    const img = event.target as HTMLImageElement
    if (img) {
        img.src = `/images/weapons/${formatImgName(fallbackName)}.png`
    }
}

// 1. Group by Weapon Type
const weaponsByType = computed(() => {
    const groups: Record<string, WeaponSummary[]> = {}
    const sortedWeapons = [...weaponsData.value].sort((a, b) => a.name.localeCompare(b.name))
    
    for (const w of sortedWeapons) {
        const type = w.Type || 'Other'
        if (!groups[type]) groups[type] = []
        groups[type].push(w)
    }
    
    const preferredOrder = [
        'Assault Rifle',
        'Submachine Gun',
        'Light Machine Gun',
        'Marksman Weapon',
        'Sniper Rifle',
        'Shotgun',
        'Pistol'
    ]

    const sortedGroups: Record<string, WeaponSummary[]> = {}
    for (const key of preferredOrder) {
        if (groups[key]) sortedGroups[key] = groups[key]
    }
    Object.keys(groups).sort().forEach(k => {
        if (!sortedGroups[k]) sortedGroups[k] = groups[k]
    })
    
    return sortedGroups
})

// 2. Group by Ammo Type (Mythic weapons grouped together)
const weaponsByAmmo = computed(() => {
    const groups: Record<string, WeaponSummary[]> = {}
    const sortedWeapons = [...weaponsData.value].sort((a, b) => a.name.localeCompare(b.name))
    
    for (const w of sortedWeapons) {
        // Group all mythic weapons together in ammo mode
        if (isMythicWeapon(w.name) || w.Ammo?.toLowerCase().includes('mythic')) {
            if (!groups['Mythic']) groups['Mythic'] = []
            groups['Mythic'].push(w)
            continue
        }

        const ammo = w.Ammo || 'Special'
        // Handle dual ammo like C.A.R. SMG (Heavy/Light Rounds)
        if (ammo.includes('/')) {
            const parts = ammo.split('/')
            for (const p of parts) {
                const subAmmo = p.includes('Rounds') || p.includes('Ammo') ? p.trim() : `${p.trim()} Rounds`
                if (!groups[subAmmo]) groups[subAmmo] = []
                groups[subAmmo].push(w)
            }
        } else {
            if (!groups[ammo]) groups[ammo] = []
            groups[ammo].push(w)
        }
    }

    const preferredOrder = [
        'Light Rounds',
        'Heavy Rounds',
        'Energy Ammo',
        'Shotgun Shells',
        'Sniper Ammo',
        'Arrows',
        'Mythic'
    ]

    const sortedGroups: Record<string, WeaponSummary[]> = {}
    for (const key of preferredOrder) {
        if (groups[key]) sortedGroups[key] = groups[key]
    }
    Object.keys(groups).sort().forEach(k => {
        if (!sortedGroups[k]) sortedGroups[k] = groups[k]
    })

    return sortedGroups
})

// Active Categories Map depending on toggle mode
const activeCategories = computed(() => {
    return groupBy.value === 'type' ? weaponsByType.value : weaponsByAmmo.value
})

const currentCategoryWeapons = computed(() => {
    return activeCategories.value[selectedCategory.value] || []
})

// Auto-initialize on load
function initSelection() {
    const categories = Object.keys(activeCategories.value)
    if (categories.length === 0) return

    if (!activeCategories.value[selectedCategory.value]) {
        selectedCategory.value = categories[0]
    }

    const currentList = activeCategories.value[selectedCategory.value] || []
    if (currentList.length > 0) {
        if (!selectedWeaponName.value || !currentList.some(w => w.name === selectedWeaponName.value)) {
            selectWeapon(currentList[0].name)
        }
    }
}

watch(weaponsData, () => {
    initSelection()
}, { immediate: true })

onMounted(() => {
    initSelection()
})
</script>

<template>
  <div class="h-full flex flex-col relative animate-fade-in-up">
    
    <!-- TOP BAR: Title + Mode Toggle + Centered Category Tabs -->
    <header class="shrink-0 mb-4 flex flex-col gap-3 border-b border-titan-border pb-3">
      <!-- Title & Controls Header -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 class="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-widest leading-none drop-shadow-md">
            {{ $t('weapons.title') }}
          </h2>
          <div class="text-titan-cyan text-xs sm:text-sm font-mono tracking-widest uppercase mt-1 opacity-80 flex items-center gap-2">
            <span>&gt;</span>
            <span>{{ $t('weapons.subtitle') }}</span>
          </div>
        </div>

        <!-- Mode Toggle (Type vs Ammo) + Stats -->
        <div class="flex items-center gap-3">
          <!-- Segmented Mode Toggle -->
          <div class="flex items-center bg-black/60 border border-titan-border p-0.5 rounded gap-1 shadow-inner">
            <button
              @click="setGroupBy('type')"
              class="px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-all rounded cursor-pointer"
              :class="groupBy === 'type'
                ? 'bg-titan-cyan/20 border border-titan-cyan text-titan-cyan font-bold shadow-[0_0_10px_rgba(45,212,191,0.25)]'
                : 'text-gray-400 hover:text-white border border-transparent'"
            >
              {{ $t('weapons.groupByType') }}
            </button>
            <button
              @click="setGroupBy('ammo')"
              class="px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-all rounded cursor-pointer"
              :class="groupBy === 'ammo'
                ? 'bg-titan-orange/20 border border-titan-orange text-titan-orange font-bold shadow-[0_0_10px_rgba(249,115,22,0.25)]'
                : 'text-gray-400 hover:text-white border border-transparent'"
            >
              {{ $t('weapons.groupByAmmo') }}
            </button>
          </div>

          <!-- Total Counter -->
          <div class="hidden lg:flex items-center text-xs font-mono">
            <span class="px-2.5 py-1.5 bg-black/60 border border-titan-border/60 text-gray-300 rounded">
              <strong class="text-titan-cyan">{{ Object.keys(activeCategories).length }}</strong> {{ $t('weapons.categoriesCount') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Horizontal Categories Selector (Centered, Bold, Clean) -->
      <div class="flex items-center justify-center gap-2 sm:gap-3 overflow-x-auto custom-scrollbar pb-1 pt-1">
        <button
          v-for="(_, catName) in activeCategories"
          :key="catName"
          @click="selectCategory(catName)"
          class="shrink-0 px-4 py-2 transition-all duration-200 border rounded flex items-center justify-center font-display uppercase tracking-widest text-xs sm:text-sm cursor-pointer relative group select-none"
          :class="[
            selectedCategory === catName
              ? (catName === 'Mythic'
                  ? 'bg-red-600/30 border-red-500 text-red-200 shadow-[0_0_18px_rgba(239,68,68,0.45)] font-black'
                  : (groupBy === 'ammo'
                      ? 'bg-titan-orange/25 border-titan-orange text-white shadow-[0_0_18px_rgba(249,115,22,0.35)] font-black'
                      : 'bg-titan-cyan/25 border-titan-cyan text-white shadow-[0_0_18px_rgba(45,212,191,0.35)] font-black'))
              : (catName === 'Mythic'
                  ? 'bg-red-950/25 border-red-900/60 text-red-400 hover:text-red-200 hover:border-red-600 font-bold'
                  : 'bg-black/60 border-titan-border/60 text-gray-400 hover:text-gray-100 hover:border-gray-400 hover:bg-white/5 font-bold')
          ]"
        >
          <!-- Active Bottom Indicator Line -->
          <span 
            v-if="selectedCategory === catName"
            class="absolute bottom-0 left-2 right-2 h-0.5"
            :class="catName === 'Mythic' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]' : (groupBy === 'ammo' ? 'bg-titan-orange shadow-[0_0_8px_rgba(249,115,22,1)]' : 'bg-titan-cyan shadow-[0_0_8px_rgba(45,212,191,1)]')"
          ></span>

          <span>{{ catName }}</span>
        </button>
      </div>
    </header>

    <!-- MAIN BODY: Center Workbench + Right Weapons Rail -->
    <div class="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden min-h-0 pb-1">
      
      <!-- CENTER: Embedded Weapon Details / Workbench -->
      <main class="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <WeaponWorkbench />
      </main>

      <!-- RIGHT: Scrollable Weapons List for Active Category -->
      <aside class="w-full md:w-64 lg:w-72 xl:w-80 shrink-0 flex flex-col glass-panel border border-titan-border bg-[#10141b]/95 rounded overflow-hidden h-full">
        <!-- Right Sidebar Header -->
        <div class="p-3 bg-[#141923] border-b border-titan-border/60 flex items-center justify-between font-mono text-xs font-bold text-gray-300 uppercase tracking-widest shrink-0">
          <div class="flex items-center gap-2">
            <span 
              class="w-2 h-2 block"
              :class="groupBy === 'ammo' ? 'bg-titan-orange shadow-[0_0_6px_rgba(249,115,22,0.8)]' : 'bg-titan-cyan shadow-[0_0_6px_rgba(45,212,191,0.8)]'"
            ></span>
            <span>{{ $t('weapons.weaponsSidebarTitle') }}</span>
          </div>
          <span class="text-[11px] text-titan-cyan bg-black/60 border border-titan-border px-2 py-0.5 rounded">
            {{ currentCategoryWeapons.length }} {{ $t('weapons.categoryWeaponsCount') }}
          </span>
        </div>

        <!-- Scrollable Weapons List -->
        <div class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
          <button
            v-for="weapon in currentCategoryWeapons"
            :key="weapon.name"
            @click="selectWeapon(weapon.name)"
            class="w-full text-left p-2.5 transition-all duration-200 border rounded flex items-center justify-between group relative overflow-hidden cursor-pointer"
            :class="[
              selectedWeaponName === weapon.name
                ? (groupBy === 'ammo'
                    ? 'bg-titan-orange/15 border-titan-orange text-white shadow-[0_0_15px_rgba(249,115,22,0.25)]'
                    : 'bg-titan-cyan/15 border-titan-cyan text-white shadow-[0_0_15px_rgba(45,212,191,0.25)]')
                : 'bg-black/40 border-titan-border/50 text-gray-400 hover:text-gray-200 hover:border-gray-500 hover:bg-white/5'
            ]"
          >
            <!-- Left Neon Strip for Active Weapon -->
            <div 
              v-if="selectedWeaponName === weapon.name"
              class="absolute left-0 top-0 bottom-0 w-1"
              :class="groupBy === 'ammo' ? 'bg-titan-orange shadow-[0_0_8px_rgba(249,115,22,0.8)]' : 'bg-titan-cyan shadow-[0_0_8px_rgba(45,212,191,0.8)]'"
            ></div>

            <!-- Weapon Name (Short Name) -->
            <div class="flex flex-col gap-0.5 min-w-0 pr-2 pl-1">
              <div class="flex items-center gap-1.5">
                <span class="font-display font-bold uppercase tracking-wider text-xs md:text-sm truncate">
                  {{ weapon.shortname || weapon.name }}
                </span>
                <span 
                  v-if="isMythicWeapon(weapon.name)" 
                  class="text-[9px] font-mono px-1 py-0.2 bg-red-600/40 border border-red-500 text-red-300 rounded"
                >
                  MYTHIC
                </span>
              </div>
            </div>

            <!-- Weapon Thumbnail Silhouette Image -->
            <div class="w-16 h-10 shrink-0 flex items-center justify-center relative">
              <img 
                :src="`/images/weapons/${formatImgName(weapon.name)}.svg`"
                @error="handleImgError($event, weapon.name)"
                :alt="weapon.name"
                class="w-full h-full object-contain filter invert opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]"
                :class="selectedWeaponName === weapon.name ? 'opacity-100 scale-105' : ''"
              />
            </div>
          </button>
        </div>
      </aside>

    </div>
  </div>
</template>

<style scoped>
</style>
