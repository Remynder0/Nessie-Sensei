<script setup lang="ts">
import { ref, computed } from 'vue'
import { legendsData, loadLegendDetails, currentLegendDetails, isLoadingLegendDetails, latestPatchStatus, isLatestPatchRecent } from '../../logic/store'
import LegendGallery from '../LegendGallery.vue'
import LegendModal from '../LegendModal.vue'

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

const impactOrder: Record<string, number> = {
    'introduced': 6,
    'rework': 5,
    'major_buff': 4,
    'major_nerf': 4,
    'buff': 3,
    'nerf': 3,
    'adjust': 1
};

const sortedAffectedLegends = computed(() => {
    const list = [];
    for (const [key, status] of Object.entries(latestPatchStatus.value)) {
        const legendObj = legendsData.value.find(l => l.Name.toLowerCase().replace(/ /g, '_') === key);
        if (legendObj) {
            list.push({
                name: legendObj.Name,
                key: key,
                status: status
            });
        }
    }
    
    return list.sort((a, b) => {
        const impactA = impactOrder[a.status] || 0;
        const impactB = impactOrder[b.status] || 0;
        if (impactA !== impactB) return impactB - impactA;
        return a.name.localeCompare(b.name);
    });
});

const patchStatusClass = (status: string) => {
    switch (status) {
        case 'introduced': return 'text-titan-orange border-titan-orange/50 bg-titan-orange/20 shadow-[0_0_15px_rgba(255,165,0,0.4)]';
        case 'rework': return 'text-fuchsia-400 border-fuchsia-400/50 bg-fuchsia-400/10 shadow-[0_0_10px_rgba(217,70,239,0.3)]';
        case 'major_buff': return 'text-green-400 border-green-400/50 bg-green-400/10 shadow-[0_0_10px_rgba(74,222,128,0.3)]';
        case 'buff': return 'text-green-400/80 border-green-400/30 bg-green-400/5';
        case 'major_nerf': return 'text-red-500 border-red-500/50 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
        case 'nerf': return 'text-red-500/80 border-red-500/30 bg-red-500/5';
        case 'adjust': return 'text-titan-cyan border-titan-cyan/30 bg-titan-cyan/10';
        default: return '';
    }
};

const patchStatusIcon = (status: string) => {
    switch (status) {
        case 'introduced': 
            return '<span class="text-[10px] font-black tracking-wider mt-0.5">NEW</span>';
        case 'rework': 
            return `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0l2.5 8.5L23 11l-8.5 2.5L12 22l-2.5-8.5L1 11l8.5-2.5L12 0z"/></svg>`;
        case 'major_buff': 
            return `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7M5 9l7-7 7 7" /></svg>`;
        case 'buff': 
            return `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12l7-7 7 7M12 5v14" /></svg>`;
        case 'major_nerf': 
            return `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7M19 15l-7 7-7-7" /></svg>`;
        case 'nerf': 
            return `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M19 12l-7 7-7-7M12 19V5" /></svg>`;
        case 'adjust': 
            return `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>`;
        default: return '';
    }
};

const patchStatusTooltip = (status: string) => {
    switch (status) {
        case 'introduced': return 'New Legend';
        case 'rework': return 'Rework';
        case 'major_buff': return 'Major Buff';
        case 'buff': return 'Buff';
        case 'major_nerf': return 'Major Nerf';
        case 'nerf': return 'Nerf';
        case 'adjust': return 'Adjustment';
        default: return '';
    }
};

const modalInitialTab = ref<string>('infos')
const modalHighlightPatch = ref<boolean>(false)

async function selectLegend(name: string) {
    modalInitialTab.value = 'infos'
    modalHighlightPatch.value = false
    selectedLegendName.value = name
    await loadLegendDetails(name)
}

async function selectLegendFromPatch(name: string) {
    modalInitialTab.value = 'patch'
    modalHighlightPatch.value = true
    selectedLegendName.value = name
    await loadLegendDetails(name)
}

const formatClassName = (name: string) => name.toLowerCase().replace(/ /g, '_')

function hideErrorImage(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img) img.style.display = 'none';
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden relative">
    <!-- Top Search Bar & Header -->
    <div class="p-6 border-b border-titan-border bg-black/60 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10">
        <div class="flex items-center">
            <h2 class="text-2xl font-black text-white tracking-widest uppercase font-mono flex items-center shrink-0">
                <span class="text-titan-cyan mr-3 block w-3 h-3 bg-titan-cyan"></span> 
                {{ $t('legends.title') }}
            </h2>
            
            <div v-if="isLatestPatchRecent && sortedAffectedLegends.length > 0" class="hidden md:flex items-center gap-3 ml-8 border-l border-titan-border/50 pl-8">
                <div 
                    v-for="l in sortedAffectedLegends" 
                    :key="l.key"
                    class="relative cursor-pointer group shrink-0"
                    @click="selectLegendFromPatch(l.name)"
                >
                    <img 
                        :src="`/images/legends/icons/${l.key}.png`" 
                        @error="hideErrorImage"
                        class="w-10 h-10 object-cover object-top border transition-colors opacity-80 group-hover:opacity-100"
                        :class="[
                            l.status === 'introduced' ? 'border-titan-orange' : 'border-titan-border group-hover:border-titan-cyan'
                        ]"
                    >
                    <div 
                        class="absolute -bottom-1 -right-1.5 w-5 h-5 flex items-center justify-center border backdrop-blur-md transition-transform group-hover:scale-110" 
                        :class="patchStatusClass(l.status)"
                    >
                        <span class="flex items-center justify-center" v-html="patchStatusIcon(l.status)"></span>
                    </div>

                    <div class="absolute top-12 left-1/2 -translate-x-1/2 bg-black/90 border px-2 py-1 text-[10px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none" :class="patchStatusClass(l.status)">
                        {{ l.name }} : {{ patchStatusTooltip(l.status) }}
                    </div>
                </div>
            </div>
        </div>

        <div class="flex items-center gap-4 w-full md:w-auto mt-4 md:mt-0">
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
        <div v-if="!groupByClass" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-12 gap-y-24 content-start pt-8 pb-8">
            <LegendGallery 
                v-for="legend in filteredLegends" 
                :key="legend.Name"
                :legendName="legend.Name"
                @click="selectLegend(legend.Name)"
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
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-12 gap-y-32 content-start pt-8">
                    <LegendGallery 
                        v-for="legend in group" 
                        :key="legend.Name"
                        :legendName="legend.Name"
                        @click="selectLegend(legend.Name)"
                    />
                </div>
            </div>
        </div>
    </div>

    <!-- Modal for Legend Details -->
    <LegendModal 
        v-if="selectedLegendName" 
        @close="selectedLegendName = null" 
        :initialTab="modalInitialTab"
        :highlightLatestPatch="modalHighlightPatch"
    />
  </div>
</template>
