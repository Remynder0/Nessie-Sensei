/**
 * Composable for rarity-based Tailwind CSS class helpers.
 * Shared across all weapon/gunsmith components.
 */
export function useRarityStyles() {
    const getBoxClasses = (rarity: string): string => {
        switch (rarity) {
            case 'common': return 'border-gray-500 shadow-[0_0_10px_rgba(107,114,128,0.2)]'
            case 'rare': return 'border-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.4)]'
            case 'epic': return 'border-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.4)]'
            case 'legendary': return 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.4)]'
            case 'corrupted': return 'border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.6)] glitch-box'
            default: return 'border-gray-600'
        }
    }

    const getIconTintClasses = (rarity: string): string => {
        switch (rarity) {
            case 'common': return 'bg-gray-500/10'
            case 'rare': return 'bg-blue-500/10'
            case 'epic': return 'bg-fuchsia-500/10'
            case 'legendary': return 'bg-yellow-500/10'
            case 'corrupted': return 'bg-red-600/10'
            default: return 'bg-transparent'
        }
    }

    const getTextColor = (rarity: string): string => {
        switch (rarity) {
            case 'common': return 'text-gray-400'
            case 'rare': return 'text-blue-400'
            case 'epic': return 'text-pink-400'
            case 'legendary': return 'text-yellow-400'
            case 'corrupted': return 'text-red-500 font-bold tracking-widest'
            default: return 'text-gray-500'
        }
    }

    return { getBoxClasses, getIconTintClasses, getTextColor }
}
