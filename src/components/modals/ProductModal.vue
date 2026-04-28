<script setup>
import { ref, watch, onMounted } from 'vue'
import { useStockStore } from '@/stores/stockStore'

const props = defineProps({
  modelValue: Boolean,
  product: Object
})

const emit = defineEmits(['update:modelValue', 'save'])

const stockStore = useStockStore()

const form = ref({
  name: '',
  category: '',
  quantity: 0,
  unitPrice: 0,
  minStockLevel: 0,
  description: ''
})

const isEditing = computed(() => !!props.product)

watch(() => props.product, (newProduct) => {
  if (newProduct) {
    form.value = { ...newProduct }
  } else {
    resetForm()
  }
}, { immediate: true })

function resetForm() {
  form.value = {
    name: '',
    category: '',
    quantity: 0,
    unitPrice: 0,
    minStockLevel: 0,
    description: ''
  }
}

function save() {
  if (!form.value.name || !form.value.category || 
      isNaN(form.value.quantity) || isNaN(form.value.unitPrice) || isNaN(form.value.minStockLevel)) {
    alert('Please fill in all required fields')
    return
  }
  
  emit('save', { ...form.value })
  close()
}

function close() {
  emit('update:modelValue', false)
  resetForm()
}

import { computed } from 'vue'
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="close">
      <div class="modal">
        <div class="modal__header">
          <h2>{{ isEditing ? 'Edit Product' : 'Add New Product' }}</h2>
          <button class="close-btn" @click="close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal__body">
          <form @submit.prevent="save">
            <div class="form-row">
              <div class="form-group">
                <label>ឈ្មោះផលិតផល *</label>
                <input type="text" v-model="form.name" required>
              </div>
              <div class="form-group">
                <label>ប្រភេទទំនេញ *</label>
                <select v-model="form.category" required>
                  <option value="">ជ្រើសរើសប្រភេទទំនេញ</option>
                  <option v-for="cat in stockStore.stockCategories" :key="cat.id" :value="cat.name">
                    {{ cat.name }}
                  </option>
                </select>
              </div>
              <!-- <div class="form-group">
                <label>SKU *</label>
                <input type="text" v-model="form.sku" required>
              </div> -->
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>ចំនួនផលិតផល *</label>
                <input type="number" v-model.number="form.quantity" required min="0">
              </div>
              <div class="form-group">
                <label>តម្លៃឯកតា *</label>
                <input type="number" v-model.number="form.unitPrice" required min="0" step="0.01">
              </div>
            </div>
            <div class="form-group">
              <label>កំណត់ស្តុកពេលជិតអស់ *</label>
              <input type="number" v-model.number="form.minStockLevel" required min="0">
            </div>
            <div class="form-group">
              <label>កំណត់សំម្គាល់</label>
              <textarea v-model="form.description" rows="3"></textarea>
            </div>
          </form>
        </div>
        <div class="modal__footer">
          <button class="btn btn-outline" @click="close">បោះបង់</button>
          <button class="btn btn-primary" @click="save">រក្សាទុក</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>