/**
 * ============================================================================
 * GUNSMITH — CONFIGURATION & CONSTANTS
 * ============================================================================
 *
 * All static configuration data for the gunsmith calculation engine:
 * - Attachment stat ratios (recoil, hipfire, handling, reload)
 * - Corrupted modifier multipliers
 * - Rarity-to-index mappings
 * - Seasonal data loaded from season_config.json
 * - Dynamically-generated consumable regex
 *
 * This module has zero runtime dependencies on Vue or the DOM.
 * ============================================================================
 */

import seasonConfig from '../../data/season_config.json'
import type { MythicWeaponConfig, WeaponConsumable, RarityRatioTable } from './types'

// ---------------------------------------------------------------------------
// Attachment Ratio Tables
// ---------------------------------------------------------------------------

/**
 * Global Attachment Ratio Configuration.
 *
 * These ratios scale weapon base stats when explicit multi-value strings
 * are not present in the weapon JSON data. Each sub-object maps rarity
 * tiers to their corresponding multiplier.
 */
export const ATTACHMENT_RATIOS = {
    /** Recoil Control boost ratios (Barrel Stabilizer). */
    RECOIL: {
        common: 1.045,     // +4.5%
        rare: 1.095,       // +9.5%
        epic: 1.1425,      // +14.25%
        corrupted: 1.1425  // +14.25%
    },
    /** Hipfire Accuracy boost ratios (Laser Sight). */
    HIPFIRE: {
        common: 1.044,     // +4.4%
        rare: 1.094,       // +9.4%
        epic: 1.144,       // +14.4%
        corrupted: 1.144   // +14.4%
    },
    /** Handling boost ratios (Sniper Stock). */
    SNIPER_HANDLING: {
        common: 1.0585,    // +5.85%
        rare: 1.11,        // +11%
        epic: 1.16,        // +16%
        corrupted: 1.16    // +16%
    },
    /** Reload Speed multipliers (Sniper Stock reduction on reload time). */
    SNIPER_RELOAD: {
        common: 0.96,      // -4% reload time
        rare: 0.93,        // -7% reload time
        epic: 0.90,        // -10% reload time
        corrupted: 0.90    // -10% reload time
    },
    /** Reload Speed multipliers (Standard Stock reduction on reload time). */
    STANDARD_RELOAD: {
        common: 0.97,      // -3% reload time
        rare: 0.925,       // -7.5% reload time
        epic: 0.90,        // -10% reload time
        corrupted: 0.90    // -10% reload time
    },
    /** Handling boost ratios (Standard Stock). */
    STANDARD_HANDLING: {
        common: 1.0625,    // +6.25% handling
        rare: 1.11,        // +11% handling
        epic: 1.16,        // +16% handling
        corrupted: 1.16    // +16% handling
    },
    /** Corrupted-tier penalty & bonus fallback multipliers. */
    CORRUPTED_MODIFIERS: {
        BARREL_HIPFIRE_MULTIPLIER: 0.80,      // -20% Hipfire Accuracy penalty
        LASER_RECOIL_MULTIPLIER: 0.80,        // -20% Recoil Control penalty
        LASER_RELOAD_MULTIPLIER: 0.60,        // -40% Reload Time boost
        SNIPER_STOCK_ROF_MULTIPLIER: 1.20,    // +20% ROF/RPM boost (Corrupted Sniper Stock)
        STOCK_MAG_MULTIPLIER: 0.80            // -20% Magazine Capacity penalty
    }
} as const

/**
 * Weapon-specific Corrupted Sniper Stock ROF multipliers.
 * Override the default `SNIPER_STOCK_ROF_MULTIPLIER` for fine-tuned weapons.
 */
export const SNIPER_STOCK_ROF_RATIOS: Record<string, number> = {
    'g7': 1.20,
    'bocek': 1.20,
    'longbow': 1.21,
    'triple': 1.21,
    'charge': 1.22,
    'sentinel': 1.25
}

// ---------------------------------------------------------------------------
// Rarity Index Mappings
// ---------------------------------------------------------------------------

/**
 * Maps rarity tier strings to their positional index in multi-value stat strings.
 * Used to look up the correct tier value from "base / common / rare / epic / corrupted" arrays.
 */
export const rarityToIndex: Record<string, number> = {
    'common': 1,
    'rare': 2,
    'epic': 3,
    'legendary': 3,
    'corrupted': 4
}

/** Alias for `rarityToIndex` — kept for backward compatibility. */
export const rarityToMagIndex = rarityToIndex

// ---------------------------------------------------------------------------
// Seasonal Data (loaded from season_config.json)
// ---------------------------------------------------------------------------

/** Seasonal Mythic Weapons configuration, loaded dynamically from `src/data/season_config.json`. */
export const SEASON_MYTHIC_WEAPONS: Record<string, MythicWeaponConfig> =
    seasonConfig.mythicWeapons as Record<string, MythicWeaponConfig>

/** Weapon consumable definitions, loaded dynamically from `src/data/season_config.json`. */
export const WEAPON_CONSUMABLES: Record<string, WeaponConsumable> =
    seasonConfig.weaponConsumables as Record<string, WeaponConsumable>

// ---------------------------------------------------------------------------
// Dynamic Consumable Regex
// ---------------------------------------------------------------------------

/**
 * Keywords extracted from season_config.json consumable labels.
 * Used to build the dynamic regex for stat string parsing.
 */
const CONSUMABLE_KEYWORDS = Object.values(seasonConfig.weaponConsumables)
    .map((c: { label: string }) => c.label)
    .concat(['Amped'])

/**
 * Regex that matches consumable-mode stat suffixes like "(Frag: 7)" or "(Cell: 12)".
 * Automatically updated when new consumables are added to season_config.json.
 */
export const CONSUMABLE_REGEX = new RegExp(
    `\\((?:${CONSUMABLE_KEYWORDS.join('|')}):\\s*([\\s\\S]+?)\\)$`, 'i'
)

// ---------------------------------------------------------------------------
// Type-Safe Stock Ratio Accessors
// ---------------------------------------------------------------------------

/** Returns true if the stock attachment name indicates a Sniper Stock variant. */
export const isSniperStock = (name: string): boolean =>
    name.toLowerCase().includes('sniper')

/** Returns the handling ratio table for the given stock type (Sniper or Standard). */
export const getStockHandlingRatios = (stockName: string): RarityRatioTable =>
    isSniperStock(stockName) ? ATTACHMENT_RATIOS.SNIPER_HANDLING : ATTACHMENT_RATIOS.STANDARD_HANDLING

/** Returns the reload ratio table for the given stock type (Sniper or Standard). */
export const getStockReloadRatios = (stockName: string): RarityRatioTable =>
    isSniperStock(stockName) ? ATTACHMENT_RATIOS.SNIPER_RELOAD : ATTACHMENT_RATIOS.STANDARD_RELOAD
