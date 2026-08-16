<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { currentLegendDetails, isLoadingLegendDetails, currentLegendPatchHistory, legendsData } from '../logic/store'
import { legendThemes, defaultTheme, hexToRgb } from '../logic/legendThemes'

const props = defineProps<{
    initialTab?: string,
    highlightLatestPatch?: boolean
}>()

const emit = defineEmits(['close'])

const activeModalTab = ref(props.initialTab || 'infos')
const showFullBio = ref(false)

// Only the most recent patch is expanded by default — the rest stay collapsed.
const collapsedPatches = ref<Set<number>>(new Set())

watch(currentLegendPatchHistory, (list) => {
    if (list && list.length > 0) {
        collapsedPatches.value = new Set(list.map((_, i) => i).filter(i => i !== 0))
    } else {
        collapsedPatches.value = new Set()
    }
}, { immediate: true })

const togglePatch = (index: number) => {
    const next = new Set(collapsedPatches.value)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    collapsedPatches.value = next
}

const legendClass = computed(() => {
    if (!currentLegendDetails.value) return '';
    const legend = legendsData.value.find(l => l.Name === currentLegendDetails.value?.name);
    return legend ? legend.Class || '' : '';
});

const currentTheme = computed(() => {
    if (!currentLegendDetails.value) return defaultTheme;
    return legendThemes[currentLegendDetails.value.name] || defaultTheme;
});

const getAbilityName = (category: string) => {
    if (!currentLegendDetails.value) return '';
    if (category === 'Tactical') return currentLegendDetails.value.abilities?.tactical?.name || '';
    if (category === 'Passive') return currentLegendDetails.value.abilities?.passive?.name || '';
    if (category === 'Ultimate') return currentLegendDetails.value.abilities?.ultimate?.name || '';
    if (category === 'Class') return legendClass.value;
    return '';
};

const isHighlightingPatch = ref(false)
if (props.highlightLatestPatch) {
    isHighlightingPatch.value = true
    setTimeout(() => {
        isHighlightingPatch.value = false
    }, 1500)
}

const formatImgName = (name: string) => name.toLowerCase().replace(/ /g, '_')

const portraitError = ref(false)
const ability1Error = ref(false)
const ability2Error = ref(false)
const ability3Error = ref(false)

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

interface ParsedPatchSuccess {
    ability: string;
    type: string;
    text: string;
    isFormatted: true;
}

interface ParsedPatchFallback {
    ability?: undefined;
    type?: undefined;
    text: string;
    isFormatted: false;
}

type ParsedPatch = ParsedPatchSuccess | ParsedPatchFallback;

const parsePatchDetail = (detail: string): ParsedPatch => {
    const match = detail.match(/^(?:(\[.*?\])\s*)?(.*?)\s*->\s*(.*)$/);
    if (match) {
        let text = match[3];
        // Strip ability name at the beginning (e.g. "Tempest: ") except for Perks
        if (match[1] && !match[1].toLowerCase().includes('perk')) {
            text = text.replace(/^[^:]{1,30}:\s*/, '');
        }
        // Capitalize
        text = text.charAt(0).toUpperCase() + text.slice(1);
        
        let type = match[2]?.trim() || '';
        let ability = match[1] || '[Base]';

        // Fix if type is empty (e.g., "[Rework] -> ..." or "[Fix] -> ...")
        if (type === '') {
            type = ability.replace(/\[|\]/g, '').trim();
            ability = '[Base]';
        }
        
        return {
            ability: ability,
            type: type,
            text: text,
            isFormatted: true
        };
    }
    return {
        text: detail,
        isFormatted: false
    };
};

const formatReworkText = (text: string) => {
    if (!text.includes(':')) return [text];
    
    const parts = text.split(':');
    const intro = parts[0] + ':';
    let rest = parts.slice(1).join(':').trim();
    
    const details = rest.split(/,\s+(?=[A-Z])/);
    
    return [intro, ...details];
};

const getPatchTypeClass = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('buff')) return 'text-green-400 border-green-400/30 bg-green-400/10';
    if (t.includes('nerf')) return 'text-apex-red border-apex-red/30 bg-apex-red/10';
    if (t.includes('adjust')) return 'text-titan-cyan border-titan-cyan/30 bg-titan-cyan/10';
    if (t.includes('fix') || t.includes('corr')) return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
    if (t.includes('rework') || t.includes('reborn') || t.includes('revived')) return 'text-fuchsia-400 border-fuchsia-400/30 bg-fuchsia-400/10';
    if (t.includes('new')) return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
    if (t.includes('introduced') || t.includes('intro')) return 'text-titan-orange border-titan-orange/30 bg-titan-orange/10';
    if (t.includes('removed')) return 'text-gray-500 border-gray-500/30 bg-gray-500/10';
    return 'text-gray-400 border-gray-400/30 bg-gray-400/10';
};

const formatStatValue = (val: string) => {
    const match = val.trim().match(/^(\d+)s$/);
    if (match) {
        const sec = parseInt(match[1], 10);
        if (sec >= 60) {
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            return s > 0 ? `${m}m ${s}s` : `${m}m`;
        }
    }
    return val;
};

