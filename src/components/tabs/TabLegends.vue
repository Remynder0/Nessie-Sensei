<script setup lang="ts">
import { ref, computed } from 'vue'
import { legendsData, loadLegendDetails, currentLegendDetails, isLoadingLegendDetails } from '../../logic/store'
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

async function selectLegend(name: string) {
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
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-12 gap-y-32 content-start pt-32">
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
    />
  </div>
</template>
