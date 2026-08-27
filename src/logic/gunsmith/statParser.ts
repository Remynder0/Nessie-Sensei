/**
 * ============================================================================
 * GUNSMITH — STAT PARSING UTILITIES
 * ============================================================================
 *
 * Pure functions for extracting and parsing raw stat values from weapon JSON:
 * - Multi-tier stat string parsing ("10 / 12 / 14 / 16 / 20" → number[])
 * - Mode-aware stat string extraction (Akimbo, Amped, Breach, Consumable)
 * - Damage range parsing ("35 - 60" → {min, max})
 * - Headshot multiplier extraction
 *
 * These utilities are consumed by both `attachments.ts` and `statCalculators.ts`.
 * ============================================================================
 */

import type { WeaponDetails } from './types'
import { CONSUMABLE_REGEX } from './config'

// ---------------------------------------------------------------------------
// Multi-Value Stat Parsing
// ---------------------------------------------------------------------------

/**
 * Parses slash-delimited or whitespace-separated stat strings into numeric arrays.
 *
 * @example
 * parseMultiStat("10 / 12 / 14 / 16 / 20") // → [10, 12, 14, 16, 20]
 * parseMultiStat("300 900")                   // → [300, 900]
 * parseMultiStat(undefined)                   // → []
 *
 * @param val - The raw stat string from weapon JSON data.
 * @returns An array of parsed numeric values, empty if input is undefined or unparseable.
 */
export const parseMultiStat = (val: string | undefined): number[] => {
    if (!val) return []
    const str = val.trim()
    if (str.includes('/')) {
        return str.split('/').map(v => parseFloat(v.trim())).filter(n => !isNaN(n))
    }
    if (str.includes('–') || str.includes('—') || (str.includes('-') && !str.startsWith('-'))) {
        return str.split(/[\s–—\-]+/).map(v => parseFloat(v.trim())).filter(n => !isNaN(n))
    }
    const numbers = str.split(/\s+/).map(v => parseFloat(v)).filter(n => !isNaN(n))
    return numbers
}

// ---------------------------------------------------------------------------
// Mode-Aware Stat String Extraction
// ---------------------------------------------------------------------------

/**
 * Extracts the effective stat substring based on active weapon mode flags.
 *
 * Handles three types of mode suffixes in stat strings:
 * 1. **Breach Mode**: `"21 (Breach: 4-38)"` → extracts `"4-38"` or `"21"`
 * 2. **Consumable Mode**: `"40 (Frag: 7)"` → extracts `"7"` or `"40"`
 * 3. **Akimbo Mode**: `"20 (Akimbo: 15)"` → extracts `"15"` or `"20"`
 *
 * @param statStr - The raw stat string containing possible mode substrings.
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

    // 2. Generic Consumable Mode: matches "(Frag: ...)", "(Cell: ...)", "(Thermite: ...)", etc.
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

// ---------------------------------------------------------------------------
// Damage Parsing
// ---------------------------------------------------------------------------

/**
 * Parses numeric damage strings and hyphenated damage ranges into min and max bounds.
 *
 * @example
 * getDamageRange("35 - 60") // → { min: 35, max: 60, isRange: true }
 * getDamageRange("75")      // → { min: 75, max: 75, isRange: false }
 *
 * @param val - The raw damage string from weapon JSON data.
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
 *
 * @param weapon - The weapon data object.
 * @returns The numeric headshot multiplier (defaults to 1.5 if unspecified or invalid).
 */
export const getBaseHeadshotMultiplier = (weapon: WeaponDetails | null | undefined): number => {
    if (!weapon?.Damage?.['Head Multiplier']) return 1.5
    const mult = parseFloat(weapon.Damage['Head Multiplier'])
    return (!isNaN(mult) && mult > 0) ? mult : 1.5
}
