<script setup lang="ts">
import { legendsData } from '../../logic/store'
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="mb-6">
        <h2 class="text-3xl font-black text-white tracking-tighter uppercase font-mono">
          <span class="text-titan-cyan mr-2">>></span>Base de Données
        </h2>
        <p class="text-gray-400 text-sm font-mono mt-1">Registre global des unités tactiques</p>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="legend in legendsData" :key="legend.Name" class="glass-panel p-4 hover:border-titan-cyan transition-colors group">
                <div class="flex justify-between items-center mb-3 border-b border-titan-border pb-2">
                    <h3 class="text-xl font-bold text-white uppercase font-sans tracking-wide group-hover:text-titan-cyan transition-colors">{{ legend.Name }}</h3>
                    <span class="text-xs font-mono text-gray-500 uppercase">{{ legend.Class }}</span>
                </div>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div v-for="(val, stat) in legend.stats" :key="stat" v-show="val > 0" class="flex justify-between items-center text-xs font-mono">
                        <span class="text-gray-400 capitalize">{{ stat.toString().replace('_', ' ') }}</span>
                        <span class="text-titan-orange font-bold">{{ val }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>
