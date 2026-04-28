<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStockStore } from '@/stores/stockStore'
import { useAssetStore } from '@/stores/assetStore'
import { useFormatters } from '@/composables/useFormatters'

const props = defineProps({
  title: String
})

defineEmits(['toggle-sidebar'])

const stockStore = useStockStore()
const assetStore = useAssetStore()
const { formatDate } = useFormatters()

const notificationsOpen = ref(false)
// This array stores IDs of notifications the user has dismissed
const clearedNotifications = ref([])

const notifications = computed(() => {
  const alerts = []
  
  // 1. Low Stock Alerts
  stockStore.lowStockItems.forEach(item => {
    const id = `low-stock-${item.id}-${item.quantity}` // Unique ID including quantity
    if (!clearedNotifications.value.includes(id)) {
      alerts.push({
        id,
        type: 'warning',
        icon: 'fas fa-exclamation-triangle',
        title: 'Low Stock Alert',
        text: `${item.name} is running low (${item.quantity} remaining)`
      })
    }
  })
  
  // 2. Maintenance Alerts
  assetStore.assets.filter(a => a.status === 'maintenance').forEach(item => {
    const id = `maint-${item.id}`
    if (!clearedNotifications.value.includes(id)) {
      alerts.push({
        id,
        type: 'warning',
        icon: 'fas fa-wrench',
        title: 'Asset Maintenance Required',
        text: `${item.name} (${item.tag}) is under maintenance`
      })
    }
  })
  
  return alerts
})

const notificationCount = computed(() => notifications.value.length)

function toggleNotifications() {
  notificationsOpen.value = !notificationsOpen.value
}

function closeNotifications() {
  notificationsOpen.value = false
}

/**
 * FIXED: This function now correctly updates the cleared list
 */
function clearAllNotifications() {
  // Get all current notification IDs and add them to the cleared list
  const currentIds = notifications.value.map(n => n.id)
  clearedNotifications.value = [...clearedNotifications.value, ...currentIds]
}

function handleClickOutside(e) {
  const bell = document.querySelector('.notification-bell')
  if (bell && !bell.contains(e.target)) {
    notificationsOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <header class="header">
    <div class="header-left">
      <button class="menu-btn" @click="$emit('toggle-sidebar')">
        <i class="fas fa-bars"></i>
      </button>
      <h1 class="page-title">{{ title }}</h1>
    </div>

    <div class="header-right">
      <div class="notification-bell">
        <div class="bell-wrapper" @click.stop="toggleNotifications">
          <i class="fas fa-bell"></i>
          <span class="badge" v-show="notificationCount > 0">{{ notificationCount }}</span>
        </div>
        
        <div class="notifications-dropdown" :class="{ active: notificationsOpen }" @click.stop>
          <div class="notifications-header">
            <h3>Notifications</h3>
            <div class="header-actions">
              <button 
                v-if="notifications.length > 0" 
                class="clear-all-btn" 
                @click="clearAllNotifications"
              >
                Clear All
              </button>
              <button class="close-btn" @click="closeNotifications">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <div class="notifications-list">
            <template v-if="notifications.length > 0">
              <div 
                v-for="notif in notifications" 
                :key="notif.id"
                class="notification-item"
                :class="notif.type"
              >
                <i :class="notif.icon"></i>
                <div class="notification-content">
                  <p class="notification-title">{{ notif.title }}</p>
                  <p class="notification-text">{{ notif.text }}</p>
                </div>
              </div>
            </template>
            <div v-else class="no-notifications">
              <i class="fas fa-check-circle"></i>
              <p>No new notifications</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.notification-bell {
  position: relative;
  cursor: pointer;
}

.bell-wrapper {
  position: relative;
  padding: 8px;
}

.notifications-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.clear-all-btn {
  background: none;
  border: none;
  color: var(--primary-color);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.clear-all-btn:hover {
  background-color: rgba(var(--primary-rgb), 0.1);
  text-decoration: underline;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
}

/* Ensure dropdown stays above other elements */
.notifications-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  width: 320px;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  display: none;
  z-index: 1000;
  cursor: default;
}

.notifications-dropdown.active {
  display: block;
}
</style>