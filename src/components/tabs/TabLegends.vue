<script setup lang="ts">
import { ref, computed } from 'vue'
import { legendsData, loadLegendDetails, currentLegendDetails, isLoadingLegendDetails } from '../../logic/store'
import LegendGallery from '../LegendGallery.vue'

const searchQuery = ref('')
const selectedLegendName = ref<string | null>(null)
const groupByClass = ref(false)

const filteredLegends = computed(() => {
    let list = legendsData.value
    if (searchQuery.value) {
        list = list.filter(l => l.Name.toLowerCase().includes(searchQuery.value.toLowerCase()))
    }
    // Sort alphabetically by base
    return list.slice().sort((a, b) => a.Name.localeCompare(b.Name))
})

const groupedLegends = computed(() => {
    if (!groupByClass.value) return null
    const groups: Record<string, typeof legendsData.value> = {}
    filteredLegends.value.forEach(legend => {
        const c = legend.Class || 'Unknown'
        if (!groups[c]) groups[c] = []
        groups[c].push(legend)
    })
    return groups
})

async function selectLegend(name: string) {
    selectedLegendName.value = name
    await loadLegendDetails(name)
}

const activeModalTab = ref('general')

function closeModal() {
    selectedLegendName.value = null
    activeModalTab.value = 'general'
}

const formatImgName = (name: string) => name.toLowerCase().replace(/ /g, '_')
const formatClassName = (name: string) => name.toLowerCase().replace(/ /g, '_')

const portraitError = ref(false)
const ability1Error = ref(false)
const ability2Error = ref(false)
const ability3Error = ref(false)

function handleSelectLegend(name: string) {
    portraitError.value = false;
    ability1Error.value = false;
    ability2Error.value = false;
    ability3Error.value = false;
    selectLegend(name);
}

function handleImageError(event: Event, fallbackSrc: string, errorFlagRef: 'portraitError' | 'ability1Error' | 'ability2Error' | 'ability3Error') {
    const img = event.target as HTMLImageElement;
    img.src = fallbackSrc;
    img.onerror = () => {
        if (errorFlagRef === 'portraitError') portraitError.value = true;
        if (errorFlagRef === 'ability1Error') ability1Error.value = true;
        if (errorFlagRef === 'ability2Error') ability2Error.value = true;
        if (errorFlagRef === 'ability3Error') ability3Error.value = true;
    };
}

