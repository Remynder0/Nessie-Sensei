/**
 * Weapon-related TypeScript interfaces.
 *
 * `WeaponDetails` and `AttachmentItem` are defined in gunsmithCalculator.ts
 * and re-exported here for convenience.
 */
export { type WeaponDetails, type AttachmentItem, type AttachmentGroup } from '../logic/gunsmithCalculator'

/** Summary entry coming from /data/weapons.json */
export interface WeaponSummary {
    name: string
    shortname?: string
    Type: string
    Ammo?: string
}
