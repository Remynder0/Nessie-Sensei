<script setup lang="ts">
import { ref, computed } from 'vue'
import { isMythicWeapon } from '../logic/gunsmithCalculator'

const props = defineProps<{
  weaponName: string
  displayName?: string
}>()

const isMythic = computed(() => isMythicWeapon(props.weaponName))

const emit = defineEmits<{
    (e: 'click'): void
}>()

const formatImgName = (name: string) => {
    let formatted = name.toLowerCase().replace(/ /g, '_').replace(/\//g, '_');
    if (formatted === 'sentinel') return 'sentinel_esr';
    return formatted;
}

const cardRef = ref<HTMLElement | null>(null)
const innerRef = ref<HTMLElement | null>(null)
const glareRef = ref<HTMLElement | null>(null)

function handleMouseMove(e: MouseEvent) {
  if (!cardRef.value || !innerRef.value || !glareRef.value) return
  
  const rect = cardRef.value.getBoundingClientRect()
  
  const x = e.clientX - rect.left 
  const y = e.clientY - rect.top
  
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  
  const rotateX = ((y - centerY) / centerY) * -15
  const rotateY = ((x - centerX) / centerX) * 15
  
  innerRef.value.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
  glareRef.value.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.2), transparent 60%)`
}

function handleMouseLeave() {
  if (!innerRef.value || !glareRef.value) return
  innerRef.value.style.transition = `transform 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)`
  innerRef.value.style.transform = `rotateX(0deg) rotateY(0deg)`
  glareRef.value.style.opacity = ''
}

function handleMouseEnter() {
  if (!innerRef.value) return
  innerRef.value.style.transition = `none`
}

function handleGridPortraitError(event: Event, fallbackSrc: string) {
    const img = event.target as HTMLImageElement;
    img.src = fallbackSrc;
}
</script>

<template>
<div 
  ref="cardRef" 
  class="marvel-card" 
  role="button"
  tabindex="0"
  :aria-label="displayName || weaponName"
  @keydown.enter="emit('click')"
  @mousemove="handleMouseMove" 
  @mouseleave="handleMouseLeave" 
  @mouseenter="handleMouseEnter"
  @click="emit('click')"
>
  <div class="absolute -top-5 left-0 w-full text-center font-mono font-bold tracking-widest text-sm uppercase drop-shadow-md z-10 pointer-events-none flex items-center justify-center gap-1.5" :class="isMythic ? 'text-red-500' : 'text-titan-cyan'">
    <span>{{ displayName || weaponName }}</span>
    <span v-if="isMythic" class="text-[9px] px-1 py-0.2 bg-red-600/40 border border-red-500 text-red-300 rounded shadow-[0_0_8px_rgba(239,68,68,0.5)]">MYTHIC</span>
  </div>
  <div class="card-bg">
      
  </div>

  <div>
    <div ref="innerRef" class="card-inner">
      <!-- L'effet de reflet -->
      <div ref="glareRef" class="glare"></div>
      
      <img 
          :src="`/images/weapons/${formatImgName(weaponName)}.svg`" 
          @error="handleGridPortraitError($event, `/images/weapons/${formatImgName(weaponName)}.png`)"
          :alt="weaponName" 
          class="character-img invert opacity-90 drop-shadow-[0_15px_15px_rgba(0,0,0,1)]"
      >
      
    </div>
  </div>
</div>
</template>

<style scoped>
.marvel-card {
  width: 80%;
  height: 140px;
  cursor: pointer;
  margin: 20px auto 0 auto; 
  position: relative; 
}



.card-inner {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0; left: 0;
  transform-style: preserve-3d; 
  transition: transform 0.1s; 
  pointer-events: none; 
}

.card-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--color-titan-panel);
  border-top: 3px solid var(--color-titan-cyan);
  
  filter: drop-shadow(0 10px 15px rgba(0,0,0,0.5));
  
  background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 10px 10px;
}

.glare {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15), transparent 60%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  transform: translateZ(1px);
}

.character-img {
  position: absolute;
  bottom: 10px;
  left: 50%;
  width: 90%;
  height: 90%;
  max-width: none;
  object-fit: contain;
  object-position: bottom;
  pointer-events: none; 
  
  /* L'effet de jaillissement 3D profond */
  transform: translateX(-50%) translateZ(60px);
}

.marvel-card:hover .glare {
  opacity: 1;
}
</style>
