<script setup>
import { ref, computed } from 'vue'
import { useStockStore } from '@/stores/stockStore'
import { useOrderStore } from '@/stores/orderStore'
import { useIncomeStore } from '@/stores/incomeStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useFormatters } from '@/composables/useFormatters'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'save'])

const stockStore = useStockStore()
const orderStore = useOrderStore()
const incomeStore = useIncomeStore()
const inventoryStore = useInventoryStore()
const { formatCurrency } = useFormatters()

const form = ref({
  date: new Date().toISOString().split('T')[0],
  customer: '',
  paymentMethod: 'cash',
  status: 'pending',
  notes: ''
})

const items = ref([])

/**
 * UPDATED: availableProducts
 * This now only returns the "Active" batch for each product name.
 * An active batch is the oldest one with quantity > 0.
 */
const availableProducts = computed(() => {
  const allItems = stockStore.stockItems.filter(item => item.quantity > 0)
  const uniqueNames = [...new Set(allItems.map(i => i.name))]
  
  return uniqueNames.map(name => {
    // Find the oldest batch for this specific name
    const batches = allItems
      .filter(i => i.name === name)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    
    return batches[0] // Return only the oldest available batch
  }).filter(Boolean)
})

const total = computed(() => {
  return items.value.reduce((sum, item) => sum + ((item.unitPrice || 0) * (item.quantity || 0)), 0)
})

function addItem() {
  items.value.push({
    id: Date.now() + Math.random(),
    productId: '',
    quantity: 1,
    unitPrice: 0,
    maxStock: 0
  })
}

function removeItem(index) {
  if (items.value.length > 1) {
    items.value.splice(index, 1)
  } else {
    alert('ការកម្មង់ត្រូវតែមានទំនិញយ៉ាងតិចមួយ')
  }
}

function updateItemPrice(index) {
  const item = items.value[index]
  const product = stockStore.getProductById(item.productId)
  if (product) {
    item.unitPrice = product.unitPrice
    item.maxStock = product.quantity
    if (item.quantity > product.quantity) {
      item.quantity = product.quantity
    }
  }
}

function validateItems() {
  for (const item of items.value) {
    if (!item.productId || !item.quantity || item.quantity <= 0 || !item.unitPrice) {
      alert('សូមបំពេញព័ត៌មានទំនិញឱ្យបានត្រឹមត្រូវ')
      return null
    }
    const product = stockStore.getProductById(item.productId)
    if (!product) {
      alert('រកមិនឃើញទំនិញ')
      return null
    }
    if (item.quantity > product.quantity) {
      alert(`ចំនួនស្តុកមិនគ្រាន់គ្រាន់សម្រាប់ ${product.name} (នៅសល់: ${product.quantity})`)
      return null
    }
  }
  return items.value.map(item => {
    const product = stockStore.getProductById(item.productId)
    return {
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.unitPrice * item.quantity
    }
  })
}

function save() {
  const validatedItems = validateItems()
  if (!validatedItems) return

  const order = orderStore.createOrder({
    date: new Date(form.value.date),
    customer: form.value.customer,
    paymentMethod: form.value.paymentMethod,
    status: form.value.status,
    items: validatedItems,
    total: total.value,
    notes: form.value.notes
  })

  if (form.value.status === 'completed') {
    validatedItems.forEach(item => {
      const product = stockStore.getProductById(item.productId)
      if (product) {
        stockStore.adjustStock(item.productId, item.quantity, 'out')
        inventoryStore.recordMovement({
          productId: product.id,
          productName: product.name,
          type: 'sale',
          quantity: item.quantity,
          reference: order.orderNumber,
          notes: `Sold to ${form.value.customer}`
        })
      }
    })

    incomeStore.addIncome({
      date: new Date(form.value.date),
      amount: order.total,
      category: 'លក់ផលិតផល',
      paymentMethod: form.value.paymentMethod,
      customer: form.value.customer,
      orderId: order.id,
      reference: order.orderNumber,
      description: `${order.orderNumber}`
    })
  }

  close()
}

