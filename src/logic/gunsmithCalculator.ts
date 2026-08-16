/**
 * ============================================================================
 * NESSIE SENSEI — GUNSMITH CALCULATOR ENGINE
 * ============================================================================
 * 
 * Overview & Architecture:
 * ------------------------
 * This module is the pure business logic computation engine for the Gunsmith.
 * It is completely decoupled from the UI/DOM layer and operates as a pure
 * functional transform pipeline:
 * 
 *   (Weapon Raw Data + Equipped Attachments + Mode Flags) => Normalized StatResult
 * 
 * Data Flow & Responsibilities:
 * ------------------------------
 * 1. Qualitative Schema vs. Quantitative Engine:
 *    - `public/data/attachments.json`: Defines the qualitative schema of attachments
 *      (which stats are buffed or penalized, descriptive text).
 *    - `src/logic/gunsmithCalculator.ts`: Implements the quantitative mathematical model
 *      (exact multipliers, order of operations, weapon-specific overrides, and rounding).
 * 
 * 2. Attachment Slotting & Recognition Pipeline:
 *    - Attachments are identified via predicates (`src/logic/gunsmithPredicates.ts`)
 *      and mapped to standardized slots: 'barrel', 'mag', 'optic', 'stock', 'hopup', 'bolt'.
 *    - UI components (`GunsmithStatsPanel.vue`) reactively pass the corresponding
 *      slotted items (`equippedItems['stock']`, `equippedItems['barrel']`, etc.) into
 *      the dedicated calculation functions.
 * 
 * 3. Calculation Lifecycle (4 Key Steps):
 *    - Step 1 [Raw Data Extraction]: `getEffectiveStatString` extracts the active string
 *      variant based on mode (e.g. single vs. Akimbo, standard vs. Amped/Cell/Frag).
 *    - Step 2 [Multi-Stat Parsing]: `parseMultiStat` parses multi-tier slash-delimited
 *      values (e.g. "10 / 12 / 14 / 16 / 20") into indexable numeric arrays.
 *    - Step 3 [Order of Operations]: Applies stat modifiers with strict precedence:
 *      * Handling: Base -> Splatter Rounds flat boost -> Stock multiplier -> Math.round.
 *      * Reload: Effective Base (Corrupted Mag/Laser) -> Splatter multiplier (0.80) ->
 *                Stock reduction ratio (Standard vs Sniper) -> Math.round to 1 decimal.
 *      * Magazine: Base -> Mag attachment bonus -> Corrupted Stock penalty (Standard on
 *                  base mag, Sniper on total mag) -> Splatter (+2 bullets added last).
 *      * RPM: Base -> Shotgun Bolt index -> Corrupted Sniper Stock weapon-specific ratios.
 *      * Recoil & Hipfire: Stabilizer / Laser ratios + Corrupted cross-penalties.
 *      * DPS: Body damage * (RPM / 60) with charged/un-charged weapon curves.
 *    - Step 4 [Output Normalization]: Returns a standardized `StatResult` object containing
 *      `base`, `current`, `isBoosted`, and `isPenalty` for direct reactive UI binding.
 * ============================================================================
 */

import seasonConfig from '../data/season_config.json'
import {
    isSplatterRounds,
    isBarrelStabilizer,
    isLaserSight,
    isStockAttachment,
    isMagazineAttachment,
    isBoltAttachment,
    isHopUpItem,
    isWeaponNamed
} from './gunsmithPredicates'

// --- Dynamic consumable regex built from season_config.json ---
const CONSUMABLE_KEYWORDS = Object.values(seasonConfig.weaponConsumables)
    .map((c: { label: string }) => c.label)
    .concat(['Amped'])
const CONSUMABLE_REGEX = new RegExp(
    `\\((?:${CONSUMABLE_KEYWORDS.join('|')}):\\s*([\\s\\S]+?)\\)$`, 'i'
)

/** Type-safe accessor for stock-variant ratio tables. */
type RarityRatioTable = { common: number; rare: number; epic: number; corrupted: number }
const getSniperStock = () => ATTACHMENT_RATIOS.SNIPER_HANDLING
const getStandardStock = () => ATTACHMENT_RATIOS.STANDARD_HANDLING
const getSniperReload = () => ATTACHMENT_RATIOS.SNIPER_RELOAD
const getStandardReload = () => ATTACHMENT_RATIOS.STANDARD_RELOAD
const isSniperStock = (name: string): boolean => name.toLowerCase().includes('sniper')
const getStockHandlingRatios = (stockName: string): RarityRatioTable =>
    isSniperStock(stockName) ? getSniperStock() : getStandardStock()
const getStockReloadRatios = (stockName: string): RarityRatioTable =>
    isSniperStock(stockName) ? getSniperReload() : getStandardReload()

export interface AttachmentItem {
    name: string
    detail: string
    rarity: string
}

export interface AttachmentGroup {
    category: string
    items: AttachmentItem[]
}

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

export interface StatResult {
    base: number
    current: number
    isBoosted: boolean
    isPenalty: boolean
    displayString?: string
    baseDisplayString?: string
    minVal?: number
    maxVal?: number
}

export interface MythicWeaponConfig {
    name: string
    isMythic: boolean
    lockedAttachments: Record<string, AttachmentItem>
}

/**
 * Seasonal Mythic Weapons Configuration
 * Loaded dynamically from src/data/season_config.json.
 */
export const SEASON_MYTHIC_WEAPONS: Record<string, MythicWeaponConfig> = seasonConfig.mythicWeapons as Record<string, MythicWeaponConfig>