function hideErrorImage(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img) img.style.display = 'none';
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden relative">
    <!-- Top Search Bar & Header -->
    <div class="p-6 border-b border-titan-border bg-black/60 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10">
        <h2 class="text-2xl font-black text-white tracking-widest uppercase font-mono flex items-center">
            <span class="text-titan-cyan mr-3 block w-3 h-3 bg-titan-cyan"></span> 
            {{ $t('legends.title') }}
        </h2>
        <div class="flex items-center gap-4 w-full md:w-auto">
            <button 
                @click="groupByClass = !groupByClass" 
                class="px-4 py-2 font-mono text-xs uppercase tracking-widest border transition-colors whitespace-nowrap"
                :class="groupByClass ? 'border-titan-cyan text-titan-cyan bg-titan-cyan/10' : 'border-titan-border text-gray-400 hover:text-white'"
            >
                {{ $t('legends.groupedByClass') }}
            </button>
            <input 
                v-model="searchQuery" 
                type="text" 
                :placeholder="$t('legends.searchPlaceholder')" 
                class="w-full md:w-96 bg-black/50 border border-titan-border text-white px-4 py-2 font-mono text-sm focus:outline-none focus:border-titan-cyan transition-colors"
            />
        </div>
    </div>

    <!-- Legends Grid -->
    <div class="flex-1 overflow-y-auto custom-scrollbar p-6 bg-black/40">
        <!-- Ungrouped Display -->
        <div v-if="!groupByClass" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-12 gap-y-32 content-start pt-32 pb-8">
            <LegendGallery 
                v-for="legend in filteredLegends" 
                :key="legend.Name"
                :legendName="legend.Name"
                @click="handleSelectLegend(legend.Name)"
            />
        </div>

        <!-- Grouped Display -->
        <div v-else class="space-y-16 pb-8">
            <div v-for="(group, className) in groupedLegends" :key="className">
                <div class="flex items-center gap-4 mb-4 border-b border-titan-border/50 pb-2">
                    <div class="w-10 h-10 bg-black/60 border border-titan-border flex items-center justify-center p-2 rounded-sm shrink-0">
                        <img 
                            :src="`/images/legends/classes/${formatClassName(String(className))}_class.svg`" 
                            class="w-full h-full opacity-80 invert drop-shadow" 
                            @error="hideErrorImage"
                        />
                    </div>
                    <h3 class="text-2xl font-black text-white tracking-widest uppercase font-sans">{{ className }}</h3>
                    <span class="text-titan-cyan font-mono text-sm ml-2">[{{ group.length }}]</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-12 gap-y-32 content-start pt-32">
                    <LegendGallery 
                        v-for="legend in group" 
                        :key="legend.Name"
                        :legendName="legend.Name"
                        @click="handleSelectLegend(legend.Name)"
                    />
                </div>
            </div>
        </div>
    </div>

    <!-- Modal for Legend Details -->
    <div v-if="selectedLegendName" class="absolute inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="closeModal"></div>
        
        <!-- Modal Content -->
        <div class="relative w-full max-w-[95%] xl:max-w-7xl h-full max-h-[90vh] bg-black border border-titan-cyan shadow-[0_0_50px_rgba(45,212,191,0.15)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <!-- Close Button -->
            <button @click="closeModal" class="absolute top-4 right-4 z-50 w-12 h-12 flex items-center justify-center bg-black/80 border border-titan-border text-gray-400 hover:text-white hover:border-titan-orange transition-colors group">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <!-- Loading State -->
            <div v-if="isLoadingLegendDetails" class="flex-1 flex items-center justify-center">
                <div class="text-titan-orange font-mono animate-pulse flex items-center gap-3">
                    <span class="block w-3 h-3 bg-titan-orange"></span> {{ $t('legends.extracting') }}
                </div>
            </div>

            <!-- Detail Content -->
            <div v-else-if="currentLegendDetails" class="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                <!-- Header / Portrait Area -->
                <div class="relative h-72 shrink-0 bg-gradient-to-b from-black/80 to-black border-b border-titan-border overflow-hidden">
                    <img 
                        v-show="!portraitError"
                        :src="`/images/legends/portraits/${formatImgName(currentLegendDetails.name)}.jpg`"
                        @error="handleImageError($event, `/images/legends/portraits/${formatImgName(currentLegendDetails.name)}.png`, 'portraitError')"
                        class="absolute top-0 right-0 h-[150%] object-contain object-top opacity-40 pointer-events-none transform translate-x-1/4 -translate-y-10 mask-image-gradient"
                    />
                    <div class="absolute inset-0 p-8 flex flex-col justify-end z-10 bg-gradient-to-r from-black via-black/90 to-transparent">
                        <h1 class="text-6xl md:text-7xl font-black text-white uppercase tracking-tighter drop-shadow-lg">{{ currentLegendDetails.name }}</h1>
                        <div class="text-titan-cyan font-mono tracking-widest uppercase mt-4 text-sm flex items-center gap-6">
                            <span class="flex items-center gap-2"><div class="w-1.5 h-1.5 bg-titan-cyan"></div> {{ currentLegendDetails.lore.real_name || $t('legends.unknownIdentity') }}</span>
                            <span v-if="currentLegendDetails.lore.age" class="flex items-center gap-2"><div class="w-1.5 h-1.5 bg-titan-cyan"></div> {{ $t('legends.age') }} {{ currentLegendDetails.lore.age }}</span>
                        </div>
                    </div>
                </div>

                <!-- Modal Tabs -->
                <div class="flex border-b border-titan-border bg-black/80 shrink-0">
                    <button 
                        @click="activeModalTab = 'general'" 
                        class="flex-1 py-4 font-mono uppercase tracking-widest text-sm transition-colors border-b-2"
                        :class="activeModalTab === 'general' ? 'text-titan-cyan border-titan-cyan bg-titan-cyan/5' : 'text-gray-500 border-transparent hover:text-white hover:bg-white/5'"
                    >
                        {{ $t('legends.tabGeneral') }}
                    </button>
                    <button 
                        @click="activeModalTab = 'tactics'" 
                        class="flex-1 py-4 font-mono uppercase tracking-widest text-sm transition-colors border-b-2"
                        :class="activeModalTab === 'tactics' ? 'text-titan-cyan border-titan-cyan bg-titan-cyan/5' : 'text-gray-500 border-transparent hover:text-white hover:bg-white/5'"
                    >
                        {{ $t('legends.tabTactics') }}
                    </button>
                </div>

                <!-- GENERAL TAB CONTENT -->
                <template v-if="activeModalTab === 'general'">
                    <!-- Body Area -->
                    <div class="p-8 md:p-10 flex-1 flex flex-col lg:flex-row gap-12 bg-black/60">
                    <!-- Lore -->
                    <div class="flex-1 space-y-8">
                        <div>
                            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono mb-3 flex items-center gap-2">
                                <span class="w-1.5 h-1.5 bg-gray-400 block"></span> {{ $t('legends.origin') }}
                            </h3>
                            <p class="text-white font-mono text-lg tracking-wide">{{ currentLegendDetails.lore.home_world || $t('legends.secretClassification') }}</p>
                        </div>

                        <div v-if="currentLegendDetails.lore.bio">
                            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono mb-3 flex items-center gap-2">
                                <span class="w-1.5 h-1.5 bg-gray-400 block"></span> {{ $t('legends.bio') }}
                            </h3>
                            <p class="text-gray-300 font-sans leading-relaxed text-justify whitespace-pre-line">{{ currentLegendDetails.lore.bio }}</p>
                        </div>
                    </div>

                    <!-- Abilities -->
                    <div class="flex-1 space-y-8 lg:border-l lg:border-titan-border/50 lg:pl-12">
                        <div class="relative">
                            <div class="absolute -left-12 top-1 bottom-1 w-px bg-titan-cyan/30 hidden lg:block"></div>
                            <h3 class="text-xs font-bold text-titan-cyan uppercase tracking-widest font-mono mb-6 flex items-center gap-2">
                                <span class="w-2 h-2 bg-titan-cyan block"></span> {{ $t('legends.tacticalAbilities') }}
                            </h3>

                            <div class="space-y-8">
                                <!-- Passive -->
                                <div class="flex gap-5 items-start group">
                                    <div class="w-14 h-14 mt-1 bg-black/80 border border-titan-border shrink-0 flex items-center justify-center group-hover:border-titan-cyan group-hover:bg-titan-cyan/5 transition-colors">
                                        <img 
                                            :src="`/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_2.svg`"
                                            @error="handleImageError($event, `/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_2.png`, 'ability2Error')"
                                            v-show="!ability2Error"
                                            class="w-8 h-8 invert opacity-80 group-hover:opacity-100 transition-opacity"
                                        />
                                        <span v-if="ability2Error" class="text-gray-600 font-mono text-xs">PAS</span>
                                    </div>
                                    <div>
                                        <div class="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">{{ $t('legends.passive') }}</div>
                                        <h4 class="font-bold text-white uppercase tracking-wider text-lg">{{ currentLegendDetails.abilities.passive.name || $t('legends.unknown') }}</h4>
                                        <p v-if="currentLegendDetails.abilities.passive.description" class="text-sm text-gray-400 mt-2 font-sans">{{ currentLegendDetails.abilities.passive.description }}</p>
                                        <div v-if="currentLegendDetails.abilities.passive.cooldown && currentLegendDetails.abilities.passive.cooldown !== '?'" class="mt-2 text-[10px] font-mono text-titan-cyan uppercase border border-titan-cyan/30 inline-block px-2 py-0.5 rounded-sm">
                                            {{ $t('legends.cooldown') }}: {{ currentLegendDetails.abilities.passive.cooldown }}
                                        </div>
                                    </div>
                                </div>

                                <!-- Tactical -->
                                <div class="flex gap-5 items-start group">
                                    <div class="w-14 h-14 mt-1 bg-black/80 border border-titan-border shrink-0 flex items-center justify-center group-hover:border-titan-cyan group-hover:bg-titan-cyan/5 transition-colors">
                                        <img 
                                            :src="`/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_1.svg`"
                                            @error="handleImageError($event, `/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_1.png`, 'ability1Error')"
                                            v-show="!ability1Error"
                                            class="w-8 h-8 invert opacity-80 group-hover:opacity-100 transition-opacity"
                                        />
                                        <span v-if="ability1Error" class="text-gray-600 font-mono text-xs">TAC</span>
                                    </div>
                                    <div>
                                        <div class="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">{{ $t('legends.tactical') }}</div>
                                        <h4 class="font-bold text-white uppercase tracking-wider text-lg">{{ currentLegendDetails.abilities.tactical.name || $t('legends.unknown') }}</h4>
                                        <p v-if="currentLegendDetails.abilities.tactical.description" class="text-sm text-gray-400 mt-2 font-sans">{{ currentLegendDetails.abilities.tactical.description }}</p>
                                        <div v-if="currentLegendDetails.abilities.tactical.cooldown && currentLegendDetails.abilities.tactical.cooldown !== '?'" class="mt-2 text-[10px] font-mono text-titan-cyan uppercase border border-titan-cyan/30 inline-block px-2 py-0.5 rounded-sm">
                                            {{ $t('legends.cooldown') }}: {{ currentLegendDetails.abilities.tactical.cooldown }}
                                        </div>
                                    </div>
                                </div>

                                <!-- Ultimate -->
                                <div class="flex gap-5 items-start group">
                                    <div class="w-14 h-14 mt-1 bg-black/80 border border-titan-orange shrink-0 flex items-center justify-center group-hover:bg-titan-orange/10 transition-colors">
                                        <img 
                                            :src="`/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_3.svg`"
                                            @error="handleImageError($event, `/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_3.png`, 'ability3Error')"
                                            v-show="!ability3Error"
                                            class="w-8 h-8 invert opacity-90 group-hover:opacity-100 transition-opacity"
                                        />
                                        <span v-if="ability3Error" class="text-titan-orange/50 font-mono text-xs">ULT</span>
                                    </div>
                                    <div>
                                        <div class="text-[10px] text-titan-orange font-mono uppercase tracking-widest mb-1">{{ $t('legends.ultimate') }}</div>
                                        <h4 class="font-bold text-white uppercase tracking-wider text-lg">{{ currentLegendDetails.abilities.ultimate.name || $t('legends.unknown') }}</h4>
                                        <p v-if="currentLegendDetails.abilities.ultimate.description" class="text-sm text-gray-400 mt-2 font-sans">{{ currentLegendDetails.abilities.ultimate.description }}</p>
                                        <div v-if="currentLegendDetails.abilities.ultimate.cooldown && currentLegendDetails.abilities.ultimate.cooldown !== '?'" class="mt-2 text-[10px] font-mono text-titan-orange uppercase border border-titan-orange/30 inline-block px-2 py-0.5 rounded-sm">
                                            {{ $t('legends.cooldown') }}: {{ currentLegendDetails.abilities.ultimate.cooldown }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Patch History Area -->
                <div v-if="currentLegendDetails.patch_history && currentLegendDetails.patch_history.length > 0" class="p-8 md:p-10 border-t border-titan-border/50 bg-black/40">
                    <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono mb-6 flex items-center gap-2">
                        <span class="w-1.5 h-1.5 bg-gray-400 block"></span> {{ $t('legends.patchHistory') }}
                    </h3>
                    <div class="space-y-6">
                        <div v-for="patch in currentLegendDetails.patch_history" :key="patch.patch" class="border-l-2 border-titan-border/50 pl-4 py-1">
                            <h4 class="font-bold text-titan-cyan font-mono text-sm uppercase tracking-wider mb-2">{{ patch.patch }}</h4>
                            <ul class="space-y-1 list-disc list-inside text-gray-400 text-sm">
                                <li v-for="(detail, i) in patch.details" :key="i" class="leading-relaxed">{{ detail }}</li>
                            </ul>
                        </div>
                    </div>
                </div>
                </template>

                <!-- TACTICS TAB CONTENT -->
                <template v-else-if="activeModalTab === 'tactics'">
                    <div v-if="!currentLegendDetails.tactics" class="flex-1 p-8 md:p-12 flex items-center justify-center text-gray-500 font-mono text-center">
                        {{ $t('legends.noTacticsData') }}
                    </div>
                    <div v-else class="p-8 md:p-12 flex-1 flex flex-col gap-12 bg-black/60 overflow-y-auto custom-scrollbar">
                        <!-- Playstyle -->
                        <div>
                            <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono mb-4 flex items-center gap-2">
                                <span class="w-1.5 h-1.5 bg-titan-cyan block"></span> {{ $t('legends.playstyle') }}
                            </h3>
                            <p class="text-white font-sans text-lg md:text-xl leading-relaxed text-justify">{{ currentLegendDetails.tactics.playstyle }}</p>
                        </div>
                        
                        <div class="flex flex-col gap-12">
                            <!-- Perks Tree -->
                            <div class="w-full">
                                <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono mb-6 flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 bg-titan-orange block"></span> {{ $t('legends.bestPerks') }}
                                </h3>
                                
                                <div class="relative flex flex-col items-center py-8 bg-black/40 border border-titan-border/50 overflow-hidden">
                                    <!-- Central vertical line -->
                                    <div class="absolute top-12 bottom-12 left-1/2 w-0.5 bg-white/10 -translate-x-1/2 z-0"></div>

                                    <!-- Level 1 (Top Shield) -->
                                    <div class="relative z-10 flex flex-col items-center mb-16">
                                        <div class="w-20 h-16 bg-black border-[3px] border-white flex flex-col items-center justify-center perk-shield-shape shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                                            <span class="text-white font-mono font-black text-[10px] mt-1">NIV. 1</span>
                                            <svg class="w-5 h-5 text-white mt-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z"/></svg>
                                        </div>
                                    </div>

                                    <!-- Level 2 Row -->
                                    <div class="relative z-10 flex items-center justify-center w-full mb-16 px-4">
                                        <!-- Branch Lines -->
                                        <div class="absolute left-1/4 right-1/2 top-1/2 h-0.5 bg-titan-cyan/30 -translate-y-1/2 z-0"></div>
                                        <div class="absolute left-1/2 right-1/4 top-1/2 h-0.5 bg-titan-cyan/30 -translate-y-1/2 z-0"></div>

                                        <!-- Left Perk Box -->
                                        <div class="flex-1 flex justify-end pr-2 md:pr-8">
                                            <div class="w-full max-w-[280px] border-2 flex flex-col relative group cursor-default transition-all perk-skew"
                                                 :class="currentLegendDetails.tactics.perks.level_2.left.recommended ? 'bg-titan-cyan/20 border-titan-cyan shadow-[0_0_20px_rgba(45,212,191,0.3)]' : 'bg-black/80 border-titan-cyan/30'">
                                                <div class="p-4 perk-unskew flex flex-col h-full justify-center">
                                                    <div v-if="currentLegendDetails.tactics.perks.level_2.left.recommended" class="absolute -top-3 right-4 bg-titan-cyan text-black text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase shadow-[0_0_10px_rgba(45,212,191,0.5)]">Recommandé</div>
                                                    <h4 class="font-bold text-white text-xs md:text-sm uppercase tracking-wider mb-1 font-mono transition-colors" :class="{'text-titan-cyan drop-shadow-[0_0_5px_rgba(45,212,191,0.8)]': currentLegendDetails.tactics.perks.level_2.left.recommended}">{{ currentLegendDetails.tactics.perks.level_2.left.name }}</h4>
                                                    <p class="text-gray-400 font-sans text-[10px] md:text-xs leading-tight line-clamp-3">{{ currentLegendDetails.tactics.perks.level_2.left.description }}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Center Shield Lvl 2 -->
                                        <div class="w-20 h-16 bg-black border-[3px] border-titan-cyan flex flex-col items-center justify-center perk-shield-shape shadow-[0_0_15px_rgba(45,212,191,0.3)] z-10 mx-2 shrink-0">
                                            <span class="text-white font-mono font-black text-[10px] mt-1">NIV. 2</span>
                                            <svg class="w-5 h-5 text-titan-cyan mt-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z"/></svg>
                                        </div>

                                        <!-- Right Perk Box -->
                                        <div class="flex-1 flex justify-start pl-2 md:pl-8">
                                            <div class="w-full max-w-[280px] border-2 flex flex-col relative group cursor-default transition-all perk-skew"
                                                 :class="currentLegendDetails.tactics.perks.level_2.right.recommended ? 'bg-titan-cyan/20 border-titan-cyan shadow-[0_0_20px_rgba(45,212,191,0.3)]' : 'bg-black/80 border-titan-cyan/30'">
                                                <div class="p-4 perk-unskew flex flex-col h-full justify-center">
                                                    <div v-if="currentLegendDetails.tactics.perks.level_2.right.recommended" class="absolute -top-3 left-4 bg-titan-cyan text-black text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase shadow-[0_0_10px_rgba(45,212,191,0.5)]">Recommandé</div>
                                                    <h4 class="font-bold text-white text-xs md:text-sm uppercase tracking-wider mb-1 font-mono transition-colors" :class="{'text-titan-cyan drop-shadow-[0_0_5px_rgba(45,212,191,0.8)]': currentLegendDetails.tactics.perks.level_2.right.recommended}">{{ currentLegendDetails.tactics.perks.level_2.right.name }}</h4>
                                                    <p class="text-gray-400 font-sans text-[10px] md:text-xs leading-tight line-clamp-3">{{ currentLegendDetails.tactics.perks.level_2.right.description }}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Level 3 Row -->
                                    <div class="relative z-10 flex items-center justify-center w-full px-4">
                                        <!-- Branch Lines -->
                                        <div class="absolute left-1/4 right-1/2 top-1/2 h-0.5 bg-fuchsia-500/30 -translate-y-1/2 z-0"></div>
                                        <div class="absolute left-1/2 right-1/4 top-1/2 h-0.5 bg-fuchsia-500/30 -translate-y-1/2 z-0"></div>

                                        <!-- Left Perk Box -->
                                        <div class="flex-1 flex justify-end pr-2 md:pr-8">
                                            <div class="w-full max-w-[280px] border-2 flex flex-col relative group cursor-default transition-all perk-skew"
                                                 :class="currentLegendDetails.tactics.perks.level_3.left.recommended ? 'bg-fuchsia-500/20 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.3)]' : 'bg-black/80 border-fuchsia-500/30'">
                                                <div class="p-4 perk-unskew flex flex-col h-full justify-center">
                                                    <div v-if="currentLegendDetails.tactics.perks.level_3.left.recommended" class="absolute -top-3 right-4 bg-fuchsia-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase shadow-[0_0_10px_rgba(217,70,239,0.5)]">Recommandé</div>
                                                    <h4 class="font-bold text-white text-xs md:text-sm uppercase tracking-wider mb-1 font-mono transition-colors" :class="{'text-fuchsia-400 drop-shadow-[0_0_5px_rgba(217,70,239,0.8)]': currentLegendDetails.tactics.perks.level_3.left.recommended}">{{ currentLegendDetails.tactics.perks.level_3.left.name }}</h4>
                                                    <p class="text-gray-400 font-sans text-[10px] md:text-xs leading-tight line-clamp-3">{{ currentLegendDetails.tactics.perks.level_3.left.description }}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Center Shield Lvl 3 -->
                                        <div class="w-20 h-16 bg-black border-[3px] border-fuchsia-500 flex flex-col items-center justify-center perk-shield-shape shadow-[0_0_15px_rgba(217,70,239,0.3)] z-10 mx-2 shrink-0">
                                            <span class="text-white font-mono font-black text-[10px] mt-1">NIV. 3</span>
                                            <svg class="w-5 h-5 text-fuchsia-500 mt-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z"/></svg>
                                        </div>

                                        <!-- Right Perk Box -->
                                        <div class="flex-1 flex justify-start pl-2 md:pl-8">
                                            <div class="w-full max-w-[280px] border-2 flex flex-col relative group cursor-default transition-all perk-skew"
                                                 :class="currentLegendDetails.tactics.perks.level_3.right.recommended ? 'bg-fuchsia-500/20 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.3)]' : 'bg-black/80 border-fuchsia-500/30'">
                                                <div class="p-4 perk-unskew flex flex-col h-full justify-center">
                                                    <div v-if="currentLegendDetails.tactics.perks.level_3.right.recommended" class="absolute -top-3 left-4 bg-fuchsia-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase shadow-[0_0_10px_rgba(217,70,239,0.5)]">Recommandé</div>
                                                    <h4 class="font-bold text-white text-xs md:text-sm uppercase tracking-wider mb-1 font-mono transition-colors" :class="{'text-fuchsia-400 drop-shadow-[0_0_5px_rgba(217,70,239,0.8)]': currentLegendDetails.tactics.perks.level_3.right.recommended}">{{ currentLegendDetails.tactics.perks.level_3.right.name }}</h4>
                                                    <p class="text-gray-400 font-sans text-[10px] md:text-xs leading-tight line-clamp-3">{{ currentLegendDetails.tactics.perks.level_3.right.description }}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Weapons -->
                            <div class="w-full mt-4">
                                <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono mb-6 flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 bg-apex-red block"></span> {{ $t('legends.recommendedWeapons') }}
                                </h3>
                                <div class="flex flex-wrap gap-3">
                                    <div v-for="weapon in currentLegendDetails.tactics.weapons" :key="weapon" class="bg-black border border-titan-border px-4 py-2 font-mono text-white uppercase tracking-wider flex items-center gap-2">
                                        <div class="w-1 h-1 bg-apex-red"></div>
                                        {{ weapon }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
            
            <!-- Error State -->
            <div v-else class="flex-1 flex items-center justify-center text-red-500 font-mono">
                {{ $t('legends.errorExtraction') }}
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.mask-image-gradient {
    mask-image: linear-gradient(to right, transparent, black 60%);
    -webkit-mask-image: linear-gradient(to right, transparent, black 60%);
}

.perk-shield-shape {
    clip-path: polygon(10% 0%, 90% 0%, 100% 25%, 50% 100%, 0% 25%);
}

.perk-skew {
    transform: skewX(-15deg);
}

.perk-unskew {
    transform: skewX(15deg);
}
</style>
