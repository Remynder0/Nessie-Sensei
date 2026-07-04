import { ref } from 'vue';

export const syncCode = ref<string>('');
export const syncStatus = ref<'ONLINE' | 'SYNCING' | 'OFFLINE'>('OFFLINE');

// Fausse base de données Cloud pour la simulation locale
const mockCloudDB: Record<string, string> = {};

function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for(let i=0; i<9; i++) {
        if (i===4) {
            code += '-';
            continue;
        }
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export function initSync() {
    let savedCode = localStorage.getItem('apex_composer_sync_code');
    if (!savedCode) {
        savedCode = generateCode();
        localStorage.setItem('apex_composer_sync_code', savedCode);
    }
    syncCode.value = savedCode;
    
    // Initial fetch to simulate grabbing data
    syncStatus.value = 'ONLINE';
}

export function syncToCloud() {
    syncStatus.value = 'SYNCING';
    setTimeout(() => {
        // Lecture locale (qui sera remplacée par tauri fs plus tard)
        const localData = localStorage.getItem('apex_composer_history');
        if (localData) {
            // Écriture Cloud (simulée)
            mockCloudDB[syncCode.value] = localData;
        }
        syncStatus.value = 'ONLINE';
    }, 1500); // délai artificiel pour montrer l'UI
}

export function linkDevice(code: string): boolean {
    if (code.length < 9) return false;
    syncStatus.value = 'SYNCING';
    
    setTimeout(() => {
        // En vrai, on ferait un fetch réseau vers Supabase/Vercel KV
        const cloudData = mockCloudDB[code];
        
        // Simule qu'on récupère la donnée du Cloud
        if (cloudData) {
            localStorage.setItem('apex_composer_history', cloudData);
        }
        
        localStorage.setItem('apex_composer_sync_code', code);
        syncCode.value = code;
        syncStatus.value = 'ONLINE';
        
        // On recharge la page pour appliquer les nouvelles données (simplicité)
        window.location.reload();
    }, 2000);
    return true;
}
