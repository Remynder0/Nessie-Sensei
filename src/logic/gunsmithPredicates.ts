/**
 * Utility predicates for matching attachment types, names, and categories.
 * Eliminates repetitive string parsing and fragile inline .includes() checks.
 */

const SPLATTER_KEYWORDS = ['splatter', 'graffiti', 'grafiti']
const BARREL_KEYWORDS = ['barrel', 'stabilizer', 'canon']
const LASER_KEYWORDS = ['laser']
const STOCK_KEYWORDS = ['stock', 'cross']
const MAG_KEYWORDS = ['mag', 'chargeur']
const BOLT_KEYWORDS = ['bolt']

const HOPUP_KEYWORDS = [
    'anvil', 'boosted', 'deadeye', 'disruptor', 'double tap',
    'elite', 'redline', 'hammerpoint', 'precision choke', 'selectfire',
    'shatter', 'skullpiercer', 'splatter', 'graffiti', 'grafiti', 'turbocharger'
]

export const isSplatterRounds = (name: string | undefined): boolean => {
    if (!name) return false
    const lower = name.toLowerCase()
    return SPLATTER_KEYWORDS.some(k => lower.includes(k))
}

export const isBarrelStabilizer = (name: string | undefined): boolean => {
    if (!name) return false
    const lower = name.toLowerCase()
    return BARREL_KEYWORDS.some(k => lower.includes(k))
}

export const isLaserSight = (name: string | undefined): boolean => {
    if (!name) return false
    const lower = name.toLowerCase()
    return LASER_KEYWORDS.some(k => lower.includes(k))
}

export const isStockAttachment = (name: string | undefined): boolean => {
    if (!name) return false
    const lower = name.toLowerCase()
    return STOCK_KEYWORDS.some(k => lower.includes(k))
}

export const isMagazineAttachment = (name: string | undefined): boolean => {
    if (!name) return false
    const lower = name.toLowerCase()
    return MAG_KEYWORDS.some(k => lower.includes(k))
}

export const isBoltAttachment = (name: string | undefined): boolean => {
    if (!name) return false
    const lower = name.toLowerCase()
    return BOLT_KEYWORDS.some(k => lower.includes(k))
}

export const isHopUpItem = (name: string | undefined, category?: string): boolean => {
    if (category === 'Hop-Ups' || category === 'Hop-Up') return true
    if (!name) return false
    const lower = name.toLowerCase()
    return HOPUP_KEYWORDS.some(k => lower.includes(k))
}

export const isWeaponNamed = (weaponName: string | undefined, targetKey: string): boolean => {
    if (!weaponName) return false
    return weaponName.toLowerCase().includes(targetKey.toLowerCase())
}
