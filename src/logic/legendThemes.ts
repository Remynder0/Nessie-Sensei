export interface LegendTheme {
    primary: string;   // Main color (used for background tints, large glows)
    secondary: string; // Accent color (used for text, active tabs, buttons)
}

// Fallback theme (Titanfall style cyan/orange)
export const defaultTheme: LegendTheme = {
    primary: '#2dd4bf', // titan-cyan
    secondary: '#ffa500' // titan-orange
};

// Hand-picked color palettes for each legend based on their iconic look
export const legendThemes: Record<string, LegendTheme> = {
    'Wraith': { primary: '#6d28d9', secondary: '#c084fc' },      // Deep Purple / Light Purple
    'Octane': { primary: '#166534', secondary: '#4ade80' },      // Dark Green / Neon Green
    'Bloodhound': { primary: '#991b1b', secondary: '#f87171' },  // Blood Red / Bright Red
    'Valkyrie': { primary: '#7e22ce', secondary: '#e879f9' },    // Deep Purple / Fuchsia (was amber/yellow)
    'Crypto': { primary: '#047857', secondary: '#34d399' },      // Emerald / Light Emerald
    'Pathfinder': { primary: '#1d4ed8', secondary: '#60a5fa' },  // Blue / Light Blue
    'Gibraltar': { primary: '#9a3412', secondary: '#fb923c' },   // Orange-Brown / Bright Orange
    'Lifeline': { primary: '#be185d', secondary: '#f9a8d4' },    // Deep Pink / Light Pink (nuance, was pink/teal)
    'Horizon': { primary: '#172554', secondary: '#93c5fd' },     // Deep Navy Blue / Bright Sky Blue (was indigo/violet)
    'Loba': { primary: '#831843', secondary: '#d4af37' },        // Deep Rose / Gold (was rose/soft-pink)
    'Fuse': { primary: '#7f1d1d', secondary: '#ef4444' },        // Dark Red / Red-Orange (was dupe of Gibraltar)
    'Revenant': { primary: '#1e293b', secondary: '#dc2626' },    // Slate (same as Ash — simulacrum link) / Dark Red (assassin)
    'Rampart': { primary: '#c2410c', secondary: '#fbbf24' },     // Rust Orange / Yellow
    'Alter': { primary: '#0f766e', secondary: '#5eead4' },       // Jade Green / Ice Teal (was dupe of Lifeline)
    'Vantage': { primary: '#0369a1', secondary: '#7dd3fc' },     // Sky Blue / Ice Blue
    'Ballistic': { primary: '#3f3f46', secondary: '#e4e4e7' },   // Zinc Grey / Metallic White (was dupe of Rampart)
    'Mad Maggie': { primary: '#b91c1c', secondary: '#fdba74' },  // Explosive Red / Warm Orange (kin with Fuse, was pink/rose)
    'Newcastle': { primary: '#1e3a8a', secondary: '#38bdf8' },   // Royal Blue / Light Blue
    'Ash': { primary: '#1e293b', secondary: '#818cf8' },         // Slate / Electric Indigo (was dupe of Newcastle)
    'Seer': { primary: '#4c1d95', secondary: '#fcd34d' },        // Violet / Gold
    'Wattson': { primary: '#0ea5e9', secondary: '#67e8f9' },     // Bright Light Blue / Electric Cyan (was orange/blue)
    'Catalyst': { primary: '#312e81', secondary: '#d8b4fe' },    // Dark Indigo / Soft Purple (Ferrofluid)
    'Caustic': { primary: '#14532d', secondary: '#eab308' },     // Toxic Green / Yellow
    'Bangalore': { primary: '#78350f', secondary: '#f97316' },   // Brown / Orange
    'Mirage': { primary: '#ca8a04', secondary: '#fef08a' },      // Yellow / Bright Yellow
    'Conduit': { primary: '#65a30d', secondary: '#facc15' },     // Radioactive Green / Vivid Yellow (Latin American flag colours, was blue/yellow)
    'Sparrow': { primary: '#065f46', secondary: '#6ee7b7' },     // Custom: Emerald / Light Mint (was dupe of Crypto)
    'Axle': { primary: '#1e1b4b', secondary: '#71717a' },        // Violet-Black / Gunmetal Grey (was slate/rose)
};

// Helper to convert hex to rgb string "r, g, b"
export function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
    }
    // Derived from defaultTheme instead of a hardcoded duplicate, so it can
    // never silently drift out of sync if defaultTheme.primary ever changes.
    return hexToRgb(defaultTheme.primary);
}

// Dev-only helper: call once legend data is loaded (e.g. in store.ts after
// the fetch resolves) to catch legends silently falling back to the default
// theme — a typo in a legend name here would otherwise fail silently.
export function warnMissingThemes(legendNames: string[]): void {
    if (!import.meta.env?.DEV) return;
    const missing = legendNames.filter(name => !legendThemes[name]);
    if (missing.length > 0) {
        console.warn('[legendThemes] No dedicated theme for:', missing);
    }
}