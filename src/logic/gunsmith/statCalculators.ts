/**
 * ============================================================================
 * GUNSMITH — STAT CALCULATION ENGINE
 * ============================================================================
 *
 * All 9 stat calculation functions that transform raw weapon data + equipped
 * attachments into normalized StatResult objects for reactive UI binding.
 *
 * Calculation Lifecycle (4 Key Steps):
 * ------------------------------------
 * 1. [Raw Data Extraction] — `getEffectiveStatString` extracts the active string
 *    variant based on mode (Single vs. Akimbo, Standard vs. Amped/Cell/Frag).
 * 2. [Multi-Stat Parsing] — `parseMultiStat` parses multi-tier slash-delimited
 *    values into indexable numeric arrays.
 * 3. [Order of Operations] — Applies stat modifiers with strict precedence
 *    (see individual function docs for detailed order).
 * 4. [Output Normalization] — Returns a standardized `StatResult` with base,
 *    current, isBoosted, isPenalty for direct reactive UI binding.
 *
 * This module depends on:
 * - `types.ts` for interfaces
 * - `config.ts` for ratio constants and rarity mappings
 * - `statParser.ts` for value extraction utilities
 * - `attachments.ts` for turbocharger detection
 * - `gunsmithPredicates.ts` for attachment identification
 * ============================================================================
 */

import { isSplatterRounds, isBarrelStabilizer, isLaserSight, isWeaponNamed } from '../gunsmithPredicates'
import type { WeaponDetails, AttachmentItem, StatResult, RarityRatioTable } from './types'
import {
    ATTACHMENT_RATIOS,
    SNIPER_STOCK_ROF_RATIOS,
    rarityToIndex,
    rarityToMagIndex,
    isSniperStock,
    getStockHandlingRatios,
    getStockReloadRatios
} from './config'
import { parseMultiStat, getEffectiveStatString, getDamageRange, getBaseHeadshotMultiplier } from './statParser'
import { isTurbochargerEquipped } from './attachments'

// ---------------------------------------------------------------------------
// Magazine Capacity
// ---------------------------------------------------------------------------