/**
 * Retrieves the seasonal Mythic weapon configuration for a given weapon name.
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
 * @param weaponName - The name of the weapon to inspect.
 * @returns True if the weapon is Mythic, false otherwise.
 */
export const isMythicWeapon = (weaponName: string | undefined): boolean => {
    return getMythicWeaponConfig(weaponName) !== null
}

/**
 * Returns all locked attachment items for a weapon from Mythic and special seasonal configs.
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

/**
 * Global Attachment Ratio Configuration
 * These ratios scale weapon base stats when explicit multi-value strings are not present.
 */
export const ATTACHMENT_RATIOS = {
    // Recoil Control boost ratios (Barrel Stabilizer)
    RECOIL: {
        common: 1.045,   // +4.5%
        rare: 1.095,      // +9.5%
        epic: 1.1425,     // +14.25%
        corrupted: 1.1425  // +14.25%
    },
    // Hipfire Accuracy boost ratios (Laser Sight)
    HIPFIRE: {
        common: 1.044,   // +4.4%
        rare: 1.094,      // +9.4%
        epic: 1.144,      // +14.4%
        corrupted: 1.144   // +14.4%
    },
    // Handling boost ratios (Sniper Stock)
    SNIPER_HANDLING: {
        common: 1.0585,    // +5.85%
        rare: 1.11,      // +11%
        epic: 1.16,      // +16%
        corrupted: 1.16   // +16%
    },
    // Reload Speed multipliers (Sniper Stock reduction on reload time)
    SNIPER_RELOAD: {
        common: 0.96,    // -4% reload time
        rare: 0.93,      // -7% reload time
        epic: 0.90,      // -10% reload time
        corrupted: 0.90   // -10% reload time
    },
    // Reload Speed multipliers (Standard Stock reduction on reload time)
    STANDARD_RELOAD: {
        common: 0.97,    // -3% reload time
        rare: 0.925,      // -7.5% reload time
        epic: 0.90,      // -10% reload time
        corrupted: 0.90   // -10% reload time
    },
    // Handling boost ratios (Standard Stock)
    STANDARD_HANDLING: {
        common: 1.0625,    // +6.25% handling
        rare: 1.11,      // +11% handling
        epic: 1.16,      // +16% handling
        corrupted: 1.16   // +16% handling
    },
    // Corrupted Penalty & Bonus fallback multipliers
    CORRUPTED_MODIFIERS: {
        BARREL_HIPFIRE_MULTIPLIER: 0.80,      // -20% Hipfire Accuracy penalty
        LASER_RECOIL_MULTIPLIER: 0.80,       // -20% Recoil Control penalty
        LASER_RELOAD_MULTIPLIER: 0.60,        // -40% Reload Time boost
        SNIPER_STOCK_ROF_MULTIPLIER: 1.20,    // +20% ROF/RPM boost STRICTLY for Corrupted Sniper Stock
        STOCK_MAG_MULTIPLIER: 0.80            // -20% Magazine Capacity penalty on base mag for Corrupted Stock
    }
} as const

export const rarityToIndex: Record<string, number> = {
    'common': 1,
    'rare': 2,
    'epic': 3,
    'legendary': 3,
    'corrupted': 4
}

export const rarityToMagIndex = rarityToIndex

export interface WeaponConsumable {
    weaponKey: string
    name: string
    icon: string
    label: string
}

export const WEAPON_CONSUMABLES: Record<string, WeaponConsumable> = seasonConfig.weaponConsumables as Record<string, WeaponConsumable>

/**
 * Retrieves the consumable item definition associated with energizable weapons.
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

/**
 * Parses slash-delimited or whitespace-separated stat strings into numeric arrays.
 * @param val - The raw stat string (e.g. "10 / 12 / 14 / 16 / 20").
 * @returns An array of parsed numeric values.
 */
export const parseMultiStat = (val: string | undefined): number[] => {
    if (!val) return []
    if (val.includes('/')) {
        return val.split('/').map(v => parseFloat(v.trim())).filter(n => !isNaN(n))
    }
    const numbers = val.trim().split(/\s+/).map(v => parseFloat(v)).filter(n => !isNaN(n))
    return numbers
}

/**
 * Parses slash-delimited or ampersand-separated fire mode strings into an array of distinct modes.
 * @param fireModesStr - The raw fire mode string (e.g. "Single / Auto").
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
 * Determines whether an alternate fire mode is locked due to a missing required hop-up (such as Selectfire Receiver).
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

/**
 * Maps an optic attachment's name to its standardized rarity tier.
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

/**
 * Groups and parses raw attachment string arrays into structured categories with auto-expanded rarity tiers.
 * @param attachmentsList - The raw attachment strings from weapon JSON data.
 * @returns An array of categorized AttachmentGroup objects containing AttachmentItem entries.
 */
