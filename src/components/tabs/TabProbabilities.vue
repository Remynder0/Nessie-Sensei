<script setup lang="ts">
import { ref, computed } from 'vue'
import { calculatePickProbabilities, type ProbResult } from '../../logic/composer'
import { legendsData, antiSynergiesData, historyData } from '../../logic/store'

const probTarget = ref<string>('')
const probResults = ref<ProbResult[]>([])

// Animation state
const animatedProbs = ref<Record<string, number>>({})
const maxLegendName = ref<string>('')
const isAnimationComplete = ref(false)
let animationFrame: number | null = null;

const sortedLegends = computed(() => {
    return [...legendsData.value].sort((a, b) => a.Name.localeCompare(b.Name));
});

function selectTarget(name: string) {
  // Reset animation
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animatedProbs.value = {};
  isAnimationComplete.value = false;
  maxLegendName.value = '';

  if (probTarget.value === name) {
    probTarget.value = ''
    probResults.value = []
  } else {
    probTarget.value = name
    probResults.value = calculatePickProbabilities(probTarget.value, legendsData.value, antiSynergiesData.value, historyData.value)
    
    if (probResults.value.length > 0) {
        // Find highest probability legend
        const maxRes = probResults.value.reduce((prev, current) => (prev.prob > current.prob) ? prev : current);
        maxLegendName.value = maxRes.name;

        // Initialize animated values
        probResults.value.forEach(res => {
            animatedProbs.value[res.name] = 0;
        });

        // Start progressive animation (10% per second)
        let lastTime = performance.now();
        const SPEED = 0.010; 
        
        const animate = (time: number) => {
            const dt = time - lastTime;
            lastTime = time;
            let allDone = true;
            
            probResults.value.forEach(res => {
                if (animatedProbs.value[res.name] < res.prob) {
                    animatedProbs.value[res.name] = Math.min(res.prob, animatedProbs.value[res.name] + SPEED * dt);
                    allDone = false;
                }
            });

            if (!allDone) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                isAnimationComplete.value = true;
            }
        };
        animationFrame = requestAnimationFrame(animate);
    }
  }
}

function getProbFor(name: string): string | null {
    if (!probTarget.value || name === probTarget.value) return null;
    const res = probResults.value.find(r => r.name === name);
    return res ? res.prob.toFixed(1) : null;
}

function getAnimatedProbFor(name: string): string | null {
    if (!probTarget.value || name === probTarget.value) return null;
    const prob = animatedProbs.value[name];
    return prob !== undefined ? prob.toFixed(1) : null;
}

function isAntiSynergy(name1: string, name2: string): boolean {
    if (!name1 || !name2 || name1 === name2) return false;
    return antiSynergiesData.value.some(anti => anti.legends.includes(name1) && anti.legends.includes(name2));
}

function getColorClassFor(probStr: string | null): string {
    if (!probStr) return 'text-gray-400';
    const prob = parseFloat(probStr);
    if (prob > 6) return 'text-titan-cyan drop-shadow-[0_0_10px_rgba(45,212,191,0.9)]'; // Exceptional
    if (prob > 4) return 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.9)]'; // Good
    if (prob > 2) return 'text-titan-orange drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]'; // Average
    return 'text-apex-red drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]'; // Low
}

const formatImgName = (name: string) => name.toLowerCase().replace(/ /g, '_')

function hideErrorImage(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img) img.style.display = 'none';
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="p-6 shrink-0 border-b border-titan-border bg-black/60">
        <h2 class="text-2xl font-black text-white tracking-widest uppercase font-mono flex items-center">
            <span class="text-titan-cyan mr-3 block w-3 h-3 bg-titan-cyan"></span> 
            {{ $t('probabilities.title') }}
        </h2>
        <p class="text-gray-400 text-sm font-mono mt-2">{{ $t('probabilities.subtitle') }}</p>
    </div>

    <!-- The grid of characters -->
    <div class="flex-1 overflow-y-auto custom-scrollbar p-6 bg-black/40">
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-4 content-start">
            <div 
                v-for="legend in sortedLegends" 
                :key="legend.Name"
                @click="selectTarget(legend.Name)"
                class="relative aspect-square cursor-pointer group border-2 transition-all duration-300 bg-black/60"
                :class="[
                    probTarget === legend.Name ? 'border-titan-cyan shadow-[0_0_15px_rgba(45,212,191,0.5)] scale-105 z-10' : 'border-titan-border hover:border-titan-cyan/50',
                    probTarget && isAntiSynergy(probTarget, legend.Name) ? 'cursor-not-allowed' : ''
                ]"
            >
                <img 
                    :src="`/images/legends/icons/${formatImgName(legend.Name)}.png`" 
                    :alt="legend.Name"
                    class="w-full h-full object-cover"
                    :class="[
                        probTarget && probTarget !== legend.Name ? 'opacity-60 grayscale-[30%]' : 'opacity-100',
                        probTarget && isAntiSynergy(probTarget, legend.Name) ? 'grayscale opacity-30' : ''
                    ]"
                    @error="hideErrorImage"
                />
                
                <!-- Target Overlay (pulsing border effect) -->
                <div v-if="probTarget === legend.Name" class="absolute inset-0 border-2 border-titan-cyan animate-pulse pointer-events-none z-20"></div>

                <!-- Probability Overlay (Animated) -->
                <div v-if="getProbFor(legend.Name) && !isAntiSynergy(probTarget, legend.Name)" 
                     class="absolute inset-0 flex items-center justify-center backdrop-blur-[1px] transition-all duration-500"
                     :class="legend.Name === maxLegendName && isAnimationComplete ? 'bg-black/10 shadow-[inset_0_0_30px_rgba(45,212,191,0.4)]' : 'bg-black/40'">
                    <span class="font-black font-mono transition-all duration-500" 
                          :class="[
                              getColorClassFor(getProbFor(legend.Name)),
                              legend.Name === maxLegendName && isAnimationComplete ? 'text-2xl md:text-4xl scale-125 drop-shadow-[0_0_20px_rgba(45,212,191,1)]' : 'text-lg md:text-2xl'
                          ]">
                        {{ getAnimatedProbFor(legend.Name) }}%
                    </span>
                </div>

                <!-- Anti-synergy Overlay (Cross) -->
                <div v-if="probTarget && isAntiSynergy(probTarget, legend.Name)" class="absolute inset-0 flex items-center justify-center bg-apex-red/20 backdrop-blur-[1px] pointer-events-none transition-opacity duration-300">
                    <svg class="w-1/2 h-1/2 text-apex-red drop-shadow-[0_0_5px_rgba(220,38,38,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </div>
                
                <!-- Name label on hover or if target -->
                <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent p-2 text-center pointer-events-none transition-opacity duration-300"
                     :class="probTarget === legend.Name ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'">
                    <span class="text-white font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest drop-shadow-md">
                        {{ legend.Name }}
                    </span>
                </div>

                <!-- Anti-synergy Tooltip -->
                <div v-if="probTarget && isAntiSynergy(probTarget, legend.Name)" class="absolute -top-10 left-1/2 -translate-x-1/2 bg-black border border-apex-red text-apex-red px-3 py-1 text-[10px] font-mono uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 shadow-[0_0_10px_rgba(220,38,38,0.3)]">
                    {{ $t('probabilities.antiSynergy') }}
                    <div class="absolute -bottom-[5px] left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-apex-red w-0 h-0"></div>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>
