import { ref } from 'vue';

export const syncCode = ref<string>('');
export const syncStatus = ref<'ONLINE' | 'SYNCING' | 'OFFLINE' | 'ERROR'>('OFFLINE');
export const isSyncEnabled = ref<boolean>(false);

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
    const enabled = localStorage.getItem('apex_composer_sync_enabled') === 'true';
    const savedCode = localStorage.getItem('apex_composer_sync_code');
    
    if (enabled && savedCode) {
        isSyncEnabled.value = true;
        syncCode.value = savedCode;
        syncStatus.value = 'ONLINE';
    } else {
        isSyncEnabled.value = false;
        syncStatus.value = 'OFFLINE';
    }
}

export async function enableCloudSync() {
    if (isSyncEnabled.value) return;

    let savedCode = localStorage.getItem('apex_composer_sync_code');
    if (!savedCode) {
        savedCode = generateCode();
        localStorage.setItem('apex_composer_sync_code', savedCode);
    }
    
    syncCode.value = savedCode;
    isSyncEnabled.value = true;
    localStorage.setItem('apex_composer_sync_enabled', 'true');
    
    // Perform initial push
    await syncToCloud();
}

export async function syncToCloud() {
    if (!isSyncEnabled.value || !syncCode.value) return;

    syncStatus.value = 'SYNCING';
    
    try {
        const localData = localStorage.getItem('apex_composer_history');
        if (!localData) {
            syncStatus.value = 'ONLINE';
            return;
        }

        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: syncCode.value,
                data: localData // sending the stringified JSON
            })
        });

        if (!response.ok) {
            throw new Error('Failed to sync to cloud');
        }

        syncStatus.value = 'ONLINE';
    } catch (e) {
        console.error("Sync error:", e);
        syncStatus.value = 'ERROR';
    }
}

export async function linkDevice(code: string): Promise<boolean> {
    if (code.length < 9) return false;
    syncStatus.value = 'SYNCING';
    
    try {
        const response = await fetch(`/api/sync?code=${code}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch from cloud');
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
            localStorage.setItem('apex_composer_history', result.data);
            
            localStorage.setItem('apex_composer_sync_code', code);
            localStorage.setItem('apex_composer_sync_enabled', 'true');
            
            syncCode.value = code;
            isSyncEnabled.value = true;
            syncStatus.value = 'ONLINE';
            
            window.location.reload();
            return true;
        } else {
            throw new Error('No data found for this code');
        }
    } catch (e) {
        console.error("Link device error:", e);
        syncStatus.value = 'ERROR';
        return false;
    }
}

// Function to retry syncing when in ERROR state
export function retrySync() {
    if (syncStatus.value === 'ERROR') {
        syncToCloud();
    }
}
