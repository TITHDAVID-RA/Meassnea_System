<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useStockStore } from '@/stores/stockStore'

const props = defineProps({
  modelValue: Boolean,
})

const emit = defineEmits(['update:modelValue', 'save'])

const stockStore = useStockStore()

const date = ref(new Date().toISOString().split('T')[0])
const notes = ref('')

// តែ price per gram (user input, stored in stockStore)
const teaPricePerGram = ref(stockStore.getTeaPricePerGram())

// Track original last prices to detect price-only changes
const originalLastPrices = ref({})

// Material configuration: name, hasSize, onlyPrice (no qty, just unit price)
const materialConfig = [
  { key: 'plasticBag', name: 'ថង់', hasSize: true, onlyPrice: false, sizes: ['S', 'M'] },
  { key: 'packageBag', name: 'ថង់វេចខ្ចប់', hasSize: true, onlyPrice: false },
  { key: 'box', name: 'ប្រអប់', hasSize: true, onlyPrice: false, sizes: ['S', 'M'] },
  { key: 'card', name: 'Leafleap', hasSize: true, onlyPrice: false, sizes: ['S', 'M'] },
  { key: 'sticker', name: 'ស្ទីកគ័រ', hasSize: true, onlyPrice: false, sizes: ['M', 'L'] },
  { key: 'labor', name: 'ពលកម្ម', hasSize: true, onlyPrice: true },
  { key: 'teaPowder', name: 'ទាបបារាំង', hasSize: false, onlyPrice: false, isKg: true },
  { key: 'caseBox', name: 'កេស', hasSize: false, onlyPrice: false },
]

const sizeLabels = {
  S: 'តូច (S)',
  M: 'មធ្យម (M)',
  L: 'ធំ (L)',
}

// Helper to get allowed sizes for a material based on its config
function getAllowedSizes(mat) {
  if (!mat.sizes) return sizeLabels
  const result = {}
  mat.sizes.forEach((size) => {
    if (sizeLabels[size]) result[size] = sizeLabels[size]
  })
  return result
}

// Tea grams per product size (for display)
const teaGramsPerSize = {
  S: 100,
  M: 200,
  L: 500,
}

function formatMoney(value) {
  if (value === 0 || value === null || value === undefined) return '0'
  const num = Number(value)
  if (isNaN(num)) return '0'

  // Round to 4 decimal places using proper rounding
  const rounded = Math.round(num * 10000) / 10000

  // Convert to string and trim trailing zeros
  let str = rounded.toString()

  // If it's in scientific notation, fall back to toFixed
  if (str.includes('e')) {
    str = rounded.toFixed(4).replace(/\.?0+$/, '')
  }

  return str
}

// Data structure
const formData = ref({})