/**
 * Computes final magazine capacity considering:
 * - Mag attachment bonuses (tiered by rarity)
 * - Corrupted Stock penalties (Standard = base mag only, Sniper = total mag)
 * - Splatter Rounds (+2 bullets added last)
 * - Akimbo/Consumable mode base adjustments
 *
 * Order of operations: Base → Mag bonus → Stock penalty → Splatter (+2)
 *
 * @param weapon - The raw weapon data object.
 * @param equipped - The dictionary of currently equipped attachments by slot.
 * @param isAkimbo - Whether Akimbo dual-wield mode is active.
 * @param isAmped - Whether consumable energized mode is active.
 * @param isBreach - Whether Breach underbarrel mode is active.
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
    const singleParts = singleMagStr.split(/\s*\/\s*/).map((v: string) => parseFloat(v.trim()))
    const base = singleParts[0] || 0
    if (base === 0) return { base: 0, current: 0, isBoosted: false, isPenalty: false }

    // Breach mode: magazine is always 1 (single grenade)
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
    const effectiveParts = effectiveMagStr.split(/\s*\/\s*/).map((v: string) => parseFloat(v.trim()))
    const effectiveBase = effectiveParts[0] || base

    let magBonus = 0
    let stockPenalty = 0

    const magEq = equipped['mag']
    const stockEq = equipped['stock']
    const hopupEq = equipped['hopup'] || equipped['other']
    const isSplatter = isSplatterRounds(hopupEq?.name)

    // 1. Calculate mag attachment bonus
    if (magEq) {
        if (magEq.rarity === 'corrupted') {
            // Corrupted mag: take the last value in the multi-stat array
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

    // 3. Splatter Rounds (+2 bullets) is added AT THE VERY END
    if (isSplatter) {
        current += 2
    }

    return {
        base,
        current,
        isBoosted: current > base,
        isPenalty: current < base,
        tooltipKey: 'weapons.tooltipMag'
    }
}

// ---------------------------------------------------------------------------
// Rate of Fire (RPM)
// ---------------------------------------------------------------------------

/**
 * Computes weapon Rate of Fire (RPM) incorporating:
 * - Shotgun Bolt RPM tiers
 * - Multi-fire mode selection (e.g. Prowler Burst/Auto)
 * - Corrupted Sniper Stock ROF boost (weapon-specific multipliers)
 * - Special curves for Devotion (300-900) and Nemesis (451-582)
 * - Turbocharger interactions
 *
 * @param weapon - The raw weapon data object.
 * @param equipped - The dictionary of currently equipped attachments by slot.
 * @param isAkimbo - Whether Akimbo dual-wield mode is active.
 * @param isAmped - Whether consumable energized mode is active.
 * @param selectedFireModeIndex - The index of the active fire mode.
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

    // --- Special Devotion RPM curve (300-900 base, 408-900 with Turbocharger) ---
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
            baseMinVal: baseMin,
            isBoosted: isTurbo,
            isPenalty: false,
            displayString: `${currentMin}–${currentMax}`,
            baseDisplayString: `${baseMin}–${baseMax}`,
            tooltipKey: isTurbo ? 'weapons.tooltipDevotionRpmTurbo' : 'weapons.tooltipDevotionRpm'
        }
    }

    // --- Special Nemesis RPM curve (451-582 base, max 582 direct with Turbocharger) ---
    if (isWeaponNamed(weapon?.name, 'nemesis')) {
        const baseMin = 451
        const baseMax = 582
        return {
            base: isTurbo ? baseMin : baseMax,
            current: baseMax,
            minVal: isTurbo ? baseMax : baseMin,
            maxVal: baseMax,
            baseMinVal: baseMin,
            isBoosted: isTurbo,
            isPenalty: false,
            displayString: isTurbo ? '582' : `${baseMin}–${baseMax}`,
            baseDisplayString: `${baseMin}–${baseMax}`,
            tooltipKey: isTurbo ? 'weapons.tooltipNemesisRpmTurbo' : 'weapons.tooltipNemesisRpm'
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
            const index = Math.min(rarityToIndex[boltEq.rarity] || 0, effectiveRpmValues.length - 1)
            current = effectiveRpmValues[index]
        }
    } else if (effectiveRpmValues.length > 1 && !isAmped) {
        // Multi-firemode weapon (e.g. Prowler "579/795", Charge Rifle "26 / 84")
        if (selectedFireModeIndex > 0 && effectiveRpmValues[selectedFireModeIndex] !== undefined) {
            current = effectiveRpmValues[selectedFireModeIndex]
        }
    }

    // 2. Corrupted Sniper Stock ROF boost (weapon-specific multipliers or default fallback)
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

    const isHavoc = isWeaponNamed(weapon?.name, 'havoc')
    const tooltipKey = isHavoc
        ? (isTurbo ? 'weapons.tooltipHavocRpmTurbo' : 'weapons.tooltipHavocRpm')
        : 'weapons.tooltipRpm'

    return {
        base,
        current,
        isBoosted: current > base,
        isPenalty: current < base,
        tooltipKey
    }
}

// ---------------------------------------------------------------------------
// Spin-Up / Wind-Up
// ---------------------------------------------------------------------------

/**
 * Computes spin-up / wind-up delay in seconds for weapons with charge mechanics (Devotion).
 * Returns null for weapons without spin-up mechanics.
 *
 * @param weapon - The raw weapon data object.
 * @param equipped - The dictionary of currently equipped attachments by slot.
 * @returns A StatResult with labelKey if the weapon has a spin-up mechanic, or null.
 */
export const calculateSpinUpStat = (
    weapon: WeaponDetails | null | undefined,
    equipped: Record<string, AttachmentItem | null>
): (StatResult & { labelKey: string }) | null => {
    if (!weapon?.name) return null
    const isTurbo = isTurbochargerEquipped(equipped)

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
            labelKey: 'weapons.spinUpTime',
            tooltipKey: isTurbo ? 'weapons.tooltipDevotionRpmTurbo' : 'weapons.tooltipDevotionRpm'
        }
    }

    return null
}

