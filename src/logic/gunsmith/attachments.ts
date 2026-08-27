/**
 * ============================================================================
 * GUNSMITH — ATTACHMENT MANAGEMENT
 * ============================================================================
 *
 * Functions for managing weapon attachments, mythic configurations, consumables,
 * fire modes, and attachment parsing:
 * - Mythic weapon lookup and validation
 * - Locked attachment resolution
 * - Consumable item retrieval
 * - Raw attachment string parsing into categorized groups
 * - Fire mode parsing and lock detection
 * - Turbocharger detection
 *
 * This module depends on `config.ts` for seasonal data and `gunsmithPredicates.ts`
 * for attachment identification logic.
 * ============================================================================
 */

import seasonConfig from '../../data/season_config.json'
import {
    isSplatterRounds,
    isBarrelStabilizer,
    isLaserSight,
    isStockAttachment,
    isMagazineAttachment,
    isBoltAttachment,
    isHopUpItem,
    isWeaponNamed
} from '../gunsmithPredicates'
import type { AttachmentItem, AttachmentGroup, MythicWeaponConfig, WeaponDetails, WeaponConsumable } from './types'
import { SEASON_MYTHIC_WEAPONS, WEAPON_CONSUMABLES } from './config'

// ---------------------------------------------------------------------------
// Mythic Weapon Configuration
// ---------------------------------------------------------------------------

/**
 * Retrieves the seasonal Mythic weapon configuration for a given weapon name.
 * Uses fuzzy matching via `isWeaponNamed` to support shortnames and partial matches.
 *
 * @param weaponName - The raw name of the weapon.
 * @returns The MythicWeaponConfig if found, or null otherwise.
 */
export const getMythicWeaponConfig = (weaponName: string | undefined): MythicWeaponConfig | null => {
    if (!weaponName) return null
    for (const key in SEASON_MYTHIC_WEAPONS) {
        if (isWeaponNamed(weaponName, key)) return SEASON_MYTHIC_WEAPONS[key]
    }
    return null
}

/**
 * Checks whether a given weapon is currently classified as a seasonal Mythic weapon.
 *
 * @param weaponName - The name of the weapon to inspect.
 * @returns True if the weapon is Mythic, false otherwise.
 */
export const isMythicWeapon = (weaponName: string | undefined): boolean => {
    return getMythicWeaponConfig(weaponName) !== null
}

// ---------------------------------------------------------------------------
// Locked Attachments
// ---------------------------------------------------------------------------

/**
 * Returns all locked attachment items for a weapon from Mythic and special seasonal configs.
 * Locked attachments cannot be removed or replaced by the player.
 *
 * @param weaponName - The name of the weapon.
 * @returns A dictionary mapping slot IDs to their locked AttachmentItem definitions.
 */
export const getLockedAttachmentsForWeapon = (weaponName: string | undefined): Record<string, AttachmentItem> => {
    if (!weaponName) return {}

    // 1. Mythic weapons configuration
    const mythicConfig = getMythicWeaponConfig(weaponName)
    if (mythicConfig) {
        return { ...mythicConfig.lockedAttachments }
    }

    // 2. Special locked attachment weapons (loaded from season_config.json)
    for (const key in seasonConfig.specialLockedAttachments) {
        if (isWeaponNamed(weaponName, key)) {
            return { ...(seasonConfig.specialLockedAttachments as Record<string, Record<string, AttachmentItem>>)[key] }
        }
    }

    return {}
}

// ---------------------------------------------------------------------------
// Weapon Consumables
// ---------------------------------------------------------------------------

/**
 * Retrieves the consumable item definition associated with energizable weapons
 * (e.g. Shield Cell for Sentinel, Frag Grenade for Bocek).
 *
 * @param weaponName - The name of the weapon.
 * @returns The WeaponConsumable configuration if available, or null.
 */
