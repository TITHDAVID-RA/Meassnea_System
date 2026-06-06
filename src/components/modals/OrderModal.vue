<script setup>
import { ref, computed } from 'vue'
import { useStockStore } from '@/stores/stockStore'
import { useOrderStore } from '@/stores/orderStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useFormatters } from '@/composables/useFormatters'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'save'])

const stockStore = useStockStore()
const orderStore = useOrderStore()
const inventoryStore = useInventoryStore()
const { formatCurrency } = useFormatters()

const form = ref({
  date: new Date().toISOString().split('T')[0],
  customer: '',
  paymentMethod: 'cash',
  status: 'pending',
  caseBoxQty: 0,
  deliveryCost: 0,
})

const items = ref([])
const freeItems = ref([])
const plasticBags = ref([])

const availableProducts = computed(() => {
  const allItems = stockStore.stockItems.filter((item) => item.quantity > 0)
  const uniqueNames = [...new Set(allItems.map((i) => i.name))]
  return uniqueNames
    .map((name) => {
      return allItems
        .filter((i) => i.name === name)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0]
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})

const total = computed(() => {
  const itemsTotal = items.value.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  return itemsTotal
})

function addItem() {
  items.value.push({ productId: '', quantity: 1, unitPrice: 0, costPrice: 0 })
}
function removeItem(index) {
  items.value.splice(index, 1)
}

function addFreeItem() {
  freeItems.value.push({ productId: '', quantity: 1, unitPrice: 0, costPrice: 0 })
}
function removeFreeItem(index) {
  freeItems.value.splice(index, 1)
}

function updateItemPrice(index) {
  const product = stockStore.getProductById(items.value[index].productId)
  if (product) {
    items.value[index].unitPrice = product.unitPrice
    items.value[index].costPrice = product.costPrice || 0
  }
}

function updateFreeItemPrice(index) {
  const product = stockStore.getProductById(freeItems.value[index].productId)
  if (product) {
    freeItems.value[index].unitPrice = 0
    freeItems.value[index].costPrice = product.costPrice || 0
  }
}

function addPlasticBag() {
  plasticBags.value.push({ size: 'S', qty: 1 })
}
function removePlasticBag(index) {
  plasticBags.value.splice(index, 1)
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
    caseBoxQty: 0,
    deliveryCost: 0,
  }
  items.value = []
  freeItems.value = []
  plasticBags.value = []
}

