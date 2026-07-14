<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  legendName: string
}>()

const emit = defineEmits<{
    (e: 'click'): void
}>()

const formatImgName = (name: string) => name.toLowerCase().replace(/ /g, '_')

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
<!-- Le conteneur principal a maintenant EXACTEMENT la taille du fond gris -->
<!-- Ainsi le hover ne se déclenche que sur le fond -->
<div 
  ref="cardRef" 
  class="marvel-card" 
  @mousemove="handleMouseMove" 
  @mouseleave="handleMouseLeave" 
  @mouseenter="handleMouseEnter"
  @click="emit('click')"
>
  <!-- Le fond gris de la carte est maintenant en dehors de innerRef -->
  <!-- Il restera donc 100% statique et ne tournera pas avec la souris -->
  <div class="card-bg">
      
  </div>

  <div class="clip-wrapper">
    <div ref="innerRef" class="card-inner">
      <!-- L'effet de reflet -->
      <div ref="glareRef" class="glare"></div>
      
      <!-- L'image du personnage, qui déborde du cadre vers le haut et tourne -->
      <img 
          :src="`/images/legends/portraits/${formatImgName(legendName)}.jpg`" 
          @error="handleGridPortraitError($event, `/images/legends/portraits/${formatImgName(legendName)}.png`)"
          :alt="legendName" 
          class="character-img"
      >
    </div>
  </div>
</div>
</template>

<style scoped>

.marvel-card {
  width: 70%;
  height: 200px;
  cursor: pointer;
  margin: 80px auto 0 auto; /* Espace en haut et centré */
  position: relative; /* Ajouté pour ancrer le fond statique */
}

.clip-wrapper {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none;
  perspective: 1000px;
  /* Top, left, right are wide open (-500%, 500%). Bottom perfectly traces the card's bevel and horizontal edge. */
  clip-path: polygon(-500% -500%, 500% -500%, 500% calc(100% - 50px), 100% calc(100% - 50px), calc(10% - 40px) 100%, -500% 100%);
}

.card-inner {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0; left: 0;
  transform-style: preserve-3d; 
  transition: transform 0.1s; 
  pointer-events: none; /* Laisse les clics passer au conteneur parent */
}

.card-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #2b2b2b;
  /* Utilisation de clip-path pour biseauter le bas-droit */
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 50px), calc(10% - 40px) 100%, 0 100%);
  border-top: 5px solid #e02424;
  
  /* Remplacement de box-shadow par drop-shadow car clip-path masque les ombres classiques */
  filter: drop-shadow(0 15px 20px rgba(0,0,0,0.5));
  
  /* Ajout d'une texture de grille (grid) discrète pour le fond comme sur l'image */
  background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 20px 20px;
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
  bottom: 0px;
  left: 50%;
  width: 140%;
  height: 140%;
  max-width: none;
  object-fit: contain;
  object-position: bottom;
  pointer-events: none; /* Ignore la souris, seul le fond gris déclenche le hover */
  
  /* L'effet de jaillissement 3D profond */
  transform: translateX(-50%) translateZ(80px);
  filter: drop-shadow(0 20px 20px rgba(0,0,0,0.6));
}

.marvel-card:hover .glare {
  opacity: 1;
}
</style>
