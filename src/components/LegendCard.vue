<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Legend } from '../logic/composer'

const props = defineProps<{
  legend: Legend
}>()

const topStats = computed(() => {
  return Object.entries(props.legend.stats)
    .filter(([_, val]) => val > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5) // Show top 5 stats
})

const formattedName = computed(() => props.legend.Name.toLowerCase().replace(/ /g, '_'))
const formattedClass = computed(() => props.legend.Class.toLowerCase().replace(/ /g, '_'))

const iconError = ref(false)
const classIconError = ref(false)

const classBgColor = computed(() => {
  const c = props.legend.Class.toLowerCase()
  if (c.includes('assault')) return 'bg-red-600'
  if (c.includes('recon')) return 'bg-purple-600'
  if (c.includes('skirmish')) return 'bg-yellow-500'
  if (c.includes('control')) return 'bg-green-600'
  if (c.includes('support')) return 'bg-blue-500'
  return 'bg-titan-border'
})
</script>

<template>
  <div class="glass-panel p-6 flex flex-col justify-between transition-transform transform hover:-translate-y-1 hover:border-titan-cyan group">
    <div class="absolute top-0 left-0 w-1 h-full bg-titan-border group-hover:bg-titan-cyan transition-colors"></div>
    <div class="pl-2">
      <div class="flex justify-between items-start mb-4">
        
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 bg-black/40 border border-titan-border flex-shrink-0 flex items-center justify-center overflow-hidden">
            <img 
              v-show="!iconError"
              :src="`/images/legends/icons/${formattedName}.png`" 
              :alt="legend.Name"
              @error="iconError = true"
              class="w-full h-full object-cover"
            />
            <span v-if="iconError" class="text-gray-600 font-bold font-mono text-xl">?</span>
          </div>
          <h2 class="text-xl md:text-2xl font-black text-white font-sans uppercase tracking-wider">{{ legend.Name }}</h2>
        </div>
        
        <div 
          class="flex-shrink-0 flex items-center justify-center border border-black/50 w-8 h-8 relative group/class shadow-lg" 
          :class="classBgColor"
          :title="legend.Class"
        >
          <img 
              v-show="!classIconError"
              :src="`/images/legends/classes/${formattedClass}_class.svg`" 
              :alt="legend.Class"
              @error="classIconError = true"
              class="w-5 h-5 opacity-90 invert drop-shadow"
          />
          <span v-if="classIconError" class="text-[10px] font-mono text-white uppercase px-1">{{ legend.Class.substring(0,3) }}</span>
        </div>
      </div>

      <div class="space-y-2 mt-6">
        <div v-for="[statName, val] in topStats" :key="statName" class="flex items-center">
          <div class="w-24 text-[10px] text-gray-400 capitalize font-mono">{{ statName.replace('_', ' ') }}</div>
          <div class="flex-1 bg-black/60 h-1 overflow-hidden border border-titan-border/50">
            <div class="bg-titan-cyan h-full transition-all" :style="{ width: `${val * 10}%` }"></div>
          </div>
          <div class="w-6 text-right text-[10px] font-bold text-white font-mono">{{ val }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
