<script setup lang="ts">
import { computed } from 'vue'
import {
    type WeaponDetails,
    getEffectiveStatString,
    calculateHeadshotDamageStat,
    calculateDpsStat,
    calculateRpmStat,
    calculateSpinUpStat,
    isTurbochargerEquipped,
    isFireModeLocked
} from '../../logic/gunsmithCalculator'

const props = defineProps<{
    weapon: WeaponDetails
    isMythic: boolean
    isAkimboMode: boolean
    isAmped: boolean
    fireModesList: string[]
    selectedFireModeIndex: number
    equippedItems: Record<string, import('../../logic/gunsmithCalculator').AttachmentItem | null>
}>()

const emit = defineEmits<{
    (e: 'select-fire-mode', index: number): void
}>()

const getBaseStat = (val: string) => {
    if (!val) return ''
    return val.split(' / ')[0].trim()
}

const isBreachMode = computed(() => props.fireModesList[props.selectedFireModeIndex]?.toLowerCase().includes('breach') ?? false)

// Headshot damage needs equipped items for corrupted barrel / skullpiercer
const headshotDamageInfo = computed(() => calculateHeadshotDamageStat(props.weapon, props.equippedItems, props.isAmped, isBreachMode.value))

// DPS & RPM & Spin-up display for the characteristics card
const isTurbo = computed(() => isTurbochargerEquipped(props.equippedItems))
const rpmInfo = computed(() => calculateRpmStat(props.weapon, props.equippedItems, props.isAkimboMode, props.isAmped, props.selectedFireModeIndex))
const dpsInfo = computed(() => calculateDpsStat(props.weapon, rpmInfo.value.current, rpmInfo.value.base, props.isAmped, isBreachMode.value, isTurbo.value))
const spinUpInfo = computed(() => calculateSpinUpStat(props.weapon, props.equippedItems))
</script>

