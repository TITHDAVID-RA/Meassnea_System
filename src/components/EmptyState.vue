<script setup>
defineProps({
  icon: {
    type: String,
    default: 'fas fa-box-open'
  },
  message: {
    type: String,
    default: 'No items found'
  }
})
</script>

<template>
  <div class="empty-state">
    <i :class="icon"></i>
    <p>{{ message }}</p>
  </div>
</template>