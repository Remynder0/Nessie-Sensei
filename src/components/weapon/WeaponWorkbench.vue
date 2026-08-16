<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { currentWeaponDetails, isLoadingWeaponDetails } from '../../logic/store'
import {
    type AttachmentItem,
    parseAttachments,
    parseFireModes,
    isMythicWeapon,
    getLockedAttachmentsForWeapon,
    getWeaponConsumable,
    isFireModeLocked
} from '../../logic/gunsmithCalculator'
import { useGunsmithDragDrop } from './composables/useGunsmithDragDrop'
import WeaponBanner from './WeaponBanner.vue'
import WeaponInfoPanel from './WeaponInfoPanel.vue'
import AttachmentChest from './AttachmentChest.vue'

// --- UI State ---
const showAttachments = ref(false)
const selectedFireModeIndex = ref(0)
const isAmped = ref(false)
const equippedItems = ref<Record<string, AttachmentItem | null>>({})

// --- Derived data ---
const isMythic = computed(() => isMythicWeapon(currentWeaponDetails.value?.name))
const weaponConsumable = computed(() => getWeaponConsumable(currentWeaponDetails.value?.name))
const fireModesList = computed(() => parseFireModes(currentWeaponDetails.value?.['Fire modes']))
const activeFireMode = computed(() => fireModesList.value[selectedFireModeIndex.value] || fireModesList.value[0] || '')
const isAkimboMode = computed(() => activeFireMode.value.toLowerCase().includes('akimbo'))

const attachmentGroups = computed(() => {
    if (!currentWeaponDetails.value?.Attachments) return []
    return parseAttachments(currentWeaponDetails.value.Attachments)
})

const isSlotLocked = (slotId: string): boolean => {
    const locked = getLockedAttachmentsForWeapon(currentWeaponDetails.value?.name)
    return slotId in locked
}

// --- Drag & Drop ---
const {
    dragOverSlotId,
    onDragStartFromChest,
    onDragStartFromSlot,
    onDropOnSlot,
    equipItemFromChest,
    onDragOverSlot,
    onDragLeaveSlot,
    onDragEnd,
    onDropOnChest,
    onClickSlot
} = useGunsmithDragDrop(equippedItems, attachmentGroups, isSlotLocked)

// --- Chest (unequipped items) ---
const chestGroups = computed(() => {
    return attachmentGroups.value.map(group => {
        if (isMythic.value && group.category !== 'Optics') return { ...group, items: [] }
        const filtered = group.items.filter(item => {
            for (const slotId in equippedItems.value) {
                const eq = equippedItems.value[slotId]
                if (eq && eq.name === item.name && eq.rarity === item.rarity && eq.detail === item.detail) return false
            }
            return true
        })
        return { ...group, items: filtered }
    }).filter(g => g.items.length > 0)
})

const hasCorruptedEquipped = computed(() => {
    for (const slotId in equippedItems.value) {
        const eq = equippedItems.value[slotId]
        if (eq && eq.rarity === 'corrupted') return true
    }
    return false
})

// --- Actions ---
function selectFireMode(index: number) {
    if (isFireModeLocked(currentWeaponDetails.value, index, equippedItems.value)) return
    selectedFireModeIndex.value = index
}
function toggleConsumable() { isAmped.value = !isAmped.value }

// --- Auto-reset fire mode if required hop-up is removed ---
watch(equippedItems, (newEq) => {
    if (selectedFireModeIndex.value !== 0 && isFireModeLocked(currentWeaponDetails.value, selectedFireModeIndex.value, newEq)) {
        selectedFireModeIndex.value = 0
    }
}, { deep: true })

// --- Reset on weapon change ---
watch(currentWeaponDetails, (newWeapon) => {
    selectedFireModeIndex.value = 0
    isAmped.value = false
    showAttachments.value = false
    const initial: Record<string, AttachmentItem | null> = {
        optics: null, mag: null, stock: null, barrel: null, bolt: null, hopup: null, other: null
    }

    if (newWeapon?.name) {
        const locked = getLockedAttachmentsForWeapon(newWeapon.name)
        for (const slotId in locked) {
            initial[slotId] = locked[slotId]
        }
    }

    equippedItems.value = initial
}, { immediate: true })
</script>

<template>
    <div
        class="relative w-full h-full glass-panel border bg-[#171c24] flex flex-col overflow-hidden transition-colors duration-500 rounded"
        :class="isMythic
            ? 'border-red-600/80 shadow-[0_0_35px_rgba(220,38,38,0.25)]'
            : 'border-titan-cyan/60 shadow-[0_0_35px_rgba(45,212,191,0.12)]'"
    >
        <!-- Loading State -->
        <div v-if="isLoadingWeaponDetails" class="flex-1 flex items-center justify-center min-h-[300px]">
            <div class="font-mono animate-pulse flex items-center gap-3" :class="isMythic ? 'text-red-500' : 'text-titan-cyan'">
                <span class="block w-3 h-3" :class="isMythic ? 'bg-red-500' : 'bg-titan-cyan'"></span>
                {{ $t('weapons.extracting') }}
            </div>
        </div>

        <!-- Weapon Content -->
        <div v-else-if="currentWeaponDetails" class="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            <WeaponBanner
                :weapon="currentWeaponDetails"
                :show-attachments="showAttachments"
                :is-mythic="isMythic"
                :active-fire-mode="activeFireMode"
                :attachment-groups="attachmentGroups"
                :equipped-items="equippedItems"
                :is-akimbo-mode="isAkimboMode"
                :is-amped="isAmped"
                :fire-modes-list="fireModesList"
                :selected-fire-mode-index="selectedFireModeIndex"
                :weapon-consumable="weaponConsumable"
                :drag-over-slot-id="dragOverSlotId"
                @toggle-view="showAttachments = !showAttachments"
                @select-fire-mode="selectFireMode"
                @toggle-consumable="toggleConsumable"
                @drag-over-slot="onDragOverSlot"
                @drag-leave-slot="onDragLeaveSlot"
                @drop-on-slot="onDropOnSlot"
                @click-slot="onClickSlot"
                @drag-start-from-slot="onDragStartFromSlot"
                @drag-end="onDragEnd"
            />

            <WeaponInfoPanel
                v-show="!showAttachments"
                :weapon="currentWeaponDetails"
                :is-mythic="isMythic"
                :is-akimbo-mode="isAkimboMode"
                :is-amped="isAmped"
                :fire-modes-list="fireModesList"
                :selected-fire-mode-index="selectedFireModeIndex"
                :equipped-items="equippedItems"
                @select-fire-mode="selectFireMode"
            />

            <AttachmentChest
                v-show="showAttachments"
                :chest-groups="chestGroups"
                :is-mythic="isMythic"
                :has-corrupted-equipped="hasCorruptedEquipped"
                @equip-item="equipItemFromChest"
                @drag-start="onDragStartFromChest"
                @drag-end="onDragEnd"
                @drop-on-chest="onDropOnChest"
            />
        </div>
    </div>
</template>
