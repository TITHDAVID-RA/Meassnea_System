<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useIncomeStore } from '@/stores/incomeStore'
import { useOrderStore } from '@/stores/orderStore'
import { useStockStore } from '@/stores/stockStore'
import { useFormatters } from '@/composables/useFormatters'
import EmptyState from '@/components/EmptyState.vue'
import IncomeModal from '@/components/modals/IncomeModal.vue'

const incomeStore = useIncomeStore()
const orderStore = useOrderStore()
const stockStore = useStockStore()
const { formatCurrency, formatDate, formatPaymentMethod } = useFormatters()

const search = ref('')
const categoryFilter = ref('')
const startDate = ref('')
const endDate = ref('')

const showModal = ref(false)
const editingIncome = ref(null)

const activeDropdown = ref(null)

const showProductModal = ref(false)
const productIncome = ref(null)
const productOrder = ref(null)

onMounted(async () => {
  window.addEventListener('click', closeDropdowns)
  try {
    const promises = []
    if (incomeStore.incomes.length === 0) promises.push(incomeStore.fetchIncomes())
    if (orderStore.orders.length === 0) promises.push(orderStore.fetchOrders())
    if (stockStore.stockItems.length === 0) promises.push(stockStore.fetchStockData())
    if (promises.length > 0) await Promise.all(promises)
  } catch (error) {
    console.error('Failed to load initial income view data from D1:', error)
  }
})

onUnmounted(() => {
  window.removeEventListener('click', closeDropdowns)
})

const filteredIncomes = computed(() => {
  let items = incomeStore.incomes.filter(item => {
    const matchesSearch = !search.value || 
      item.description.toLowerCase().includes(search.value.toLowerCase()) ||
      (item.customer && item.customer.toLowerCase().includes(search.value.toLowerCase()))
    const matchesCategory = !categoryFilter.value || item.category === categoryFilter.value
    const matchesDateRange = (!startDate.value || new Date(item.date) >= new Date(startDate.value)) &&
      (!endDate.value || new Date(item.date) <= new Date(endDate.value))
    return matchesSearch && matchesCategory && matchesDateRange
  })
  return items.sort((a, b) => new Date(b.date) - new Date(a.date))
})

const filteredTotal = computed(() => {
  return filteredIncomes.value.reduce((sum, item) => sum + (item.amount || 0), 0)
})

function toggleDropdown(id) {
  activeDropdown.value = activeDropdown.value === id ? null : id
}

function closeDropdowns(e) {
  if (!e.target.closest('.action-container')) activeDropdown.value = null
}

function showAddIncome() {
  editingIncome.value = null
  showModal.value = true
}

function editIncome(item) {
  editingIncome.value = item
  showModal.value = true
  activeDropdown.value = null 
}

function viewProducts(item) {
  productIncome.value = item
  if (item.orderId) {
    productOrder.value = orderStore.orders.find(o => o.id === item.orderId) || null
  } else if (item.reference) {
    productOrder.value = orderStore.orders.find(o => o.orderNumber === item.reference) || null
  } else {
    productOrder.value = null
  }
  showProductModal.value = true
  activeDropdown.value = null
}

function getProductBreakdown(order) {
  if (!order) return []
  const paidItems = (order.items || []).map(item => {
    const size = stockStore.getSizeFromProductName(item.name || item.productName)
    const qty = Number(item.quantity || 0)
    const unitPrice = Number(item.unitPrice || 0)
    const costPrice = Number(item.costPrice || 0)
    return {
      name: item.name || item.productName || 'ផលិតផល',
      size: size || 'N/A',
      quantity: qty,
      unitPrice,
      costPrice,
      totalPrice: qty * unitPrice,
      totalCost: qty * costPrice,
      profit: (unitPrice - costPrice) * qty,
      isFree: false
    }
  })
  const freeItemsList = (order.freeItems || []).map(item => {
    const size = stockStore.getSizeFromProductName(item.name || item.productName)
    const qty = Number(item.quantity || 0)
    return {
      name: `${item.name || item.productName || 'ផលិតផល'} (ឥតគិតថ្លៃ)`,
      size: size || 'N/A',
      quantity: qty,
      unitPrice: 0,
      costPrice: 0,
      totalPrice: 0,
      totalCost: 0,
      profit: 0,
      isFree: true
    }
  })
  return [...paidItems, ...freeItemsList]
}

async function saveIncome(data) {
  try {
    if (editingIncome.value) {
      await incomeStore.updateIncome(editingIncome.value.id, data)
    } else {
      await incomeStore.addIncome(data)
    }
    showModal.value = false
  } catch (error) {
    alert('មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យចំណូល!')
  }
}

