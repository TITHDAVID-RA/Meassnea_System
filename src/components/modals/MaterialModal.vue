<script setup>
import { ref, computed, watch } from 'vue'
import { useStockStore } from '@/stores/stockStore'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'save'])

const stockStore = useStockStore()

const date = ref(new Date().toISOString().split('T')[0])
const notes = ref('')

// តែ price per gram (user input, stored in stockStore)
const teaPricePerGram = ref(stockStore.getTeaPricePerGram())

// Material configuration: name, hasSize, onlyPrice (no qty, just unit price)
const materialConfig = [
  { key: 'packageBag', name: 'ថង់វេចខ្ចប់', hasSize: true, onlyPrice: false },
  { key: 'box', name: 'ប្រអប់', hasSize: true, onlyPrice: false },
  { key: 'card', name: 'Leafleap', hasSize: true, onlyPrice: false },
  { key: 'labor', name: 'ពលកម្ម', hasSize: true, onlyPrice: true },
  { key: 'teaPowder', name: 'ទាបបារាំង', hasSize: false, onlyPrice: false, isKg: true },
  { key: 'plasticBag', name: 'ថង់', hasSize: false, onlyPrice: false },
  { key: 'caseBox', name: 'កេស', hasSize: false, onlyPrice: false }
]

const sizeLabels = {
  S: 'តូច (S)',
  M: 'មធ្យម (M)',
  L: 'ធំ (L)'
}

// Tea grams per product size (for display)
const teaGramsPerSize = {
  S: 100,
  M: 200,
  L: 500
}

// Data structure
const formData = ref({})

function initForm() {
  const obj = {}
  materialConfig.forEach(mat => {
    obj[mat.key] = {}
    if (mat.hasSize) {
      Object.keys(sizeLabels).forEach(size => {
        obj[mat.key][size] = { qty: 0, price: 0 }
      })
    } else {
      obj[mat.key]['N/A'] = { qty: 0, price: 0 }
    }
  })
  formData.value = obj
  // Load current tea price
  teaPricePerGram.value = stockStore.getTeaPricePerGram()
}

initForm()

watch(() => props.modelValue, (visible) => {
  if (visible) {
    date.value = new Date().toISOString().split('T')[0]
    notes.value = ''
    teaPricePerGram.value = stockStore.getTeaPricePerGram()
    initForm()
  }
})

const hasAnyData = computed(() => {
  return materialConfig.some(mat => {
    const sizes = formData.value[mat.key]
    return Object.values(sizes).some(s => (s.qty || 0) > 0)
  })
})

const grandTotal = computed(() => {
  let total = 0
  materialConfig.forEach(mat => {
    const sizes = formData.value[mat.key]
    Object.values(sizes).forEach(s => {
      if (mat.onlyPrice) {
        total += (s.price || 0)
      } else {
        total += (s.qty || 0) * (s.price || 0)
      }
    })
  })
  return total
})

