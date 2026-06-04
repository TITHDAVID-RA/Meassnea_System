<script setup>
import { ref, watch, computed } from 'vue'
import { useStockStore } from '@/stores/stockStore'

const props = defineProps({
  modelValue: Boolean,
  editData: Object,
})

const emit = defineEmits(['update:modelValue', 'save'])

const stockStore = useStockStore()

const date = ref('')
const materialName = ref('')
const size = ref('N/A')
const quantity = ref(0)
const unitPrice = ref(0)
const notes = ref('')

const sizeLabels = {
  S: 'តូច (S)',
  M: 'មធ្យម (M)',
  L: 'ធំ (L)',
  'N/A': 'គ្មានទំហំ',
}

function formatMoney(value) {
  if (value === 0 || value === null || value === undefined) return '0'
  const num = Number(value)
  if (isNaN(num)) return '0'
  const rounded = Math.round(num * 10000) / 10000
  let str = rounded.toString()
  if (str.includes('e')) {
    str = rounded.toFixed(4).replace(/\.?0+$/, '')
  }
  return str
}

const totalPrice = computed(() => {
  return (Number(quantity.value) || 0) * (Number(unitPrice.value) || 0)
})

watch(
  () => props.editData,
  (newVal) => {
    if (newVal) {
      date.value = newVal.date ? new Date(newVal.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      materialName.value = newVal.materialName || ''
      size.value = newVal.size || 'N/A'
      quantity.value = newVal.quantity || 0
      unitPrice.value = newVal.unitPrice || 0
      notes.value = newVal.notes || ''
    } else {
      resetForm()
    }
  },
  { immediate: true },
)

function resetForm() {
  date.value = new Date().toISOString().split('T')[0]
  materialName.value = ''
  size.value = 'N/A'
  quantity.value = 0
  unitPrice.value = 0
  notes.value = ''
}

function close() {
  emit('update:modelValue', false)
}

function submit() {
  if (!materialName.value || quantity.value <= 0) {
    alert('សូមបំពេញព័ត៌មានឱ្យបានត្រឹមត្រូវ')
    return
  }

  emit('save', {
    id: props.editData?.id,
    materialName: materialName.value,
    size: size.value,
    quantity: Number(quantity.value),
    unitPrice: Number(unitPrice.value),
    totalPrice: totalPrice.value,
    date: new Date(date.value),
    notes: notes.value,
  })

  close()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="close">
      <div class="modal-container">
        <header class="modal-header">
          <div class="header-content">
            <h2>កែប្រែប្រតិបត្តិការវត្ថុធាតុដើម</h2>
            <p>កែប្រែព័ត៌មានប្រតិបត្តិការទិញចូល</p>
          </div>
          <button class="close-btn" @click="close">&times;</button>
        </header>

        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label>ឈ្មោះវត្ថុធាតុដើម *</label>
              <input type="text" v-model="materialName" class="form-control" readonly />
            </div>

            <div class="form-group">
              <label>ទំហំ</label>
              <input type="text" :value="sizeLabels[size] || size" class="form-control" readonly />
            </div>

            <div class="form-group">
              <label>ថ្ងៃខែ *</label>
              <input type="date" v-model="date" class="form-control" required />
            </div>

            <div class="form-group">
              <label>ចំនួន *</label>
              <input type="number" v-model.number="quantity" min="1" class="form-control" required />
            </div>

            <div class="form-group">
              <label>តម្លៃ/ឯកតា ($) *</label>
              <input type="number" v-model.number="unitPrice" step="0.01" min="0" class="form-control" required />
            </div>

            <div class="form-group">
              <label>តម្លៃសរុប</label>
              <div class="total-display">${{ formatMoney(totalPrice) }}</div>
            </div>

            <div class="form-group full-width">
              <label>កំណត់សម្គាល់</label>
              <input type="text" v-model="notes" placeholder="ព័ត៌មានបន្ថែម..." class="form-control" />
            </div>
          </div>
        </div>

        <footer class="modal-footer">
          <div class="actions">
            <button class="btn btn-secondary" @click="close">បោះបង់</button>
            <button class="btn btn-primary" @click="submit">រក្សាទុកការកែប្រែ</button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  background: #ffffff;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.modal-header {
  padding: 1.25rem 2rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-content h2 {
  margin: 0;
  font-size: 1.2rem;
  color: #1e293b;
}
.header-content p {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
}
.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #94a3b8;
  cursor: pointer;
}

.modal-body {
  padding: 1.5rem 2rem;
  overflow-y: auto;
  background: #f8fafc;
  flex: 1;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group.full-width {
  grid-column: span 2;
}

.form-group label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
}

.form-control {
  width: 100%;
  padding: 0.65rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  outline: none;
  background: #fff;
}

.form-control[readonly] {
  background: #f1f5f9;
  color: #64748b;
}

.form-control:focus {
  border-color: #3b82f6;
}

.total-display {
  padding: 0.65rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  font-weight: 800;
  color: #15803d;
  font-size: 1.1rem;
  text-align: center;
}

.modal-footer {
  padding: 1.25rem 2rem;
  border-top: 1px solid #e2e8f0;
  background: #fff;
  display: flex;
  justify-content: flex-end;
}

.actions {
  display: flex;
  gap: 0.75rem;
}

.btn {
  padding: 0.7rem 1.5rem;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  white-space: nowrap;
}

.btn-secondary {
  background: #fff;
  border: 1px solid #e2e8f0;
  color: #475569;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
  box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.2);
}

@media (max-width: 480px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .form-group.full-width {
    grid-column: span 1;
  }
  .actions {
    width: 100%;
  }
  .btn {
    flex: 1;
  }
}
</style>