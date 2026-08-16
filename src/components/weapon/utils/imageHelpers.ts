/**
 * Shared image utility helpers for weapon/ components.
 * Eliminates duplication of hideImageOnError and formatAttachmentImg across 4 files.
 */

import { isSplatterRounds } from '../../../logic/gunsmithPredicates'

/** Hides an <img> element when its source fails to load. */
export function hideImageOnError(event: Event): void {
    const img = event.target as HTMLImageElement
    if (img) img.style.display = 'none'
}

/**
 * Converts an attachment display name to its corresponding SVG filename.
 * Strips rarity suffixes in parentheses and normalizes Splatter Rounds variants.
 */
export function formatAttachmentImg(name: string): string {
    let base = name.split(' (')[0]
    base = base.replace(/"/g, '')
    if (isSplatterRounds(base)) {
        base = 'Splatter Rounds'
    }
    return base.replace(/ /g, '_')
}
