/**
 * ============================================================================
 * GUNSMITH — SHARED TYPES & INTERFACES
 * ============================================================================
 *
 * Central type definitions shared across all gunsmith modules.
 * These interfaces define the data contracts between the weapon JSON data,
 * the calculation engine, and the reactive UI layer.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Attachment Types
// ---------------------------------------------------------------------------

/** Represents a single attachment item with its name, descriptive detail, and rarity tier. */
export interface AttachmentItem {
    name: string
    detail: string
    rarity: string
    points?: number
}

/** A categorized group of attachment items (e.g. Optics, Others, Hop-Ups). */
export interface AttachmentGroup {
    category: string
    items: AttachmentItem[]
}

// ---------------------------------------------------------------------------
// Weapon Types
// ---------------------------------------------------------------------------

/**
 * Raw weapon data object as loaded from JSON.
 * All stat fields are optional strings that must be parsed by the stat engine.
 */
export interface WeaponDetails {
    name: string
    shortname?: string
    Type?: string
    Ammo?: string
    'Fire modes'?: string
    Manufacturer?: string
    RPM?: string
    DPS?: string
    Magazine?: string
    'Tac reload time'?: string
    'Full reload time'?: string
    'Hipfire Accuracy'?: string
    'Recoil Control'?: string
    'Weapon Handling'?: string
    Lore?: string
    Icon?: string
    Damage?: {
        'Head Multiplier'?: string
        Head?: string
        Body?: string
        Leg?: string
        [key: string]: string | undefined
    }
    Attachments?: string[]
    [key: string]: any
}

// ---------------------------------------------------------------------------
// Stat Result Types
// ---------------------------------------------------------------------------

/**
 * Normalized output from every stat calculation function.
 * Provides `base` and `current` values for direct reactive UI binding,
 * along with boost/penalty flags for conditional styling.
 */
export interface StatResult {
    base: number
    current: number
    isBoosted: boolean
    isPenalty: boolean
    displayString?: string
    baseDisplayString?: string
    minVal?: number
    maxVal?: number
    /** Minimum value before any boost (used for RPM range display). */
    baseMinVal?: number
    /** i18n key for tooltip explanations. */
    tooltipKey?: string
}

// ---------------------------------------------------------------------------
// Season Config Types
// ---------------------------------------------------------------------------

/** Seasonal Mythic weapon configuration with locked attachments. */
export interface MythicWeaponConfig {
    name: string
    isMythic: boolean
    lockedAttachments: Record<string, AttachmentItem>
}

/** Weapon consumable definition (e.g. Shield Cell for Sentinel, Frag for Bocek). */
export interface WeaponConsumable {
    weaponKey: string
    name: string
    icon: string
    label: string
}

// ---------------------------------------------------------------------------
// Internal Utility Types
// ---------------------------------------------------------------------------

/** Type-safe rarity-keyed ratio table used for stock/barrel multiplier lookups. */
export type RarityRatioTable = {
    common: number
    rare: number
    epic: number
    corrupted: number
}