export const getWeaponConsumable = (weaponName: string | undefined): WeaponConsumable | null => {
    if (!weaponName) return null
    for (const key in WEAPON_CONSUMABLES) {
        if (isWeaponNamed(weaponName, key)) return WEAPON_CONSUMABLES[key]
    }
    return null
}

// ---------------------------------------------------------------------------
// Optic Rarity Resolution
// ---------------------------------------------------------------------------

/**
 * Maps an optic attachment's name to its standardized rarity tier.
 * Rarity is determined by the optic's zoom level (e.g. 1x = common, 2x-4x = epic).
 *
 * @param name - The optic's display name.
 * @returns The mapped rarity string ('common', 'rare', 'epic', or 'legendary').
 */
export const getOpticRarity = (name: string): string => {
    const lower = name.toLowerCase()
    if (lower.includes('4x-10x') || lower.includes('1x digital') || lower.includes('digital threat')) return 'legendary'
    if (lower.includes('4x-8x') || lower.includes('2x-4x') || lower.includes('3x')) return 'epic'
    if (lower.includes('1x-2x') || lower.includes('2x') || lower.includes('6x')) return 'rare'
    return 'common'
}

// ---------------------------------------------------------------------------
// Attachment Parsing
// ---------------------------------------------------------------------------

/**
 * Groups and parses raw attachment string arrays into structured categories
 * with auto-expanded rarity tiers.
 *
 * The raw attachment data from weapon JSON is a flat array of strings like:
 * `["Optics", "1x HCOG", "Others", "Barrel Stabilizer (Common, Rare, Epic)"]`
 *
 * This function categorizes them into `AttachmentGroup` objects with individual
 * `AttachmentItem` entries for each rarity variant.
 *
 * @param attachmentsList - The raw attachment strings from weapon JSON data.
 * @returns An array of categorized AttachmentGroup objects.
 */
export const parseAttachments = (attachmentsList: string[] | undefined): AttachmentGroup[] => {
    if (!attachmentsList || attachmentsList.length === 0) return []

    const opticsItems: AttachmentItem[] = []
    const hopupItems: AttachmentItem[] = []
    const otherItems: AttachmentItem[] = []

    let currentCategory = 'Others'

    for (const item of attachmentsList) {
        // Category headers
        if (item === 'Optics' || item === 'Others' || item === 'Hop-Ups' || item === 'Hop-Up') {
            currentCategory = (item === 'Hop-Up') ? 'Hop-Ups' : item
        } else {
            // Parse "Name (Rarity1, Rarity2)" format
            const splitMatch = item.match(/^(.*?)(?:\s*\((.*?)\))?$/)
            if (splitMatch) {
                const baseName = splitMatch[1].trim()
                const raritiesStr = splitMatch[2] ? splitMatch[2].trim() : ''

                // Determine rarity expansion rules using centralized predicates
                const isBolt = isBoltAttachment(baseName)
                const forceAllRarities = isMagazineAttachment(baseName) ||
                                         isStockAttachment(baseName) ||
                                         isBarrelStabilizer(baseName) ||
                                         isLaserSight(baseName) ||
                                         isBolt

                let rarities: string[] = []

                if (isBolt) {
                    rarities = ['Common', 'Rare', 'Epic']
                } else if (forceAllRarities) {
                    rarities = ['Common', 'Rare', 'Epic', 'Corrupted']
                } else if (raritiesStr) {
                    rarities = raritiesStr.split(',').map(r => r.trim()).filter(r => r.toLowerCase() !== 'legendary')
                }

                // Route items to the correct category bucket
                if (isHopUpItem(baseName, currentCategory)) {
                    const pointsMatch = raritiesStr.match(/(\d+)\s*(?:pts|points)/i)
                    const points = pointsMatch ? parseInt(pointsMatch[1], 10) : undefined
                    hopupItems.push({
                        name: isSplatterRounds(baseName) ? 'Splatter Rounds' : baseName,
                        detail: points ? `${points} PTS` : 'Legendary',
                        rarity: 'legendary',
                        points
                    })
                } else if (currentCategory === 'Optics') {
                    const r = getOpticRarity(baseName)
                    opticsItems.push({
                        name: baseName,
                        detail: r.charAt(0).toUpperCase() + r.slice(1),
                        rarity: r
                    })
                } else if (rarities.length > 0) {
                    for (const r of rarities) {
                        otherItems.push({
                            name: baseName,
                            detail: r,
                            rarity: r.toLowerCase()
                        })
                    }
                } else {
                    otherItems.push({
                        name: baseName,
                        detail: '',
                        rarity: 'default'
                    })
                }
            }
        }
    }

    // Build final groups, preserving display order: Optics → Others → Hop-Ups
    const groups: AttachmentGroup[] = []
    if (opticsItems.length > 0) groups.push({ category: 'Optics', items: opticsItems })
    if (otherItems.length > 0) groups.push({ category: 'Others', items: otherItems })
    if (hopupItems.length > 0) groups.push({ category: 'Hop-Ups', items: hopupItems })

    return groups
}