const getPrimaryStat = (ability: any) => {
    if (!ability || !ability.stats) return null;
    const entries = Object.entries(ability.stats);
    if (entries.length === 0) return null;
    return {
        key: entries[0][0],
        value: formatStatValue(entries[0][1] as string)
    };
};

const CATEGORY_ORDER = [
    { key: 'rework', label: 'Rework' },
    { key: 'passive', label: 'Passive' },
    { key: 'tactical', label: 'Tactical' },
    { key: 'ultimate', label: 'Ultimate' },
    { key: 'perks', label: 'Perks' },
    { key: 'class', label: 'Class' },
    { key: 'others', label: 'Others' }
];

const groupPatchDetails = (details: string[]) => {
    const groups: Record<string, any[]> = {
        rework: [],
        passive: [],
        tactical: [],
        ultimate: [],
        perks: [],
        class: [],
        others: []
    };
    
    for (const detail of details) {
        const parsed = parsePatchDetail(detail);
        if (parsed.isFormatted) {
            let catKey = parsed.ability.replace(/\[|\]/g, '').toLowerCase();
            if (catKey === 'base' && parsed.type.toLowerCase() === 'rework') {
                catKey = 'rework';
            } else if (catKey === 'base' || !groups.hasOwnProperty(catKey)) {
                catKey = 'others';
            }
            groups[catKey].push(parsed);
        } else {
            groups.others.push(parsed);
        }
    }
    
    const result = [];
    for (const cat of CATEGORY_ORDER) {
        if (groups[cat.key].length > 0) {
            result.push({
                category: cat.label,
                items: groups[cat.key]
            });
        }
    }
    return result;
};

const getPatchReworks = (details: string[]) => {
    const reworks: string[] = [];
    for (const detail of details) {
        const parsed = parsePatchDetail(detail);
        if (parsed.isFormatted) {
            const t = parsed.type.toLowerCase();
            const isTypeRework = t.includes('rework') || t.includes('reborn') || t.includes('revived');
            const isAbilityRework = parsed.ability.toLowerCase().includes('rework');

            if (isTypeRework || isAbilityRework) {
                let catKey = parsed.ability.replace(/\[|\]/g, '').trim();
                const lowerCat = catKey.toLowerCase();
                
                if (lowerCat === 'tactical') catKey = getAbilityName('Tactical') || 'Tactical';
                else if (lowerCat === 'passive') catKey = getAbilityName('Passive') || 'Passive';
                else if (lowerCat === 'ultimate') catKey = getAbilityName('Ultimate') || 'Ultimate';
                else if (lowerCat === 'rework' || lowerCat === 'base') catKey = 'Base';
                
                if (!reworks.includes(catKey)) {
                    reworks.push(catKey);
                }
            }
        }
    }
    return reworks;
};

function hideImageOnError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img) img.style.display = 'none';
}
</script>

