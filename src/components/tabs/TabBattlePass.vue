<script setup lang="ts">
import { ref, computed } from 'vue'
import { generateSeasons, getParsedSeasonData } from '../../logic/packCalculator'
import type { SeasonData } from '../../logic/packCalculator'

const seasons = ref<SeasonData[]>(generateSeasons().reverse())
const selectedSeasonId = ref<string>(seasons.value[0]?.id || '')

const selectedSeasonData = computed(() => {
    if (!selectedSeasonId.value) return null
    return getParsedSeasonData(selectedSeasonId.value)
})

const selectedSeasonMeta = computed(() => {
    return seasons.value.find(s => s.id === selectedSeasonId.value)
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
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex justify-between items-end border-b border-titan-border pb-4">
      <div>
        <h2 class="text-2xl font-black text-white font-display uppercase tracking-widest">{{ $t('battlePass.title') }}</h2>
        <p class="text-gray-400 text-sm mt-1">{{ $t('battlePass.subtitle') }}</p>
      </div>
    </div>

    <!-- Controls -->
    <div class="flex flex-wrap gap-6 items-center bg-black/40 p-6 border border-titan-border relative overflow-hidden">
      <div class="flex gap-4 items-center z-10">
          <label class="text-sm font-bold text-titan-cyan uppercase tracking-wider">{{ $t('battlePass.selectSeason') }}</label>
          <select 
            v-model="selectedSeasonId" 
            class="bg-titan-panel border border-titan-border text-white px-4 py-2 font-mono outline-none focus:border-titan-cyan transition-colors min-w-[200px]"
          >
            <option v-for="season in seasons" :key="season.id" :value="season.id">
              {{ season.name }}
            </option>
          </select>
      </div>
      
      <div v-if="selectedSeasonMeta?.weaponSkin && selectedSeasonMeta.weaponSkin !== 'Inconnu'" class="ml-auto flex items-center gap-4 bg-black/60 border border-titan-border/50 px-4 py-2 z-10">
          <div class="flex flex-col">
              <span class="text-[13px] text-gray-500 font-mono uppercase tracking-widest mb-1">{{ $t('battlePass.reactiveSkin') }}</span>
              <span class="text-white font-bold tracking-wider font-mono text-sm">{{ getWeaponDetails(selectedSeasonMeta.weaponSkin).skin }}</span>
          </div>
          <div class="w-24 h-12 flex items-center justify-center shrink-0 ml-4">
              <img 
                  v-if="getWeaponIconName(selectedSeasonMeta.weaponSkin)"
                  :src="`/images/weapons/${getWeaponIconName(selectedSeasonMeta.weaponSkin)}.svg`"
                  class="max-w-full max-h-full invert opacity-80 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                  :alt="getWeaponDetails(selectedSeasonMeta.weaponSkin).weapon"
                  :title="getWeaponDetails(selectedSeasonMeta.weaponSkin).weapon"
                  @error="hideImageOnError"
              />
          </div>
      </div>
      
      <!-- Deco Background Weapon -->
      <img 
          v-if="selectedSeasonMeta?.weaponSkin && selectedSeasonMeta.weaponSkin !== 'Inconnu' && getWeaponIconName(selectedSeasonMeta.weaponSkin)"
          :src="`/images/weapons/${getWeaponIconName(selectedSeasonMeta.weaponSkin)}.svg`"
          class="absolute -right-10 -bottom-10 h-[250%] opacity-[0.03] invert pointer-events-none transform -rotate-12"
      />
    </div>

    <!-- Rewards List -->
    <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar">
      <div v-if="levels.length === 0" class="text-center py-12 text-gray-500 font-mono italic">
        {{ $t('battlePass.noData') }}
      </div>
      <div v-else class="grid grid-cols-1 gap-2 pb-8">
        <!-- Header -->
        <div class="grid grid-cols-12 gap-4 px-4 py-2 bg-titan-cyan/10 border-y border-titan-cyan/30 text-xs font-bold text-titan-cyan uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
          <div class="col-span-2 text-center">{{ $t('battlePass.level') }}</div>
          <div class="col-span-5">{{ $t('battlePass.premium') }}</div>
          <div class="col-span-5">{{ $t('battlePass.free') }}</div>
        </div>
        
        <!-- Rows -->
        <template v-for="item in levels" :key="item.level">
          <div 
            v-if="item.premium.length > 0 || item.free.length > 0"
            class="grid grid-cols-12 gap-4 px-4 py-3 bg-black/20 border border-titan-border/50 hover:border-titan-cyan/50 hover:bg-black/40 transition-colors items-center group"
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
                v-for="(r, idx) in item.premium" 
                :key="idx"
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
            
            <div class="col-span-5 flex flex-col gap-1 items-start border-l border-titan-border/50 pl-4">
              <span v-if="item.free.length === 0" class="text-gray-600 italic text-sm">-</span>
              <span 
                v-else 
                v-for="(r, idx) in item.free" 
                :key="idx"
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
