<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import AppSidebar from '@/components/AppSidebar.vue'
import AppHeader from '@/components/AppHeader.vue'

const route = useRoute()
const { logout } = useAuth()

// Hide sidebar/header on login page
const showLayout = computed(() => !route.meta.public)

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

function handleLogout() {
  logout()
}

const mainContentClass = computed(() => {
  if (!showLayout.value) return 'full-page'
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
  <!-- Login Page: No layout, just router-view -->
  <template v-if="!showLayout">
    <router-view />
  </template>

  <!-- Authenticated Pages: Full layout with sidebar + header -->
  <div v-else class="app-container">
    <AppSidebar 
      :collapsed="isTablet ? !tabletExpanded : sidebarCollapsed"
      :mobileOpen="mobileMenuOpen"
      @toggle="toggleSidebar"
      @logout="handleLogout"
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
        @logout="handleLogout"
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
/* Full page for login */
:global(body) {
  margin: 0;
  padding: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>