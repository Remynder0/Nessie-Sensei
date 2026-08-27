<script setup lang="ts">
import { computed } from 'vue'

/**
 * Generic stat bar used in GunsmithStatsPanel.
 * Handles standard bars, inverted bars (reload), and range bars (DPS, RPM).
 */
interface StatData {
    base: number
    current: number
    isBoosted: boolean
    isPenalty: boolean
    minVal?: number
    maxVal?: number
    baseMinVal?: number
    displayString?: string
    baseDisplayString?: string
    tooltipKey?: string
}

const props = withDefaults(defineProps<{
    label: string
    stat: StatData
    max: number
    invertBar?: boolean
    suffix?: string
}>(), {
    invertBar: false,
    suffix: ''
})

const isRange = computed(() =>
    props.stat.minVal !== undefined &&
    props.stat.maxVal !== undefined &&
    props.stat.minVal !== props.stat.maxVal
)

// --- Bar width helpers ---
const barPct = (value: number) => {
    if (props.invertBar) return Math.max(5, 100 - (value / props.max) * 100)
    return Math.min(100, (value / props.max) * 100)
}

const diffPct = (a: number, b: number) => Math.min(100, (Math.abs(a - b) / props.max) * 100)
</script>

<template>
    <div class="relative flex items-center gap-3 py-0.5 w-full cursor-default">
        <!-- Label with hover tooltip on the word -->
        <div
            class="group/label relative w-24 shrink-0 text-xs font-mono tracking-wider uppercase font-bold flex items-center cursor-help select-none"
            :class="stat.isPenalty ? 'text-red-500' : stat.isBoosted ? 'text-green-400' : 'text-gray-300'"
        >
            <!-- Tooltip on Hover (only over the word) -->
            <div
                v-if="stat.tooltipKey"
                class="opacity-0 group-hover/label:opacity-100 pointer-events-none transition-all duration-200 absolute bottom-full mb-2 left-0 z-50 px-3 py-2 bg-[#0f1318]/95 border border-titan-cyan text-[11px] font-mono text-titan-cyan shadow-[0_0_15px_rgba(45,212,191,0.3)] w-max max-w-[280px] sm:max-w-sm md:max-w-md whitespace-normal leading-relaxed rounded-xs flex items-start gap-2 backdrop-blur-md"
            >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0 text-titan-cyan mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
                <span class="text-left font-normal normal-case tracking-normal" v-html="$t(stat.tooltipKey)"></span>
            </div>

            <span>{{ label }}</span>
        </div>

        <!-- Bar (Clean flat track with dark/bright boost mechanics) -->
        <div class="flex-1 h-[8px] bg-gray-700 relative overflow-hidden">
            <!-- Range mode (DPS or RPM with min/max: Base + Vert sombre / Rouge sombre) -->
            <template v-if="isRange && stat.minVal !== undefined && stat.maxVal !== undefined">
                <!-- Minimum solid base (white) -->
                <div
                    class="absolute h-full transition-all duration-500"
                    :class="stat.isPenalty ? 'bg-red-500' : 'bg-white'"
                    :style="`left: 0%; width: ${Math.min(100, ((stat.baseMinVal || stat.minVal) / max) * 100)}%`"
                ></div>
                <!-- Green boost on min if boosted (e.g. 300 to 408 on Devotion) -->
                <div
                    v-if="stat.isBoosted && stat.baseMinVal && stat.minVal > stat.baseMinVal"
                    class="absolute h-full bg-green-500 transition-all duration-500"
                    :style="`left: ${Math.min(100, (stat.baseMinVal / max) * 100)}%; width: ${Math.min(100, ((stat.minVal - stat.baseMinVal) / max) * 100)}%`"
                ></div>
                <!-- Range extension (vert sombre bg-emerald-800 si boosté, rouge sombre bg-red-900 si pénalité) -->
                <div
                    class="absolute h-full transition-all duration-500"
                    :class="stat.isBoosted ? 'bg-emerald-800' : stat.isPenalty ? 'bg-red-900' : 'bg-gray-400/60'"
                    :style="`left: ${Math.min(100, (stat.minVal / max) * 100)}%; width: ${Math.min(100, ((stat.maxVal - stat.minVal) / max) * 100)}%`"
                ></div>
            </template>

            <!-- Standard / Inverted mode -->
            <template v-else>
                <!-- Base bar (white) -->
                <div
                    class="absolute h-full bg-white transition-all duration-500"
                    :style="`width: ${barPct(invertBar ? (stat.isPenalty ? stat.current : stat.base) : (stat.isPenalty ? stat.current : stat.base))}%`"
                ></div>
                <!-- Green boost (vert vif) -->
                <div
                    v-if="stat.isBoosted"
                    class="absolute h-full bg-green-500 transition-all duration-700"
                    :style="invertBar
                        ? `left: ${barPct(stat.base)}%; width: ${diffPct(stat.base, stat.current)}%`
                        : `left: ${barPct(stat.base)}%; width: ${diffPct(stat.base, stat.current)}%`"
                ></div>
                <!-- Red penalty (rouge vif) -->
                <div
                    v-if="stat.isPenalty"
                    class="absolute h-full bg-red-600 transition-all duration-700"
                    :style="invertBar
                        ? `left: ${barPct(stat.current)}%; width: ${diffPct(stat.base, stat.current)}%`
                        : `left: ${barPct(stat.base)}%; width: ${diffPct(stat.base, stat.current)}%`"
                ></div>
            </template>
        </div>

        <!-- Value Display (Fixed w-36 width: avoids bar jumping while keeping gap compact) -->
        <div class="w-36 text-right text-xs font-mono font-bold flex items-center justify-end gap-1 shrink-0">
            <template v-if="!stat.isBoosted && !stat.isPenalty">
                <span class="text-white whitespace-nowrap">{{ stat.displayString || stat.base }}{{ suffix }}</span>
            </template>
            <template v-else-if="stat.isBoosted">
                <span class="text-gray-400 whitespace-nowrap">{{ stat.baseDisplayString || stat.base }}{{ suffix }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                <span class="text-green-400 whitespace-nowrap">{{ stat.displayString || stat.current }}{{ suffix }}</span>
            </template>
            <template v-else-if="stat.isPenalty">
                <span class="text-gray-400 whitespace-nowrap">{{ stat.baseDisplayString || stat.base }}{{ suffix }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
                <span class="text-red-500 whitespace-nowrap">{{ stat.displayString || stat.current }}{{ suffix }}</span>
            </template>
        </div>
    </div>
</template>
