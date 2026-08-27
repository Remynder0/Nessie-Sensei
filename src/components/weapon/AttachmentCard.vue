<script setup lang="ts">
import type { AttachmentItem } from '../../logic/gunsmithCalculator'
import { useRarityStyles } from './composables/useRarityStyles'
import { hideImageOnError, formatAttachmentImg } from './utils/imageHelpers'

const { getBoxClasses, getIconTintClasses } = useRarityStyles()

const props = defineProps<{
    item: AttachmentItem
    showHalftone: boolean
    disabled: boolean
}>()

const emit = defineEmits<{
    (e: 'equip', item: AttachmentItem): void
    (e: 'drag-start', event: DragEvent, item: AttachmentItem): void
    (e: 'drag-end'): void
}>()
</script>

<template>
    <div
        draggable="true"
        @dragstart="emit('drag-start', $event, item)"
        @dragend="emit('drag-end')"
        @click="emit('equip', item)"
        class="relative w-16 h-16 flex items-center justify-center shrink-0 border-2 rounded-[6px] overflow-hidden bg-[#242b35] transition-all hover:scale-110 hover:z-10 cursor-pointer group/item"
        :class="[
            getBoxClasses(item.rarity),
            disabled ? 'opacity-40 cursor-not-allowed' : ''
        ]"
        :title="`${item.name} (${item.detail})`"
    >
        <!-- Halftone Dots background -->
        <template v-if="showHalftone">
            <div class="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none" :class="getIconTintClasses(item.rarity)"></div>
            <div class="absolute -top-4 -left-4 w-12 h-12 halftone-dots opacity-40 pointer-events-none"></div>
            <div class="absolute -bottom-4 -right-4 w-12 h-12 halftone-dots opacity-40 pointer-events-none"></div>
        </template>

        <!-- Points Badge -->
        <div
            v-if="item.points"
            class="absolute top-0.5 right-0.5 z-20 text-[8px] font-mono font-bold text-amber-400 bg-black/80 px-1 py-0.2 rounded border border-amber-500/50 shadow-[0_0_6px_rgba(245,158,11,0.4)]"
        >
            {{ item.points }} PTS
        </div>

        <!-- SVG Icon -->
        <img
            :src="`/images/attachments/${formatAttachmentImg(item.name)}.svg`"
            @error="hideImageOnError"
            class="relative z-10 w-11 h-11 object-contain invert opacity-90 group-hover/item:opacity-100 transition-opacity pointer-events-none"
            :class="{ 'glitch-svg': item.rarity === 'corrupted' }"
        />
    </div>
</template>
