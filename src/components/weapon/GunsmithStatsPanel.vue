<script setup lang="ts">
import { computed } from 'vue'
import type { WeaponDetails, AttachmentItem, WeaponConsumable } from '../../logic/gunsmithCalculator'
import {
    calculateMagazineStat,
    calculateRpmStat,
    calculateDpsStat,
    calculateReloadStat,
    calculateHandlingStat,
    calculateRecoilStat,
    calculateHipfireStat,
    calculateSpinUpStat,
    isTurbochargerEquipped,
    isFireModeLocked
} from '../../logic/gunsmithCalculator'
import StatBar from './StatBar.vue'
import { hideImageOnError } from './utils/imageHelpers'

const props = defineProps<{
    weapon: WeaponDetails
    equippedItems: Record<string, AttachmentItem | null>
    isMythic: boolean
    isAkimboMode: boolean
    isAmped: boolean
    fireModesList: string[]
    selectedFireModeIndex: number
    weaponConsumable: WeaponConsumable | null
}>()

const emit = defineEmits<{
    (e: 'select-fire-mode', index: number): void
    (e: 'toggle-consumable'): void
}>()

// --- Mode flags ---
const isBreachMode = computed(() => props.fireModesList[props.selectedFireModeIndex]?.toLowerCase().includes('breach') ?? false)

// --- Stat computations ---
const isTurbo = computed(() => isTurbochargerEquipped(props.equippedItems))
const magInfo = computed(() => calculateMagazineStat(props.weapon, props.equippedItems, props.isAkimboMode, props.isAmped, isBreachMode.value))
const rpmInfo = computed(() => calculateRpmStat(props.weapon, props.equippedItems, props.isAkimboMode, props.isAmped, props.selectedFireModeIndex))
const dpsInfo = computed(() => calculateDpsStat(props.weapon, rpmInfo.value.current, rpmInfo.value.base, props.isAmped, isBreachMode.value, isTurbo.value))

const fullReloadInfo = computed(() => calculateReloadStat(
    props.weapon['Full reload time'],
    props.weapon,
    props.equippedItems['mag'],
    props.equippedItems['stock'],
    props.equippedItems['barrel'],
    props.isAkimboMode,
    props.equippedItems['hopup'],
    isBreachMode.value
))

const handlingInfo = computed(() => calculateHandlingStat(props.weapon, props.equippedItems['stock'], props.equippedItems['hopup']))
const recoilInfo = computed(() => calculateRecoilStat(props.weapon, props.equippedItems['barrel'], props.equippedItems['hopup']))
const hipfireInfo = computed(() => calculateHipfireStat(props.weapon, props.equippedItems['barrel'], props.equippedItems['hopup']))
const spinUpInfo = computed(() => calculateSpinUpStat(props.weapon, props.equippedItems))

const statMaxBounds = computed(() => {
    const wType = props.weapon.Type?.toLowerCase() || ''
    if (wType.includes('sniper')) return { maxDps: 100, maxRpm: 100, maxMag: 16 }
    if (wType.includes('marksman')) return { maxDps: 150, maxRpm: 300, maxMag: 20 }
    if (wType.includes('shotgun')) return { maxDps: 180, maxRpm: 250, maxMag: 16 }
    if (wType.includes('pistol')) return { maxDps: 200, maxRpm: 600, maxMag: 32 }
    if (wType.includes('submachine') || wType.includes('smg')) return { maxDps: 240, maxRpm: 1100, maxMag: 40 }
    if (wType.includes('machine gun') || wType.includes('lmg')) return { maxDps: 250, maxRpm: 900, maxMag: 60 }
    return { maxDps: 220, maxRpm: 900, maxMag: 45 }
})

// Expose dpsInfo for parent (WeaponInfoPanel needs displayString)
defineExpose({ dpsInfo })
</script>