function close() {
  emit('update:modelValue', false)
  resetForm()
}

function resetForm() {
  form.value = {
    date: new Date().toISOString().split('T')[0],
    customer: '',
    paymentMethod: 'cash',
    status: 'pending',
    notes: ''
  }
  items.value = []
  addItem()
}

addItem()
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="close">
      <div class="modal" style="max-width: 700px;">
        <div class="modal__header">
          <h2>បង្កើតការកម្មង់ថ្មី</h2>
          <button class="close-btn" @click="close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal__body">
          <form @submit.prevent="save">
            <div class="form-row">
              <div class="form-group">
                <label>កាលបរិច្ឆេទ *</label>
                <input type="date" v-model="form.date" required>
              </div>
              <div class="form-group">
                <label>ឈ្មោះអតិថិជន *</label>
                <input type="text" v-model="form.customer" required placeholder="ឈ្មោះអតិថិជន">
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>វិធីសាស្ត្រទូទាត់ *</label>
                <select v-model="form.paymentMethod" required>
                  <option value="cash">សាច់ប្រាក់</option>
                  <option value="bank_transfer">ផ្ទេរប្រាក់តាមធនាគារ</option>
                </select>
              </div>
              <div class="form-group">
                <label>ស្ថានភាពការកម្មង់ *</label>
                <select v-model="form.status" required>
                  <option value="pending">មិនទាន់ទូទាត់ (Pending)</option>
                  <option value="completed">ទូទាត់រួច (Completed)</option>
                </select>
              </div>
            </div>

            <div class="order-items-section">
              <div class="section-header">
                <h4>បញ្ជីទំនិញកម្មង់</h4>
                <button type="button" class="btn btn-outline btn-sm" @click="addItem">
                  <i class="fas fa-plus"></i> បន្ថែមទំនិញ
                </button>
              </div>
              
              <div class="order-items-list">
                <div v-for="(item, index) in items" :key="item.id" class="order-item-row">
                  <div class="form-group flex-grow">
                    <label>ឈ្មោះទំនិញ</label>
                    <select v-model="item.productId" @change="updateItemPrice(index)" required>
                      <option value="">ជ្រើសរើសទំនិញ</option>
                      <option 
                        v-for="product in availableProducts" 
                        :key="product.id" 
                        :value="product.id"
                      >
                        {{ product.name }} (ស្តុកនៅសល់: {{ product.quantity }})
                      </option>
                    </select>
                  </div>
                  <div class="form-group width-sm">
                    <label>ចំនួន</label>
                    <input type="number" v-model.number="item.quantity" min="1" :max="item.maxStock" required>
                  </div>
                  <div class="form-group width-md">
                    <label>តម្លៃឯកតា</label>
                    <input type="text" :value="formatCurrency(item.unitPrice)" readonly>
                  </div>
                  <button type="button" class="remove-item-btn" @click="removeItem(index)" title="Remove">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div class="order-total">
                សរុប: {{ formatCurrency(total) }}
              </div>
            </div>

            <div class="form-group">
              <label>សម្គាល់ (កំណត់ចំណាំផ្សេងៗ)</label>
              <textarea v-model="form.notes" rows="2"></textarea>
            </div>
          </form>
        </div>
        <div class="modal__footer">
          <button class="btn btn-outline" @click="close">បោះបង់</button>
          <button class="btn btn-primary" @click="save">បង្កើតការកម្មង់</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>

@media (max-width: 600px) {
  .order-item-row {
    flex-direction: column; /* Stack fields vertically */
    align-items: stretch;
    gap: 8px;
    padding-top: 40px;
    position: relative; /* Space for absolute positioned trash icon */
  }

  .width-sm, .width-md, .flex-grow {
    width: 100% !important; /* Full width on mobile */
  }

  .remove-item-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 5px 10px;
  }
  
  .modal__header h2 {
    font-size: 1.2rem; /* Smaller title on mobile */
  }
}
</style>