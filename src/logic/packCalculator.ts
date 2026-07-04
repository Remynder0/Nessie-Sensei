export function calculatePrestige0Packs(level: number): number {
    let packs = 0;
    if (level >= 2) {
        packs += Math.min(level, 20) - 1;
    }
    if (level >= 22) {
        packs += Math.floor((Math.min(level, 300) - 20) / 2);
    }
    if (level >= 305) {
        packs += Math.floor((Math.min(level, 500) - 300) / 5);
    }
    return packs;
}

export function calculatePrestigePacks(level: number): number {
    let packs = 0;
    const l = Math.min(level, 500);
    if (l > 0) packs += Math.floor(Math.min(l, 100) / 10);
    if (l > 100) packs += Math.round((Math.min(l, 200) - 100) * 0.13);
    if (l > 200) packs += Math.round((Math.min(l, 300) - 200) * 0.17);
    if (l > 300) packs += Math.round((Math.min(l, 400) - 300) * 0.25);
    if (l > 400) packs += Math.round((Math.min(l, 500) - 400) * 0.50);
    return packs;
}

export function calculateAccountLevelPacks(level: number, prestige: number): number {
    let totalPacks = 0;
    if (prestige === 0) {
        totalPacks += calculatePrestige0Packs(level);
    } else {
        totalPacks += 199;
        for (let i = 1; i < prestige; i++) {
            totalPacks += 115;
        }
        totalPacks += calculatePrestigePacks(level);
    }
    return totalPacks;
}

export interface SeasonData {
    id: string;
    name: string;
    level: number;
    maxLevel: number;
    purchased: boolean;
    weaponSkin: string;
}

const seasonDataFiles: Record<string, any> = import.meta.glob('../../public/data/seasons/*.json', { eager: true });

export function getParsedSeasonData(seasonId: string): any {
    const cleanId = seasonId.replace('s', '');
    const jsonPath = `../../public/data/seasons/season_${cleanId}.json`;
    return seasonDataFiles[jsonPath]?.default || seasonDataFiles[jsonPath];
}

const WEAPONS = ['R-301', 'R-99', 'Flatline', 'Hemlok', 'Havoc', 'HAVOC', 'Nemesis', 'Alternator', 'Prowler', 'Volt', 'C.A.R.', 'Devotion', 'L-STAR', 'Spitfire', 'Rampage', 'G7 Scout', 'Triple Take', '30-30', 'Bocek', 'Charge Rifle', 'Longbow', 'Kraber', 'Sentinel', 'EVA-8', 'Mastiff', 'Peacekeeper', 'Mozambique', 'RE-45', 'P2020', 'Wingman'];

function extractWeaponSkin(items: string[], fallbackId: string): string {
    // Some seasons on the wiki lack the weapon name entirely. We keep a mini fallback for those known exceptions.
    const fallbacks: Record<string, string> = {
        "14": "Triple Take : Lucky Draw",
        "24_2": "Inconnu"
    };
    if (fallbacks[fallbackId]) return fallbacks[fallbackId];

    for (const item of items) {
        if (item.includes('XP Boost') || item.includes('Apex Coin') || item.includes('Crafting') || item.includes('Apex Pack') || item.includes('Banner Frame') || item.includes('Holospray') || item.includes('Tracker')) continue;
        
        for (const w of WEAPONS) {
            if (item.toUpperCase().includes(w.toUpperCase())) {
                let skinStr = item;
                // Clean up prefixes and suffixes
                skinStr = skinStr.replace(/Legendary Hunt Themed Event /i, '');
                skinStr = skinStr.replace(/M600 /i, '').replace(/ Burst AR/i, '').replace(/ SMG/i, '').replace(/ LMG/i, '').replace(/ Auto/i, '').replace(/ Carbine/i, '').replace(/ DMR/i, '').replace(/ EMG/i, '').replace(/ PDW/i, '').replace(/ Compound Bow/i, '').replace(/ .50-Cal Sniper/i, '').replace(/ Rifle/i, '').replace(/ Repeater/i, '').replace(/ VK-47/i, '');
                
                // Format the colon properly
                if (skinStr.toLowerCase().includes('skin:')) {
                    skinStr = skinStr.replace(/skin:\s*/i, ' : ');
                } else if (!skinStr.includes(':')) {
                    const regex = new RegExp(`(${w})\\s+(.*)`, 'i');
                    skinStr = skinStr.replace(regex, '$1 : $2');
                }
                
                return skinStr.trim();
            }
        }
    }
    
    // If no explicit weapon found, find the first item that is not a known legend and not garbage
    const LEGENDS = ['Bloodhound', 'Gibraltar', 'Lifeline', 'Pathfinder', 'Wraith', 'Bangalore', 'Caustic', 'Mirage', 'Octane', 'Wattson', 'Crypto', 'Revenant', 'Loba', 'Rampart', 'Horizon', 'Fuse', 'Valkyrie', 'Seer', 'Ash', 'Mad Maggie', 'Newcastle', 'Vantage', 'Catalyst', 'Ballistic', 'Conduit', 'Alter', 'Axle'];
    for (const item of items) {
        if (item.includes('XP Boost') || item.includes('Apex Coin') || item.includes('Crafting') || item.includes('Apex Pack') || item.includes('Banner') || item.includes('Holospray') || item.includes('Tracker')) continue;
        
        let isLegend = false;
        for (const l of LEGENDS) {
            if (item.toUpperCase().includes(l.toUpperCase())) isLegend = true;
        }
        if (!isLegend) {
            return item;
        }
    }

    return "Inconnu";
}