<template>
    <div
        class="absolute z-20 bottom-8 left-8 w-[420px] sm:w-[450px] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] bg-[#151921]/95 border p-5 sm:p-6 backdrop-blur-md shadow-2xl"
        :class="isMythic ? 'border-red-600/60 shadow-[0_0_30px_rgba(220,38,38,0.25)]' : 'border-titan-border/80'"
    >
        <div class="space-y-4">
            <!-- Fire Mode Switcher -->
            <div v-if="fireModesList.length > 1" class="flex items-center justify-between border-b border-titan-border/50 pb-3 mb-2">
                <span class="text-xs font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <span class="w-1.5 h-1.5 block" :class="isMythic ? 'bg-red-500' : 'bg-titan-cyan'"></span> {{ $t('weapons.fireModes') }}
                </span>
                <div class="flex items-center gap-1.5">
                    <button
                        v-for="(mode, idx) in fireModesList"
                        :key="mode"
                        :disabled="isFireModeLocked(weapon, idx, equippedItems)"
                        :title="isFireModeLocked(weapon, idx, equippedItems) ? $t('weapons.selectfireRequired') : ''"
                        @click="emit('select-fire-mode', idx)"
                        class="px-2.5 py-1 text-xs font-mono font-bold uppercase transition-all border rounded flex items-center gap-1.5"
                        :class="[
                            isFireModeLocked(weapon, idx, equippedItems)
                                ? 'opacity-40 cursor-not-allowed bg-red-950/20 border-red-900/60 text-red-400 border-dashed hover:border-red-800'
                                : selectedFireModeIndex === idx
                                    ? (isMythic ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.6)]' : 'bg-titan-cyan border-titan-cyan text-black shadow-[0_0_10px_rgba(45,212,191,0.6)]')
                                    : 'bg-black/60 border-titan-border/50 text-gray-400 hover:text-white hover:border-titan-cyan'
                        ]"
                    >
                        <svg
                            v-if="isFireModeLocked(weapon, idx, equippedItems)"
                            xmlns="http://www.w3.org/2000/svg"
                            class="w-3 h-3 text-red-500 shrink-0"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <path fill-rule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clip-rule="evenodd" />
                        </svg>
                        <span>{{ mode }}</span>
                        <span v-if="isFireModeLocked(weapon, idx, equippedItems)" class="text-[9px] text-red-500/80 font-mono tracking-tighter uppercase font-normal">
                            [{{ $t('weapons.locked') }}]
                        </span>
                    </button>
                </div>
            </div>

            <!-- Consumable Boost -->
            <div v-if="weaponConsumable" class="flex items-center justify-between border-b border-titan-border/50 pb-3 mb-2">
                <span class="text-xs font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <span class="w-1.5 h-1.5 block" :class="isAmped ? 'bg-amber-400 animate-ping' : 'bg-gray-500'"></span>
                    {{ $t('weapons.boost') }}
                </span>
                <button
                    @click="emit('toggle-consumable')"
                    class="p-2 rounded transition-all border flex items-center justify-center cursor-pointer"
                    :class="isAmped
                        ? 'bg-amber-500/25 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)] scale-110'
                        : 'bg-black/60 border-titan-border/50 hover:border-white/50 opacity-60 hover:opacity-100'"
                    :title="weaponConsumable.name"
                >
                    <img
                        :src="`/images/ordnances/${weaponConsumable.icon}`"
                        @error="hideImageOnError"
                        class="w-6 h-6 object-contain pointer-events-none"
                    />
                </button>
            </div>

            <!-- Stat Bars -->
            <StatBar v-if="dpsInfo.base > 0"        :label="$t('weapons.statDps')"      :stat="dpsInfo"         :max="statMaxBounds.maxDps" />
            <StatBar v-if="weapon.RPM"               :label="$t('weapons.statRpm')"      :stat="rpmInfo"         :max="statMaxBounds.maxRpm" />
            <StatBar v-if="spinUpInfo"               :label="spinUpInfo.labelKey === 'weapons.spinUpDelay' ? $t('weapons.windUp') : $t('weapons.spinUp')" :stat="spinUpInfo" :max="spinUpInfo.labelKey === 'weapons.spinUpDelay' ? 0.6 : 2.5" :invert-bar="true" suffix="s" />
            <StatBar v-if="weapon.Magazine"           :label="$t('weapons.statMag')"      :stat="magInfo"         :max="statMaxBounds.maxMag" />
            <StatBar v-if="weapon['Full reload time']" :label="isBreachMode ? $t('weapons.cooldown') : $t('weapons.statReload')" :stat="fullReloadInfo" :max="isBreachMode ? 30 : 5" :invert-bar="true" suffix="s" />
            <StatBar                                  :label="$t('weapons.statHandling')" :stat="handlingInfo"    :max="100" />
            <StatBar                                  :label="$t('weapons.statRecoil')"   :stat="recoilInfo"      :max="100" />
            <StatBar                                  :label="$t('weapons.statHipfire')"  :stat="hipfireInfo"     :max="100" />
        </div>
    </div>
</template>
