<script setup lang="ts">
import type { AttachmentItem, AttachmentGroup } from '../../logic/gunsmithCalculator'
import AttachmentCard from './AttachmentCard.vue'

defineProps<{
    chestGroups: AttachmentGroup[]
    isMythic: boolean
    hasCorruptedEquipped: boolean
}>()

const emit = defineEmits<{
    (e: 'equip-item', item: AttachmentItem): void
    (e: 'drag-start', event: DragEvent, item: AttachmentItem, category: string): void
    (e: 'drag-end'): void
    (e: 'drop-on-chest', event: DragEvent): void
}>()
</script>

<template>
    <div
        class="animate-in fade-in slide-in-from-bottom-6 duration-400 bg-[#0d1016] border-t border-titan-border/50"
        @dragover.prevent
        @drop="emit('drop-on-chest', $event)"
    >
        <div class="p-4 md:p-5">
            <!-- Multi-column horizontal layout -->
            <div v-if="chestGroups.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 xl:gap-6 items-start">
                <div
                    v-for="group in chestGroups"
                    :key="group.category"
                    class="bg-black/30 border border-titan-border/40 p-3.5 rounded flex flex-col justify-start"
                >
                    <!-- Category Header -->
                    <h3 class="text-xs font-bold text-gray-300 uppercase tracking-widest font-display flex items-center justify-between border-b border-titan-border/40 pb-2 mb-3">
                        <span class="flex items-center gap-2">
                            <span class="w-1.5 h-1.5 block" :class="group.category === 'Optics' ? 'bg-titan-cyan shadow-[0_0_6px_rgba(45,212,191,0.8)]' : (group.category === 'Hop-Ups' || group.category === 'Hop-Up' ? 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.8)]' : 'bg-titan-orange shadow-[0_0_6px_rgba(249,115,22,0.8)]')"></span>
                            {{ group.category === 'Optics' ? $t('weapons.optics') : (group.category === 'Hop-Ups' || group.category === 'Hop-Up' ? $t('weapons.hopups') : $t('weapons.accessories')) }}
                        </span>
                        <span class="font-mono text-[10px] text-gray-500 bg-black/60 border border-titan-border/40 px-1.5 py-0.2 rounded">
                            {{ group.items.length }}
                        </span>
                    </h3>

                    <!-- Cards Row / Wrap -->
                    <div class="flex flex-wrap gap-2.5">
                        <AttachmentCard
                            v-for="item in group.items"
                            :key="item.name + item.rarity"
                            :item="item"
                            :show-halftone="group.category !== 'Optics'"
                            :disabled="item.rarity === 'corrupted' && hasCorruptedEquipped"
                            @equip="emit('equip-item', item)"
                            @drag-start="(ev: DragEvent, it: AttachmentItem) => emit('drag-start', ev, it, group.category)"
                            @drag-end="emit('drag-end')"
                        />
                    </div>
                </div>
            </div>

            <!-- Empty state -->
            <div
                v-else
                class="text-center py-6 font-mono text-sm uppercase tracking-widest"
                :class="isMythic ? 'text-red-400 font-bold' : 'text-gray-500'"
            >
                {{ isMythic ? $t('weapons.mythicLocked') : $t('weapons.allEquipped') }}
            </div>
        </div>
    </div>
</template>