// ---------------------------------------------------------------------------
// Headshot Damage
// ---------------------------------------------------------------------------

/**
 * Computes headshot damage values incorporating:
 * - Corrupted Barrel Stabilizer (+20% headshot multiplier)
 * - Skullpiercer Hop-Up (+35% headshot multiplier)
 * - Explosive fragment calculations (e.g. "50 (+25)")
 * - Breach mode (uniform explosive damage, no headshot multiplier)
 *
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

    // Breach mode: explosive damage is uniform (no headshot multiplier)
    if (isBreach) {
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

    // Handle explosive fragment format: "50 (+25)"
    if (effectiveBodyStr.includes('(+')) {
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

    // Standard damage range
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

// ---------------------------------------------------------------------------
// DPS (Damage Per Second)
// ---------------------------------------------------------------------------

/**
 * Computes Damage Per Second (DPS) based on effective RPM, body damage ranges,
 * and weapon-specific charge curves.
 *
 * Handles special cases for:
 * - Charged weapons (30-30 Repeater, Bocek): use 60 RPM for charged shots
 * - Devotion spin-up curve: 80-240 DPS (109-240 with Turbocharger)
 * - Nemesis charge curve: 128-165 DPS (165 with Turbocharger)
 * - Bocek Frag mode: fixed 125 DPS
 * - Sentinel Amped mode: 1.25x body damage multiplier
 *
 * @param weapon - The raw weapon data object.
 * @param effectiveRpm - The active calculated RPM.
 * @param baseRpm - The un-boosted base RPM.
 * @param isAmped - Whether consumable energized mode is active.
 * @param isBreach - Whether Breach underbarrel launcher mode is active.
 * @param isTurbo - Whether Turbocharger is equipped.
 * @returns A StatResult containing base and calculated DPS values.
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

    // Breach mode: single-shot explosive, DPS = body damage
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

    // Helper: extract total body damage including explosive fragments
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

    // Identify weapons with special DPS curves
    const is3030 = isWeaponNamed(weapon.name, '30-30')
    const isBocek = isWeaponNamed(weapon.name, 'bocek')
    const isDevotion = isWeaponNamed(weapon.name, 'devotion')
    const isNemesis = isWeaponNamed(weapon.name, 'nemesis')

    // --- Unamped base DPS range ---
    const baseChargedRpm = (is3030 || isBocek) ? 60 : baseRpm
    let baseMinDps = (baseRange.min > 0 && baseRpm > 0) ? Math.round(baseRange.min * (baseRpm / 60)) : 0
    let baseMaxDps = (baseRange.max > 0 && baseChargedRpm > 0) ? Math.round(baseRange.max * (baseChargedRpm / 60)) : 0

    // Override with known fixed DPS curves
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

    // --- Current DPS calculation ---
    let minDps = 0
    let maxDps = 0

    if (isAmped && isBocek && activeRange.isFrag) {
        // Frag mode on Bocek: single fixed charged DPS = 125
        minDps = 125
        maxDps = 125
    } else if (isAmped && isWeaponNamed(weapon.name, 'sentinel')) {
        // Amped Sentinel: 1.25x body damage multiplier
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

    const base = (isTurbo && isNemesis) ? baseMinDps : (baseUpper || parseFloat(weapon?.DPS || '0'))
    const current = upperDps || base

    const isBoosted = current > baseUpper || isAmped || (isDevotion && isTurbo) || (isNemesis && isTurbo)
    const isRange = (activeRange.isRange && !activeRange.isFrag) || isDevotion || (isNemesis && !isTurbo)

    // Select appropriate tooltip key
    let tooltipKey: string | undefined = undefined
    if (isNemesis) tooltipKey = isTurbo ? 'weapons.tooltipNemesisDpsTurbo' : 'weapons.tooltipNemesisDps'
    else if (isDevotion) tooltipKey = isTurbo ? 'weapons.tooltipDevotionDpsTurbo' : 'weapons.tooltipDevotionDps'
    else if (isWeaponNamed(weapon?.name, 'havoc')) tooltipKey = isTurbo ? 'weapons.tooltipHavocDpsTurbo' : 'weapons.tooltipHavocDps'
    else if (is3030) tooltipKey = 'weapons.tooltip3030'
    else if (isBocek) tooltipKey = 'weapons.tooltipBocek'
    else tooltipKey = 'weapons.tooltipDps'

    if (isRange) {
        return {
            base: baseUpper,
            current: upperDps,
            minVal: lowerDps,
            maxVal: upperDps,
            baseMinVal: isDevotion ? baseMinDps : undefined,
            isBoosted,
            isPenalty: false,
            displayString: `${lowerDps} - ${upperDps}`,
            baseDisplayString,
            tooltipKey
        }
    }

    return {
        base,
        current: upperDps,
        minVal: lowerDps,
        maxVal: upperDps,
        baseMinVal: isNemesis ? baseMinDps : undefined,
        isBoosted,
        isPenalty: current < baseUpper,
        displayString: String(upperDps),
        baseDisplayString,
        tooltipKey
    }
}

// ---------------------------------------------------------------------------
// Reload Time
// ---------------------------------------------------------------------------

/**
 * Computes reload time incorporating:
 * - Corrupted Mag penalty (extended base reload)
 * - Corrupted Laser reload boost (0.60 multiplier)
 * - Splatter Rounds reload bonus (0.80 multiplier, applied FIRST)
 * - Stock reload ratio (applied SECOND on top)
 *
 * Order of operations: Base → Corrupted Mag → Corrupted Laser → Splatter → Stock ratio
 *
 * @param statStr - The raw reload time string (e.g. "3.0 / 4.1").
 * @param _weapon - The raw weapon data object (reserved for future use).
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
    _weapon: WeaponDetails | null | undefined,
    magEq: AttachmentItem | null | undefined,
    stockEq: AttachmentItem | null | undefined,
    barrelEq: AttachmentItem | null | undefined,
    isAkimbo: boolean = false,
    hopupEq?: AttachmentItem | null | undefined,
    isBreach: boolean = false
): StatResult => {
    if (!statStr) return { base: 0, current: 0, isBoosted: false, isPenalty: false }
    const singleStatStr = getEffectiveStatString(statStr, false, false, false)
    const singleParts = singleStatStr.split(/\s*\/\s*/).map(p => parseFloat(p.trim())).filter(n => !isNaN(n))
    const rawBase = singleParts[0] || 0
    if (rawBase === 0) return { base: 0, current: 0, isBoosted: false, isPenalty: false }

    const effectiveStatStr = getEffectiveStatString(statStr, isAkimbo, false, isBreach)
    if (!effectiveStatStr) return { base: 0, current: 0, isBoosted: false, isPenalty: false }

    // Breach mode: fixed cooldown
    if (isBreach) {
        const val = parseFloat(effectiveStatStr) || 30
        return {
            base: val,
            current: val,
            isBoosted: false,
            isPenalty: false,
            displayString: String(val)
        }
    }

    const effectiveParts = effectiveStatStr.split(/\s*\/\s*/).map(p => parseFloat(p.trim())).filter(n => !isNaN(n))
    const effectiveBase = effectiveParts[0] || rawBase

    // 1. Determine base reload time (incorporating Corrupted Mag penalty if equipped)
    let currentBase = effectiveBase

    if (magEq?.rarity === 'corrupted') {
        if (effectiveParts.length > 1) {
            const magVal = effectiveParts[effectiveParts.length - 1]
            if (magVal !== undefined && !isNaN(magVal) && magVal > effectiveBase) {
                currentBase = magVal
            }
        }
    }

    // 2. Corrupted Laser reload time boost (e.g. 2.1 → 1.3, multiplier 0.60)
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
        isPenalty: current > rawBase,
        tooltipKey: isBreach ? 'weapons.tooltipBreachReload' : 'weapons.tooltipReload'
    }
}

