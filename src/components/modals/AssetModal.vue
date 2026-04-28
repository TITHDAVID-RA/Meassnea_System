<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  asset: Object
})

const emit = defineEmits(['update:modelValue', 'save'])

const form = ref({
  name: '',
  category: '',
  location: '',
  assignedTo: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  value: '',
  vendor: '',
  description: ''
})

const isEditing = computed(() => !!props.asset)

watch(() => props.asset, (newAsset) => {
  if (newAsset) {
    form.value = {
      name: newAsset.name,
      category: newAsset.category,
      location: newAsset.location,
      assignedTo: newAsset.assignedTo || '',
      purchaseDate: newAsset.purchaseDate ? new Date(newAsset.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      value: newAsset.value,
      vendor: newAsset.vendor || '',
      description: newAsset.description || ''
    }
  } else {
    resetForm()
  }
}, { immediate: true })

function resetForm() {
  form.value = {
    name: '',
    category: '',
    location: '',
    assignedTo: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    value: '',
    vendor: '',
    description: ''
  }
}

function save() {
  if (!form.value.name || !form.value.category || !form.value.location || !form.value.purchaseDate || isNaN(form.value.value)) {
    alert('សូមបំពេញព័ត៌មានដែលចាំបាច់ (Required fields)')
    return
  }
  
  emit('save', { 
    ...form.value, 
    value: parseFloat(form.value.value),
    purchaseDate: new Date(form.value.purchaseDate)
  })
  close()
}

function close() {
  emit('update:modelValue', false)
  resetForm()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="close">
      <div class="modal" style="max-width: 600px;">
        <div class="modal__header">
          <h2>{{ isEditing ? 'កែប្រែព័ត៌មានទ្រព្យសម្បត្តិ' : 'បន្ថែមទ្រព្យសម្បត្តិថ្មី' }}</h2>
          <button class="close-btn" @click="close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal__body">
          <form @submit.prevent="save">
            <div class="form-row">
              <div class="form-group">
                <label>ឈ្មោះទ្រព្យសម្បត្តិ *</label>
                <input type="text" v-model="form.name" required placeholder="ឧទាហរណ៍: MacBook Pro">
              </div>
              <div class="form-group">
                <label>ប្រភេទ *</label>
                <input type="text" v-model="form.category" required placeholder="ឧទាហរណ៍: អេឡិចត្រូនិច">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>ទីតាំង *</label>
                <input type="text" v-model="form.location" required placeholder="ឧទាហរណ៍: ការិយាល័យភ្នំពេញ">
              </div>
              <div class="form-group">
                <label>អ្នកកាន់កាប់</label>
                <input type="text" v-model="form.assignedTo" placeholder="ឈ្មោះបុគ្គលិក ឬ ផ្នែក">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>កាលបរិច្ឆេទទិញ *</label>
                <input type="date" v-model="form.purchaseDate" required>
              </div>
              <div class="form-group">
                <label>តម្លៃទិញចូល *</label>
                <input type="number" v-model.number="form.value" required min="0" step="0.01">
              </div>
            </div>

            <div class="form-group">
              <div class="form-group">
                <label>អ្នកផ្គត់ផ្គង់ (Vendor)</label>
                <input type="text" v-model="form.vendor">
              </div>
            </div>

            <div class="form-group">
              <label>ការពិពណ៌នា</label>
              <textarea v-model="form.description" rows="3" placeholder="ព័ត៌មានបន្ថែមផ្សេងៗ..."></textarea>
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

<style scoped>
/* Added layout consistency for form rows */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}
@media (max-width: 480px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>