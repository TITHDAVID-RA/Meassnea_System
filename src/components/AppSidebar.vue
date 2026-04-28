<template>
  <aside 
    class="sidebar" 
    :class="{ 
      'collapsed': collapsed, 
      'mobile-open': mobileOpen 
    }"
  >
    <div class="sidebar-header">
      <div class="logo">
        <i class="fas fa-chart-line"></i>
        <span v-show="!collapsed || mobileOpen">MEASSNEA</span>
      </div>
      <button class="toggle-btn" @click="$emit('toggle')">
        <i :class="collapsed && !mobileOpen ? 'fas fa-chevron-right' : 'fas fa-chevron-left'"></i>
      </button>
    </div>

    <nav class="sidebar-nav">
      <router-link
        v-for="item in navItems"
        :key="item.name"
        :to="item.path"
        class="nav-item"
        :class="{ active: route.path === item.path }"
        @click="mobileOpen && $emit('toggle')"
      >
        <i :class="item.icon"></i>
        <span v-show="!collapsed || mobileOpen">{{ item.label }}</span>
      </router-link>
    </nav>

    <div class="sidebar-footer" v-show="!collapsed || mobileOpen">
      <p>&copy; 2026 MEASSNEA_SYSTEM</p>
    </div>
  </aside>
</template>

<script setup>
import { useRoute } from 'vue-router'

const props = defineProps({
  collapsed: Boolean,
  mobileOpen: Boolean
})

defineEmits(['toggle'])
const route = useRoute()

const navItems = [
  { name: 'dashboard', label: 'ផ្ទាំងគ្រប់គ្រង', icon: 'fas fa-home', path: '/' },
  { name: 'stock', label: 'ស្តុកទំនិញ', icon: 'fas fa-boxes', path: '/stock' },
  { name: 'orders', label: 'ការកម្មង់', icon: 'fas fa-shopping-cart', path: '/orders' },
  { name: 'assets', label: 'ស្តុកអីវ៉ាន់', icon: 'fas fa-laptop', path: '/assets' },
  { name: 'income', label: 'ចំណូល', icon: 'fas fa-arrow-trend-up', path: '/income' },
  { name: 'expense', label: 'ចំណាយ', icon: 'fas fa-arrow-trend-down', path: '/expense' }
]
</script>