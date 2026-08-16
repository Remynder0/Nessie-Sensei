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
    displayString?: string
    baseDisplayString?: string
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
</script>

<template>
    <div class="flex items-center gap-3">
        <!-- Label -->
        <div
            class="w-1/3 text-xs font-sans font-medium"
            :class="stat.isPenalty ? 'text-red-500 font-bold' : stat.isBoosted ? 'text-green-400 font-bold' : 'text-gray-200'"
        >{{ label }}</div>

        <!-- Bar -->
        <div class="flex-1 h-[6px] bg-gray-700 relative overflow-hidden">
            <!-- Range mode (DPS or RPM with min/max) -->
            <template v-if="isRange && stat.minVal !== undefined && stat.maxVal !== undefined">
                <!-- Minimum solid base -->
                <div
                    class="absolute h-full transition-all duration-500"
                    :class="stat.isBoosted ? 'bg-green-500' : stat.isPenalty ? 'bg-red-500' : 'bg-white'"
                    :style="`left: 0%; width: ${Math.min(100, (stat.minVal / max) * 100)}%`"
                ></div>
                <!-- Range acceleration extension -->
                <div
                    class="absolute h-full transition-all duration-500"
                    :class="stat.isBoosted ? 'bg-green-400/60' : stat.isPenalty ? 'bg-red-900' : 'bg-gray-400/60'"
                    :style="`left: ${Math.min(100, (stat.minVal / max) * 100)}%; width: ${Math.min(100, ((stat.maxVal - stat.minVal) / max) * 100)}%`"
                ></div>
            </template>

            <!-- Standard / Inverted mode -->
            <template v-else>
                <!-- Base / Boosted / Penalty bar -->
                <div
                    class="absolute h-full transition-all duration-500"
                    :class="stat.isBoosted ? 'bg-green-500' : (stat.isPenalty ? 'bg-red-600' : 'bg-white')"
                    :style="`left: 0%; width: ${barPct(stat.current || stat.base)}%`"
                ></div>
            </template>
        </div>

        <!-- Value Display with Boost/Penalty indicator -->
        <div class="w-40 sm:w-44 text-right text-xs font-bold flex items-center justify-end gap-1 flex-shrink-0">
            <template v-if="!stat.isBoosted && !stat.isPenalty">
                <span class="text-white font-mono whitespace-nowrap">{{ stat.displayString || stat.base }}{{ suffix }}</span>
            </template>
            <template v-else-if="stat.isBoosted">
                <span class="text-gray-400 font-mono whitespace-nowrap">{{ stat.baseDisplayString || stat.base }}{{ suffix }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                <span class="text-green-400 font-mono whitespace-nowrap">{{ stat.displayString || stat.current }}{{ suffix }}</span>
            </template>
            <template v-else-if="stat.isPenalty">
                <span class="text-gray-400 font-mono whitespace-nowrap">{{ stat.baseDisplayString || stat.base }}{{ suffix }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
                <span class="text-red-500 font-mono whitespace-nowrap">{{ stat.displayString || stat.current }}{{ suffix }}</span>
            </template>
        </div>
    </div>
</template>