function initForm() {
  const obj = {}
  materialConfig.forEach((mat) => {
    obj[mat.key] = {}
    if (mat.hasSize) {
      // Use mat.sizes if defined, otherwise all sizes S/M/L
      const allowedSizes = mat.sizes || Object.keys(sizeLabels)
      allowedSizes.forEach((size) => {
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

watch(
  () => props.modelValue,
  async (visible) => {
    if (visible) {
      date.value = new Date().toISOString().split('T')[0]
      notes.value = ''
      teaPricePerGram.value = stockStore.getTeaPricePerGram()

      // Build form data with pre-filled prices from last purchase (តម្លៃចុងក្រោយ)
      // Also track original last prices for detecting price-only changes
      const obj = {}
      const origPrices = {}
      materialConfig.forEach((mat) => {
        obj[mat.key] = {}
        if (mat.hasSize) {
          // Use mat.sizes if defined, otherwise all sizes S/M/L
          const allowedSizes = mat.sizes || Object.keys(sizeLabels)
          allowedSizes.forEach((size) => {
            const lastPrice = stockStore.getLastMaterialPrice(mat.name, size)
            obj[mat.key][size] = {
              qty: 0,
              price: lastPrice > 0 ? Number(lastPrice.toFixed(4)) : 0,
            }
            origPrices[`${mat.name}|${size}`] = lastPrice
          })
        } else {
          const lastPrice = stockStore.getLastMaterialPrice(mat.name, 'N/A')
          obj[mat.key]['N/A'] = {
            qty: 0,
            price: lastPrice > 0 ? Number(lastPrice.toFixed(4)) : 0,
          }
          origPrices[`${mat.name}|N/A`] = lastPrice
        }
      })
      formData.value = obj
      originalLastPrices.value = origPrices

      // Ensure DOM updates with the new values
      await nextTick()
    }
  },
)

const hasAnyData = computed(() => {
  return materialConfig.some((mat) => {
    const sizes = formData.value[mat.key]
    return Object.values(sizes).some((s) => (s.qty || 0) > 0)
  })
})

const grandTotal = computed(() => {
  let total = 0
  materialConfig.forEach((mat) => {
    const sizes = formData.value[mat.key]
    Object.values(sizes).forEach((s) => {
      if (mat.onlyPrice) {
        total += s.price || 0
      } else {
        total += (s.qty || 0) * (s.price || 0)
      }
    })
  })
  return total
})

async function submit() {
  const entries = []
  const priceUpdates = []

  materialConfig.forEach((mat) => {
    const sizes = formData.value[mat.key]
    Object.entries(sizes).forEach(([size, data]) => {
      const origPrice = originalLastPrices.value[`${mat.name}|${size}`] || 0
      const currentPrice = Number(data.price) || 0
      const currentQty = Number(data.qty) || 0

      if (mat.onlyPrice) {
        // Labor: only price, quantity always 1 per unit
        if (currentPrice > 0) {
          entries.push({
            materialName: mat.name,
            size: size,
            quantity: 1,
            unitPrice: currentPrice,
            totalPrice: currentPrice,
            date: new Date(date.value),
            notes: notes.value,
          })
        }
      } else if (currentQty > 0) {
        // Quantity entered → create new transaction
        entries.push({
          materialName: mat.name,
          size: size,
          quantity: currentQty,
          unitPrice: currentPrice,
          totalPrice: currentQty * currentPrice,
          date: new Date(date.value),
          notes: notes.value,
        })
      } else if (currentPrice !== origPrice && origPrice > 0) {
        // Price changed but no quantity → update last transaction price
        priceUpdates.push({
          materialName: mat.name,
          size: size,
          newUnitPrice: currentPrice,
        })
      }
    })
  })

  // Save តែ price per gram to stockStore
  stockStore.setTeaPricePerGram(teaPricePerGram.value)

  // Apply price-only updates to the most recent 'in' transaction for each material+size
  for (const update of priceUpdates) {
    try {
      // Find the most recent 'in' transaction for this material+size
      const txs = stockStore.materialTransactions
        .filter(tx => 
          tx.type === 'in' && 
          tx.materialName === update.materialName && 
          tx.size === update.size &&
          tx.quantity > 0
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date))

      if (txs.length > 0) {
        const lastTx = txs[0]
        const newTotalPrice = lastTx.quantity * update.newUnitPrice
        await stockStore.updateMaterialTransaction(lastTx.id, {
          unitPrice: update.newUnitPrice,
          totalPrice: newTotalPrice,
        })
      }
    } catch (error) {
      console.error(`Failed to update price for ${update.materialName} ${update.size}:`, error)
    }
  }

  emit('save', {
    date: new Date(date.value),
    entries,
    grandTotal: grandTotal.value,
    notes: notes.value,
  })
  close()
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="close">
      <div class="modal-container">
        <header class="modal-header">
          <div class="header-content">
            <h2>បញ្ចូលស្តុកទំនិញ</h2>
            <p>គ្រប់គ្រងទិន្នន័យទិញចូលតាមប្រភេទ</p>
          </div>
          <button class="close-btn" @click="close">&times;</button>
        </header>

        <div class="modal-body">
          <div class="meta-section">
            <div class="field-group date-field">
              <label>ថ្ងៃខែទិញចូល</label>
              <input type="date" v-model="date" class="form-control" />
            </div>
            <div class="field-group note-field">
              <label>កំណត់សម្គាល់</label>
              <input
                type="text"
                v-model="notes"
                placeholder="ព័ត៌មានបន្ថែម..."
                class="form-control"
              />
            </div>
          </div>

          <div class="tea-status-bar">
            <div class="tea-input-part">
              <div class="label-row">
                <span class="icon">🍃</span>
                <label>តម្លៃតែ ($/100g)</label>
              </div>
              <input type="number" v-model.number="teaPricePerGram" step="0.01" class="tea-input" />
            </div>

            <div class="tea-preview-part">
              <div v-for="(grams, size) in teaGramsPerSize" :key="size" class="tea-pill">
                <span class="pill-name">{{ size }} ({{ grams }}g)</span>
                <span class="pill-cost">${{ formatMoney(teaPricePerGram * (grams / 100)) }}</span>
              </div>
            </div>
          </div>

          <div class="materials-grid">
            <div v-for="mat in materialConfig" :key="mat.key" class="material-card">
              <div class="card-header">
                <span class="name">{{ mat.name }}</span>
                <span v-if="mat.isKg" class="badge">KG</span>
              </div>

              <div class="card-content">
                <template v-if="mat.hasSize">
                  <div v-for="(label, size) in getAllowedSizes(mat)" :key="size" class="row-item">
                    <div class="row-info">
                      <span class="row-label">{{
                        mat.key === 'packageBag' && size === 'M' ? 'កំប៉ុង (M)' : label
                      }}</span>
                      <span class="row-total" v-if="formData[mat.key][size].qty > 0">
                        Total: ${{
                          formatMoney(formData[mat.key][size].qty * formData[mat.key][size].price)
                        }}
                      </span>
                    </div>

                    <div class="input-row">
                      <div class="input-box qty" v-if="!mat.onlyPrice">
                        <label>QTY</label>
                        <input type="number" v-model.number="formData[mat.key][size].qty" />
                      </div>
                      <div class="input-box price" :class="{ 'full-width': mat.onlyPrice }">
                        <label>PRICE</label>
                        <input
                          type="number"
                          v-model.number="formData[mat.key][size].price"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <div class="row-item single">
                    <div class="input-row">
                      <div class="input-box qty">
                        <label>{{ mat.isKg ? 'WEIGHT (KG)' : 'QTY' }}</label>
                        <input type="number" v-model.number="formData[mat.key]['N/A'].qty" />
                      </div>
                      <div class="input-box price">
                        <label>PRICE</label>
                        <input
                          type="number"
                          v-model.number="formData[mat.key]['N/A'].price"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <footer class="modal-footer">
          <div class="summary">
            <span class="sum-label">តម្លៃសរុបទាំងអស់</span>
            <span class="sum-value">${{ formatMoney(grandTotal) }}</span>
          </div>
          <div class="actions">
            <button class="btn btn-secondary" @click="close">បោះបង់</button>
            <button class="btn btn-primary" @click="submit">រក្សាទុកទិន្នន័យ</button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Reset & Base Control */
* {
  box-sizing: border-box;
}

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
  max-width: 950px;
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
  overflow-x: hidden;
  background: #f8fafc;
  flex: 1;
}

/* Metadata Flex Layout */
.meta-section {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}
.date-field {
  flex: 0 0 220px;
}
.note-field {
  flex: 1 1 300px;
}
.field-group label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 0.5rem;
}
.form-control {
  width: 100%;
  padding: 0.65rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  outline: none;
}
.form-control:focus {
  border-color: #3b82f6;
}

/* Tea Status Bar Styles */
.tea-status-bar {
  background: #0f172a;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .tea-status-bar {
    flex-direction: row;
    align-items: center;
  }
}

.tea-input-part {
  flex-shrink: 0;
}
.label-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.label-row label {
  font-size: 0.7rem;
  color: #94a3b8;
  font-weight: 700;
  text-transform: uppercase;
}
.tea-input {
  background: #1e293b;
  border: 2px solid #334155;
  border-radius: 8px;
  color: #fff;
  padding: 0.5rem 1rem;
  width: 130px;
  font-weight: 800;
  font-size: 1.1rem;
  outline: none;
}

.tea-preview-part {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  flex: 1;
}
.tea-pill {
  background: rgba(255, 255, 255, 0.05);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex: 1 1 auto;
}
.pill-name {
  font-size: 0.75rem;
  color: #94a3b8;
}
.pill-cost {
  font-weight: 800;
  color: #10b981;
}

/* Material Grid & Cards */
.materials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 1.25rem;
}

.material-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}
.card-header {
  padding: 0.75rem 1.25rem;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  font-weight: 800;
  color: #334155;
  font-size: 0.9rem;
}
.badge {
  background: #dbeafe;
  color: #2563eb;
  font-size: 0.6rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.card-content {
  padding: 0.5rem 1.25rem;
}
.row-item {
  padding: 1.25rem 0;
  border-bottom: 1px dotted #e2e8f0;
}
.row-item:last-child {
  border-bottom: none;
}

.row-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}
.row-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: #64748b;
}
.row-total {
  font-size: 0.75rem;
  font-weight: 800;
  color: #059669;
}

.input-row {
  display: flex;
  gap: 0.75rem;
}
.input-box {
  flex: 1;
}
.input-box label {
  display: block;
  font-size: 0.6rem;
  font-weight: 800;
  color: #94a3b8;
  margin-bottom: 4px;
}
.input-box input {
  width: 100%;
  padding: 0.5rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 6px;
  text-align: center;
  font-weight: 800;
  outline: none;
  font-size: 0.95rem;
}
.input-box input:focus {
  border-color: #3b82f6;
}
.full-width {
  flex: 100%;
}

/* Footer */
.modal-footer {
  padding: 1.25rem 2rem;
  border-top: 1px solid #e2e8f0;
  background: #fff;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1.25rem;
}
.summary {
  display: flex;
  flex-direction: column;
}
.sum-label {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 600;
}
.sum-value {
  font-size: 1.75rem;
  font-weight: 900;
  color: #1e293b;
}

.actions {
  display: flex;
  gap: 0.75rem;
  flex: 1;
  justify-content: flex-end;
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
  .actions {
    width: 100%;
  }
  .btn {
    flex: 1;
  }
  .tea-status-bar {
    padding: 1rem;
  }
  .tea-input {
    width: 100%;
  }
}
</style>