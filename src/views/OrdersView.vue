<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useOrderStore } from '@/stores/orderStore'
import { useStockStore } from '@/stores/stockStore'
import { useIncomeStore } from '@/stores/incomeStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useFormatters } from '@/composables/useFormatters'
import StatCard from '@/components/StatCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import OrderModal from '@/components/modals/OrderModal.vue'
import OrderDetailModal from '@/components/modals/OrderDetailModal.vue'

const orderStore = useOrderStore()
const stockStore = useStockStore()
const incomeStore = useIncomeStore()
const inventoryStore = useInventoryStore()
const { formatCurrency, formatDate } = useFormatters()

const search = ref('')
const statusFilter = ref('')
const startDate = ref('')
const endDate = ref('')

const showOrderModal = ref(false)
const showDetailModal = ref(false)
const selectedOrderId = ref(null)

const activeMenuId = ref(null)

const toggleMenu = (id) => {
  activeMenuId.value = activeMenuId.value === id ? null : id
}

const closeMenus = (e) => {
  if (!e.target.closest('.action-wrapper')) activeMenuId.value = null
}

onMounted(() => window.addEventListener('click', closeMenus))
onUnmounted(() => window.removeEventListener('click', closeMenus))

/**
 * UPDATED LOGIC: Search items + Sort Newest First
 */
const filteredOrders = computed(() => {
  let items = orderStore.orders.filter((order) => {
    const searchLower = search.value.toLowerCase()
    
    // Search Order # or Customer
    const matchesBasic = !search.value ||
      order.orderNumber.toLowerCase().includes(searchLower) ||
      order.customer.toLowerCase().includes(searchLower)
    
    // NEW: Search for Item names inside the order
    const matchesItems = order.items.some(item => 
      item.productName.toLowerCase().includes(searchLower)
    )

    const matchesStatus = !statusFilter.value || order.status === statusFilter.value
    const matchesDateRange =
      (!startDate.value || new Date(order.date) >= new Date(startDate.value)) &&
      (!endDate.value || new Date(order.date) <= new Date(endDate.value))
    
    return (matchesBasic || matchesItems) && matchesStatus && matchesDateRange
  })

  // SORT: New to Old (Newest at the top)
  return items.sort((a, b) => new Date(b.date) - new Date(a.date))
})

const totals = computed(() => {
  return filteredOrders.value.reduce(
    (acc, order) => {
      if (order.status === 'completed' || order.status === 'pending') {
        const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
        acc.items += itemCount
        acc.amount += order.total
      }
      return acc
    },
    { items: 0, amount: 0 },
  )
})

function getStatusClass(status) {
  return `badge-${status}`
}

function viewDetails(id) {
  selectedOrderId.value = id
  showDetailModal.value = true
  activeMenuId.value = null
}

function cancelOrder(id) {
  if (!confirm('Are you sure you want to cancel this order?')) return
  const order = orderStore.getOrderById(id)
  if (!order) return

  if (order.status === 'completed') {
    order.items.forEach((item) => {
      const product = stockStore.getProductById(item.productId)
      if (product) {
        const previousQty = product.quantity
        stockStore.adjustStock(item.productId, item.quantity, 'in')
        inventoryStore.recordMovement({
          productId: product.id,
          productName: product.name,
          type: 'return',
          quantity: item.quantity,
          previousQuantity: previousQty,
          newQuantity: product.quantity,
          unitPrice: item.unitPrice,
          totalValue: item.total,
          reference: order.orderNumber,
          referenceId: order.id,
          notes: 'Order cancelled - stock returned',
        })
      }
    })
    const incomeIndex = incomeStore.incomes.findIndex((i) => i.orderId === id)
    if (incomeIndex !== -1) incomeStore.incomes.splice(incomeIndex, 1)
  }
  orderStore.cancelOrder(id)
  activeMenuId.value = null
}

function completeOrder(id) {
  const order = orderStore.getOrderById(id)
  if (!order || order.status !== 'pending') return

  for (const item of order.items) {
    const product = stockStore.getProductById(item.productId)
    if (product) {
      if (item.quantity > product.quantity) {
        alert(`Cannot complete order. Not enough stock for ${product.name}. Available: ${product.quantity}`)
        return
      }
      const previousQty = product.quantity
      stockStore.adjustStock(item.productId, item.quantity, 'out')
      inventoryStore.recordMovement({
        productId: product.id,
        productName: product.name,
        type: 'sale',
        quantity: item.quantity,
        previousQuantity: previousQty,
        newQuantity: product.quantity,
        unitPrice: item.unitPrice,
        totalValue: item.total,
        reference: order.orderNumber,
        referenceId: order.id,
        notes: `Sold to ${order.customer}`,
      })
    }
  }
  orderStore.completeOrder(id)
  incomeStore.addIncome({
    date: new Date(),
    amount: order.total,
    category: 'លក់ផលិតផល',
    paymentMethod: order.paymentMethod,
    description: `${order.orderNumber}`,
    customer: order.customer,
    reference: order.orderNumber,
    orderId: order.id,
  })
  activeMenuId.value = null
}
</script>

<template>
  <div class="page">
    <div class="page-header">
<div class="search-box">
  <i class="fas fa-search search-icon"></i>
  <input 
    type="text" 
    placeholder="ស្វែងរកការកម្មង់..." 
    v-model="search" 
    class="search-input"
  />
