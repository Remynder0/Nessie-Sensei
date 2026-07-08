<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { generateSeasons, getParsedSeasonData } from '../../logic/packCalculator'
import type { SeasonData } from '../../logic/packCalculator'

const seasons = ref<SeasonData[]>(generateSeasons().reverse())
const currentIndex = ref(0)

const selectedSeasonMeta = computed(() => seasons.value[currentIndex.value])

const selectedSeasonData = computed(() => {
    if (!selectedSeasonMeta.value) return null
    return getParsedSeasonData(selectedSeasonMeta.value.id)
})

const goNext = () => {
    if (currentIndex.value < seasons.value.length - 1) {
        currentIndex.value++
    }
}

const goPrev = () => {
    if (currentIndex.value > 0) {
        currentIndex.value--
    }
}

const patchExpanded = ref(false)

watch(currentIndex, () => {
    patchExpanded.value = false
})

const levels = computed(() => {
    const data = selectedSeasonData.value
    if (!data || !data.rewards) return []
    
    const maxLevel = selectedSeasonMeta.value?.maxLevel || 110
    const result = []
    
    for (let i = 1; i <= maxLevel; i++) {
        const levelData = data.rewards[`level_${i}`]
        if (levelData) {
            result.push({
                level: i,
                free: levelData.free || [],
                premium: levelData.premium || []
            })
        } else {
            result.push({
                level: i,
                free: [],
                premium: []
            })
        }
    }
    return result
})

const levelChunks = computed(() => {
    const chunks = []
    for (let i = 0; i < levels.value.length; i += 20) {
        chunks.push({
            start: i + 1,
            end: Math.min(i + 20, levels.value.length),
            items: levels.value.slice(i, i + 20),
            expanded: ref(i === 0) // Default expand first chunk
        })
    }
    return chunks
})

const getWeaponIconName = (skinStr: string) => {
    if (!skinStr) return null;
    const lower = skinStr.toLowerCase();
    if (lower.includes('r-301')) return 'r-301_carbine';
    if (lower.includes('flatline')) return 'vk-47_flatline';
    if (lower.includes('car') || lower.includes('c.a.r.')) return 'c.a.r._smg';
    if (lower.includes('nemesis')) return 'nemesis_burst_ar';
    if (lower.includes('prowler')) return 'prowler_burst_pdw';
    if (lower.includes('hemlok')) return 'hemlok_burst_ar';
    if (lower.includes('r-99')) return 'r-99_smg';
    if (lower.includes('volt')) return 'volt_smg';
    if (lower.includes('alternator')) return 'alternator_smg';
    if (lower.includes('spitfire')) return 'm600_spitfire';
    if (lower.includes('devotion')) return 'devotion_lmg';
    if (lower.includes('rampage')) return 'rampage_lmg';
    if (lower.includes('l-star')) return 'l-star_emg';
    if (lower.includes('havoc')) return 'havoc_rifle';
    if (lower.includes('g7 scout')) return 'g7_scout';
    if (lower.includes('triple take')) return 'triple_take';
    if (lower.includes('30-30')) return '30-30_repeater';
    if (lower.includes('bocek')) return 'bocek_compound_bow';
    if (lower.includes('kraber')) return 'kraber_.50-cal_sniper';
    if (lower.includes('sentinel')) return 'sentinel_esr';
    if (lower.includes('charge rifle')) return 'charge_rifle';
    if (lower.includes('longbow')) return 'longbow_dmr';
    if (lower.includes('peacekeeper')) return 'peacekeeper';
    if (lower.includes('mastiff')) return 'mastiff_shotgun';
    if (lower.includes('eva-8')) return 'eva-8_auto';
    if (lower.includes('mozambique')) return 'mozambique_shotgun';
    if (lower.includes('wingman')) return 'wingman';
    if (lower.includes('p2020')) return 'p2020';
    if (lower.includes('re-45')) return 're-45_auto';
    return null;
}

const getWeaponSkinIcon = (item: string) => {
    const lower = item.toLowerCase();
    if (lower.includes('xp boost') || lower.includes('apex coin') || lower.includes('crafting') || lower.includes('apex pack') || lower.includes('banner') || lower.includes('holospray') || lower.includes('tracker') || lower.includes('voice line') || lower.includes('quip') || lower.includes('emote') || lower.includes('transition') || lower.includes('charm') || lower.includes('sticker') || lower.includes('music') || lower.includes('skydive') || lower.includes('badge') || lower.includes('stat tracker')) {
        return null;
    }
    return getWeaponIconName(item);
}