<template>
    <div class="animate-in fade-in slide-in-from-bottom-8 duration-500 overflow-y-auto custom-scrollbar">
        <div class="p-8 md:p-10 flex flex-col lg:flex-row gap-12 bg-transparent">
            <!-- Stats Grid -->
            <div class="flex-1 space-y-8">
                <!-- Characteristics -->
                <div>
                    <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest font-display mb-4 flex items-center gap-2">
                        <span class="w-1.5 h-1.5 bg-gray-400 block"></span> {{ $t('weapons.characteristics') }}
                    </h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div v-if="weapon.DPS || dpsInfo.base > 0" class="bg-black/50 border border-titan-border p-4 hover:border-titan-cyan transition-colors">
                            <div class="text-[11px] text-gray-500 font-mono uppercase tracking-widest mb-1">DPS</div>
                            <div class="text-xl font-bold font-mono" :class="dpsInfo.isBoosted ? 'text-green-400' : 'text-white'">{{ dpsInfo.displayString || weapon.DPS }}</div>
                        </div>
                        <div v-if="weapon.RPM" class="bg-black/50 border border-titan-border p-4 hover:border-titan-cyan transition-colors">
                            <div class="text-[11px] text-gray-500 font-mono uppercase tracking-widest mb-1">RPM</div>
                            <div class="text-xl font-bold font-mono" :class="rpmInfo.isBoosted ? 'text-green-400' : 'text-white'">{{ rpmInfo.displayString || rpmInfo.current || getBaseStat(weapon.RPM) }}</div>
                        </div>
                        <div v-if="spinUpInfo" class="bg-black/50 border border-titan-border p-4 hover:border-titan-cyan transition-colors">
                            <div class="text-[11px] text-gray-500 font-mono uppercase tracking-widest mb-1">{{ $t(spinUpInfo.labelKey) }}</div>
                            <div class="text-xl font-bold font-mono" :class="spinUpInfo.isBoosted ? 'text-green-400' : 'text-white'">{{ spinUpInfo.displayString }}</div>
                        </div>
                        <div v-if="weapon.Manufacturer" class="bg-black/50 border border-titan-border p-4 hover:border-titan-cyan transition-colors">
                            <div class="text-[11px] text-gray-500 font-mono uppercase tracking-widest mb-1">{{ $t('weapons.manufacturer') }}</div>
                            <div class="text-base font-bold text-white uppercase">{{ weapon.Manufacturer }}</div>
                        </div>
                        <div v-if="weapon['Fire modes']" class="bg-black/50 border border-titan-border p-4 hover:border-titan-cyan transition-colors">
                            <div class="text-[11px] text-gray-500 font-mono uppercase tracking-widest mb-1">{{ $t('weapons.fireModes') }}</div>
                            <template v-if="fireModesList.length > 1">
                                <div class="flex items-center gap-2 flex-wrap mt-1">
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
                                                    ? (isMythic ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-titan-cyan border-titan-cyan text-black shadow-[0_0_10px_rgba(45,212,191,0.5)]')
                                                    : 'bg-black/60 border-titan-border text-gray-400 hover:text-white hover:border-titan-cyan'
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
                            </template>
                            <template v-else>
                                <div class="text-sm font-bold text-white uppercase break-words">{{ weapon['Fire modes'] }}</div>
                            </template>
                        </div>
                    </div>
                </div>

                <!-- Ammo & Reload -->
                <div v-if="weapon.Magazine || weapon['Full reload time']">
                    <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest font-display mb-4 flex items-center gap-2">
                        <span class="w-1.5 h-1.5 bg-gray-400 block"></span> {{ $t('weapons.ammoAndReload') }}
                    </h3>
                    <div class="space-y-3">
                        <div v-if="weapon.Magazine" class="flex justify-between items-center border-b border-titan-border/50 pb-2">
                            <span class="text-sm font-mono text-gray-400">{{ $t('weapons.magazine') }}</span>
                            <span class="text-sm font-bold text-titan-cyan">{{ isBreachMode ? '1' : getBaseStat(getEffectiveStatString(weapon.Magazine, isAkimboMode, isAmped, isBreachMode)) }}</span>
                        </div>
                        <div v-if="weapon['Tac reload time'] && !isBreachMode" class="flex justify-between items-center border-b border-titan-border/50 pb-2">
                            <span class="text-sm font-mono text-gray-400">{{ $t('weapons.tacReload') }}</span>
                            <span class="text-sm font-bold font-mono" :class="isAkimboMode && weapon['Tac reload time'].includes('Akimbo:') ? 'text-red-400 font-bold' : 'text-white'">
                                {{ getBaseStat(getEffectiveStatString(weapon['Tac reload time'], isAkimboMode, isAmped, isBreachMode)) }} s
                            </span>
                        </div>
                        <div v-if="weapon['Full reload time']" class="flex justify-between items-center border-b border-titan-border/50 pb-2">
                            <span class="text-sm font-mono text-gray-400">{{ isBreachMode ? $t('weapons.cooldown') : $t('weapons.fullReload') }}</span>
                            <span class="text-sm font-bold font-mono" :class="isAkimboMode && weapon['Full reload time'].includes('Akimbo:') ? 'text-red-400 font-bold' : 'text-white'">
                                {{ isBreachMode ? '30 s' : (getBaseStat(getEffectiveStatString(weapon['Full reload time'], isAkimboMode, isAmped, isBreachMode)) + ' s') }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Damage Profile -->
                <div v-if="weapon.Damage && Object.keys(weapon.Damage).length > 0" class="w-full bg-black/50 border border-titan-border p-6 relative overflow-hidden mt-4">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-titan-orange/10 rounded-full blur-3xl"></div>
                    <h3 class="text-sm font-bold text-white uppercase tracking-widest font-display mb-6 border-b border-titan-border/50 pb-3 flex items-center gap-2">
                        <span class="w-1.5 h-1.5 bg-titan-orange block"></span> {{ $t('weapons.damageProfile') }}
                    </h3>
                    <div class="space-y-4">
                        <!-- Head -->
                        <div class="flex items-center justify-between group">
                            <div class="flex items-center gap-4">
                                <div class="w-8 h-8 bg-black border border-titan-border flex items-center justify-center group-hover:border-titan-orange transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400 group-hover:text-titan-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21v-2a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v2"/></svg>
                                </div>
                                <span class="font-mono text-sm text-gray-300 uppercase tracking-widest">{{ $t('weapons.head') }}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-2xl font-black font-mono transition-colors" :class="headshotDamageInfo.isBoosted ? 'text-green-400 font-bold' : 'text-titan-orange'">
                                    {{ headshotDamageInfo.displayString || headshotDamageInfo.current || weapon.Damage.Head || '-' }}
                                </span>
                                <span v-if="headshotDamageInfo.isBoosted && headshotDamageInfo.base && headshotDamageInfo.base !== headshotDamageInfo.current" class="text-xs font-mono text-gray-400">
                                    ({{ headshotDamageInfo.base }})
                                </span>
                            </div>
                        </div>
                        <!-- Body -->
                        <div class="flex items-center justify-between group">
                            <div class="flex items-center gap-4">
                                <div class="w-8 h-8 bg-black border border-titan-border flex items-center justify-center group-hover:border-titan-cyan transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400 group-hover:text-titan-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                </div>
                                <span class="font-mono text-sm text-gray-300 uppercase tracking-widest">{{ $t('weapons.body') }}</span>
                            </div>
                            <span class="text-2xl font-black font-mono text-titan-cyan">
                                {{ getEffectiveStatString(weapon.Damage?.Body, isAkimboMode, isAmped, isBreachMode) || '-' }}
                            </span>
                        </div>
                        <!-- Legs -->
                        <div class="flex items-center justify-between group">
                            <div class="flex items-center gap-4">
                                <div class="w-8 h-8 bg-black border border-titan-border flex items-center justify-center group-hover:border-gray-300 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400 group-hover:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 14l-4 8"/><path d="M12 14l4 8"/><path d="M12 14v-6"/></svg>
                                </div>
                                <span class="font-mono text-sm text-gray-300 uppercase tracking-widest">{{ $t('weapons.legs') }}</span>
                            </div>
                            <span class="text-2xl font-black font-mono text-white">
                                {{ isBreachMode ? getEffectiveStatString(weapon.Damage?.Body, isAkimboMode, isAmped, isBreachMode) : (getEffectiveStatString(weapon.Damage?.Leg, isAkimboMode, isAmped, isBreachMode) || '-') }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Lore -->
            <div class="flex-1 lg:border-l lg:border-titan-border/50 lg:pl-12" v-if="weapon.Lore">
                <h3 class="text-xs font-bold text-titan-orange uppercase tracking-widest font-display mb-4 flex items-center gap-2">
                    <span class="w-2 h-2 bg-titan-orange block"></span> {{ $t('weapons.lore') }}
                </h3>
                <p class="text-gray-300 font-sans leading-relaxed text-justify text-lg font-medium drop-shadow-sm whitespace-pre-line">
                    {{ weapon.Lore }}
                </p>
            </div>
        </div>
    </div>
</template>
