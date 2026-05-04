<script setup>
import { ref, watch, computed } from 'vue'
import { useStockStore } from '@/stores/stockStore'

const props = defineProps({
  modelValue: Boolean,
  editData: Object,
})

const emit = defineEmits(['update:modelValue', 'process'])

const stockStore = useStockStore()

const name = ref('')
const quantity = ref(1)
const costPrice = ref(0)
const sellingPrice = ref(0)
const minStockLevel = ref(5)
const notes = ref('')

// Products: S, M, L only (no XL), names in Khmer
const allowedProducts = ['តែទាបបារាំង (S)', 'តែទាបបារាំង (M)', 'តែទាបបារាំង (L)']

// Auto-calculate costPrice from material costs when product or size changes
const autoCostPrice = computed(() => {
  const size = stockStore.getSizeFromProductName(name.value)
  if (!size) return 0
  return Number(stockStore.getMaterialCostPerUnit(size).toFixed(2))
})

// Watch for edit data to fill the form
watch(
  () => props.editData,
  (newVal) => {
    if (newVal) {
      name.value = newVal.name
      quantity.value = newVal.quantity
      costPrice.value = newVal.costPrice || 0
      sellingPrice.value = newVal.unitPrice || 0
      minStockLevel.value = newVal.minStockLevel || 5
      notes.value = newVal.notes || ''
    } else {
      resetForm()
    }
  },
  { immediate: true },
)

// When product selection changes, auto-fill costPrice if not editing
watch(name, (newName) => {
  if (!props.editData && newName) {
    const size = stockStore.getSizeFromProductName(newName)
    if (size) {
      costPrice.value = Number(stockStore.getMaterialCostPerUnit(size).toFixed(2))
    }
  }
})

function resetForm() {
  name.value = ''
  quantity.value = 1
  costPrice.value = 0
  sellingPrice.value = 0
  minStockLevel.value = 5
  notes.value = ''
}

function close() {
  emit('update:modelValue', false)
}

function submit() {
  if (!name.value || quantity.value <= 0) {
    alert('សូមបំពេញព័ត៌មានឱ្យបានត្រឹមត្រូវ')
    return
  }

  emit('process', {
    name: name.value,
    quantity: Number(quantity.value),
    costPrice: Number(costPrice.value),
    unitPrice: Number(sellingPrice.value),
    minStockLevel: Number(minStockLevel.value),
    notes: notes.value,
    createdAt: props.editData ? props.editData.createdAt : new Date().toISOString(),
  })

  close()
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
          <form id="stockForm" @submit.prevent="submit">
            <div class="form-group">
              <label>ជ្រើសរើសផលិតផល *</label>
              <select v-model="name" class="form-select" required>
                <option value="" disabled>-- ជ្រើសរើស --</option>
                <option v-for="p in allowedProducts" :key="p" :value="p">{{ p }}</option>
              </select>
              <small v-if="autoCostPrice > 0" class="cost-hint">
                <i class="fas fa-calculator"></i>
                តម្លៃវត្ថុធាតុដើមសរុប: {{ autoCostPrice.toFixed(2) }} $ (ថង់វេចខ្ចប់ + ប្រអប់ + Leafleap +
                តែ + ពលកម្ម)
              </small>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>ចំនួនបញ្ចូល *</label>
                <input type="number" v-model.number="quantity" min="1" required />
              </div>
              <div class="form-group">
                <label>តម្លៃដើម ($) *</label>
                <input type="number" v-model.number="costPrice" step="0.01" required />
                <small class="field-hint">គណនាពីវត្ថុធាតុដើម</small>
              </div>
            </div>

            <div class="form-group">
              <label>តម្លៃលក់ ($) *</label>
              <input type="number" v-model.number="sellingPrice" step="0.01" required />
            </div>

            <div class="form-group">
              <label>កម្រិតផ្តល់ដំណឹងស្តុកទាប *</label>
              <input type="number" v-model.number="minStockLevel" min="0" required />
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

<style scoped>
.form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background-color: #fff;
  font-size: 1rem;
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}
.form-group label {
  font-size: 0.9rem;
  font-weight: 500;
  color: #475569;
}
.form-group input,
.form-group textarea {
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
}
.cost-hint {
  color: #16a34a;
  font-size: 0.8rem;
  margin-top: 4px;
}
.cost-hint i {
  margin-right: 4px;
}
.field-hint {
  color: #64748b;
  font-size: 0.75rem;
}
</style>