async function deleteIncome(id) {
  if (confirm('តើអ្នកប្រាកដថាចង់លុបទិន្នន័យចំណូលនេះមែនទេ?')) {
    try {
      await incomeStore.deleteIncome(id)
      activeDropdown.value = null
    } catch (error) {
      alert('មានបញ្ហាក្នុងការលុបទិន្នន័យចំណូល!')
    }
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div class="search-box">
        <i class="fas fa-search search-icon"></i>
        <input type="text" placeholder="ស្វែងរកចំណូល..." v-model="search" class="filter-input">
      </div>
      <button class="btn btn-primary" @click="showAddIncome">
        <i class="fas fa-plus"></i> បន្ថែមចំណូល
      </button>
    </div>

    <div class="card">
      <div class="table-header">
        <h3>បញ្ជីចំណូល</h3>
        <div class="filter-actions">
          <select v-model="categoryFilter" class="filter-input">
            <option value="">ប្រភេទទាំងអស់</option>
            <option v-for="cat in incomeStore.incomeCategories" :key="cat.id" :value="cat.name">
              {{ cat.name }}
            </option>
          </select>
          <input type="date" v-model="startDate" class="filter-input">
          <input type="date" v-model="endDate" class="filter-input">
        </div>
      </div>

      <div class="table-container scrollable-table-container hide-scrollbar">
        <table class="table" v-if="filteredIncomes.length > 0">
          <thead>
            <tr>
              <th>កាលបរិច្ឆេទ</th>
              <th>បរិយាយ</th>
              <th>ប្រភេទ</th>
              <th>អតិថិជន</th>
              <th>ការទូទាត់</th>
              <th class="text-right">ចំនួនទឹកប្រាក់</th>
              <th class="text-right">សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredIncomes" :key="item.id">
              <td>{{ formatDate(item.date) }}</td>
              <td>
                <div class="desc-cell">
                  <strong>{{ item.description }}</strong>
                  <span v-if="item.orderId" class="connected-record">
                    <i class="fas fa-link"></i> ការកម្មង់
                  </span>
                </div>
              </td>
              <td><span class="badge badge-success">{{ item.category }}</span></td>
              <td>{{ item.customer || '-' }}</td>
              <td>{{ formatPaymentMethod(item.paymentMethod) }}</td>
              <td class="text-right amount-cell">{{ formatCurrency(item.amount) }}</td>
              <td class="text-right action-cell">
                <div class="action-container">
                  <button class="btn-icon mobile-dots-toggle" @click.stop="toggleDropdown(item.id)">
                    <i class="fas fa-ellipsis-v"></i>
                  </button>
                  <div class="action-buttons" :class="{ 'show-mobile': activeDropdown === item.id }">
                    <button v-if="item.orderId || item.reference" class="btn-icon info" @click.stop="viewProducts(item)" title="មើលផលិតផល">
                      <i class="fas fa-boxes"></i>
                    </button>
                    <button class="btn-icon" @click.stop="editIncome(item)" title="កែប្រែ">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon danger" @click.stop="deleteIncome(item.id)" title="លុប">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot class="sticky-footer">
            <tr class="total-row">
              <td colspan="5" class="text-right"><strong>សរុបទឹកប្រាក់:</strong></td>
              <td class="text-right total-amount"><strong>{{ formatCurrency(filteredTotal) }}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <EmptyState v-else icon="fas fa-receipt" message="មិនមានទិន្នន័យចំណូលទេ" />
      </div>
    </div>

    <IncomeModal v-model="showModal" :income="editingIncome" @save="saveIncome" />

    <!-- Product Detail Modal -->
    <div v-if="showProductModal" class="modal-overlay" @click="showProductModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3><i class="fas fa-boxes"></i> ផលិតផលបានលក់ — {{ productIncome?.description }}</h3>
          <button class="modal-close" @click="showProductModal = false"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div v-if="productOrder && productOrder.items && productOrder.items.length > 0">
            <table class="product-table">
              <thead>
                <tr>
                  <th>ផលិតផល</th>
                  <th>ទំហំ</th>
                  <th>ចំនួន</th>
                  <th>តម្លៃលក់</th>
                  <th>តម្លៃដើម</th>
                  <th>ចំណេញ</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(product, idx) in getProductBreakdown(productOrder)" :key="idx" :class="{ 'free-item': product.isFree }">
                  <td>
                    <div class="product-name"><i :class="product.isFree ? 'fas fa-gift' : 'fas fa-cube'"></i><span>{{ product.name }}</span></div>
                  </td>
                  <td>
                    <span class="size-badge" :class="{ 'size-s': product.size === 'S', 'size-m': product.size === 'M', 'size-l': product.size === 'L' }">
                      {{ product.size === 'N/A' ? '—' : product.size }}
                    </span>
                  </td>
                  <td><strong>{{ product.quantity }}</strong></td>
                  <td>{{ formatCurrency(product.unitPrice) }}</td>
                  <td>{{ formatCurrency(product.costPrice) }}</td>
                  <td class="text-success"><strong>{{ formatCurrency(product.profit) }}</strong></td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" class="text-right"><strong>សរុប:</strong></td>
                  <td><strong>{{ getProductBreakdown(productOrder).reduce((s, p) => s + p.quantity, 0) }}</strong></td>
                  <td><strong>{{ formatCurrency(getProductBreakdown(productOrder).reduce((s, p) => s + p.totalPrice, 0)) }}</strong></td>
                  <td><strong>{{ formatCurrency(getProductBreakdown(productOrder).reduce((s, p) => s + p.totalCost, 0)) }}</strong></td>
                  <td class="text-success"><strong>{{ formatCurrency(getProductBreakdown(productOrder).reduce((s, p) => s + p.profit, 0)) }}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div v-else class="empty-products">
            <i class="fas fa-inbox"></i>
            <p>មិនអាចរកឃើញព័ត៌មានផលិតផលសម្រាប់ចំណូលនេះទេ</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollable-table-container {
  max-height: 600px;
  overflow-y: auto !important;
  overflow-x: auto;
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.table thead th {
  position: sticky;
  top: 0;
  background-color: #ffffff;
  z-index: 20;
  box-shadow: inset 0 -1px 0 var(--border-color);
}

.sticky-footer {
  position: sticky;
  bottom: 0;
  z-index: 20;
}

.sticky-footer td {
  background-color: #daffdd !important;
  padding: 1rem !important;
  box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.05);
}

.total-amount {
  color: var(--success-color);
  font-weight: 800;
  font-size: 1.1rem;
}

.action-cell {
  position: relative;
  overflow: visible !important;
}

.action-container {
  display: inline-flex;
  position: relative;
}

.mobile-dots-toggle {
  display: none;
  background: var(--bg-color);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.amount-cell {
  color: var(--success-color);
  font-weight: 700;
}

.connected-record {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--primary-color);
  background: #eff6ff;
  padding: 2px 6px;
  border-radius: 4px;
  margin-top: 4px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.modal-header h3 i { color: #3b82f6; }

.modal-close {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  font-size: 1rem;
}

.modal-close:hover {
  background: #f1f5f9;
  color: #dc2626;
}

.modal-body { padding: 1.5rem; }

.product-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.product-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  background: #f1f5f9;
  color: #475569;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.product-table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  color: #334155;
}

.product-table tbody tr:hover { background: #f8fafc; }

.product-table tfoot td {
  background: #f0fdf4;
  border-top: 2px solid #bbf7d0;
  padding: 1rem;
  font-weight: 700;
}

.product-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.product-name i {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 0.8rem;
  background: #dbeafe;
  color: #2563eb;
}

.size-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 700;
}

.size-s { background: #dbeafe; color: #1d4ed8; }
.size-m { background: #dcfce7; color: #15803d; }
.size-l { background: #fef3c7; color: #b45309; }

.text-success { color: #16a34a; }

.empty-products {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

.empty-products i {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
  color: #cbd5e1;
}

.btn-icon.info { color: #3b82f6; }
.btn-icon.info:hover { background: #eff6ff; }

.product-table tr.free-item td {
  background: #fdf2f8;
  color: #db2777;
  font-style: italic;
}

.product-table tr.free-item .product-name i {
  background: #fce7f3;
  color: #db2777;
}

@media (max-width: 1024px) {
  .mobile-dots-toggle { display: flex; }
  .action-buttons {
    display: none;
    position: absolute;
    right: 0;
    top: 35px;
    background: white;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-lg);
    border-radius: 8px;
    z-index: 100;
    flex-direction: column;
    padding: 6px;
    min-width: 120px;
  }
  .action-buttons.show-mobile { display: flex; }
  .action-buttons .btn-icon {
    width: 100%;
    justify-content: flex-start;
    padding: 10px;
    gap: 10px;
  }
  .action-buttons .btn-icon::after {
    content: attr(title);
    font-size: 14px;
  }
  .modal-content { max-width: 95vw; margin: 0.5rem; }
  .product-table { font-size: 0.8rem; }
  .product-table th, .product-table td { padding: 0.5rem 0.5rem; }
}

.text-right { text-align: right; }
</style>