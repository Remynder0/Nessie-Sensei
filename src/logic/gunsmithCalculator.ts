/**
 * ============================================================================
 * NESSIE SENSEI — GUNSMITH CALCULATOR ENGINE (Barrel Re-Export)
 * ============================================================================
 *
 * This file is a backward-compatibility barrel that re-exports all gunsmith
 * logic from the decomposed `src/logic/gunsmith/` modules.
 *
 * All existing imports from '../../logic/gunsmithCalculator' continue to work
 * without any changes.
 *
 * Module Structure:
 * -----------------
 * - gunsmith/types.ts          — Shared interfaces (AttachmentItem, WeaponDetails, StatResult, etc.)
 * - gunsmith/config.ts         — Constants, ratios, seasonal data, consumable regex
 * - gunsmith/attachments.ts    — Attachment parsing, mythic configs, fire modes, turbocharger
 * - gunsmith/statParser.ts     — Stat string parsing (multi-value, mode-aware, damage ranges)
 * - gunsmith/statCalculators.ts — All 9 calculate*Stat functions (Magazine, RPM, DPS, Reload, etc.)
 * ============================================================================
 */

export * from './gunsmith'