const WEAPONS_LIST = ['R-301', 'R-99', 'Flatline', 'Hemlok', 'Havoc', 'Nemesis', 'Alternator', 'Prowler', 'Volt', 'C.A.R.', 'Devotion', 'L-STAR', 'Spitfire', 'Rampage', 'G7 Scout', 'Triple Take', '30-30', 'Bocek', 'Charge Rifle', 'Longbow', 'Kraber', 'Sentinel', 'EVA-8', 'Mastiff', 'Peacekeeper', 'Mozambique', 'RE-45', 'P2020', 'Wingman'];

const getWeaponDetails = (item: string) => {
    let weaponName = '';
    for (const w of WEAPONS_LIST) {
        if (item.toLowerCase().includes(w.toLowerCase())) {
            weaponName = w;
            if (w === 'C.A.R.') weaponName = 'C.A.R. SMG';
            break;
        }
    }
    
    if (weaponName) {
        let skinOnly = item.replace(new RegExp(weaponName, 'ig'), '').trim();
        skinOnly = skinOnly.replace(/^(SMG|LMG|AR|PDW|Rifle|Repeater|Bow|Sniper|Shotgun|Auto|Carbine|DMR|EMG|Burst)/i, '').trim();
        skinOnly = skinOnly.replace(/^[:\-\s]+/, ''); 
        if (!skinOnly) return { weapon: weaponName, skin: item };
        return { weapon: weaponName, skin: skinOnly };
    }
    return { weapon: item, skin: item };
}

const hideImageOnError = (event: Event) => {
    const target = event.target as HTMLImageElement;
    if (target) target.style.display = 'none';
};

const formatPatchDetail = (detail: string) => {
    let formatted = detail;
    formatted = formatted.replace(/\[Base\]/g, '<span class="text-titan-cyan font-bold">[Base]</span>');
    formatted = formatted.replace(/\[Perks\]/g, '<span class="text-titan-orange font-bold">[Perks]</span>');
    formatted = formatted.replace(/Buff/g, '<span class="text-green-400 font-bold">Buff</span>');
    formatted = formatted.replace(/Nerf/g, '<span class="text-red-400 font-bold">Nerf</span>');
    formatted = formatted.replace(/Adjust/g, '<span class="text-blue-400 font-bold">Adjust</span>');
    formatted = formatted.replace(/Fix/g, '<span class="text-yellow-400 font-bold">Fix</span>');
    return formatted;
}
</script>