export function generateSeasons(): SeasonData[] {
    const seasons: SeasonData[] = [];
    
    for (let i = 1; i <= 21; i++) {
        const id = `s${i}`;
        const data = getParsedSeasonData(id);
        let skinName = "Inconnu";
        
        // Reactive is at level 100 or 110
        if (data?.rewards?.level_100?.premium) {
            skinName = extractWeaponSkin(data.rewards.level_100.premium, `${i}`);
        }
        if (skinName === "Inconnu" && data?.rewards?.level_110?.premium) {
            skinName = extractWeaponSkin(data.rewards.level_110.premium, `${i}`);
        }
        const weaponSkin = `${skinName}`;

        seasons.push({
            id,
            name: `Saison ${i}`,
            level: 0,
            maxLevel: 110,
            purchased: false,
            weaponSkin
        });
    }

    for (let i = 22; i <= 29; i++) {
        for (let split = 1; split <= 2; split++) {
            const id = `s${i}_${split}`;
            const key = `${i}_${split}`;
            const data = getParsedSeasonData(id);
            let skinName = "Inconnu";
            
            // Reactive is at level 60 for new split passes
            if (data?.rewards?.level_60?.premium) {
                skinName = extractWeaponSkin(data.rewards.level_60.premium, key);
            }
            const weaponSkin = `${skinName}`;

            seasons.push({
                id: id,
                name: `Saison ${i} (S${split})`,
                level: 0,
                maxLevel: 60,
                purchased: false,
                weaponSkin
            });
        }
    }
    
    return seasons;
}

export function calculateSeasonPacks(seasonId: string, level: number, purchased: boolean, maxLevel: number): number {
    const cleanId = seasonId.replace('s', '');
    const jsonPath = `../../public/data/seasons/season_${cleanId}.json`;
    
    if (seasonDataFiles[jsonPath]) {
        const data = seasonDataFiles[jsonPath].default || seasonDataFiles[jsonPath];
        const rewards = data.rewards;
        let total = 0;
        
        for (let l = 1; l <= level; l++) {
            const levelData = rewards[`level_${l}`];
            if (levelData) {
                if (levelData.free) {
                    total += levelData.free.filter((r: string) => r.includes('Apex Pack')).length;
                }
                if (purchased && levelData.premium) {
                    total += levelData.premium.filter((r: string) => r.includes('Apex Pack')).length;
                }
            }
        }
        return total;
    }

    if (maxLevel === 110) {
        const freeLevels = [3, 7, 13, 27, 33, 43, 53];
        const premiumLevels = [5, 12, 25, 41, 57, 63, 85];
        
        let total = 0;
        for(const l of freeLevels) {
            if (level >= l) total++;
        }
        if (purchased) {
            for(const l of premiumLevels) {
                if (level >= l) total++;
            }
        }
        return total;
    } else {
        const freeLevels = [5, 15, 25, 35, 45];
        const premiumLevels = [10, 20, 30, 40, 50];
        
        let total = 0;
        for(const l of freeLevels) {
            if (level >= l) total++;
        }
        if (purchased) {
            for(const l of premiumLevels) {
                if (level >= l) total++;
            }
        }
        return total;
    }
}