</div>
      <button class="btn btn-primary" @click="showOrderModal = true">
        <i class="fas fa-plus"></i> កម្មង់ថ្មី
      </button>
    </div>

    <div class="card">
      <div class="table-header">
        <h3>Orders</h3>
        <div class="filter-actions">
          <select v-model="statusFilter">
            <option value="">All Status</option>
            <option value="completed">ទូទាត់រួច</option>
            <option value="pending">មិនទូទាត់</option>
            <option value="cancelled">បានបោះបង់</option>
          </select>
          <input type="date" v-model="startDate" />
          <input type="date" v-model="endDate" />
        </div>
      </div>

      <div class="table-container scrollable-table-container hide-scrollbar">
        <table class="table" v-if="filteredOrders.length > 0">
          <thead>
            <tr>
              <th>Order #</th>
              <th>ថ្ងៃខែ</th>
              <th>ឈ្មោះអតិថិជន</th>
              <th>ទំនិញ</th>
              <th></th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in filteredOrders" :key="order.id">
              <td><strong>{{ order.orderNumber }}</strong></td>
              <td>{{ formatDate(order.date) }}</td>
              <td>{{ order.customer }}</td>
              <td>
                <div class="item-names">
                  {{ order.items.map((item) => item.productName).join(', ') }}
                </div>
                <small class="text-muted">
                  ({{ order.items.reduce((sum, item) => sum + item.quantity, 0) }} units)
                </small>
              </td>
              <td class="amount-cell">{{ formatCurrency(order.total) }}</td>
              <td>
                <span class="badge" :class="getStatusClass(order.status)">
                  <template v-if="order.status === 'pending'">មិនទាន់ទូទាត់</template>
                  <template v-else-if="order.status === 'completed'">ទូទាត់រួច</template>
                  <template v-else-if="order.status === 'cancelled'">បានបោះបង់</template>
                  <template v-else>{{ order.status }}</template>
                </span>
              </td>
              <td class="text-right">
                <div class="action-wrapper">
                  <button class="btn-dots" @click.stop="toggleMenu(order.id)">
                    <i class="fas fa-ellipsis-v"></i>
                  </button>

                  <div class="action-buttons" :class="{ 'is-open': activeMenuId === order.id }">
                    <button class="btn-icon" @click="viewDetails(order.id)" title="View Details">
                      <i class="fas fa-eye"></i> <span class="mobile-label">View Details</span>
                    </button>
                    <button v-if="order.status === 'pending'" class="btn-icon success" @click="completeOrder(order.id)" title="Complete">
                      <i class="fas fa-check"></i> <span class="mobile-label">ទូទាត់</span>
                    </button>
                    <button v-if="order.status !== 'cancelled'" class="btn-icon danger" @click="cancelOrder(order.id)" title="Cancel">
                      <i class="fas fa-times"></i> <span class="mobile-label">បោះបង់</span>
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot class="table-footer-fixed">
            <tr>
              <td colspan="3" class="text-right"></td>
              <td><strong>ទំនិញសរុប​ : {{ totals.items }}</strong></td>
              <td class="amount-cell"><strong>{{ formatCurrency(totals.amount) }}</strong></td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
        <EmptyState v-else icon="fas fa-shopping-cart" message="No orders found" />
      </div>
    </div>

    <OrderModal v-model="showOrderModal" />
    <OrderDetailModal v-model="showDetailModal" :order-id="selectedOrderId" />
  </div>
</template>

<style scoped>


/* NEW: Scroll logic after approx 10 rows */
.scrollable-table-container {
max-height: 650px;
  /* Use !important to override the 'overflow-y: visible' in main.css at 768px */
  overflow-y: auto !important; 
  overflow-x: auto;
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

/* NEW: Sticky Header to keep titles visible while scrolling */
.scrollable-table-container thead th {
  position: sticky;
  top: 0;
  background-color: white;
  z-index: 10;
  box-shadow: inset 0 -1px 0 #eee;
}

.text-right {
  text-align: left;
}
.amount-cell {
  font-family: monospace;
}

/* Action Buttons Container */
.action-wrapper {
  position: relative;
  display: inline-block;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-dots {
  display: none;
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: #666;
}

.mobile-label {
  display: none;
}

/* RESPONSIVE LOGIC */
@media (max-width: 768px) {
  .btn-dots {
    display: block;
  }

  .action-buttons {
    display: none;
    position: absolute;
    right: 0;
    top: 100%;
    background: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid #eee;
    border-radius: 8px;
    z-index: 100;
    flex-direction: column;
    min-width: 150px;
    padding: 8px 0;
  }

  .action-buttons.is-open {
    display: flex;
  }

  .btn-icon {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 16px;
    border-radius: 0;
    background: transparent;
    color: #333;
  }

  .btn-icon:hover {
    background-color: #f5f5f5;
  }

  .btn-icon.danger {
    color: #dc3545;
  }
  .btn-icon.success {
    color: #28a745;
  }

  .mobile-label {
    display: inline;
    font-size: 0.9rem;
  }
  
  .btn-dots {
    display: block;
  }

  .action-buttons {
    display: none;
    position: absolute;
    right: 0;
    top: 100%;
    background: white;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    z-index: 100;
    flex-direction: column;
    min-width: 150px;
  }

  .action-buttons.is-open {
    display: flex;
  }
}
</style>