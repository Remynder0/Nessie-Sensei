<script setup lang="ts">
import { computed } from 'vue'
import type { WeaponDetails, AttachmentItem, AttachmentGroup, WeaponConsumable } from '../../logic/gunsmithCalculator'
import { getLockedAttachmentsForWeapon } from '../../logic/gunsmithCalculator'
import {
    isHopUpItem,
    isMagazineAttachment,
    isBoltAttachment,
    isStockAttachment,
    isBarrelStabilizer,
    isLaserSight
} from '../../logic/gunsmithPredicates'
import GunsmithSlot from './GunsmithSlot.vue'
import GunsmithStatsPanel from './GunsmithStatsPanel.vue'
import { hideImageOnError, formatAttachmentImg } from './utils/imageHelpers'

const props = defineProps<{
    weapon: WeaponDetails
    showAttachments: boolean
    isMythic: boolean
    activeFireMode: string
    attachmentGroups: AttachmentGroup[]
    equippedItems: Record<string, AttachmentItem | null>
    isAkimboMode: boolean
    isAmped: boolean
    fireModesList: string[]
    selectedFireModeIndex: number
    weaponConsumable: WeaponConsumable | null
    // Drag state
    dragOverSlotId: string | null
}>()

const emit = defineEmits<{
    (e: 'toggle-view'): void
    (e: 'select-fire-mode', index: number): void
    (e: 'toggle-consumable'): void
    // Slot drag events
    (e: 'drag-over-slot', event: DragEvent, slotId: string): void
    (e: 'drag-leave-slot'): void
    (e: 'drop-on-slot', event: DragEvent, slotId: string): void
    (e: 'click-slot', slotId: string): void
    (e: 'drag-start-from-slot', event: DragEvent, slotId: string): void
    (e: 'drag-end'): void
}>()

const formatImgName = (name: string, fireMode?: string) => {
    if (name === 'Sentinel') return 'sentinel_esr'
    let base = name.toLowerCase().replace(/ /g, '_')
    if (fireMode && fireMode.toLowerCase().includes('akimbo')) return `${base}_akimbo`
    return base
}