function submit() {
  if (!hasAnyData.value) {
    alert('សូមបញ្ចូលចំនួនយ៉ាងតិចមួយ')
    return
  }

  const entries = []
  materialConfig.forEach(mat => {
    const sizes = formData.value[mat.key]
    Object.entries(sizes).forEach(([size, data]) => {
      if (mat.onlyPrice) {
        // Labor: only price, quantity always 1 per unit
        if ((data.price || 0) > 0) {
          entries.push({
            materialName: mat.name,
            size: size,
            quantity: 1,
            unitPrice: Number(data.price) || 0,
            totalPrice: Number(data.price) || 0,
            date: new Date(date.value),
            notes: notes.value
          })
        }
      } else if ((data.qty || 0) > 0) {
        entries.push({
          materialName: mat.name,
          size: size,
          quantity: Number(data.qty),
          unitPrice: Number(data.price) || 0,
          totalPrice: Number(data.qty) * (Number(data.price) || 0),
          date: new Date(date.value),
          notes: notes.value
        })
      }
    })
  })

  // Save តែ price per gram to stockStore
  stockStore.setTeaPricePerGram(teaPricePerGram.value)

  emit('save', { date: new Date(date.value), entries, grandTotal: grandTotal.value, notes: notes.value })
  close()
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="close">
      <div class="modal modal--wide">
        <div class="modal__header">
          <h2>បញ្ចូលស្តុកវត្ថុធាតុដើម</h2>
          <button class="close-btn" @click="close"><i class="fas fa-times"></i></button>
        </div>

        <div class="modal__body">
          <form @submit.prevent="submit" id="materialForm">
            <!-- Date & Notes -->
            <div class="form-row top-row">
              <div class="form-group date-group">
                <label>ថ្ងៃខែ *</label>
                <input type="date" v-model="date" required class="form-input">
              </div>
              <div class="form-group notes-group">
                <label>កំណត់សម្គាល់</label>
                <input type="text" v-model="notes" placeholder="កំណត់សម្គាល់..." class="form-input">
              </div>
            </div>

            <!-- តែ Price Per Gram - User Input -->
            <div class="tea-price-section">
              <div class="tea-price-header">
                <i class="fas fa-leaf"></i>
                <strong>តម្លៃតែ (គណនាដោយដៃ)</strong>
              </div>
              <div class="tea-price-body">
                <div class="tea-price-input-wrap">
                  <label class="tea-price-label">តម្លៃតែ ក្នុងមួយ 100ក្រាម ($/100g)</label>
                  <div class="input-wrap">
                    <span class="input-prefix">$/100g</span>
                    <input 
                      type="number" 
                      v-model.number="teaPricePerGram" 
                      min="0" 
                      step="0.01"
                      class="form-input tea-price-input"
                      placeholder="0.00"
                    >
                  </div>
                </div>
                <div class="tea-cost-preview" v-if="teaPricePerGram > 0">
                  <div class="preview-title">តម្លៃតែក្នុងមួយផលិតផល (តម្លៃ/100g):</div>
                  <div class="preview-grid">
                    <div class="preview-item">
                      <span class="preview-size">S ({{ teaGramsPerSize.S }}g)</span>
                      <span class="preview-cost">{{ (teaPricePerGram * (teaGramsPerSize.S / 100)).toFixed(2) }} $</span>
                    </div>
                    <div class="preview-item">
                      <span class="preview-size">M ({{ teaGramsPerSize.M }}g)</span>
                      <span class="preview-cost">{{ (teaPricePerGram * (teaGramsPerSize.M / 100)).toFixed(2) }} $</span>
                    </div>
                    <div class="preview-item">
                      <span class="preview-size">L ({{ teaGramsPerSize.L }}g)</span>
                      <span class="preview-cost">{{ (teaPricePerGram * (teaGramsPerSize.L / 100)).toFixed(2) }} $</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Materials Grid -->
            <div class="materials-grid">
              <div v-for="mat in materialConfig" :key="mat.key" class="material-card">
                <div class="material-header-bar">
                  <i class="fas fa-box"></i>
                  <strong>{{ mat.name }}</strong>
                </div>

                <div class="size-grid">
                  <template v-if="mat.hasSize">
                    <div v-for="(label, size) in sizeLabels" :key="size" class="size-input-block">
                      <label class="size-label">
                        {{ mat.key === 'packageBag' && size === 'M' ? 'កំប៉ុង (M)' : label }}
                      </label>
                      <div class="input-pair" :class="{ 'price-only': mat.onlyPrice }">
                        <div class="input-wrap" v-if="!mat.onlyPrice">
                          <span class="input-prefix">ចំនួន</span>
                          <input 
                            type="number" 
                            v-model.number="formData[mat.key][size].qty" 
                            min="0" 
                            class="form-input qty-input"
                            placeholder="0"
                          >
                        </div>
                        <div class="input-wrap" :class="{ 'full-width': mat.onlyPrice }">
                          <span class="input-prefix">តម្លៃ</span>
                          <input 
                            type="number" 
                            v-model.number="formData[mat.key][size].price" 
                            min="0" 
                            step="0.01"
                            class="form-input price-input"
                            placeholder="0.00"
                          >
                        </div>
                      </div>
                      <div v-if="!mat.onlyPrice && formData[mat.key][size].qty > 0" class="line-total">
                        = {{ (formData[mat.key][size].qty * formData[mat.key][size].price).toFixed(2) }} $
                      </div>
                      <div v-if="mat.onlyPrice && formData[mat.key][size].price > 0" class="line-total">
                        តម្លៃក្នុងមួយឯកតា: {{ formData[mat.key][size].price.toFixed(2) }} $
                      </div>
                    </div>
                  </template>

                  <template v-else>
                    <div class="size-input-block no-size">
                      <label class="size-label">{{ mat.isKg ? 'ចំនួន (kg)' : 'Default (N/A)' }}</label>
                      <div class="input-pair" :class="{ 'single-row': mat.isKg }">
                        <div class="input-wrap">
                          <span class="input-prefix">{{ mat.isKg ? 'kg' : 'ចំនួន' }}</span>
                          <input 
                            type="number" 
                            v-model.number="formData[mat.key]['N/A'].qty" 
                            min="0" 
                            step="0.01"
                            class="form-input qty-input"
                            placeholder="0"
                          >
                        </div>
                        <div class="input-wrap">
                          <span class="input-prefix">តម្លៃ</span>
                          <input 
                            type="number" 
                            v-model.number="formData[mat.key]['N/A'].price" 
                            min="0" 
                            step="0.01"
                            class="form-input price-input"
                            placeholder="0.00"
                          >
                        </div>
                      </div>
                      <div v-if="!mat.onlyPrice && formData[mat.key]['N/A'].qty > 0" class="line-total">
                        = {{ (formData[mat.key]['N/A'].qty * formData[mat.key]['N/A'].price).toFixed(2) }} $
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>

            <!-- Grand Total -->
            <div class="grand-total-bar">
              <span>តម្លៃសរុបទាំងអស់:</span>
              <strong>{{ grandTotal.toFixed(2) }} $</strong>
            </div>
          </form>
        </div>

        <div class="modal__footer">
          <button type="button" class="btn btn-outline" @click="close">បោះបង់</button>
          <button type="submit" form="materialForm" class="btn btn-primary">
            <i class="fas fa-save"></i> រក្សាទុក
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal--wide {
  max-width: 900px;
  width: 95%;
  max-height: 90vh;
  overflow-y: auto;
}

.top-row {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e2e8f0;
}

/* Tea Price Section */
.tea-price-section {
  background: #f0fdf4;
  border: 2px solid #bbf7d0;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 20px;
}

.tea-price-header {
  background: #166534;
  color: white;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
}

.tea-price-header i {
  font-size: 0.9rem;
  opacity: 0.8;
}

.tea-price-body {
  padding: 14px;
}

.tea-price-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tea-price-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #166534;
}

