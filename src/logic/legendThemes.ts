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
    'Valkyrie': { primary: '#b45309', secondary: '#facc15' },    // Amber / Yellow
    'Crypto': { primary: '#047857', secondary: '#34d399' },      // Emerald / Light Emerald
    'Pathfinder': { primary: '#1d4ed8', secondary: '#60a5fa' },  // Blue / Light Blue
    'Gibraltar': { primary: '#9a3412', secondary: '#fb923c' },   // Orange-Brown / Bright Orange
    'Lifeline': { primary: '#be185d', secondary: '#2dd4bf' },    // Pink / Teal (Her two main colors)
    'Horizon': { primary: '#312e81', secondary: '#a78bfa' },     // Dark Indigo / Violet
    'Fuse': { primary: '#7f1d1d', secondary: '#fb923c' },        // Dark Red / Orange (Explosions)
    'Revenant': { primary: '#450a0a', secondary: '#dc2626' },    // Very Dark Red / Crimson
    'Loba': { primary: '#831843', secondary: '#fbcfe8' },        // Deep Pink / Soft Pink (White/Gold)
    'Rampart': { primary: '#c2410c', secondary: '#fbbf24' },     // Rust Orange / Yellow
    'Alter': { primary: '#0f766e', secondary: '#2dd4bf' },       // Jade Green / Light Teal
    'Vantage': { primary: '#0369a1', secondary: '#7dd3fc' },     // Sky Blue / Ice Blue
    'Ballistic': { primary: '#3f3f46', secondary: '#fbbf24' },   // Zinc Grey / Gold
    'Mad Maggie': { primary: '#9d174d', secondary: '#fb7185' },  // Magenta / Rose
    'Newcastle': { primary: '#1e3a8a', secondary: '#38bdf8' },   // Royal Blue / Light Blue
    'Ash': { primary: '#1e293b', secondary: '#38bdf8' },         // Slate / Electric Blue
    'Seer': { primary: '#4c1d95', secondary: '#fcd34d' },        // Violet / Gold
    'Wattson': { primary: '#ea580c', secondary: '#3b82f6' },     // Orange / Electric Blue
    'Catalyst': { primary: '#312e81', secondary: '#d8b4fe' },    // Dark Indigo / Soft Purple (Ferrofluid)
    'Caustic': { primary: '#14532d', secondary: '#eab308' },     // Toxic Green / Yellow
    'Bangalore': { primary: '#78350f', secondary: '#f97316' },   // Brown / Orange
    'Mirage': { primary: '#ca8a04', secondary: '#fef08a' },      // Yellow / Bright Yellow
    'Conduit': { primary: '#0284c7', secondary: '#fde047' },     // Ocean Blue / Yellow
    'Sparrow': { primary: '#065f46', secondary: '#34d399' },     // Custom: Emerald
    'Axle': { primary: '#1e293b', secondary: '#f43f5e' },        // Custom: Slate / Rose
};

// Helper to convert hex to rgb string "r, g, b"
export function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` 
        : '45, 212, 191'; // Fallback to titan-cyan
}
