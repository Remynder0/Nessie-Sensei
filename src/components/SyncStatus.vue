<script setup lang="ts">
import { ref } from 'vue'
import { syncCode, syncStatus, linkDevice } from '../logic/syncService'

const showModal = ref(false)
const inputCode = ref('')
const copySuccess = ref(false)

function copyToClipboard() {
    navigator.clipboard.writeText(syncCode.value)
    copySuccess.value = true
    setTimeout(() => copySuccess.value = false, 2000)
}

function handleLink() {
    if (inputCode.value.length === 9) {
        linkDevice(inputCode.value.toUpperCase())
        showModal.value = false
    }
}
</script>

<template>
  <div class="relative w-full">
    <!-- Status Indicator Button -->
    <button 
        @click="showModal = true; copyToClipboard()"
        class="w-full p-4 border-t border-titan-border text-xs font-mono text-center transition-colors group relative cursor-pointer outline-none"
        :class="{
            'bg-titan-panel hover:bg-black/30': syncStatus === 'ONLINE',
            'bg-titan-orange/10': syncStatus === 'SYNCING',
            'bg-apex-red/10': syncStatus === 'OFFLINE'
        }"
    >
        <div v-if="syncStatus === 'ONLINE'" class="text-titan-cyan flex items-center justify-center gap-2">
            <span class="w-2 h-2 rounded-full bg-titan-cyan group-hover:shadow-[0_0_8px_#00f0ff]"></span>
            SYSTEM ONLINE
        </div>
        <div v-else-if="syncStatus === 'SYNCING'" class="text-titan-orange flex items-center justify-center gap-2 animate-pulse">
            <span class="w-2 h-2 bg-titan-orange"></span>
            SYNCHRONIZING...
        </div>
        <div v-else class="text-apex-red flex items-center justify-center gap-2">
            <span class="w-2 h-2 rounded-full bg-apex-red"></span>
            OFFLINE
        </div>
        
        <!-- Hover Hint -->
        <div class="absolute inset-0 flex items-center justify-center bg-titan-cyan text-black opacity-0 group-hover:opacity-100 transition-opacity font-bold">
            GÉRER SYNCHRONISATION
        </div>
    </button>

    <!-- Sync Modal Overlay -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="glass-panel titan-beveled w-full max-w-md p-8 relative">
            <button @click="showModal = false" class="absolute top-4 right-4 text-gray-500 hover:text-white font-mono text-xl">&times;</button>
            
            <h2 class="text-2xl font-black text-white uppercase font-sans tracking-wider mb-6 flex items-center gap-2">
                <span class="w-3 h-3 bg-titan-cyan block"></span> DATA LINK
            </h2>

            <div class="mb-8">
                <p class="text-xs text-gray-400 font-mono mb-2 uppercase tracking-widest">Votre Code Identifiant :</p>
                <button @click="copyToClipboard" class="w-full bg-black/50 border border-titan-cyan p-4 text-center group hover:bg-titan-cyan/10 transition-colors relative">
                    <span class="text-3xl font-mono text-white font-bold tracking-widest group-hover:text-titan-cyan transition-colors">{{ syncCode }}</span>
                    <span v-if="copySuccess" class="absolute -top-3 right-2 bg-titan-cyan text-black text-[10px] px-2 py-1 font-bold uppercase">Copié !</span>
                </button>
                <p class="text-[10px] text-gray-500 font-mono mt-2 text-center">Ce code a été copié dans votre presse-papier.</p>
            </div>

            <div class="border-t border-titan-border pt-6">
                <p class="text-xs text-gray-400 font-mono mb-2 uppercase tracking-widest">Lier un autre appareil :</p>
                <div class="flex gap-2">
                    <input 
                        v-model="inputCode" 
                        type="text" 
                        placeholder="XXXX-XXXX" 
                        maxlength="9"
                        class="flex-1 bg-black/50 border border-titan-border text-white px-4 py-2 font-mono uppercase text-center focus:outline-none focus:border-titan-orange"
                    />
                    <button 
                        @click="handleLink" 
                        :disabled="inputCode.length !== 9"
                        class="bg-titan-orange text-black px-6 font-bold font-mono uppercase disabled:opacity-50 hover:bg-orange-500 transition-colors"
                    >
                        Lier
                    </button>
                </div>
                <p class="text-[10px] text-gray-500 font-mono mt-2 text-center">Attention : Lier un appareil écrasera les données locales actuelles.</p>
            </div>
        </div>
    </div>
  </div>
</template>