.tea-price-input {
  padding-left: 55px !important;
  max-width: 200px;
}

.tea-cost-preview {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #86efac;
}

.preview-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #15803d;
  margin-bottom: 8px;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.preview-item {
  background: white;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.preview-size {
  font-size: 0.75rem;
  color: #64748b;
}

.preview-cost {
  font-size: 0.95rem;
  font-weight: 700;
  color: #15803d;
}

.materials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.material-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}

.material-header-bar {
  background: #1e293b;
  color: white;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
}

.material-header-bar i {
  font-size: 0.9rem;
  opacity: 0.8;
}

.size-grid {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.size-input-block {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
}

.size-input-block.no-size {
  background: #f0f9ff;
  border-color: #bae6fd;
}

.size-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 6px;
}

.input-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.input-pair.single-row {
  grid-template-columns: 1fr 1fr;
}

.input-wrap {
  position: relative;
}

.input-prefix {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.7rem;
  color: #94a3b8;
  pointer-events: none;
}

.qty-input, .price-input {
  padding-left: 50px;
  padding-right: 8px;
  padding-top: 8px;
  padding-bottom: 8px;
  width: 100%;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  box-sizing: border-box;
}

.qty-input:focus, .price-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.line-total {
  text-align: right;
  font-size: 0.8rem;
  color: #16a34a;
  font-weight: 600;
  margin-top: 4px;
}

.grand-total-bar {
  background: #f0fdf4;
  border: 2px solid #bbf7d0;
  border-radius: 10px;
  padding: 14px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1rem;
}

.grand-total-bar strong {
  color: #15803d;
  font-size: 1.3rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
}

.form-input {
  padding: 8px 12px;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: #ffffff;
  border-radius: 12px;
  width: 100%;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 12px 12px 0 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.modal__header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.1rem;
  color: #64748b;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.close-btn:hover { background: #e2e8f0; }

.modal__body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 0 0 12px 12px;
  position: sticky;
  bottom: 0;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.btn-outline {
  background: #ffffff;
  color: #374151;
  border: 1.5px solid #d1d5db;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover { background: #2563eb; }

.input-pair.price-only {
  grid-template-columns: 1fr;
}

.input-wrap.full-width {
  grid-column: 1 / -1;
}

@media (max-width: 768px) {
  .materials-grid {
    grid-template-columns: 1fr;
  }
  .top-row {
    grid-template-columns: 1fr;
  }
  .preview-grid {
    grid-template-columns: 1fr;
  }
}
</style>