export const parseAttachments = (attachmentsList: string[] | undefined): AttachmentGroup[] => {
    if (!attachmentsList || attachmentsList.length === 0) return []
    
    const opticsItems: AttachmentItem[] = []
    const hopupItems: AttachmentItem[] = []
    const otherItems: AttachmentItem[] = []

    let currentCategory = 'Others'

    for (const item of attachmentsList) {
        if (item === 'Optics' || item === 'Others' || item === 'Hop-Ups' || item === 'Hop-Up') {
            currentCategory = (item === 'Hop-Up') ? 'Hop-Ups' : item
        } else {
            const splitMatch = item.match(/^(.*?)(?:\s*\((.*?)\))?$/)
            if (splitMatch) {
                const baseName = splitMatch[1].trim()
                const raritiesStr = splitMatch[2] ? splitMatch[2].trim() : ''
                
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
                
                if (isHopUpItem(baseName, currentCategory)) {
                    hopupItems.push({
                        name: isSplatterRounds(baseName) ? 'Splatter Rounds' : baseName,
                        detail: 'Legendary',
                        rarity: 'legendary'
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

    const groups: AttachmentGroup[] = []
    if (opticsItems.length > 0) groups.push({ category: 'Optics', items: opticsItems })
    if (otherItems.length > 0) groups.push({ category: 'Others', items: otherItems })
    if (hopupItems.length > 0) groups.push({ category: 'Hop-Ups', items: hopupItems })

    return groups
}


/**
 * Extracts the effective stat substring based on active mode flags (Akimbo, Amped, Breach, or Consumable state).
 * @param statStr - The raw stat string containing possible mode substrings (e.g. "21 (Breach: 4-38)" or "40 (Frag: 7)").
 * @param isAkimbo - Whether Akimbo dual-wield mode is active.
 * @param isAmped - Whether consumable energized mode is active.
 * @param isBreach - Whether Breach underbarrel launcher mode is active.
 * @returns The extracted single effective stat string.
 */
export const getEffectiveStatString = (
    statStr: string | undefined, 
    isAkimbo: boolean = false,
    isAmped: boolean = false,
    isBreach: boolean = false
): string => {
    if (!statStr) return ''
    const str = String(statStr).trim()

    // 1. Breach Mode extraction: "(Breach: ...)"
    const breachMatch = str.match(/\(Breach:\s*([\s\S]+?)\)$/i)
    if (breachMatch) {
        if (isBreach) {
            return breachMatch[1].trim()
        } else {
            const idx = str.lastIndexOf(breachMatch[0])
            return str.slice(0, idx).trim()
        }
    }

    // 2. Generic Consumable Mode: matches any "(Frag: ...)", "(Cell: ...)", "(Thermite: ...)", etc.
    const consumableMatch = str.match(CONSUMABLE_REGEX)
    if (consumableMatch) {
        if (isAmped) {
            return consumableMatch[1].trim()
        } else {
            const idx = str.lastIndexOf(consumableMatch[0])
            return str.slice(0, idx).trim()
        }
    }

    // 3. Akimbo dual-wield mode
    if (str.includes('Akimbo:')) {
        const parts = str.split(/[\(\)]/)
        if (isAkimbo) {
            const akimboPart = parts.find(p => p.includes('Akimbo:'))
            if (akimboPart) return akimboPart.replace('Akimbo:', '').trim()
        } else {
            return parts[0].trim()
        }
    }
    return str
}

/**
 * Computes final magazine capacity considering mag attachments, corrupted stock penalties, hop-ups, and consumable modes.
 * @param weapon - The raw weapon data object.
 * @param equipped - The dictionary of currently equipped attachments by slot.
 * @param isAkimbo - Whether Akimbo dual-wield mode is active.
 * @param isAmped - Whether consumable energized mode is active (e.g. Frag mode on Bocek).
 * @param isBreach - Whether Breach underbarrel mode is active (Hemlok).
 * @returns A StatResult containing base and calculated magazine capacity.
 */
export const calculateMagazineStat = (
    weapon: WeaponDetails | null | undefined, 
    equipped: Record<string, AttachmentItem | null>,
    isAkimbo: boolean = false,
    isAmped: boolean = false,
    isBreach: boolean = false
): StatResult => {
    if (!weapon?.Magazine) return { base: 0, current: 0, isBoosted: false, isPenalty: false }
    
    // Always extract un-akimbo single base string for true base mag
    const singleMagStr = getEffectiveStatString(weapon.Magazine, false, false, false)
    const singleParts = singleMagStr.split(' / ').map((v: string) => parseFloat(v.trim()))
    const base = singleParts[0] || 0
    if (base === 0) return { base: 0, current: 0, isBoosted: false, isPenalty: false }

    if (isBreach) {
        return {
            base,
            current: 1,
            isBoosted: false,
            isPenalty: false,
            displayString: '1'
        }
    }

    // Extract effective mag string for active mode (Akimbo or Consumable state)
    const effectiveMagStr = getEffectiveStatString(weapon.Magazine, isAkimbo, isAmped, isBreach)
    const effectiveParts = effectiveMagStr.split(' / ').map((v: string) => parseFloat(v.trim()))
    const effectiveBase = effectiveParts[0] || base

    let magBonus = 0
    let stockPenalty = 0

    const magEq = equipped['mag']
    const stockEq = equipped['stock']
    const hopupEq = equipped['hopup'] || equipped['other']
    const isSplatter = isSplatterRounds(hopupEq?.name)

    if (magEq) {
        if (magEq.rarity === 'corrupted') {
            if (effectiveParts.length >= 5 && effectiveParts[4] !== undefined && !isNaN(effectiveParts[4])) {
                magBonus = effectiveParts[4] - base
            } else if (effectiveParts.length > 1) {
                const lastVal = effectiveParts[effectiveParts.length - 1]
                if (lastVal !== undefined && !isNaN(lastVal)) magBonus = lastVal - base
            }
        } else {
            const idx = rarityToMagIndex[magEq.rarity] ?? 0
            if (idx > 0 && effectiveParts[idx] !== undefined && !isNaN(effectiveParts[idx])) {
                magBonus = effectiveParts[idx] - base
            }
        }
    } else if (isAkimbo || isAmped) {
        magBonus = effectiveBase - base
    }

    // 2. Corrupted Stock penalty on Magazine (Standard Stock = base mag only, Sniper Stock = total mag)
    if (stockEq?.rarity === 'corrupted') {
        const targetMag = isSniperStock(stockEq.name) ? (base + magBonus) : base
        const reducedMag = Math.round(targetMag * ATTACHMENT_RATIOS.CORRUPTED_MODIFIERS.STOCK_MAG_MULTIPLIER)
        stockPenalty = Math.max(0, targetMag - reducedMag)
    }

    let current = Math.max(1, Math.round(base + magBonus - stockPenalty))

    // 3. Splatter Rounds (+2 bullets) is added AT THE VERY END!
    if (isSplatter) {
        current += 2
    }

    return {
        base,
        current,
        isBoosted: current > base,
        isPenalty: current < base
    }
}

export const SNIPER_STOCK_ROF_RATIOS: Record<string, number> = {
    'g7': 1.20,
    'bocek': 1.20,
    'longbow': 1.21,
    'triple': 1.21,
    'charge': 1.22,
    'sentinel': 1.25
}

/**
 * Checks if a Turbocharger Hop-Up is currently equipped in any slot.
 */
export const isTurbochargerEquipped = (equipped: Record<string, AttachmentItem | null> | undefined): boolean => {
    if (!equipped) return false
    for (const slot in equipped) {
        const item = equipped[slot]
        if (item?.name?.toLowerCase().includes('turbo')) return true
    }
    return false
}

/**
 * Computes weapon Rate of Fire (RPM) incorporating Shotgun Bolts, consumable states, fire mode selection, and Corrupted Sniper Stock bonuses.
 * @param weapon - The raw weapon data object.
 * @param equipped - The dictionary of currently equipped attachments by slot.
 * @param isAkimbo - Whether Akimbo dual-wield mode is active.
 * @param isAmped - Whether consumable energized mode is active.
 * @param selectedFireModeIndex - The index of the active fire mode (e.g. 0 for Burst, 1 for Auto).
 * @returns A StatResult containing base and calculated RPM values.
 */
export const calculateRpmStat = (
    weapon: WeaponDetails | null | undefined, 
    equipped: Record<string, AttachmentItem | null>,
    isAkimbo: boolean = false,
    isAmped: boolean = false,
    selectedFireModeIndex: number = 0
): StatResult => {
    const singleRpmStr = getEffectiveStatString(weapon?.RPM, false, false)
    const singleRpmValues = parseMultiStat(singleRpmStr)
    const base = singleRpmValues[0] || 0
    if (base === 0) return { base: 0, current: 0, isBoosted: false, isPenalty: false }

    const isTurbo = isTurbochargerEquipped(equipped)

    // Special Devotion RPM curve (300-900 base, 408-900 with Turbocharger)
    if (isWeaponNamed(weapon?.name, 'devotion')) {
        const baseMin = 300
        const baseMax = 900
        const currentMin = isTurbo ? 408 : 300
        const currentMax = 900
        return {
            base: baseMax,
            current: currentMax,
            minVal: currentMin,
            maxVal: currentMax,
            isBoosted: isTurbo,
            isPenalty: false,
            displayString: `${currentMin}–${currentMax}`,
            baseDisplayString: `${baseMin}–${baseMax}`
        }
    }

    // Special Nemesis RPM curve (451-582 base over 6 bursts, max 582 direct with Turbocharger over 2 bursts)
    if (isWeaponNamed(weapon?.name, 'nemesis')) {
        const baseMin = 451
        const baseMax = 582
        return {
            base: baseMax,
            current: 582,
            minVal: isTurbo ? 582 : 451,
            maxVal: 582,
            isBoosted: isTurbo,
            isPenalty: false,
            displayString: isTurbo ? '582' : `${baseMin}–${baseMax}`,
            baseDisplayString: `${baseMin}–${baseMax}`
        }
    }

    const effectiveRpmStr = getEffectiveStatString(weapon?.RPM, isAkimbo, isAmped)
    const effectiveRpmValues = parseMultiStat(effectiveRpmStr)
    let current = effectiveRpmValues[0] || base

    const boltEq = equipped['bolt']
    const stockEq = equipped['stock']

    // 1. Fire Mode Selection vs Shotgun Bolt RPM boost
    const isShotgun = weapon?.Type?.toLowerCase() === 'shotgun' || weapon?.Attachments?.some(a => a.toLowerCase().includes('bolt'))

    if (isShotgun) {
        if (boltEq && effectiveRpmValues.length > 1 && !isAmped) {
            const idx = rarityToIndex[boltEq.rarity] ?? 0
            current = effectiveRpmValues[idx] ?? current
        }
    } else if (effectiveRpmValues.length > 1 && !isAmped) {
        // Multi-firemode weapon (e.g. Prowler "579/795", Charge Rifle "26 / 84")
        if (selectedFireModeIndex > 0 && effectiveRpmValues[selectedFireModeIndex] !== undefined) {
            current = effectiveRpmValues[selectedFireModeIndex]
        }
    }

    // 2. Corrupted Sniper Stock ROF boost (Weapon-specific multipliers or default fallback)
    if (stockEq?.rarity === 'corrupted' && isSniperStock(stockEq.name)) {
        let rofMultiplier: number = ATTACHMENT_RATIOS.CORRUPTED_MODIFIERS.SNIPER_STOCK_ROF_MULTIPLIER
        for (const key in SNIPER_STOCK_ROF_RATIOS) {
            if (isWeaponNamed(weapon?.name, key)) {
                rofMultiplier = SNIPER_STOCK_ROF_RATIOS[key]
                break
            }
        }
        current = Math.round(current * rofMultiplier)
    }

    return {
        base,
        current,
        isBoosted: current > base,
        isPenalty: current < base
    }
}

/**
 * Computes spin-up / wind-up delay in seconds or burst count for weapons with charge mechanics (HAVOC, Devotion, Nemesis).
 * @param weapon - The raw weapon data object.
 * @param equipped - The dictionary of currently equipped attachments by slot.
 * @returns A StatResult with labelKey if the weapon has a spin-up mechanic, or null otherwise.
 */
export const calculateSpinUpStat = (
    weapon: WeaponDetails | null | undefined,
    equipped: Record<string, AttachmentItem | null>
): (StatResult & { labelKey: string }) | null => {
    if (!weapon?.name) return null
    const isTurbo = isTurbochargerEquipped(equipped)

    if (isWeaponNamed(weapon.name, 'havoc')) {
        const base = 0.42
        const current = isTurbo ? 0.10 : 0.42
        return {
            base,
            current,
            isBoosted: isTurbo,
            isPenalty: false,
            displayString: `${current.toFixed(2)}s`,
            baseDisplayString: `${base.toFixed(2)}s`,
            labelKey: 'weapons.spinUpDelay'
        }
    }

    if (isWeaponNamed(weapon.name, 'devotion')) {
        const base = 1.75
        const current = isTurbo ? 0.85 : 1.75
        return {
            base,
            current,
            isBoosted: isTurbo,
            isPenalty: false,
            displayString: `${current.toFixed(2)}s`,
            baseDisplayString: `${base.toFixed(2)}s`,
            labelKey: 'weapons.spinUpTime'
        }
    }

    if (isWeaponNamed(weapon.name, 'nemesis')) {
        const base = 6
        const current = isTurbo ? 2 : 6
        return {
            base,
            current,
            isBoosted: isTurbo,
            isPenalty: false,
            displayString: `${current} salves`,
            baseDisplayString: `6 salves`,
            labelKey: 'weapons.burstsToMax'
        }
    }

    return null
}

/**
 * Parses numeric damage strings and hyphenated damage ranges into min and max bounds.
 * @param val - The raw damage string (e.g. "35 - 60" or "75").
 * @returns An object with min, max numbers and an isRange boolean flag.
 */
export const getDamageRange = (val: string | undefined): { min: number, max: number, isRange: boolean } => {
    if (!val) return { min: 0, max: 0, isRange: false }
    const str = String(val).trim()
    if (str.includes('-')) {
        const parts = str.split('-').map(v => parseFloat(v.trim())).filter(n => !isNaN(n))
        if (parts.length >= 2) {
            return { min: parts[0], max: parts[1], isRange: true }
        }
    }
    const num = parseFloat(str)
    return { min: isNaN(num) ? 0 : num, max: isNaN(num) ? 0 : num, isRange: false }
}

/**
 * Extracts the base headshot multiplier for a weapon from its Damage configuration.
 * @param weapon - The weapon data object.
 * @returns The numeric headshot multiplier (defaults to 1.5).
 */
export const getBaseHeadshotMultiplier = (weapon: WeaponDetails | null | undefined): number => {
    if (!weapon?.Damage?.['Head Multiplier']) return 1.5
    const mult = parseFloat(weapon.Damage['Head Multiplier'])
    return (!isNaN(mult) && mult > 0) ? mult : 1.5
}

/**
 * Computes headshot damage values incorporating Corrupted Barrel bonuses, Skullpiercer hop-ups, explosive fragments, and Breach mode.
 * @param weapon - The raw weapon data object.
 * @param equipped - The dictionary of currently equipped attachments by slot.
 * @param isAmped - Whether consumable energized mode is active.
 * @param isBreach - Whether Breach underbarrel launcher mode is active.
 * @returns A StatResult containing base and calculated headshot damage.
 */
export const calculateHeadshotDamageStat = (
    weapon: WeaponDetails | null | undefined,
    equipped: Record<string, AttachmentItem | null>,
    isAmped: boolean = false,
    isBreach: boolean = false
): StatResult => {
    if (!weapon?.Damage) return { base: 0, current: 0, isBoosted: false, isPenalty: false }
    
    const baseBodyStr = getEffectiveStatString(weapon.Damage.Body, false, false, false)
    const effectiveBodyStr = getEffectiveStatString(weapon.Damage.Body, false, isAmped, isBreach)

    const baseMultiplier = getBaseHeadshotMultiplier(weapon)
    let effectiveMultiplier = baseMultiplier

    if (isBreach) {
        // In Breach mode, explosive damage is uniform across body, head, and legs (no headshot multiplier)
        const activeRange = getDamageRange(effectiveBodyStr)
        const displayString = activeRange.isRange ? `${activeRange.min} - ${activeRange.max}` : String(activeRange.max)
        return {
            base: activeRange.max,
            current: activeRange.max,
            isBoosted: false,
            isPenalty: false,
            displayString
        }
    }

    // 1. Corrupted Barrel Stabilizer (+20% Headshot Damage boost)
    const barrelEq = equipped['barrel']
    if (barrelEq?.rarity === 'corrupted') {
        const isBarrel = barrelEq.name.toLowerCase().includes('barrel') || barrelEq.name.toLowerCase().includes('stabilizer')
        if (isBarrel) {
            effectiveMultiplier = effectiveMultiplier * 1.20
        }
    }

    // 2. Skullpiercer Hop-Up boost (+35% headshot multiplier boost)
    const hopupEq = equipped['hopup']
    if (hopupEq && hopupEq.name.toLowerCase().includes('skullpiercer')) {
        effectiveMultiplier = effectiveMultiplier * 1.35
    }

    const baseRange = getDamageRange(baseBodyStr)
    const maxBaseHead = Math.round(baseRange.max * baseMultiplier)

    let displayString = ''
    let maxCurrHead = 0

    if (effectiveBodyStr.includes('(+')) {
        // e.g. "50 (+25)" -> impact = 50, explosion = 25
        const match = effectiveBodyStr.match(/([0-9.]+)\s*\(\+([0-9.]+)\)/)
        if (match) {
            const impactDmg = parseFloat(match[1])
            const exploDmg = parseFloat(match[2])

            const impactHead = Math.round(impactDmg * effectiveMultiplier)
            const exploHead = Math.round(exploDmg * effectiveMultiplier)
            
            maxCurrHead = impactHead + exploHead
            displayString = `${impactHead} (+${exploHead})`
        }
    }

    if (!displayString) {
        const activeRange = getDamageRange(effectiveBodyStr)
        const minCurrHead = Math.round(activeRange.min * effectiveMultiplier)
        maxCurrHead = Math.round(activeRange.max * effectiveMultiplier)
        displayString = activeRange.isRange ? `${minCurrHead} - ${maxCurrHead}` : String(maxCurrHead || maxBaseHead)
    }

    const isBoosted = effectiveMultiplier > baseMultiplier

    return {
        base: maxBaseHead,
        current: maxCurrHead,
        isBoosted,
        isPenalty: false,
        displayString
    }
}

/**
 * Computes Damage Per Second (DPS) based on effective RPM, body damage ranges, and weapon charge curves.
 * @param weapon - The raw weapon data object.
 * @param effectiveRpm - The active calculated RPM.
 * @param baseRpm - The un-boosted base RPM.
 * @param isAmped - Whether consumable energized mode is active.
 * @param isBreach - Whether Breach underbarrel launcher mode is active.
 * @returns A StatResult containing base and calculated DPS ranges or values.
 */
export const calculateDpsStat = (
    weapon: WeaponDetails | null | undefined, 
    effectiveRpm: number, 
    baseRpm: number,
    isAmped: boolean = false,
    isBreach: boolean = false,
    isTurbo: boolean = false
): StatResult => {
    if (!weapon?.Damage) return { base: 0, current: 0, isBoosted: false, isPenalty: false }

    const baseBodyStr = getEffectiveStatString(weapon.Damage.Body, false, false, false)
    const effectiveBodyStr = getEffectiveStatString(weapon.Damage.Body, false, isAmped, isBreach)

    if (isBreach) {
        const activeRange = getDamageRange(effectiveBodyStr)
        return {
            base: activeRange.max,
            current: activeRange.max,
            minVal: activeRange.min,
            maxVal: activeRange.max,
            isBoosted: false,
            isPenalty: false,
            displayString: String(activeRange.max),
            baseDisplayString: String(activeRange.max)
        }
    }

    const getTotalBodyDmg = (str: string): { min: number, max: number, isRange: boolean, isFrag: boolean } => {
        if (str.includes('(+')) {
            const match = str.match(/^([0-9.]+)\s*\(\+([0-9.]+)\)/)
            if (match) {
                const impact = parseFloat(match[1])
                const explo = parseFloat(match[2])
                const total = impact + explo
                return { min: total, max: total, isRange: false, isFrag: true }
            }
        }
        const rng = getDamageRange(str)
        return { ...rng, isFrag: false }
    }

    const baseRange = getTotalBodyDmg(baseBodyStr)
    const activeRange = getTotalBodyDmg(effectiveBodyStr)

    const is3030 = isWeaponNamed(weapon.name, '30-30')
    const isBocek = isWeaponNamed(weapon.name, 'bocek')
    const isDevotion = isWeaponNamed(weapon.name, 'devotion')
    const isNemesis = isWeaponNamed(weapon.name, 'nemesis')
    
    // Unamped base DPS range
    const baseChargedRpm = (is3030 || isBocek) ? 60 : baseRpm
    let baseMinDps = (baseRange.min > 0 && baseRpm > 0) ? Math.round(baseRange.min * (baseRpm / 60)) : 0
    let baseMaxDps = (baseRange.max > 0 && baseChargedRpm > 0) ? Math.round(baseRange.max * (baseChargedRpm / 60)) : 0

    if (isDevotion) {
        baseMinDps = 80
        baseMaxDps = 240
    } else if (isNemesis) {
        baseMinDps = 128
        baseMaxDps = 165
    }

    const baseLower = Math.min(baseMinDps, baseMaxDps)
    const baseUpper = Math.max(baseMinDps, baseMaxDps)

    const baseDisplayString = (baseRange.isRange || isDevotion || isNemesis) ? `${baseLower} - ${baseUpper}` : String(baseUpper)

    // Current DPS calculation
    let minDps = 0
    let maxDps = 0

    if (isAmped && isBocek && activeRange.isFrag) {
        // Frag mode on Bocek: Single fixed charged DPS = 125!
        minDps = 125
        maxDps = 125
    } else if (isAmped && isWeaponNamed(weapon.name, 'sentinel')) {
        minDps = (activeRange.min > 0 && effectiveRpm > 0) ? Math.round(activeRange.min * 1.25 * (effectiveRpm / 60)) : 0
        maxDps = (activeRange.max > 0 && effectiveRpm > 0) ? Math.round(activeRange.max * 1.25 * (effectiveRpm / 60)) : 0
    } else if (isDevotion) {
        minDps = isTurbo ? 109 : 80
        maxDps = 240
    } else if (isNemesis) {
        minDps = isTurbo ? 165 : 128
        maxDps = 165
    } else {
        const chargedRpm = (is3030 || isBocek) ? 60 : effectiveRpm
        minDps = (activeRange.min > 0 && effectiveRpm > 0) ? Math.round(activeRange.min * (effectiveRpm / 60)) : 0
        maxDps = (activeRange.max > 0 && chargedRpm > 0) ? Math.round(activeRange.max * (chargedRpm / 60)) : 0
    }

    const lowerDps = Math.min(minDps, maxDps)
    const upperDps = Math.max(minDps, maxDps)

    const base = baseUpper || parseFloat(weapon?.DPS || '0')
    const current = upperDps || base

    const isBoosted = current > baseUpper || isAmped || (isDevotion && isTurbo) || (isNemesis && isTurbo)
    const isRange = (activeRange.isRange && !activeRange.isFrag) || isDevotion || (isNemesis && !isTurbo)

    if (isRange) {
        return {
            base: baseUpper,
            current: upperDps,
            minVal: lowerDps,
            maxVal: upperDps,
            isBoosted,
            isPenalty: false,
            displayString: `${lowerDps} - ${upperDps}`,
            baseDisplayString
        }
    }

    return {
        base: baseUpper,
        current: upperDps,
        minVal: lowerDps,
        maxVal: upperDps,
        isBoosted,
        isPenalty: current < baseUpper,
        displayString: String(upperDps),
        baseDisplayString
    }
}

/**
 * Computes tactical or full reload time incorporating Corrupted Mag penalties, Laser boosts, Splatter Rounds, and Stock ratios.
 * @param statStr - The raw reload time string (e.g. "3.0 / 4.1").
 * @param weapon - The raw weapon data object.
 * @param magEq - The equipped magazine attachment.
 * @param stockEq - The equipped stock attachment.
 * @param barrelEq - The equipped barrel/laser attachment.
 * @param isAkimbo - Whether Akimbo dual-wield mode is active.
 * @param hopupEq - The equipped hop-up attachment.
 * @param isBreach - Whether Breach underbarrel launcher mode is active.
 * @returns A StatResult containing base and calculated reload time in seconds.
 */
export const calculateReloadStat = (
    statStr: string | undefined, 
    weapon: WeaponDetails | null | undefined, 
    magEq: AttachmentItem | null | undefined, 
    stockEq: AttachmentItem | null | undefined,
    barrelEq: AttachmentItem | null | undefined,
    isAkimbo: boolean = false,
    hopupEq?: AttachmentItem | null | undefined,
    isBreach: boolean = false
): StatResult => {
    if (!statStr) return { base: 0, current: 0, isBoosted: false, isPenalty: false }
    const singleStatStr = getEffectiveStatString(statStr, false, false, false)
    const singleParts = singleStatStr.split(' / ').map(p => parseFloat(p.trim())).filter(n => !isNaN(n))
    const rawBase = singleParts[0] || 0
    if (rawBase === 0) return { base: 0, current: 0, isBoosted: false, isPenalty: false }

    const effectiveStatStr = getEffectiveStatString(statStr, isAkimbo, false, isBreach)
    if (!effectiveStatStr) return { base: 0, current: 0, isBoosted: false, isPenalty: false }

    if (isBreach) {
        const val = parseFloat(effectiveStatStr) || 30
        return {
            base: val,
            current: val,
            isBoosted: false,
            isPenalty: false,
            displayString: `${val}s`
        }
    }

    const effectiveParts = effectiveStatStr.split(' / ').map(p => parseFloat(p.trim())).filter(n => !isNaN(n))
    const effectiveBase = effectiveParts[0] || rawBase

    // 1. Determine base reload time for active mode (incorporating Corrupted Mag penalty if equipped)
    let currentBase = effectiveBase

    if (magEq?.rarity === 'corrupted') {
        if (effectiveParts.length > 1) {
            const magVal = effectiveParts[effectiveParts.length - 1]
            if (magVal !== undefined && !isNaN(magVal) && magVal > effectiveBase) {
                currentBase = magVal
            }
        }
    }

    // 2. Corrupted Laser reload time boost (e.g. 2.1 -> 1.3, 2.5 -> 1.5, 2.2 -> 1.3 or multiplier 0.60)
    if (barrelEq?.rarity === 'corrupted' && barrelEq.name.toLowerCase().includes('laser')) {
        currentBase = Math.ceil(currentBase * ATTACHMENT_RATIOS.CORRUPTED_MODIFIERS.LASER_RELOAD_MULTIPLIER * 10) / 10
    }

    // 3. Stock reload speed reduction & Splatter Rounds reload boost
    let current = currentBase
    const activeHopup = hopupEq || (isSplatterRounds(magEq?.name) ? magEq : null)
    const isSplatter = isSplatterRounds(activeHopup?.name)

    // Step 1: Splatter Rounds applies FIRST to reload base time (0.80)
    if (isSplatter) {
        current = currentBase * 0.80
    }

    // Step 2: Stock reload ratio applies SECOND on top
    if (stockEq) {
        const idx = rarityToIndex[stockEq.rarity] ?? 0
        if (idx > 0) {
            const r = stockEq.rarity.toLowerCase() as keyof RarityRatioTable
            const ratio = getStockReloadRatios(stockEq.name)[r] ?? 1.0
            current = Math.round(current * ratio * 10) / 10
        } else {
            current = Math.round(current * 10) / 10
        }
    } else {
        current = Math.round(current * 10) / 10
    }

    return {
        base: rawBase,
        current,
        isBoosted: current < rawBase,
        isPenalty: current > rawBase
    }
}

/**
 * Computes weapon handling score scaled by Splatter Rounds bonuses and Standard/Sniper Stock ratios.
 * @param weapon - The raw weapon data object.
 * @param stockEq - The equipped stock attachment.
 * @param hopupEq - The equipped hop-up attachment.
 * @returns A StatResult containing base and calculated handling scores (0 to 100).
 */
export const calculateHandlingStat = (
    weapon: WeaponDetails | null | undefined,
    stockEq: AttachmentItem | null | undefined,
    hopupEq?: AttachmentItem | null | undefined
): StatResult => {
    const rawStr = weapon?.['Weapon Handling']
    const parts = parseMultiStat(rawStr)
    const base = parts[0] || 70

    const isSplatter = isSplatterRounds(hopupEq?.name)
    const isFlatline = isWeaponNamed(weapon?.name, 'flatline')

    // 1. Splatter Rounds applies FIRST
    let current = base
    if (isSplatter) {
        const addHand = isFlatline ? 11 : 7
        current += addHand
    }

    // 2. Stock multiplier (e.g. Epic Stock = 1.15) applies SECOND on top
    if (stockEq) {
        const idx = rarityToIndex[stockEq.rarity] ?? 0
        if (parts.length > 1 && idx > 0 && parts[idx] !== undefined) {
            current = parts[idx] + (isSplatter ? (isFlatline ? 11 : 7) : 0)
        } else {
            const r = stockEq.rarity.toLowerCase() as keyof RarityRatioTable
            const ratio = getStockHandlingRatios(stockEq.name)[r] ?? 1.0
            current = Math.min(100, Math.round(current * ratio))
        }
    }

    return {
        base,
        current,
        isBoosted: current > base,
        isPenalty: current < base
    }
}

/**
 * Computes recoil control score boosted by Barrel Stabilizers, penalized by Corrupted Lasers, and modified by Splatter Rounds.
 * @param weapon - The raw weapon data object.
 * @param barrelEq - The equipped barrel/laser attachment.
 * @param hopupEq - The equipped hop-up attachment.
 * @returns A StatResult containing base and calculated recoil control scores (0 to 100).
 */
export const calculateRecoilStat = (
    weapon: WeaponDetails | null | undefined,
    barrelEq: AttachmentItem | null | undefined,
    hopupEq?: AttachmentItem | null | undefined
): StatResult => {
    const rawStr = weapon?.['Recoil Control']
    const parts = parseMultiStat(rawStr)
    const base = parts[0] || 40
    let current = base

    const isSplatter = isSplatterRounds(hopupEq?.name)

    if (barrelEq) {
        const isLaser = isLaserSight(barrelEq.name)
        const isBarrel = isBarrelStabilizer(barrelEq.name)

        if (isBarrel) {
            const idx = rarityToIndex[barrelEq.rarity] ?? 0
            if (parts.length > 1 && idx > 0 && parts[idx] !== undefined) {
                current = parts[idx]
            } else {
                const r = barrelEq.rarity.toLowerCase() as keyof typeof ATTACHMENT_RATIOS.RECOIL
                const ratio = ATTACHMENT_RATIOS.RECOIL[r] ?? 1.0
                current = Math.min(100, Math.round(base * ratio))
            }
        } else if (isLaser && barrelEq.rarity === 'corrupted') {
            current = Math.max(0, Math.round(base * ATTACHMENT_RATIOS.CORRUPTED_MODIFIERS.LASER_RECOIL_MULTIPLIER))
        }
    }

    if (isSplatter && isWeaponNamed(weapon?.name, 'flatline')) {
        current = Math.min(100, current + 12)
    }

    return {
        base,
        current,
        isBoosted: current > base,
        isPenalty: current < base
    }
}

/**
 * Computes hipfire accuracy score boosted by Laser Sights, penalized by Corrupted Barrels, and modified by Splatter Rounds.
 * @param weapon - The raw weapon data object.
 * @param barrelEq - The equipped barrel/laser attachment.
 * @param hopupEq - The equipped hop-up attachment.
 * @returns A StatResult containing base and calculated hipfire accuracy scores (0 to 100).
 */
export const calculateHipfireStat = (
    weapon: WeaponDetails | null | undefined,
    barrelEq: AttachmentItem | null | undefined,
    hopupEq?: AttachmentItem | null | undefined
): StatResult => {
    const rawStr = weapon?.['Hipfire Accuracy']
    const parts = parseMultiStat(rawStr)
    const base = parts[0] || 70
    let current = base

    const isSplatter = isSplatterRounds(hopupEq?.name)

    if (barrelEq) {
        const isLaser = isLaserSight(barrelEq.name)
        const isBarrel = isBarrelStabilizer(barrelEq.name)

        if (isLaser) {
            const idx = rarityToIndex[barrelEq.rarity] ?? 0
            if (parts.length > 1 && idx > 0 && parts[idx] !== undefined) {
                current = parts[idx]
            } else {
                const r = barrelEq.rarity.toLowerCase() as keyof typeof ATTACHMENT_RATIOS.HIPFIRE
                const ratio = ATTACHMENT_RATIOS.HIPFIRE[r] ?? 1.0
                current = Math.min(100, Math.round(base * ratio))
            }
        } else if (isBarrel && barrelEq.rarity === 'corrupted') {
            current = Math.max(0, Math.round(base * ATTACHMENT_RATIOS.CORRUPTED_MODIFIERS.BARREL_HIPFIRE_MULTIPLIER))
        }
    }

    if (isSplatter) {
        const addHip = isWeaponNamed(weapon?.name, 'flatline') ? 9 : 11
        current = Math.min(100, current + addHip)
    }

    return {
        base,
        current,
        isBoosted: current > base,
        isPenalty: current < base
    }
}
