<script setup lang="ts">
import { ref } from 'vue'
import { startTutorial } from '../logic/tutorial'

const isOpen = ref(false)
const isSubmitted = ref(false)
const selectedType = ref('bug')
const message = ref('')
const contact = ref('')

const toggleOpen = () => {
  isOpen.value = !isOpen.value
  isSubmitted.value = false
}

const submitFeedback = () => {
  if (!message.value) return
  
  // Here we would normally send to a backend, Discord webhook, or mailto
  // For now, we simulate a successful submission
  console.log(`[Feedback - ${selectedType.value}] From: ${contact.value} | Msg: ${message.value}`)
  
  isSubmitted.value = true
  setTimeout(() => {
    isOpen.value = false
    message.value = ''
    contact.value = ''
    selectedType.value = 'bug'
    isSubmitted.value = false
  }, 2500)
}
</script>

<template>
  <div id="tour-feedback" class="fixed bottom-6 right-6 z-50">
    <!-- Bubble Button -->
    <button 
      @click="toggleOpen"
      class="w-14 h-14 rounded-full bg-titan-cyan text-black flex items-center justify-center shadow-[0_0_20px_rgba(45,212,191,0.4)] hover:scale-110 transition-transform duration-300 group"
      :class="isOpen ? 'rotate-45 bg-titan-orange shadow-[0_0_20px_rgba(255,87,34,0.4)]' : ''"
    >
      <svg v-if="!isOpen" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
    </button>

    <!-- Feedback Modal -->
    <div 
      v-if="isOpen"
      class="absolute bottom-16 right-0 w-[340px] bg-black/95 backdrop-blur-md border border-titan-border shadow-2xl origin-bottom-right animate-in zoom-in-95 duration-200"
    >
      <div class="p-4 border-b border-titan-border bg-black/50">
        <h3 class="font-black text-white uppercase tracking-widest font-display text-sm flex items-center gap-2">
          <span class="w-2 h-2 block" :class="isSubmitted ? 'bg-green-500' : 'bg-titan-cyan'"></span>
          {{ $t('feedback.title') }}
        </h3>
      </div>

      <div class="p-5">
        <div v-if="isSubmitted" class="text-center py-8">
          <div class="text-green-400 font-mono text-sm uppercase tracking-wide mb-2">{{ $t('feedback.success') }}</div>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <form v-else @submit.prevent="submitFeedback" class="space-y-4">
          <!-- Type Select -->
          <div>
            <label class="block text-[13px] text-gray-500 font-mono uppercase tracking-widest mb-1">{{ $t('feedback.type') }}</label>
            <select v-model="selectedType" class="w-full bg-black/50 border border-titan-border text-white px-3 py-2 font-mono text-xs focus:outline-none focus:border-titan-cyan transition-colors">
              <option value="bug">{{ $t('feedback.bug') }}</option>
              <option value="improvement">{{ $t('feedback.improvement') }}</option>
              <option value="opinion">{{ $t('feedback.opinion') }}</option>
              <option value="fanart">{{ $t('feedback.fanart') }}</option>
            </select>
          </div>

          <!-- Message / Link -->
          <div>
            <label class="block text-[13px] text-gray-500 font-mono uppercase tracking-widest mb-1">{{ $t('feedback.message') }}</label>
            <textarea 
              v-model="message" 
              rows="3" 
              required
              class="w-full bg-black/50 border border-titan-border text-white px-3 py-2 font-sans text-sm focus:outline-none focus:border-titan-cyan transition-colors resize-none custom-scrollbar"
            ></textarea>
          </div>

          <!-- Contact info -->
          <div>
            <label class="block text-[13px] text-gray-500 font-mono uppercase tracking-widest mb-1">{{ $t('feedback.contact') }}</label>
            <input 
              v-model="contact" 
              type="text" 
              class="w-full bg-black/50 border border-titan-border text-white px-3 py-2 font-mono text-xs focus:outline-none focus:border-titan-cyan transition-colors"
            />
          </div>

          <!-- Buttons -->
          <div class="flex gap-2 pt-2">
            <button 
              type="button" 
              @click="toggleOpen"
              class="flex-1 px-4 py-2 text-xs font-mono uppercase tracking-wider border border-titan-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              {{ $t('feedback.cancel') }}
            </button>
            <button 
              type="submit" 
              class="flex-1 px-4 py-2 text-xs font-mono uppercase tracking-wider bg-titan-cyan/10 border border-titan-cyan text-titan-cyan hover:bg-titan-cyan hover:text-black transition-colors font-bold disabled:opacity-50"
              :disabled="!message"
            >
              {{ $t('feedback.send') }}
            </button>
          </div>
        </form>

        <!-- Review Tutorial Button -->
        <button 
          @click="startTutorial(true); toggleOpen()"
          class="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-mono uppercase tracking-widest text-titan-cyan/70 hover:text-titan-cyan hover:bg-titan-cyan/5 transition-colors border border-transparent hover:border-titan-cyan/30"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ $t('feedback.reviewTutorial') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #00e5ff;
}
</style>
