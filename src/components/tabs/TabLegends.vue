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

function closeModal() {
    selectedLegendName.value = null
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
    <div v-if="selectedLegendName" class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="closeModal"></div>
        
        <!-- Modal Content -->
        <div class="relative w-full max-w-5xl h-full max-h-[90vh] bg-black border border-titan-cyan shadow-[0_0_50px_rgba(45,212,191,0.15)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
</style>
