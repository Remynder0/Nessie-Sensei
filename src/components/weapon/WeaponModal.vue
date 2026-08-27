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

const emit = defineEmits(['close'])

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
    if (newWeapon) {
        const locked = getLockedAttachmentsForWeapon(newWeapon.name)
        for (const slotId in locked) initial[slotId] = { ...locked[slotId] }
    }
    equippedItems.value = initial
}, { immediate: true })
</script>

<template>
    <div class="absolute inset-0 z-[100] flex items-center justify-center p-2 sm:p-3 md:p-6">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="emit('close')"></div>

        <!-- Modal -->
        <div
            class="relative w-full max-w-[98%] xl:max-w-[1550px] 2xl:max-w-[1650px] h-full max-h-[95vh] bg-[#1e232a] border transition-colors duration-500 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            :class="isMythic
                ? 'border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.35)]'
                : 'border-titan-cyan shadow-[0_0_50px_rgba(45,212,191,0.15)]'"
        >
            <!-- Close -->
            <button
                @click="emit('close')"
                class="absolute top-4 right-4 z-50 w-12 h-12 flex items-center justify-center bg-black/80 border text-gray-400 hover:text-white transition-colors group"
                :class="isMythic ? 'border-red-600/60 hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'border-titan-border hover:border-titan-cyan'"
            >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <!-- Loading -->
            <div v-if="isLoadingWeaponDetails" class="flex-1 flex items-center justify-center">
                <div class="font-mono animate-pulse flex items-center gap-3" :class="isMythic ? 'text-red-500' : 'text-titan-cyan'">
                    <span class="block w-3 h-3" :class="isMythic ? 'bg-red-500' : 'bg-titan-cyan'"></span> {{ $t('weapons.extracting') }}
                </div>
            </div>

            <!-- Content -->
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
    </div>
</template>