<template>
  <div class="h-full flex flex-col space-y-6 overflow-y-auto custom-scrollbar pr-2 pb-12">
    <!-- Header: Carousel Controls -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-titan-border pb-4 shrink-0">
      <div>
        <h2 class="text-2xl font-black text-white font-mono uppercase tracking-widest">{{ $t('season.title') }}</h2>
        <p class="text-gray-400 text-sm mt-1">{{ $t('season.subtitle') }}</p>
      </div>
      
      <!-- Carousel controls -->
      <div class="flex items-center gap-4 bg-black/40 border border-titan-border p-2">
          <button 
              @click="goNext" 
              :disabled="currentIndex === seasons.length - 1"
              class="px-4 py-2 bg-titan-panel border border-titan-border text-white font-mono uppercase titan-beveled hover:border-titan-cyan hover:text-titan-cyan disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
              &lt; {{ $t('season.prevSeason') }}
          </button>
          
          <div class="text-xl font-bold font-mono text-titan-cyan min-w-[160px] text-center uppercase tracking-widest">
              {{ selectedSeasonMeta?.name }}
          </div>
          
          <button 
              @click="goPrev" 
              :disabled="currentIndex === 0"
              class="px-4 py-2 bg-titan-panel border border-titan-border text-white font-mono uppercase titan-beveled hover:border-titan-cyan hover:text-titan-cyan disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
              {{ $t('season.nextSeason') }} &gt;
          </button>
      </div>
    </div>

    <!-- Infobox -->
    <div v-if="selectedSeasonData?.infobox" class="bg-black/40 border border-titan-border p-6 flex flex-col md:flex-row gap-8 relative overflow-hidden group shrink-0">
      
      <!-- Season Logo -->
      <div v-if="selectedSeasonData.infobox.Logo || selectedSeasonData.infobox.logo_url" class="w-32 h-32 md:w-40 md:h-40 shrink-0 flex items-center justify-center z-10">
          <img :src="selectedSeasonData.infobox.Logo || selectedSeasonData.infobox.logo_url" class="max-w-full max-h-full object-contain invert drop-shadow-[0_0_15px_rgba(0,229,255,0.3)]" @error="hideImageOnError" />
      </div>

      <div class="flex-1 flex flex-col gap-4 z-10">
          <h3 class="text-lg font-bold text-titan-cyan font-mono uppercase tracking-widest border-b border-titan-border/50 pb-2">{{ $t('season.infobox') }}</h3>
          
          <div class="grid grid-cols-2 md:grid-cols-3 gap-6 relative">
              <template v-for="(value, key) in selectedSeasonData.infobox" :key="key">
                  <div v-if="key !== 'Logo' && key !== 'logo_url' && key !== 'name'" class="flex flex-col">
                      <span class="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">{{ key }}</span>
                      
                      <ul v-if="Array.isArray(value)" class="list-disc pl-4 space-y-1">
                          <li v-for="(item, i) in value" :key="i" class="text-white font-bold tracking-wider text-sm">{{ item }}</li>
                      </ul>
                      <span v-else class="text-white font-bold tracking-wider text-sm">{{ value }}</span>
                  </div>
              </template>
          </div>
      </div>
      
      <!-- Weapon Deco inside Infobox if available -->
      <img 
          v-if="selectedSeasonMeta?.weaponSkin && selectedSeasonMeta.weaponSkin !== 'Inconnu' && getWeaponIconName(selectedSeasonMeta.weaponSkin)"
          :src="`/images/weapons/${getWeaponIconName(selectedSeasonMeta.weaponSkin)}.svg`"
          class="absolute -right-10 -bottom-10 h-[250%] opacity-[0.03] invert pointer-events-none transform -rotate-12 group-hover:opacity-[0.05] transition-opacity"
      />
    </div>

    <!-- Battle Pass Collapsibles -->
    <div class="flex flex-col gap-4 shrink-0">
        <h3 class="text-lg font-bold text-titan-cyan font-mono uppercase tracking-widest border-b border-titan-border/50 pb-2 flex justify-between items-end">
            {{ $t('season.battlePass') }}
            <div v-if="selectedSeasonMeta?.weaponSkin && selectedSeasonMeta.weaponSkin !== 'Inconnu'" class="text-xs flex items-center gap-2">
                <span class="text-gray-500">{{ $t('season.reactiveSkin') }}:</span>
                <span class="text-white">{{ getWeaponDetails(selectedSeasonMeta.weaponSkin).skin }}</span>
            </div>
        </h3>
        
        <div v-if="levels.length === 0" class="text-center py-12 text-gray-500 font-mono italic">
            {{ $t('season.noData') }}
        </div>
        
        <div v-for="(chunk, idx) in levelChunks" :key="idx" class="border border-titan-border bg-black/20 overflow-hidden">
            <!-- Chunk Header -->
            <button 
                @click="chunk.expanded.value = !chunk.expanded.value"
                class="w-full flex justify-between items-center p-4 bg-titan-panel hover:bg-titan-cyan/10 transition-colors text-left"
            >
                <span class="font-bold text-white font-mono uppercase tracking-wider">
                    {{ $t('season.levelsChunk', { start: chunk.start, end: chunk.end }) }}
                </span>
                <span class="text-titan-cyan font-mono">{{ chunk.expanded.value ? '-' : '+' }}</span>
            </button>
            
            <!-- Chunk Content -->
            <div v-show="chunk.expanded.value" class="p-4 grid grid-cols-1 gap-2">
                <!-- Rows Header -->
                <div class="grid grid-cols-12 gap-4 px-4 py-2 bg-titan-cyan/10 border-b border-titan-cyan/30 text-xs font-bold text-titan-cyan uppercase tracking-wider">
                    <div class="col-span-2 text-center">{{ $t('season.level') }}</div>
                    <div class="col-span-5">{{ $t('season.premium') }}</div>
                    <div class="col-span-5">{{ $t('season.free') }}</div>
                </div>
                
                <template v-for="item in chunk.items" :key="item.level">
                    <div 
                        v-if="item.premium.length > 0 || item.free.length > 0"
                        class="grid grid-cols-12 gap-4 px-4 py-3 bg-black/40 border border-titan-border/30 hover:border-titan-cyan/50 hover:bg-black/60 transition-colors items-center group"
                    >
                        <div class="col-span-2 flex justify-center">
                            <div class="w-10 h-10 bg-titan-panel border border-titan-border flex items-center justify-center font-black font-mono text-lg text-white group-hover:text-titan-cyan group-hover:border-titan-cyan transition-colors">
                                {{ item.level }}
                            </div>
                        </div>
                        
                        <div class="col-span-5 flex flex-col gap-1 items-start">
                            <span v-if="item.premium.length === 0" class="text-gray-600 italic text-sm">-</span>
                            <span 
                                v-else 
                                v-for="(r, i) in item.premium" 
                                :key="i"
                                class="text-sm font-medium w-full flex items-center"
                                :class="r.includes('Apex Pack') ? 'text-yellow-400' : 'text-gray-200'"
                            >
                                <template v-if="getWeaponSkinIcon(r)">
                                    <img 
                                        :src="`/images/weapons/${getWeaponSkinIcon(r)}.svg`"
                                        class="h-6 object-contain invert opacity-90 drop-shadow mr-2"
                                        :title="getWeaponDetails(r).weapon"
                                        @error="hideImageOnError"
                                    />
                                    <span>{{ getWeaponDetails(r).skin }}</span>
                                </template>
                                <template v-else>
                                    <span>{{ r }}</span>
                                </template>
                            </span>
                        </div>
                        
                        <div class="col-span-5 flex flex-col gap-1 items-start border-l border-titan-border/30 pl-4">
                            <span v-if="item.free.length === 0" class="text-gray-600 italic text-sm">-</span>
                            <span 
                                v-else 
                                v-for="(r, i) in item.free" 
                                :key="i"
                                class="text-sm font-medium w-full flex items-center"
                                :class="r.includes('Apex Pack') ? 'text-yellow-400' : 'text-gray-300'"
                            >
                                <template v-if="getWeaponSkinIcon(r)">
                                    <img 
                                        :src="`/images/weapons/${getWeaponSkinIcon(r)}.svg`"
                                        class="h-6 object-contain invert opacity-90 drop-shadow mr-2"
                                        :title="getWeaponDetails(r).weapon"
                                        @error="hideImageOnError"
                                    />
                                    <span>{{ getWeaponDetails(r).skin }}</span>
                                </template>
                                <template v-else>
                                    <span>{{ r }}</span>
                                </template>
                            </span>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </div>

    <!-- Patch Notes Collapsible -->
    <div v-if="selectedSeasonData?.patches" class="border border-titan-border bg-black/20 overflow-hidden shrink-0">
        <button 
            @click="patchExpanded = !patchExpanded"
            class="w-full flex justify-between items-center p-4 bg-apex-darker hover:bg-apex-red/10 transition-colors text-left"
        >
            <span class="font-bold text-apex-red font-mono uppercase tracking-wider">
                {{ $t('season.patchNotes') }}
            </span>
            <span class="text-apex-red font-mono">{{ patchExpanded ? '-' : '+' }}</span>
        </button>
        
        <div v-show="patchExpanded" class="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-black/40">
            <div v-for="(legendPatches, legendName) in selectedSeasonData.patches" :key="legendName" class="border border-titan-border/30 bg-titan-panel p-4">
                <h4 class="text-white font-bold text-lg mb-3 flex items-center gap-3 border-b border-titan-border/30 pb-2">
                    <img :src="`/images/legends/${String(legendName).toLowerCase()}.svg`" class="w-8 h-8 invert opacity-80" @error="hideImageOnError" />
                    {{ legendName }}
                </h4>
                <div class="space-y-4">
                    <div v-for="(patch, idx) in legendPatches" :key="idx" class="flex flex-col gap-2">
                        <div class="text-xs text-apex-red font-mono">{{ patch.patch }}</div>
                        <ul class="space-y-1 pl-4 list-disc text-gray-300 text-sm">
                            <li v-for="detail in patch.details" :key="detail" class="leading-relaxed">
                                <span v-html="formatPatchDetail(detail)"></span>
                            </li>
                        </ul>
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
  background: rgba(0, 0, 0, 0.2);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #00e5ff;
  opacity: 0.5;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #00b3cc;
}
</style>