<template>
    <div class="absolute inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-8">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="emit('close')"></div>
        
        <!-- Modal Content (Larger dimensions for more space) -->
        <div class="relative w-full max-w-[98%] xl:max-w-[95vw] h-full max-h-[95vh] bg-[color-mix(in_srgb,var(--theme-primary)_15%,#0f0f11)] border border-theme-primary shadow-[0_0_50px_rgba(var(--theme-primary-rgb),0.15)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
             :style="{
                 '--theme-primary': currentTheme.primary,
                 '--theme-secondary': currentTheme.secondary,
                 '--theme-primary-rgb': hexToRgb(currentTheme.primary)
             }">
            <!-- Close Button -->
            <button @click="emit('close')" class="absolute top-4 right-4 z-50 w-12 h-12 flex items-center justify-center bg-black/80 border border-titan-border text-gray-400 hover:text-white hover:border-theme-secondary transition-colors group">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <!-- Loading State -->
            <div v-if="isLoadingLegendDetails" class="flex-1 flex items-center justify-center">
                <div class="text-theme-secondary font-mono animate-pulse flex items-center gap-3">
                    <span class="block w-3 h-3 bg-theme-secondary"></span> {{ $t('legends.extracting') }}
                </div>
            </div>

            <!-- Detail Content -->
            <div v-else-if="currentLegendDetails" class="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                <!-- Header / Portrait Area -->
                <div class="relative h-56 md:h-64 shrink-0 bg-gradient-to-b from-black/80 to-black border-b border-titan-border overflow-hidden">
                    <img 
                        v-show="!portraitError"
                        :src="`/images/legends/portraits/${formatImgName(currentLegendDetails.name)}.jpg`"
                        @error="handleImageError($event, `/images/legends/portraits/${formatImgName(currentLegendDetails.name)}.png`, 'portraitError')"
                        class="absolute top-0 right-0 h-[150%] object-contain object-top opacity-40 pointer-events-none transform translate-x-1/4 -translate-y-10 mask-image-gradient"
                    />
                    <div class="absolute inset-0 p-8 flex flex-col justify-end z-10 bg-gradient-to-r from-black via-black/90 to-transparent">
                        <h1 class="text-6xl md:text-7xl font-black text-white uppercase tracking-tighter drop-shadow-lg">{{ currentLegendDetails.name }}</h1>
                        <div class="text-theme-primary font-mono tracking-widest uppercase mt-4 text-sm flex items-center gap-6">
                            <span class="flex items-center gap-2"><div class="w-1.5 h-1.5 bg-theme-primary"></div> {{ currentLegendDetails.lore.real_name || $t('legends.unknownIdentity') }}</span>
                            <span v-if="currentLegendDetails.lore.age" class="flex items-center gap-2"><div class="w-1.5 h-1.5 bg-theme-primary"></div> {{ $t('legends.age') }} {{ currentLegendDetails.lore.age }}</span>
                        </div>
                    </div>
                </div>

                <!-- Modal Tabs -->
                <div class="flex border-b border-titan-border bg-[rgba(var(--theme-primary-rgb),0.05)] shrink-0 overflow-x-auto custom-scrollbar">
                    <button 
                        @click="activeModalTab = 'infos'" 
                        class="flex-1 py-4 px-4 font-mono uppercase tracking-widest text-xs sm:text-sm transition-colors border-b-2 whitespace-nowrap"
                        :class="activeModalTab === 'infos' ? 'text-theme-secondary border-theme-secondary bg-[rgba(var(--theme-primary-rgb),0.1)]' : 'text-gray-500 border-transparent hover:text-white hover:bg-white/5'"
                    >
                        {{ $t('legends.tabInfos') }}
                    </button>
                    <button 
                        @click="activeModalTab = 'perks'" 
                        class="flex-1 py-4 px-4 font-mono uppercase tracking-widest text-xs sm:text-sm transition-colors border-b-2 whitespace-nowrap"
                        :class="activeModalTab === 'perks' ? 'text-theme-secondary border-theme-secondary bg-[rgba(var(--theme-primary-rgb),0.1)]' : 'text-gray-500 border-transparent hover:text-white hover:bg-white/5'"
                    >
                        {{ $t('legends.tabPerks') }}
                    </button>
                    <button 
                        @click="activeModalTab = 'playstyle'" 
                        class="flex-1 py-4 px-4 font-mono uppercase tracking-widest text-xs sm:text-sm transition-colors border-b-2 whitespace-nowrap"
                        :class="activeModalTab === 'playstyle' ? 'text-theme-secondary border-theme-secondary bg-[rgba(var(--theme-primary-rgb),0.1)]' : 'text-gray-500 border-transparent hover:text-white hover:bg-white/5'"
                    >
                        {{ $t('legends.tabPlaystyle') }}
                    </button>
                    <button 
                        @click="activeModalTab = 'patch'" 
                        class="flex-1 py-4 px-4 font-mono uppercase tracking-widest text-xs sm:text-sm transition-colors border-b-2 whitespace-nowrap"
                        :class="activeModalTab === 'patch' ? 'text-theme-secondary border-theme-secondary bg-[rgba(var(--theme-primary-rgb),0.1)]' : 'text-gray-500 border-transparent hover:text-white hover:bg-white/5'"
                    >
                        {{ $t('legends.tabPatch') }}
                    </button>
                </div>

                <!-- INFOS TAB CONTENT -->
                <template v-if="activeModalTab === 'infos'">
                    <!-- Body Area -->
                    <div class="p-8 md:p-10 flex-1 flex flex-col lg:flex-row gap-12 bg-transparent">
                    <!-- Lore -->
                    <div class="flex-1 space-y-8">
                        <div>
                            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest font-display mb-3 flex items-center gap-2">
                                <span class="w-1.5 h-1.5 bg-gray-400 block"></span> {{ $t('legends.origin') }}
                            </h3>
                            <p class="text-white font-mono text-lg tracking-wide">{{ currentLegendDetails.lore.home_world || $t('legends.secretClassification') }}</p>
                        </div>

                        <div v-if="currentLegendDetails.lore.bio">
                            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest font-display mb-3 flex items-center gap-2">
                                <span class="w-1.5 h-1.5 bg-gray-400 block"></span> {{ $t('legends.bio') }}
                            </h3>
                            <div class="relative">
                                <p class="text-gray-300 font-sans leading-relaxed text-justify whitespace-pre-line text-lg font-medium drop-shadow-sm" :class="{'line-clamp-4': !showFullBio}">{{ currentLegendDetails.lore.bio }}</p>
                                <button v-if="currentLegendDetails.lore.bio.length > 250" @click="showFullBio = !showFullBio" class="text-theme-secondary text-xs font-mono uppercase mt-3 hover:text-white transition-colors border border-[var(--theme-secondary)] px-3 py-1 bg-black/50">
                                    {{ showFullBio ? $t('legends.readLess') : $t('legends.readMore') }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Abilities -->
                    <div class="flex-1 space-y-8 lg:border-l lg:border-titan-border/50 lg:pl-12">
                        <div class="relative">
                            <div class="absolute -left-12 top-1 bottom-1 w-px bg-[rgba(var(--theme-primary-rgb),0.3)] hidden lg:block"></div>
                            <h3 class="text-xs font-bold text-theme-secondary uppercase tracking-widest font-display mb-6 flex items-center gap-2">
                                <span class="w-2 h-2 bg-theme-secondary block"></span> {{ $t('legends.tacticalAbilities') }}
                            </h3>

                            <div class="space-y-8">
                                <!-- Passive -->
                                <div class="flex gap-5 items-start group">
                                    <div class="w-14 h-14 mt-1 bg-black/80 border border-titan-border shrink-0 flex items-center justify-center group-hover:border-theme-secondary group-hover:bg-[rgba(var(--theme-primary-rgb),0.1)] transition-colors">
                                        <img 
                                            :src="`/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_2.svg`"
                                            @error="handleImageError($event, `/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_2.png`, 'ability2Error')"
                                            v-show="!ability2Error"
                                            class="w-8 h-8 invert opacity-80 group-hover:opacity-100 transition-opacity"
                                        />
                                        <span v-if="ability2Error" class="text-gray-600 font-mono text-xs">PAS</span>
                                    </div>
                                    <div>
                                        <div class="text-[13px] text-gray-500 font-mono uppercase tracking-widest mb-1">{{ $t('legends.passive') }}</div>
                                        <h4 class="font-bold text-white uppercase tracking-wider text-lg">{{ currentLegendDetails.abilities.passive.name || $t('legends.unknown') }}</h4>
                                        <p v-if="currentLegendDetails.abilities.passive.description" class="text-base text-gray-400 mt-2 font-sans font-medium drop-shadow-sm leading-relaxed">{{ currentLegendDetails.abilities.passive.description }}</p>
                                        <div v-if="getPrimaryStat(currentLegendDetails.abilities.passive)" class="mt-2 text-[13px] font-mono text-theme-secondary uppercase border border-[var(--theme-secondary)] inline-block px-2 py-0.5 rounded-sm">
                                            {{ getPrimaryStat(currentLegendDetails.abilities.passive)?.key.toLowerCase() === 'cooldown' ? $t('legends.cooldown') : getPrimaryStat(currentLegendDetails.abilities.passive)?.key }}: {{ getPrimaryStat(currentLegendDetails.abilities.passive)?.value }}
                                        </div>
                                    </div>
                                </div>

                                <!-- Tactical -->
                                <div class="flex gap-5 items-start group">
                                    <div class="w-14 h-14 mt-1 bg-black/80 border border-titan-border shrink-0 flex items-center justify-center group-hover:border-theme-secondary group-hover:bg-[rgba(var(--theme-primary-rgb),0.1)] transition-colors">
                                        <img 
                                            :src="`/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_1.svg`"
                                            @error="handleImageError($event, `/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_1.png`, 'ability1Error')"
                                            v-show="!ability1Error"
                                            class="w-8 h-8 invert opacity-80 group-hover:opacity-100 transition-opacity"
                                        />
                                        <span v-if="ability1Error" class="text-gray-600 font-mono text-xs">TAC</span>
                                    </div>
                                    <div>
                                        <div class="text-[13px] text-gray-500 font-mono uppercase tracking-widest mb-1">{{ $t('legends.tactical') }}</div>
                                        <h4 class="font-bold text-white uppercase tracking-wider text-lg">{{ currentLegendDetails.abilities.tactical.name || $t('legends.unknown') }}</h4>
                                        <p v-if="currentLegendDetails.abilities.tactical.description" class="text-base text-gray-400 mt-2 font-sans font-medium drop-shadow-sm leading-relaxed">{{ currentLegendDetails.abilities.tactical.description }}</p>
                                        <div v-if="getPrimaryStat(currentLegendDetails.abilities.tactical)" class="mt-2 text-[13px] font-mono text-theme-secondary uppercase border border-[var(--theme-secondary)] inline-block px-2 py-0.5 rounded-sm">
                                            {{ getPrimaryStat(currentLegendDetails.abilities.tactical)?.key.toLowerCase() === 'cooldown' ? $t('legends.cooldown') : getPrimaryStat(currentLegendDetails.abilities.tactical)?.key }}: {{ getPrimaryStat(currentLegendDetails.abilities.tactical)?.value }}
                                        </div>
                                    </div>
                                </div>

                                <!-- Ultimate -->
                                <div class="flex gap-5 items-start group">
                                    <div class="w-14 h-14 mt-1 bg-black/80 border border-titan-border shrink-0 flex items-center justify-center group-hover:border-theme-secondary group-hover:bg-[rgba(var(--theme-primary-rgb),0.1)] transition-colors">
                                        <img 
                                            :src="`/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_3.svg`"
                                            @error="handleImageError($event, `/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_3.png`, 'ability3Error')"
                                            v-show="!ability3Error"
                                            class="w-8 h-8 invert opacity-90 group-hover:opacity-100 transition-opacity"
                                        />
                                        <span v-if="ability3Error" class="text-gray-600 font-mono text-xs">ULT</span>
                                    </div>
                                    <div>
                                        <div class="text-[13px] text-theme-secondary font-mono uppercase tracking-widest mb-1">{{ $t('legends.ultimate') }}</div>
                                        <h4 class="font-bold text-white uppercase tracking-wider text-lg">{{ currentLegendDetails.abilities.ultimate.name || $t('legends.unknown') }}</h4>
                                        <p v-if="currentLegendDetails.abilities.ultimate.description" class="text-base text-gray-400 mt-2 font-sans font-medium drop-shadow-sm leading-relaxed">{{ currentLegendDetails.abilities.ultimate.description }}</p>
                                        <div v-if="getPrimaryStat(currentLegendDetails.abilities.ultimate)" class="mt-2 text-[13px] font-mono text-theme-secondary uppercase border border-[var(--theme-secondary)] inline-block px-2 py-0.5 rounded-sm">
                                            {{ getPrimaryStat(currentLegendDetails.abilities.ultimate)?.key.toLowerCase() === 'cooldown' ? $t('legends.cooldown') : getPrimaryStat(currentLegendDetails.abilities.ultimate)?.key }}: {{ getPrimaryStat(currentLegendDetails.abilities.ultimate)?.value }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                </template>

                <!-- PATCH HISTORY TAB CONTENT -->
                <template v-else-if="activeModalTab === 'patch'">
                    <div v-if="!currentLegendPatchHistory || currentLegendPatchHistory.length === 0" class="flex-1 p-8 md:p-12 flex items-center justify-center text-gray-500 font-mono text-center">
                        Aucun historique de patch.
                    </div>
                    <div v-else class="p-8 md:p-10 flex-1 bg-transparent overflow-y-auto custom-scrollbar">
                        <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest font-display mb-8 flex items-center gap-2">
                            <span class="w-1.5 h-1.5 bg-gray-400 block"></span> {{ $t('legends.patchHistory') }}
                        </h3>
                        <div class="space-y-12 ml-4 md:ml-6">
                            <div v-for="(patch, index) in currentLegendPatchHistory" :key="patch.patch" 
                                 class="relative transition-all duration-1000"
                                 :class="(index === 0 && isHighlightingPatch) ? 'bg-[rgba(var(--theme-primary-rgb),0.05)] shadow-[inset_0_0_30px_rgba(var(--theme-primary-rgb),0.1)] p-4 -mx-4 rounded-sm border border-[rgba(var(--theme-primary-rgb),0.2)]' : ''">
                                 
                                <div class="absolute -left-4 md:-left-6 top-2 bottom-0 w-px bg-titan-border/30" :class="(index === 0 && isHighlightingPatch) ? 'bg-[rgba(var(--theme-primary-rgb),0.5)] shadow-[0_0_10px_rgba(var(--theme-primary-rgb),0.5)]' : ''"></div>

                                <button @click="togglePatch(index)"
                                    class="w-full font-bold font-mono text-lg uppercase tracking-wider mb-2 flex items-center gap-3 transition-colors duration-1000 text-left hover:text-white"
                                    :class="(index === 0 && isHighlightingPatch) ? 'text-theme-primary' : 'text-theme-secondary'">
                                    <div class="w-2 h-2 rounded-full absolute -left-[1.1rem] md:-left-[1.6rem] top-2.5 transition-colors duration-1000" :class="(index === 0 && isHighlightingPatch) ? 'bg-theme-primary shadow-[0_0_10px_rgba(var(--theme-primary-rgb),1)]' : 'bg-theme-secondary'"></div>
                                    <svg class="w-4 h-4 shrink-0 transition-transform duration-200 text-gray-500" :class="{'-rotate-90': collapsedPatches.has(index)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" /></svg>
                                    <span class="flex-1">{{ patch.patch }}</span>
                                    <div class="flex items-center gap-3 shrink-0">
                                        <div v-if="getPatchReworks(patch.details).length > 0" class="flex gap-2 items-center">
                                            <span class="text-[11px] font-bold font-sans uppercase tracking-widest text-fuchsia-400 bg-fuchsia-400/10 border border-fuchsia-400/30 px-1.5 py-0.5 whitespace-nowrap">
                                                {{ $t('legends.rework') }}
                                                <span v-if="getPatchReworks(patch.details).length === 1 && !['base', 'legend'].includes(getPatchReworks(patch.details)[0].toLowerCase())" class="text-fuchsia-300 ml-1">
                                                    ({{ getPatchReworks(patch.details)[0] }})
                                                </span>
                                            </span>
                                        </div>
                                        <span class="text-[13px] text-gray-500 font-mono normal-case tracking-normal">{{ patch.details.length }} {{ patch.details.length > 1 ? $t('legends.changes') : $t('legends.change') }}</span>
                                    </div>
                                </button>
                                
                                <div v-show="!collapsedPatches.has(index)" class="flex flex-wrap gap-6 mb-6">
                                    <template v-for="group in groupPatchDetails(patch.details)" :key="group.category">
                                        <div class="flex-1 min-w-[280px] max-w-[480px] bg-[rgba(var(--theme-primary-rgb),0.05)] border border-[rgba(var(--theme-primary-rgb),0.1)] p-5 hover:border-[rgba(var(--theme-primary-rgb),0.3)] transition-colors">
                                            <div class="flex items-center gap-3 mb-4 border-b border-titan-border/20 pb-3">
                                                <template v-if="group.category === 'Tactical'">
                                                    <div class="w-8 h-8 bg-black/80 border border-titan-border flex items-center justify-center p-1.5 shrink-0">
                                                        <img :src="`/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_1.svg`" @error="hideImageOnError" class="w-full h-full invert opacity-80 drop-shadow" />
                                                    </div>
                                                </template>
                                                <template v-else-if="group.category === 'Passive'">
                                                    <div class="w-8 h-8 bg-black/80 border border-titan-border flex items-center justify-center p-1.5 shrink-0">
                                                        <img :src="`/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_2.svg`" @error="hideImageOnError" class="w-full h-full invert opacity-80 drop-shadow" />
                                                    </div>
                                                </template>
                                                <template v-else-if="group.category === 'Ultimate'">
                                                    <div class="w-8 h-8 bg-black/80 border border-titan-border flex items-center justify-center p-1.5 shrink-0">
                                                        <img :src="`/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_3.svg`" @error="hideImageOnError" class="w-full h-full invert opacity-80 drop-shadow" />
                                                    </div>
                                                </template>
                                                <template v-else-if="group.category === 'Class'">
                                                    <div class="w-8 h-8 bg-black/80 border border-titan-border flex items-center justify-center p-1.5 shrink-0">
                                                        <img :src="`/images/legends/classes/${formatImgName(legendClass)}_class.svg`" @error="hideImageOnError" class="w-full h-full invert opacity-80 drop-shadow" />
                                                    </div>
                                                </template>
                                                
                                                <div>
                                                    <div v-if="group.category !== 'Rework'" class="text-[13px] text-gray-500 font-mono tracking-widest uppercase flex items-center gap-2">
                                                        <span v-if="!['Tactical', 'Passive', 'Ultimate', 'Class'].includes(group.category)" class="w-1.5 h-1.5 bg-gray-500 rounded-sm block"></span>
                                                        {{ group.category }}
                                                    </div>
                                                    <div v-if="getAbilityName(group.category)" class="text-sm font-bold text-white tracking-wider uppercase font-sans mt-0.5">{{ getAbilityName(group.category) }}</div>
                                                    <div v-else-if="group.category === 'Rework'" class="text-sm font-bold text-fuchsia-400 tracking-wider uppercase font-sans">{{ currentLegendDetails.name }} {{ group.items[0]?.type?.toLowerCase() === 'rework' ? 'REWORK' : group.items[0]?.type }}</div>
                                                </div>
                                            </div>
                                            <ul class="space-y-4 text-gray-400 text-sm">
                                                <li v-for="(item, i) in group.items" :key="i" class="leading-relaxed flex flex-col gap-1.5">
                                                    <template v-if="group.category === 'Rework'">
                                                        <div class="flex items-center">
                                                            <span class="font-mono text-[13px] uppercase tracking-wider px-1.5 py-0.5 border" :class="getPatchTypeClass(item.type)">
                                                                REWORK
                                                            </span>
                                                        </div>
                                                        <div class="text-gray-300 text-base font-medium drop-shadow-sm space-y-4 mt-4">
                                                            <div v-for="(line, idx) in formatReworkText(item.text)" :key="idx" :class="{'text-white font-bold mb-3': idx === 0, 'ml-2 flex items-start gap-4': idx > 0}">
                                                                <template v-if="idx > 0">
                                                                    <template v-if="line.toLowerCase().includes('passive')">
                                                                        <div class="w-8 h-8 bg-black/80 border border-titan-border flex items-center justify-center p-1.5 shrink-0 -mt-1">
                                                                            <img :src="`/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_2.svg`" @error="hideImageOnError" class="w-full h-full invert opacity-80 drop-shadow" />
                                                                        </div>
                                                                    </template>
                                                                    <template v-else-if="line.toLowerCase().includes('tactical')">
                                                                        <div class="w-8 h-8 bg-black/80 border border-titan-border flex items-center justify-center p-1.5 shrink-0 -mt-1">
                                                                            <img :src="`/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_1.svg`" @error="hideImageOnError" class="w-full h-full invert opacity-80 drop-shadow" />
                                                                        </div>
                                                                    </template>
                                                                    <template v-else-if="line.toLowerCase().includes('ultimate')">
                                                                        <div class="w-8 h-8 bg-black/80 border border-titan-border flex items-center justify-center p-1.5 shrink-0 -mt-1">
                                                                            <img :src="`/images/legends/abilities/${formatImgName(currentLegendDetails.name)}_ability_3.svg`" @error="hideImageOnError" class="w-full h-full invert opacity-80 drop-shadow" />
                                                                        </div>
                                                                    </template>
                                                                    <template v-else-if="line.toLowerCase().includes('class')">
                                                                        <div class="w-8 h-8 bg-black/80 border border-titan-border flex items-center justify-center p-1.5 shrink-0 -mt-1">
                                                                            <img :src="`/images/legends/classes/${formatImgName(legendClass)}_class.svg`" @error="hideImageOnError" class="w-full h-full invert opacity-80 drop-shadow" />
                                                                        </div>
                                                                    </template>
                                                                    <template v-else>
                                                                        <span class="w-1.5 h-1.5 bg-fuchsia-400/80 rounded-sm shrink-0 mt-2 block"></span>
                                                                    </template>
                                                                    
                                                                    <span class="mt-0.5">{{ line }}</span>
                                                                </template>
                                                                <template v-else>
                                                                    <span>{{ line }}</span>
                                                                </template>
                                                            </div>
                                                        </div>
                                                    </template>
                                                    <template v-else-if="item.isFormatted">
                                                        <div class="flex items-center">
                                                            <span class="font-mono text-[13px] uppercase tracking-wider px-1.5 py-0.5 border" :class="getPatchTypeClass(item.type)">
                                                                {{ item.type }}
                                                            </span>
                                                        </div>
                                                        <span class="text-gray-300 text-base font-medium drop-shadow-sm" :class="{'line-through opacity-50': item.type.toLowerCase().includes('remove')}">{{ item.text }}</span>
                                                    </template>
                                                    <template v-else>
                                                        <span class="text-gray-400 flex items-start gap-2">
                                                            <span class="w-1.5 h-1.5 rounded-full bg-titan-border/50 shrink-0 mt-1.5 block"></span>
                                                            <span class="text-base font-medium drop-shadow-sm">{{ item.text }}</span>
                                                        </span>
                                                    </template>
                                                </li>
                                            </ul>
                                        </div>
                                    </template>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>

                <!-- PERKS TAB CONTENT -->
                <template v-else-if="activeModalTab === 'perks'">
                    <div v-if="!currentLegendDetails.tactics" class="flex-1 p-8 md:p-12 flex items-center justify-center text-gray-500 font-mono text-center">
                        {{ $t('legends.noTacticsData') }}
                    </div>
                    <div v-else class="p-8 md:p-12 flex-1 flex flex-col gap-12 bg-transparent overflow-y-auto custom-scrollbar">
                        <div class="flex flex-col gap-12">
                            <!-- Perks Tree -->
                            <div class="w-full">
                                <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest font-display mb-6 flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 bg-titan-orange block"></span> {{ $t('legends.bestPerks') }}
                                </h3>
                                
                                <div class="relative flex flex-col items-center py-8 bg-black/40 border border-titan-border/50 overflow-hidden">
                                    <!-- Central vertical line -->
                                    <div class="absolute top-12 bottom-12 left-1/2 w-0.5 bg-white/10 -translate-x-1/2 z-0"></div>

                                    <!-- Level 1 (Top Shield) -->
                                    <div class="relative z-10 flex flex-col items-center mb-16">
                                        <div class="w-20 h-16 bg-black border-[3px] border-white flex flex-col items-center justify-center perk-shield-shape shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                                            <span class="text-white font-mono font-black text-[13px] mt-1">NIV. 1</span>
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
                                                    <div v-if="currentLegendDetails.tactics.perks.level_2.left.recommended" class="absolute -top-3 right-4 bg-titan-cyan text-black text-[13px] font-bold px-2 py-0.5 rounded-sm uppercase shadow-[0_0_10px_rgba(45,212,191,0.5)]">Recommandé</div>
                                                    <h4 class="font-bold text-white text-xs md:text-sm uppercase tracking-wider mb-1 font-display transition-colors" :class="{'text-titan-cyan drop-shadow-[0_0_5px_rgba(45,212,191,0.8)]': currentLegendDetails.tactics.perks.level_2.left.recommended}">{{ currentLegendDetails.tactics.perks.level_2.left.name }}</h4>
                                                    <p class="text-gray-400 font-sans text-[13px] md:text-xs leading-tight line-clamp-3">{{ currentLegendDetails.tactics.perks.level_2.left.description }}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Center Shield Lvl 2 -->
                                        <div class="w-20 h-16 bg-black border-[3px] border-titan-cyan flex flex-col items-center justify-center perk-shield-shape shadow-[0_0_15px_rgba(45,212,191,0.3)] z-10 mx-2 shrink-0">
                                            <span class="text-white font-mono font-black text-[13px] mt-1">NIV. 2</span>
                                            <svg class="w-5 h-5 text-titan-cyan mt-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z"/></svg>
                                        </div>

                                        <!-- Right Perk Box -->
                                        <div class="flex-1 flex justify-start pl-2 md:pl-8">
                                            <div class="w-full max-w-[280px] border-2 flex flex-col relative group cursor-default transition-all perk-skew"
                                                 :class="currentLegendDetails.tactics.perks.level_2.right.recommended ? 'bg-titan-cyan/20 border-titan-cyan shadow-[0_0_20px_rgba(45,212,191,0.3)]' : 'bg-black/80 border-titan-cyan/30'">
                                                <div class="p-4 perk-unskew flex flex-col h-full justify-center">
                                                    <div v-if="currentLegendDetails.tactics.perks.level_2.right.recommended" class="absolute -top-3 left-4 bg-titan-cyan text-black text-[13px] font-bold px-2 py-0.5 rounded-sm uppercase shadow-[0_0_10px_rgba(45,212,191,0.5)]">Recommandé</div>
                                                    <h4 class="font-bold text-white text-xs md:text-sm uppercase tracking-wider mb-1 font-display transition-colors" :class="{'text-titan-cyan drop-shadow-[0_0_5px_rgba(45,212,191,0.8)]': currentLegendDetails.tactics.perks.level_2.right.recommended}">{{ currentLegendDetails.tactics.perks.level_2.right.name }}</h4>
                                                    <p class="text-gray-400 font-sans text-[13px] md:text-xs leading-tight line-clamp-3">{{ currentLegendDetails.tactics.perks.level_2.right.description }}</p>
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
                                                    <div v-if="currentLegendDetails.tactics.perks.level_3.left.recommended" class="absolute -top-3 right-4 bg-fuchsia-500 text-black text-[13px] font-bold px-2 py-0.5 rounded-sm uppercase shadow-[0_0_10px_rgba(217,70,239,0.5)]">Recommandé</div>
                                                    <h4 class="font-bold text-white text-xs md:text-sm uppercase tracking-wider mb-1 font-display transition-colors" :class="{'text-fuchsia-400 drop-shadow-[0_0_5px_rgba(217,70,239,0.8)]': currentLegendDetails.tactics.perks.level_3.left.recommended}">{{ currentLegendDetails.tactics.perks.level_3.left.name }}</h4>
                                                    <p class="text-gray-400 font-sans text-[13px] md:text-xs leading-tight line-clamp-3">{{ currentLegendDetails.tactics.perks.level_3.left.description }}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Center Shield Lvl 3 -->
                                        <div class="w-20 h-16 bg-black border-[3px] border-fuchsia-500 flex flex-col items-center justify-center perk-shield-shape shadow-[0_0_15px_rgba(217,70,239,0.3)] z-10 mx-2 shrink-0">
                                            <span class="text-white font-mono font-black text-[13px] mt-1">NIV. 3</span>
                                            <svg class="w-5 h-5 text-fuchsia-500 mt-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z"/></svg>
                                        </div>

                                        <!-- Right Perk Box -->
                                        <div class="flex-1 flex justify-start pl-2 md:pl-8">
                                            <div class="w-full max-w-[280px] border-2 flex flex-col relative group cursor-default transition-all perk-skew"
                                                 :class="currentLegendDetails.tactics.perks.level_3.right.recommended ? 'bg-fuchsia-500/20 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.3)]' : 'bg-black/80 border-fuchsia-500/30'">
                                                <div class="p-4 perk-unskew flex flex-col h-full justify-center">
                                                    <div v-if="currentLegendDetails.tactics.perks.level_3.right.recommended" class="absolute -top-3 left-4 bg-fuchsia-500 text-black text-[13px] font-bold px-2 py-0.5 rounded-sm uppercase shadow-[0_0_10px_rgba(217,70,239,0.5)]">Recommandé</div>
                                                    <h4 class="font-bold text-white text-xs md:text-sm uppercase tracking-wider mb-1 font-display transition-colors" :class="{'text-fuchsia-400 drop-shadow-[0_0_5px_rgba(217,70,239,0.8)]': currentLegendDetails.tactics.perks.level_3.right.recommended}">{{ currentLegendDetails.tactics.perks.level_3.right.name }}</h4>
                                                    <p class="text-gray-400 font-sans text-[13px] md:text-xs leading-tight line-clamp-3">{{ currentLegendDetails.tactics.perks.level_3.right.description }}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </template>

                <!-- PLAYSTYLE TAB CONTENT -->
                <template v-else-if="activeModalTab === 'playstyle'">
                    <div v-if="!currentLegendDetails.tactics" class="flex-1 p-8 md:p-12 flex items-center justify-center text-gray-500 font-mono text-center">
                        {{ $t('legends.noTacticsData') }}
                    </div>
                    <div v-else class="p-8 md:p-12 flex-1 flex flex-col gap-12 bg-transparent overflow-y-auto custom-scrollbar">
                        <!-- Playstyle -->
                        <div>
                            <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest font-display mb-4 flex items-center gap-2">
                                <span class="w-1.5 h-1.5 bg-titan-cyan block"></span> {{ $t('legends.playstyle') }}
                            </h3>
                            <p class="text-white font-sans text-xl md:text-2xl leading-relaxed text-justify font-medium drop-shadow-md">{{ currentLegendDetails.tactics.playstyle }}</p>
                        </div>

                        <!-- Weapons -->
                        <div class="w-full mt-4">
                            <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest font-display mb-6 flex items-center gap-2">
                                <span class="w-1.5 h-1.5 bg-apex-red block"></span> {{ $t('legends.recommendedWeapons') }}
                            </h3>
                            <div class="flex flex-wrap gap-4">
                                <div v-for="weapon in currentLegendDetails.tactics.weapons" :key="typeof weapon === 'object' ? (weapon.id || weapon.name) : weapon" 
                                     class="w-24 h-14 bg-black/50 border border-titan-border flex items-center justify-center p-2 group relative cursor-help transition-all hover:border-titan-cyan hover:bg-titan-cyan/10">
                                    
                                    <img v-if="typeof weapon === 'object' && weapon.id" :src="`/images/weapons/${weapon.id}.svg`" :alt="weapon.name" class="max-w-full max-h-full object-contain invert opacity-80 group-hover:opacity-100 transition-opacity" @error="hideImageOnError" />
                                    <span v-else class="font-mono text-white text-[13px] text-center">{{ typeof weapon === 'object' ? weapon.name : weapon }}</span>

                                    <!-- Tooltip -->
                                    <div v-if="typeof weapon === 'object' && weapon.name" class="absolute -top-10 left-1/2 -translate-x-1/2 bg-black border border-titan-cyan text-titan-cyan px-3 py-1 text-xs font-mono uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-[0_0_10px_rgba(45,212,191,0.2)]">
                                        {{ weapon.name }}
                                        <div class="absolute -bottom-[5px] left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-titan-cyan w-0 h-0"></div>
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