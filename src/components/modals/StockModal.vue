<script setup>
import { ref, computed, watch } from 'vue'
import { useStockStore } from '@/stores/stockStore'

const props = defineProps({
  modelValue: Boolean,
  editData: Object // Receives the row data
})

const emit = defineEmits(['update:modelValue', 'process'])
const stockStore = useStockStore()

const name = ref('')
const quantity = ref(1)
const costPrice = ref(0)
const sellingPrice = ref(0)
const minStockLevel = ref(5)
const notes = ref('')

// This logic "fills" the form when the editData prop is provided
watch(() => props.editData, (newVal) => {
  if (newVal) {
    name.value = newVal.name
    quantity.value = newVal.quantity
    costPrice.value = newVal.costPrice || 0
    sellingPrice.value = newVal.unitPrice // Mapping unitPrice to sellingPrice
    minStockLevel.value = newVal.minStockLevel || 5
    notes.value = newVal.notes || ''
  } else {
    resetForm()
  }
}, { immediate: true })

const uniqueNames = computed(() => [...new Set(stockStore.stockItems.map(i => i.name))])

function submit() {
  if (!name.value.trim() || quantity.value <= 0) {
    alert('សូមបំពេញព័ត៌មានឱ្យបានត្រឹមត្រូវ')
    return
  }

  emit('process', {
    name: name.value.trim(),
    quantity: quantity.value,
    costPrice: costPrice.value,
    price: sellingPrice.value,
    minStockLevel: minStockLevel.value,
    notes: notes.value
  })
  
  close()
}

function close() {
  emit('update:modelValue', false)
}

function resetForm() {
  name.value = ''
  quantity.value = 1
  costPrice.value = 0
  sellingPrice.value = 0
  minStockLevel.value = 5
  notes.value = ''
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="close">
      <div class="modal">
        <div class="modal__header">
          <h2>{{ editData ? 'កែប្រែព័ត៌មានស្តុក' : 'បញ្ចូលស្តុកថ្មី' }}</h2>
          <button class="close-btn" @click="close"><i class="fas fa-times"></i></button>
        </div>

        <div class="modal__body">
          <form @submit.prevent="submit" id="stockForm">
            <div class="form-group">
              <label>ឈ្មោះទំនិញ *</label>
              <input type="text" v-model="name" list="stock-suggestions" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>ចំនួនបញ្ចូល *</label>
                <input type="number" v-model.number="quantity" min="0" required>
              </div>
              <div class="form-group">
                <label>តម្លៃដើម ($) *</label>
                <input type="number" v-model.number="costPrice" step="0.01" required>
              </div>
            </div>

            <div class="form-group">
              <label>តម្លៃលក់ ($) *</label>
              <input type="number" v-model.number="sellingPrice" step="0.01" required>
            </div>

            <div class="form-group">
              <label>កម្រិតផ្តល់ដំណឹងស្តុកទាប *</label>
              <input type="number" v-model.number="minStockLevel" min="0" required>
            </div>

            <div class="form-group">
              <label>កំណត់សម្គាល់</label>
              <textarea v-model="notes" rows="3"></textarea>
            </div>
          </form>
        </div>

        <div class="modal__footer">
          <button type="button" class="btn btn-outline" @click="close">បោះបង់</button>
          <button type="submit" form="stockForm" class="btn btn-primary">
            {{ editData ? 'រក្សាទុកការកែប្រែ' : 'រក្សាទុកស្តុក' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>