const formatAmmoImg = (ammo: string | undefined, isMythic: boolean) => {
    if (!ammo) return ''
    const lower = ammo.toLowerCase()
    if (isMythic) {
        if (lower.includes('heavy')) return 'Mythic_Heavy_Rounds'
        if (lower.includes('light')) return 'Mythic_Light_Rounds'
        if (lower.includes('energy')) return 'Mythic_Energy_Ammo'
        if (lower.includes('sniper')) return 'Mythic_Sniper_Ammo'
        if (lower.includes('shotgun')) return 'Mythic_Shotgun_Shells'
        if (lower.includes('arrow')) return 'Mythic_Arrows'
    }
    if (lower.includes('heavy') && lower.includes('light')) return 'Heavy_Rounds'
    if (lower.includes('heavy')) return 'Heavy_Rounds'
    if (lower.includes('light')) return 'Light_Rounds'
    if (lower.includes('energy')) return 'Energy_Ammo'
    if (lower.includes('sniper')) return 'Sniper_Ammo'
    if (lower.includes('shotgun')) return 'Shotgun_Shells'
    if (lower.includes('arrow')) return 'Arrows'
    return ammo.trim().replace(/ /g, '_').replace(/\//g, '_')
}

const isSlotLocked = (slotId: string): boolean => {
    const locked = getLockedAttachmentsForWeapon(props.weapon.name)
    return slotId in locked
}

// --- Gunsmith Slots ---
const gunsmithSlots = computed(() => {
    const slots: { id: string, label: string, type: string }[] = []
    const seenIds = new Set<string>()
    for (const group of props.attachmentGroups) {
        if (group.category === 'Optics') {
            if (!seenIds.has('optics')) { slots.push({ id: 'optics', label: 'Optics', type: 'Optics' }); seenIds.add('optics') }
        } else if (group.category === 'Hop-Ups' || group.category === 'Hop-Up') {
            if (!seenIds.has('hopup')) { slots.push({ id: 'hopup', label: 'Hop-Up', type: 'Hop-Ups' }); seenIds.add('hopup') }
        } else {
            const uniqueNames = new Set<string>()
            for (const item of group.items) uniqueNames.add(item.name)
            for (const name of uniqueNames) {
                let id = 'other'
                if (isHopUpItem(name)) id = 'hopup'
                else if (isMagazineAttachment(name)) id = 'mag'
                else if (isBoltAttachment(name)) id = 'bolt'
                else if (isStockAttachment(name)) id = 'stock'
                else if (isBarrelStabilizer(name) || isLaserSight(name)) id = 'barrel'
                if (!seenIds.has(id)) { slots.push({ id, label: name, type: name }); seenIds.add(id) }
            }
        }
    }
    const locked = getLockedAttachmentsForWeapon(props.weapon.name)
    for (const slotId in locked) {
        if (!seenIds.has(slotId)) {
            const lockedItem = locked[slotId]
            slots.push({ id: slotId, label: lockedItem.name, type: lockedItem.name }); seenIds.add(slotId)
        }
    }
    return slots
})

const getSlotPositionClass = (id: string, index: number) => {
    switch (id) {
        case 'optics': return 'top-[20%] left-[50%] -translate-x-1/2 -translate-y-full'
        case 'mag': return 'bottom-[20%] left-[50%] -translate-x-1/2 translate-y-full'
        case 'barrel': return 'top-[50%] left-[25%] -translate-x-full -translate-y-1/2'
        case 'stock': return 'top-[50%] right-[25%] translate-x-full -translate-y-1/2'
        case 'bolt': return 'top-[30%] right-[30%]'
        case 'hopup': return 'bottom-[30%] right-[30%]'
        default: return `top-[${10 + index * 15}%] left-[10%]`
    }
}

const getSlotLineClass = (id: string) => {
    switch (id) {
        case 'optics': return 'w-px h-16 left-1/2 top-full'
        case 'mag': return 'w-px h-16 left-1/2 bottom-full'
        case 'barrel': return 'h-px w-16 top-1/2 left-full'
        case 'stock': return 'h-px w-16 top-1/2 right-full'
        default: return 'hidden'
    }
}

const getEmptySlotImg = (slot: { id: string, label: string }) => {
    if (slot.id === 'optics') {
        const opticsGroup = props.attachmentGroups.find(g => g.category === 'Optics')
        if (opticsGroup && opticsGroup.items.length > 0) return formatAttachmentImg(opticsGroup.items[0].name)
        return 'Optics_Slot'
    }
    if (slot.id === 'hopup') {
        const hopupGroup = props.attachmentGroups.find(g => g.category === 'Hop-Ups' || g.category === 'Hop-Up')
        if (hopupGroup && hopupGroup.items.length > 0) return formatAttachmentImg(hopupGroup.items[0].name)
        return 'Elite_Weapon'
    }
    if (slot.id === 'mag') return 'Extended_Heavy_Mag'
    if (slot.id === 'stock') return 'Standard_Stock'
    if (slot.id === 'barrel') return 'Barrel_Stabilizer'
    if (slot.id === 'bolt') return 'Shotgun_Bolt'
    return formatAttachmentImg(slot.label)
}
</script>

<template>
    <div
        class="relative shrink-0 bg-gradient-to-b from-[#262c38] to-[#1e232a] border-b overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        :class="[
            showAttachments ? 'h-[55vh]' : 'h-56 md:h-64',
            isMythic ? 'border-red-600/60' : 'border-titan-border'
        ]"
    >
        <!-- Weapon SVG -->
        <div
            class="absolute top-1/2 -translate-y-1/2 h-full flex items-center pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            :class="showAttachments
                ? 'left-1/2 -translate-x-1/2 w-full justify-center opacity-100 z-10'
                : 'right-0 w-3/4 justify-end pr-10 opacity-30 mask-image-gradient'"
        >
            <img
                :src="`/images/weapons/${formatImgName(weapon.name, activeFireMode)}.svg`"
                @error="hideImageOnError"
                class="transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] object-contain invert"
                :class="[
                    showAttachments ? 'max-h-[80%] max-w-[80%] object-center scale-110' : 'max-h-[150%] max-w-[100%] object-right',
                    isMythic ? 'drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]' : 'drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]'
                ]"
            />
        </div>

        <!-- Gradient -->
        <div
            class="absolute inset-0 bg-gradient-to-r from-[#1e232a] via-[#1e232a]/80 to-transparent z-0 transition-opacity duration-700"
            :class="showAttachments ? 'opacity-20' : 'opacity-100'"
        ></div>

        <!-- Weapon Info Text -->
        <div
            class="absolute z-10 flex flex-col transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            :class="showAttachments ? 'top-6 left-6 md:top-8 md:left-8' : 'bottom-8 left-8 md:bottom-10 md:left-10'"
        >
            <div class="flex items-center gap-4 flex-wrap">
                <h1
                    class="font-black text-white uppercase tracking-tighter drop-shadow-lg transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    :class="showAttachments ? 'text-3xl md:text-4xl' : 'text-6xl md:text-7xl'"
                >
                    {{ weapon.name }}
                </h1>
                <span
                    v-if="isMythic"
                    class="px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest bg-red-600/30 border border-red-500 text-red-400 rounded flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse"
                >
                    <span class="w-2 h-2 rounded-full bg-red-500"></span> {{ $t('weapons.mythicWeapon') }}
                </span>
            </div>
            <div
                class="font-mono tracking-widest uppercase mt-4 text-sm flex flex-wrap items-center gap-6 transition-all duration-500"
                :class="[
                    showAttachments ? 'opacity-0 -translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0',
                    isMythic ? 'text-red-400' : 'text-titan-cyan'
                ]"
            >
                <span class="flex items-center gap-2"><div class="w-1.5 h-1.5" :class="isMythic ? 'bg-red-500' : 'bg-titan-cyan'"></div> {{ weapon.Type || $t('weapons.unknownType') }}</span>
                <span v-if="weapon.Ammo" class="flex items-center gap-2 font-mono text-sm uppercase tracking-wider">
                    <img :src="`/images/weapons/${formatAmmoImg(weapon.Ammo, isMythic)}.svg`" @error="hideImageOnError" class="w-5 h-5 object-contain pointer-events-none" />
                    {{ weapon.Ammo }}
                </span>
                <!-- Consumable toggle (header version) -->
                <button
                    v-if="weaponConsumable"
                    @click.stop="emit('toggle-consumable')"
                    class="p-1.5 rounded transition-all border flex items-center justify-center cursor-pointer pointer-events-auto"
                    :class="isAmped
                        ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)] scale-110'
                        : 'bg-black/40 border-titan-border/60 hover:border-white/50 opacity-60 hover:opacity-100'"
                    :title="weaponConsumable.name"
                >
                    <img :src="`/images/ordnances/${weaponConsumable.icon}`" @error="hideImageOnError" class="w-5 h-5 object-contain pointer-events-none" />
                </button>
            </div>
        </div>

        <!-- Gunsmith Slots -->
        <div
            v-if="showAttachments"
            class="absolute inset-0 z-20 pointer-events-none animate-in fade-in zoom-in-95 duration-700 delay-300 fill-mode-both"
        >
            <GunsmithSlot
                v-for="(slot, index) in gunsmithSlots"
                :key="slot.type"
                :slot-id="slot.id"
                :label="slot.label"
                :equipped-item="equippedItems[slot.id] || null"
                :is-locked="isSlotLocked(slot.id)"
                :is-mythic="isMythic"
                :is-drag-over="dragOverSlotId === slot.id"
                :position-class="getSlotPositionClass(slot.id, index)"
                :line-class="getSlotLineClass(slot.id)"
                @drag-over="(ev: DragEvent, id: string) => emit('drag-over-slot', ev, id)"
                @drag-leave="emit('drag-leave-slot')"
                @drop="(ev: DragEvent, id: string) => emit('drop-on-slot', ev, id)"
                @click-slot="(id: string) => emit('click-slot', id)"
                @drag-start="(ev: DragEvent, id: string) => emit('drag-start-from-slot', ev, id)"
                @drag-end="emit('drag-end')"
            >
                <template #empty-icon>
                    <img
                        :src="`/images/attachments/${getEmptySlotImg(slot)}.svg`"
                        @error="hideImageOnError"
                        class="w-10 h-10 object-contain invert opacity-35 group-hover/empty:opacity-60 transition-opacity pointer-events-none mb-1"
                    />
                </template>
            </GunsmithSlot>
        </div>

        <!-- Stats Panel -->
        <GunsmithStatsPanel
            v-if="showAttachments"
            :weapon="weapon"
            :equipped-items="equippedItems"
            :is-mythic="isMythic"
            :is-akimbo-mode="isAkimboMode"
            :is-amped="isAmped"
            :fire-modes-list="fireModesList"
            :selected-fire-mode-index="selectedFireModeIndex"
            :weapon-consumable="weaponConsumable"
            @select-fire-mode="(idx: number) => emit('select-fire-mode', idx)"
            @toggle-consumable="emit('toggle-consumable')"
            :class="showAttachments ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'"
        />

        <!-- Toggle Button -->
        <button
            v-if="attachmentGroups.length > 0"
            @click="emit('toggle-view')"
            class="absolute bottom-4 right-4 z-20 px-6 py-3 font-mono uppercase tracking-widest text-xs font-bold transition-all border group overflow-hidden"
            :class="[
                showAttachments
                    ? (isMythic ? 'bg-red-950/40 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-titan-orange/20 border-titan-orange text-titan-orange shadow-[0_0_15px_rgba(249,115,22,0.3)]')
                    : (isMythic ? 'bg-black/80 border-red-600/60 text-red-300 hover:text-white hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-black/80 border-titan-orange/60 text-titan-orange hover:bg-titan-orange/15 hover:border-titan-orange hover:text-white hover:shadow-[0_0_15px_rgba(249,115,22,0.4)]')
            ]"
        >
            <div class="relative z-10 flex items-center gap-3">
                <span>{{ showAttachments ? $t('weapons.backToInfo') : $t('weapons.viewAttachments') }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 transition-transform duration-300" :class="showAttachments ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
        </button>
    </div>
</template>
