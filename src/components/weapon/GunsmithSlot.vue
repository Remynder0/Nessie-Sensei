<script setup lang="ts">
import type { AttachmentItem } from '../../logic/gunsmithCalculator'
import { useRarityStyles } from './composables/useRarityStyles'
import { hideImageOnError, formatAttachmentImg } from './utils/imageHelpers'

const { getBoxClasses, getIconTintClasses } = useRarityStyles()

const props = withDefaults(defineProps<{
    slotId: string
    label: string
    equippedItem: AttachmentItem | null
    isLocked: boolean
    isMythic: boolean
    isDragOver: boolean
    positionClass: string
    lineClass?: string
    pointCost?: number
}>(), {
    lineClass: '',
    pointCost: undefined
})

const emit = defineEmits<{
    (e: 'drag-over', event: DragEvent, slotId: string): void
    (e: 'drag-leave'): void
    (e: 'drop', event: DragEvent, slotId: string): void
    (e: 'click-slot', slotId: string): void
    (e: 'drag-start', event: DragEvent, slotId: string): void
    (e: 'drag-end'): void
}>()
</script>

<template>
    <div
        class="absolute pointer-events-auto group"
        :data-slot-id="slotId"
        :class="[positionClass, equippedItem ? 'cursor-grab' : 'cursor-pointer']"
        :title="equippedItem ? `${label}: ${equippedItem.name} (${equippedItem.detail})` : label"
        :aria-label="equippedItem ? `${label}: ${equippedItem.name} (${equippedItem.detail})` : label"
        role="button"
        tabindex="0"
        @keydown.enter="emit('click-slot', slotId)"
        @dragover="emit('drag-over', $event, slotId)"
        @dragleave="emit('drag-leave')"
        @drop="emit('drop', $event, slotId)"
        @click="emit('click-slot', slotId)"
        :draggable="!!equippedItem"
        @dragstart="emit('drag-start', $event, slotId)"
        @dragend="emit('drag-end')"
    >
        <!-- Empty slot -->
        <div
            v-if="!equippedItem"
            class="relative border-2 p-2 backdrop-blur-sm transition-all flex items-center justify-center min-w-[90px] h-[90px] clip-beveled group/empty"
            :class="isMythic
                ? (isDragOver ? 'bg-red-600/30 border-red-500 scale-110 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-red-950/20 border-red-600/60 hover:bg-red-900/30 hover:scale-105 shadow-[0_0_15px_rgba(220,38,38,0.2)]')
                : (isDragOver ? 'bg-titan-cyan/30 border-titan-cyan scale-110 shadow-[0_0_15px_rgba(45,212,191,0.3)]' : 'bg-titan-cyan/10 border-titan-cyan hover:bg-titan-cyan/20 hover:scale-105 shadow-[0_0_15px_rgba(45,212,191,0.3)]')"
        >
            <!-- Hop-up Point Cost Badge -->
            <div
                v-if="slotId === 'hopup' && pointCost"
                class="absolute top-1 right-1 z-20 text-[8px] font-mono font-bold text-amber-400 bg-black/80 px-1.5 py-0.5 rounded border border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
            >
                {{ pointCost }} PTS
            </div>

            <slot name="empty-icon"></slot>
        </div>

        <!-- Equipped slot -->
        <div
            v-else
            class="relative border-2 p-2 backdrop-blur-sm transition-all flex items-center justify-center min-w-[90px] h-[90px] clip-beveled overflow-hidden"
            :class="getBoxClasses(equippedItem.rarity)"
        >
            <!-- Halftone Dots -->
            <template v-if="slotId !== 'optics'">
                <div class="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none" :class="getIconTintClasses(equippedItem.rarity)"></div>
                <div class="absolute -top-4 -left-4 w-12 h-12 halftone-dots opacity-40 pointer-events-none"></div>
                <div class="absolute -bottom-4 -right-4 w-12 h-12 halftone-dots opacity-40 pointer-events-none"></div>
            </template>

            <!-- Hop-up Point Cost Badge -->
            <div
                v-if="slotId === 'hopup' && (equippedItem.points || pointCost)"
                class="absolute top-1 right-1 z-20 text-[8px] font-mono font-bold text-amber-400 bg-black/80 px-1.5 py-0.5 rounded border border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
            >
                {{ equippedItem.points || pointCost }} PTS
            </div>

            <!-- Lock icon -->
            <div v-if="isLocked" class="absolute top-1 right-1 z-20 text-titan-orange bg-black/60 p-0.5 rounded" :title="$t('weapons.lockedSlot')">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm3 8H9V7a3 3 0 0 1 6 0v3z"/></svg>
            </div>

            <!-- Equipped icon -->
            <img
                :src="`/images/attachments/${formatAttachmentImg(equippedItem.name)}.svg`"
                @error="hideImageOnError"
                class="relative z-10 w-14 h-14 object-contain invert opacity-90 pointer-events-none"
                :class="{ 'glitch-svg': equippedItem.rarity === 'corrupted' }"
            />
        </div>
    </div>
</template>