async function save() {
  if (items.value.length === 0 && freeItems.value.length === 0)
    return alert('សូមជ្រើសរើសទំនិញយ៉ាងតិចមួយ')

  // Validate paid items stock
  for (const item of items.value) {
    const product = stockStore.getProductById(item.productId)
    if (!product) return alert('ទំនិញមិនត្រឹមត្រូវ')
    if (item.quantity > product.quantity) {
      return alert(`ស្តុកមិនគ្រប់គ្រាន់សម្រាប់ ${product.name}។ នៅសល់: ${product.quantity}`)
    }
  }

  // Validate free items stock
  for (const item of freeItems.value) {
    const product = stockStore.getProductById(item.productId)
    if (!product) return alert('ទំនិញឥតគិតថ្លៃមិនត្រឹមត្រូវ')
    if (item.quantity > product.quantity) {
      return alert(
        `ស្តុកមិនគ្រប់គ្រាន់សម្រាប់ ${product.name} (ឥតគិតថ្លៃ)។ នៅសល់: ${product.quantity}`,
      )
    }
  }

  // Calculate plastic bag cost
  let plasticBagCost = 0
  for (const bag of plasticBags.value) {
    if (bag.qty > 0 && ['S', 'M'].includes(bag.size)) {
      const unitCost = stockStore.getMaterialUnitCost('ថង់', bag.size)
      plasticBagCost += (Number(bag.qty) || 0) * unitCost
    }
  }

  const orderData = {
    customer: form.value.customer,
    paymentMethod: form.value.paymentMethod,
    status: form.value.status,
    plasticBags: plasticBags.value
      .map((bag) => ({
        size: bag.size,
        qty: Number(bag.qty || 0),
      }))
      .filter((bag) => bag.qty > 0),
    plasticBagCost: Number(plasticBagCost.toFixed(4)),
    caseBoxQty: Number(form.value.caseBoxQty || 0),
    deliveryCost: Number(form.value.deliveryCost || 0),
    date: form.value.date,
    items: items.value.map((item) => {
      const product = stockStore.getProductById(item.productId)
      return {
        productId: item.productId,
        productName: product?.name || '',
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        costPrice: Number(product?.costPrice || 0),
        total: Number((item.quantity * item.unitPrice).toFixed(4)),
        isFree: false,
      }
    }),
    freeItems: freeItems.value.map((item) => {
      const product = stockStore.getProductById(item.productId)
      return {
        productId: item.productId,
        productName: product?.name || '',
        quantity: Number(item.quantity || 1),
        unitPrice: 0,
        costPrice: Number(product?.costPrice || 0),
        total: 0,
        isFree: true,
      }
    }),
    total: Number(total.value),
  }

  try {
    const order = await orderStore.createOrder(orderData)

    // Deduct paid items stock
    for (const item of items.value) {
      const product = stockStore.getProductById(item.productId)
      if (product) {
        const previousQty = product.quantity
        await stockStore.adjustStock(item.productId, item.quantity, 'out')

        await inventoryStore.recordMovement({
          productId: product.id,
          productName: product.name,
          type: 'out',
          quantity: item.quantity,
          previousQuantity: previousQty,
          newQuantity: product.quantity,
          unitPrice: item.unitPrice,
          totalValue: item.quantity * item.unitPrice,
          reference: order.orderNumber,
          referenceId: order.id,
          notes: `Reserved for ${order.customer} - ${order.status}`,
        })
      }
    }

    // Deduct free items stock
    for (const item of freeItems.value) {
      const product = stockStore.getProductById(item.productId)
      if (product) {
        const previousQty = product.quantity
        await stockStore.adjustStock(item.productId, item.quantity, 'out')

        await inventoryStore.recordMovement({
          productId: product.id,
          productName: product.name,
          type: 'out',
          quantity: item.quantity,
          previousQuantity: previousQty,
          newQuantity: product.quantity,
          unitPrice: 0,
          totalValue: 0,
          reference: order.orderNumber,
          referenceId: order.id,
          notes: `ឥតគិតថ្លៃ (Free) for ${order.customer} - ${order.status}`,
        })
      }
    }

    for (const bag of plasticBags.value) {
      if (bag.qty > 0 && ['S', 'M'].includes(bag.size)) {
        await stockStore.deductPlasticBag(bag.size, Number(bag.qty), order.orderNumber)
      }
    }

    if (form.value.caseBoxQty > 0) {
      await stockStore.materialStockOut({
        materialName: 'កេស',
        size: 'N/A',
        quantity: Number(form.value.caseBoxQty) || 0,
        notes: `បានកាត់ចេញតាមការកម្មង់លេខ: ${order.orderNumber}`,
      })
    }

    emit('save')
    close()
  } catch (error) {
    console.error('Failed to process order sequence:', error)
    alert('មានបញ្ហាក្នុងការបង្កើតការបញ្ជាទិញនេះ!')
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="close">
      <div class="modal-container">
        <div class="modal__header">
          <h2>បង្កើតការកម្មង់ថ្មី</h2>
          <button class="close-btn" @click="close"><i class="fas fa-times"></i></button>
        </div>

        <div class="modal__body">
          <form @submit.prevent>
            <div class="form-row">
              <div class="form-group">
                <label>ថ្ងៃខែ</label>
                <input type="date" v-model="form.date" class="form-input" />
              </div>
              <div class="form-group">
                <label>លេខទូរសព្ទ</label>
                <input
                  type="text"
                  v-model="form.customer"
                  placeholder="លេខទូរសព្ទ"
                  class="form-input"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>វិធីសាស្ត្រទូទាត់</label>
                <select v-model="form.paymentMethod" class="form-select">
                  <option value="cash">សាច់ប្រាក់ (Cash)</option>
                  <option value="bank">ធនាគារ (Bank Transfer)</option>
                </select>
              </div>
              <div class="form-group">
                <label>ស្ថានភាព</label>
                <select v-model="form.status" class="form-select">
                  <option value="pending">កំពុងរង់ចាំ (Pending)</option>
                  <option value="completed">បានបញ្ចប់ (Completed)</option>
                </select>
              </div>
            </div>

            <div class="items-section plastic-bag-section">
              <div class="section-header">
                <h3>ថង់ផ្លាស្ទិក (Plastic Bags)</h3>
                <button type="button" class="btn-add-item" @click="addPlasticBag">
                  <i class="fas fa-plus"></i> បន្ថែមថង់
                </button>
              </div>
              <div class="items-list">
                <div
                  v-for="(bag, index) in plasticBags"
                  :key="index"
                  class="order-item-row plastic-bag-row"
                >
                  <div class="item-product">
                    <select v-model="bag.size" class="form-select">
                      <option value="S">ថង់ S</option>
                      <option value="M">ថង់ M</option>
                    </select>
                  </div>
                  <div class="item-qty">
                    <input
                      type="number"
                      v-model.number="bag.qty"
                      placeholder="ចំនួន"
                      min="1"
                      class="form-input"
                    />
                  </div>
                  <button type="button" class="remove-item-btn" @click="removePlasticBag(index)">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>

            <div class="form-row charges-row">
              <div class="form-group">
                <label>ចំនួនកេស (Case Boxes)</label>
                <input type="number" v-model.number="form.caseBoxQty" min="0" class="form-input" />
              </div>
              <div class="form-group">
                <label>ថ្លៃដឹកជញ្ជូន (Delivery $)</label>
                <input
                  type="number"
                  v-model.number="form.deliveryCost"
                  min="0"
                  step="0.0001"
                  class="form-input"
                />
              </div>
            </div>

            <div class="items-section">
              <div class="section-header">
                <h3>បញ្ជីទំនិញ</h3>
                <button type="button" class="btn-add-item" @click="addItem">
                  <i class="fas fa-plus"></i> បន្ថែមទំនិញ
                </button>
              </div>

              <div class="items-list">
                <div v-for="(item, index) in items" :key="index" class="order-item-row">
                  <div class="item-product">
                    <select
                      v-model="item.productId"
                      @change="updateItemPrice(index)"
                      class="form-select"
                    >
                      <option value="" disabled>ជ្រើសរើសទំនិញ</option>
                      <option v-for="p in availableProducts" :key="p.id" :value="p.id">
                        {{ p.name }} (សល់: {{ p.quantity }})
                      </option>
                    </select>
                  </div>
                  <div class="item-qty">
                    <input
                      type="number"
                      v-model.number="item.quantity"
                      placeholder="ចំនួន"
                      min="1"
                      class="form-input"
                    />
                  </div>
                  <div class="item-cost">
                    <input
                      type="text"
                      :value="formatCurrency(item.costPrice)"
                      readonly
                      class="form-input readonly"
                      title="តម្លៃដើម"
                    />
                  </div>
                  <div class="item-price">
                    <input
                      type="number"
                      v-model.number="item.unitPrice"
                      placeholder="តម្លៃលក់"
                      min="0"
                      step="0.0001"
                      class="form-input"
                    />
                  </div>
                  <button type="button" class="remove-item-btn" @click="removeItem(index)">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>

              <div class="order-summary-footer">
                <div class="summary-item">
                  <span>ថ្លៃដឹកជញ្ជូន:</span>
                  <span>{{ formatCurrency(form.deliveryCost) }}</span>
                </div>
                <div class="summary-item total">
                  <span>សរុបរួម:</span>
                  <span>{{ formatCurrency(total) }}</span>
                </div>
              </div>
            </div>

            <!-- Free Items Section -->
            <div class="items-section free-items-section">
              <div class="section-header">
                <h3>ទំនិញឥតគិតថ្លៃ (Free Products)</h3>
                <button type="button" class="btn-add-item btn-free" @click="addFreeItem">
                  <i class="fas fa-gift"></i> បន្ថែមឥតគិតថ្លៃ
                </button>
              </div>

              <div class="items-list">
                <div
                  v-for="(item, index) in freeItems"
                  :key="index"
                  class="order-item-row free-item-row"
                >
                  <div class="item-product">
                    <select
                      v-model="item.productId"
                      @change="updateFreeItemPrice(index)"
                      class="form-select"
                    >
                      <option value="" disabled>ជ្រើសរើសទំនិញ</option>
                      <option v-for="p in availableProducts" :key="p.id" :value="p.id">
                        {{ p.name }} (សល់: {{ p.quantity }})
                      </option>
                    </select>
                  </div>
                  <div class="item-qty">
                    <input
                      type="number"
                      v-model.number="item.quantity"
                      placeholder="ចំនួន"
                      min="1"
                      class="form-input"
                    />
                  </div>
                  <div class="item-cost">
                    <input
                      type="text"
                      :value="formatCurrency(item.costPrice)"
                      readonly
                      class="form-input readonly"
                      title="តម្លៃដើម"
                    />
                  </div>
                  <div class="item-price free-price">
                    <span class="free-label">ឥតគិតថ្លៃ</span>
                  </div>
                  <button type="button" class="remove-item-btn" @click="removeFreeItem(index)">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
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
  overflow-y: auto;
}
.modal-container {
  background: #ffffff;
  border-radius: 12px;
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
}
.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  position: sticky;
  top: 0;
  z-index: 10;
}
.modal__header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
}
.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: #64748b;
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}
.close-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}
.modal__body {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}
.form-input,
.form-select {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
}
.form-input.readonly {
  background: #f3f4f6;
  cursor: not-allowed;
}
.charges-row {
  background-color: #f0f9ff;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid #bae6fd;
}
.items-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 2px solid #e2e8f0;
}
.plastic-bag-section {
  background-color: #fefce8;
  border: 1px solid #fde047;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}
.plastic-bag-section .section-header {
  margin-bottom: 12px;
}
.plastic-bag-section h3 {
  color: #854d0e;
  font-size: 1rem;
}
.plastic-bag-row {
  background: #fffbeb;
  border-color: #fcd34d;
}
.free-items-section {
  background-color: #fdf2f8;
  border: 1px solid #f9a8d4;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}
.free-items-section .section-header {
  margin-bottom: 12px;
}
.free-items-section h3 {
  color: #9d174d;
  font-size: 1rem;
}
.free-item-row {
  background: #fce7f3;
  border-color: #f9a8d4;
}
.free-price {
  display: flex;
  align-items: center;
  justify-content: center;
}
.free-label {
  background: #db2777;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 700;
}
.btn-free {
  background: #db2777;
}
.btn-free:hover {
  background: #be185d;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.btn-add-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.order-item-row {
  display: grid;
  grid-template-columns: 1fr 80px 90px 100px 40px;
  gap: 10px;
  align-items: center;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.plastic-bag-row {
  display: grid;
  grid-template-columns: 1fr 120px 40px;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  background: #fffbeb;
  border-radius: 8px;
  border: 1px solid #fcd34d;
}

@media (max-width: 640px) {
  .order-item-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .plastic-bag-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .item-product select {
    width: 100%;
    min-width: 0;
  }
  .item-qty,
  .item-cost,
  .item-price {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .item-qty::before {
    content: 'ចំនួន:';
    font-size: 0.85rem;
    color: #64748b;
    font-weight: 500;
  }
  .item-cost::before {
    content: 'តម្លៃដើម:';
    font-size: 0.85rem;
    color: #64748b;
    font-weight: 500;
  }
  .item-price::before {
    content: 'តម្លៃលក់:';
    font-size: 0.85rem;
    color: #64748b;
    font-weight: 500;
  }
  .item-qty input,
  .item-cost input,
  .item-price input {
    flex: 1;
  }
  .remove-item-btn {
    width: 100%;
    margin-top: 4px;
  }
}
.remove-item-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fee2e2;
  color: #dc2626;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.order-summary-footer {
  margin-top: 20px;
  padding: 16px 20px;
  background: #f0fdf4;
  border-radius: 10px;
  border: 1px solid #bbf7d0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.summary-item.total {
  font-size: 1.3rem;
  font-weight: 800;
  color: #15803d;
}
.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  position: sticky;
  bottom: 0;
}
.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.btn-outline {
  background: #ffffff;
  border: 1.5px solid #d1d5db;
}
.btn-primary {
  background: #3b82f6;
  color: white;
}
</style>