// ---------------------------------------------------------------------------
// Fire Mode Utilities
// ---------------------------------------------------------------------------

/**
 * Parses slash-delimited or ampersand-separated fire mode strings into an array of distinct modes.
 *
 * @example
 * parseFireModes("Single / Auto") // → ["Single", "Auto"]
 * parseFireModes("Burst & Auto")  // → ["Burst", "Auto"]
 *
 * @param fireModesStr - The raw fire mode string from weapon JSON data.
 * @returns An array of fire mode labels.
 */
export const parseFireModes = (fireModesStr: string | undefined): string[] => {
    if (!fireModesStr) return []
    const str = fireModesStr.trim()
    if (str.includes('/')) {
        return str.split('/').map(s => s.trim()).filter(Boolean)
    }
    if (str.includes('&')) {
        return str.split('&').map(s => s.trim()).filter(Boolean)
    }
    return [str]
}

/**
 * Determines whether an alternate fire mode is locked due to a missing required hop-up
 * (such as Selectfire Receiver).
 *
 * @param weapon - The raw weapon data object.
 * @param modeIndex - The index of the fire mode in the weapon's fireModesList.
 * @param equipped - The dictionary of currently equipped attachments by slot.
 * @returns True if the fire mode is locked without its required hop-up, false otherwise.
 */
export const isFireModeLocked = (
    weapon: WeaponDetails | null | undefined,
    modeIndex: number,
    equipped?: Record<string, AttachmentItem | null>
): boolean => {
    if (!weapon || modeIndex === 0) return false

    // Check if the weapon requires Selectfire Receiver for alternate fire modes
    const hasSelectfireAttachment = weapon.Attachments?.some(att =>
        att.toLowerCase().includes('selectfire')
    )

    if (hasSelectfireAttachment) {
        const hopupEq = equipped?.['hopup'] || equipped?.['other']
        const hasSelectfireEquipped = hopupEq?.name.toLowerCase().includes('selectfire')
        if (!hasSelectfireEquipped) {
            return true
        }
    }

    return false
}

// ---------------------------------------------------------------------------
// Turbocharger Detection
// ---------------------------------------------------------------------------

/**
 * Checks if a Turbocharger Hop-Up is currently equipped in any slot.
 * Used by RPM and DPS calculations for Devotion, Havoc, and Nemesis.
 *
 * @param equipped - The dictionary of currently equipped attachments by slot.
 * @returns True if any slot contains a Turbocharger hop-up.
 */
export const isTurbochargerEquipped = (equipped: Record<string, AttachmentItem | null> | undefined): boolean => {
    if (!equipped) return false
    for (const slot in equipped) {
        const item = equipped[slot]
        if (item?.name?.toLowerCase().includes('turbo')) return true
    }
    return false
}
