<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import AppHeader from '@/components/AppHeader.vue'

const route = useRoute()

// Responsive sidebar state
const isMobile = ref(false)
const isTablet = ref(false)
const sidebarCollapsed = ref(false)
const mobileMenuOpen = ref(false)
const tabletExpanded = ref(false)

function checkViewport() {
  const width = window.innerWidth
  isMobile.value = width <= 768
  isTablet.value = width > 768 && width <= 1024
  
  // Auto-collapse on tablet, auto-close mobile
  if (isMobile.value) {
    mobileMenuOpen.value = false
    sidebarCollapsed.value = false
  } else if (isTablet.value) {
    sidebarCollapsed.value = true
    tabletExpanded.value = false
    mobileMenuOpen.value = false
  } else {
    sidebarCollapsed.value = false
    tabletExpanded.value = false
    mobileMenuOpen.value = false
  }
}

function toggleSidebar() {
  if (isMobile.value) {
    mobileMenuOpen.value = !mobileMenuOpen.value
  } else if (isTablet.value) {
    tabletExpanded.value = !tabletExpanded.value
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
}

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

const mainContentClass = computed(() => {
  if (isMobile.value) return ''
  if (isTablet.value) return tabletExpanded.value ? 'sidebar-expanded' : ''
  return sidebarCollapsed.value ? 'sidebar-collapsed' : ''
})

const sidebarClass = computed(() => {
  if (isMobile.value) return mobileMenuOpen.value ? 'mobile-open' : ''
  if (isTablet.value) return tabletExpanded.value ? 'expanded' : ''
  return sidebarCollapsed.value ? 'collapsed' : ''
})

const pageTitle = computed(() => route.meta.title || 'Business Tracker')

onMounted(() => {
  checkViewport()
  window.addEventListener('resize', checkViewport)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkViewport)
})
</script>

<template>
  <div class="app-container">
    <AppSidebar 
      :collapsed="isTablet ? !tabletExpanded : sidebarCollapsed"
      :mobileOpen="mobileMenuOpen"
      @toggle="toggleSidebar"
    />
    
    <div 
      class="mobile-overlay" 
      :class="{ active: mobileMenuOpen }"
      @click="closeMobileMenu"
    ></div>

    <div class="main-content" :class="mainContentClass">
      <AppHeader 
        :title="pageTitle" 
        @toggle-sidebar="toggleSidebar"
      />
      
      <main class="page-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>