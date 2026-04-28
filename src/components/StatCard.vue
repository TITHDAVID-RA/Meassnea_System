<script setup>
import { computed } from 'vue'

const props = defineProps({
  icon: String,
  label: String,
  value: [String, Number],
  bgClass: {
    type: String,
    default: 'bg-primary'
  }
})

const iconClass = computed(() => props.icon)
</script>

<template>
  <div class="card stat-card">
    <div class="stat-card__icon" :class="bgClass">
      <i :class="iconClass"></i>
    </div>
    <div class="stat-card__content">
      <p class="stat-card__label">{{ label }}</p>
      <p class="stat-card__value">{{ value }}</p>
    </div>
  </div>
</template>