// ---------------------------------------------------------------------------
// Weapon Handling
// ---------------------------------------------------------------------------

/**
 * Computes weapon handling score scaled by:
 * - Splatter Rounds flat boost (+7, or +11 for Flatline) — applied FIRST
 * - Stock multiplier (tiered by rarity, Sniper vs Standard) — applied SECOND
 *
 * Uses multi-value stat strings when available, falls back to ratio multipliers.
 *
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

    // 2. Stock multiplier applies SECOND on top
    if (stockEq) {
        const idx = rarityToIndex[stockEq.rarity] ?? 0
        if (parts.length > 1 && idx > 0 && parts[idx] !== undefined) {
            // Use explicit multi-value stat when available
            current = parts[idx] + (isSplatter ? (isFlatline ? 11 : 7) : 0)
        } else {
            // Fall back to ratio multiplier
            const r = stockEq.rarity.toLowerCase() as keyof RarityRatioTable
            const ratio = getStockHandlingRatios(stockEq.name)[r] ?? 1.0
            current = Math.min(100, Math.round(current * ratio))
        }
    }

    return {
        base,
        current,
        isBoosted: current > base,
        isPenalty: current < base,
        tooltipKey: 'weapons.tooltipHandling'
    }
}

// ---------------------------------------------------------------------------
// Recoil Control
// ---------------------------------------------------------------------------

/**
 * Computes recoil control score incorporating:
 * - Barrel Stabilizer boost (tiered ratios or explicit multi-value stats)
 * - Corrupted Laser penalty (-20% recoil control)
 * - Splatter Rounds Flatline bonus (+12)
 *
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
            // Corrupted Laser: -20% recoil control penalty
            current = Math.max(0, Math.round(base * ATTACHMENT_RATIOS.CORRUPTED_MODIFIERS.LASER_RECOIL_MULTIPLIER))
        }
    }

    // Splatter Rounds: +12 recoil control for Flatline only
    if (isSplatter && isWeaponNamed(weapon?.name, 'flatline')) {
        current = Math.min(100, current + 12)
    }

    return {
        base,
        current,
        isBoosted: current > base,
        isPenalty: current < base,
        tooltipKey: 'weapons.tooltipRecoil'
    }
}

// ---------------------------------------------------------------------------
// Hipfire Accuracy
// ---------------------------------------------------------------------------

/**
 * Computes hipfire accuracy score incorporating:
 * - Laser Sight boost (tiered ratios or explicit multi-value stats)
 * - Corrupted Barrel penalty (-20% hipfire accuracy)
 * - Splatter Rounds bonus (+9 for Flatline, +11 for others)
 *
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
            // Corrupted Barrel: -20% hipfire accuracy penalty
            current = Math.max(0, Math.round(base * ATTACHMENT_RATIOS.CORRUPTED_MODIFIERS.BARREL_HIPFIRE_MULTIPLIER))
        }
    }

    // Splatter Rounds: +9 for Flatline, +11 for others
    if (isSplatter) {
        const addHip = isWeaponNamed(weapon?.name, 'flatline') ? 9 : 11
        current = Math.min(100, current + addHip)
    }

    return {
        base,
        current,
        isBoosted: current > base,
        isPenalty: current < base,
        tooltipKey: 'weapons.tooltipHipfire'
    }
}
