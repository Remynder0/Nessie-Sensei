import { ref, type ComputedRef, type Ref } from 'vue'
import type { AttachmentItem, AttachmentGroup } from '../../../logic/gunsmithCalculator'
import {
    isHopUpItem,
    isMagazineAttachment,
    isBoltAttachment,
    isStockAttachment,
    isBarrelStabilizer,
    isLaserSight
} from '../../../logic/gunsmithPredicates'

/**
 * Composable encapsulating all drag & drop state and handlers for the Gunsmith view.
 */
export function useGunsmithDragDrop(
    equippedItems: Ref<Record<string, AttachmentItem | null>>,
    attachmentGroups: ComputedRef<AttachmentGroup[]>,
    isSlotLocked: (slotId: string) => boolean
) {
    // --- Drag state ---
    const draggedItem = ref<AttachmentItem | null>(null)
    const draggedFromSlot = ref<string | null>(null)
    const dragOverSlotId = ref<string | null>(null)

    function getSlotIdForItem(item: AttachmentItem, category: string): string {
        if (category === 'Optics') return 'optics'
        if (category === 'Hop-Up' || isHopUpItem(item.name, category)) return 'hopup'
        if (isMagazineAttachment(item.name)) return 'mag'
        if (isBoltAttachment(item.name)) return 'bolt'
        if (isStockAttachment(item.name)) return 'stock'
        if (isBarrelStabilizer(item.name) || isLaserSight(item.name)) return 'barrel'
        return 'other'
    }

    function getSlotIdForItemDirect(item: AttachmentItem): string {
        for (const group of attachmentGroups.value) {
            for (const gi of group.items) {
                if (gi.name === item.name) {
                    return getSlotIdForItem(item, group.category)
                }
            }
        }
        return getSlotIdForItem(item, 'Others')
    }

    // --- Chest → Slot drag ---
    function onDragStartFromChest(event: DragEvent, item: AttachmentItem, category: string) {
        draggedItem.value = item
        draggedFromSlot.value = null
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', JSON.stringify({ item, category }))
        }
    }

    // --- Slot → Slot / Chest drag ---
    function onDragStartFromSlot(event: DragEvent, slotId: string) {
        if (isSlotLocked(slotId)) return
        const item = equippedItems.value[slotId]
        if (!item) return
        draggedItem.value = item
        draggedFromSlot.value = slotId
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', JSON.stringify({ item, slotId }))
        }
    }

    // --- Drop on slot ---
    function onDropOnSlot(event: DragEvent, slotId: string) {
        event.preventDefault()
        dragOverSlotId.value = null

        if (!draggedItem.value) return
        if (isSlotLocked(slotId)) {
            draggedItem.value = null
            draggedFromSlot.value = null
            return
        }

        // If dragged from another slot, remove from that slot first
        if (draggedFromSlot.value) {
            if (!isSlotLocked(draggedFromSlot.value)) {
                equippedItems.value[draggedFromSlot.value] = null
            }
        }

        // Check slot compatibility
        const itemSlotId = getSlotIdForItemDirect(draggedItem.value)
        if (itemSlotId !== slotId) {
            draggedItem.value = null
            draggedFromSlot.value = null
            return
        }

        // Corrupted exclusivity
        if (draggedItem.value.rarity === 'corrupted') {
            for (const sid in equippedItems.value) {
                const eq = equippedItems.value[sid]
                if (eq && eq.rarity === 'corrupted' && sid !== slotId && !isSlotLocked(sid)) {
                    equippedItems.value[sid] = null
                }
            }
        }

        equippedItems.value[slotId] = { ...draggedItem.value }
        draggedItem.value = null
        draggedFromSlot.value = null
    }

    // --- Click to equip from chest ---
    function equipItemFromChest(item: AttachmentItem) {
        const slotId = getSlotIdForItemDirect(item)
        if (isSlotLocked(slotId)) return

        if (item.rarity === 'corrupted') {
            for (const sid in equippedItems.value) {
                const eq = equippedItems.value[sid]
                if (eq && eq.rarity === 'corrupted' && sid !== slotId && !isSlotLocked(sid)) {
                    equippedItems.value[sid] = null
                }
            }
        }

        const currentEq = equippedItems.value[slotId]
        if (currentEq && currentEq.name === item.name && currentEq.rarity === item.rarity) {
            equippedItems.value[slotId] = null
        } else {
            equippedItems.value[slotId] = { ...item }
        }
    }

    // --- Drag over / leave / end ---
    function onDragOverSlot(event: DragEvent, slotId: string) {
        event.preventDefault()
        if (!draggedItem.value) return
        const itemSlotId = getSlotIdForItemDirect(draggedItem.value)
        if (itemSlotId === slotId && !isSlotLocked(slotId)) {
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
            dragOverSlotId.value = slotId
        } else {
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
        }
    }

    function onDragLeaveSlot() {
        dragOverSlotId.value = null
    }

    function onDragEnd() {
        draggedItem.value = null
        draggedFromSlot.value = null
        dragOverSlotId.value = null
    }

    // --- Drop on chest (unequip) ---
    function onDropOnChest(event: DragEvent) {
        event.preventDefault()
        if (draggedFromSlot.value && !isSlotLocked(draggedFromSlot.value)) {
            equippedItems.value[draggedFromSlot.value] = null
        }
        draggedItem.value = null
        draggedFromSlot.value = null
    }

    // --- Click slot to unequip ---
    function onClickSlot(slotId: string) {
        if (isSlotLocked(slotId)) return
        if (equippedItems.value[slotId]) {
            equippedItems.value[slotId] = null
        }
    }

    return {
        // State (readonly outside)
        draggedItem: draggedItem as Ref<AttachmentItem | null>,
        draggedFromSlot: draggedFromSlot as Ref<string | null>,
        dragOverSlotId: dragOverSlotId as Ref<string | null>,
        // Resolvers
        getSlotIdForItem,
        getSlotIdForItemDirect,
        // Handlers
        onDragStartFromChest,
        onDragStartFromSlot,
        onDropOnSlot,
        equipItemFromChest,
        onDragOverSlot,
        onDragLeaveSlot,
        onDragEnd,
        onDropOnChest,
        onClickSlot
    }
}
