<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useOrderStore } from '@/stores/orderStore'
import { useStockStore } from '@/stores/stockStore'
import { useIncomeStore } from '@/stores/incomeStore'
import { useFormatters } from '@/composables/useFormatters'
import StatCard from '@/components/StatCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import OrderModal from '@/components/modals/OrderModal.vue'
import OrderDetailModal from '@/components/modals/OrderDetailModal.vue'

const orderStore = useOrderStore()
const stockStore = useStockStore()
const incomeStore = useIncomeStore()
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

// ── SYNC WITH D1 DATABASE ON MOUNT ──
onMounted(async () => {
  window.addEventListener('click', closeMenus)
  try {
    const promises = []
    if (orderStore.orders.length === 0) promises.push(orderStore.fetchOrders())
    if (stockStore.stockItems.length === 0) promises.push(stockStore.fetchStockData())
    if (incomeStore.incomes.length === 0) promises.push(incomeStore.fetchIncomes())
    
    if (promises.length > 0) {
      await Promise.all(promises)
    }
  } catch (error) {
    console.error('Failed to load initial orders view data from D1:', error)
  }
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenus)
})

const filteredOrders = computed(() => {
  return orderStore.orders
    .filter((order) => {
      const searchLower = (search.value || '').toLowerCase()
      const matchesSearch =
        (order.orderNumber?.toLowerCase() || '').includes(searchLower) ||
        (order.customer?.toLowerCase() || '').includes(searchLower) ||
        order.items?.some((item) => (item.name?.toLowerCase() || '').includes(searchLower))

      const matchesStatus = !statusFilter.value || order.status === statusFilter.value

      const orderDate = new Date(order.date)
      const matchesDate =
        (!startDate.value || orderDate >= new Date(startDate.value)) &&
        (!endDate.value || orderDate <= new Date(endDate.value))

      return matchesSearch && matchesStatus && matchesDate
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

const totals = computed(() => {
  return filteredOrders.value.reduce(
    (acc, order) => {
      if (order.status === 'completed' || order.status === 'pending') {
        const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
        const productTotal = order.total - (Number(order.deliveryCost) || 0)
        const totalCostPrice = order.items.reduce(
          (sum, item) => sum + (item.costPrice || 0) * item.quantity,
          0,
        )

        // Get material costs for plastic bag and case box
        const plasticBagUnitCost = stockStore.getMaterialUnitCost('ថង់', 'N/A')
        const caseBoxUnitCost = stockStore.getMaterialUnitCost('កេស', 'N/A')
        const plasticBagCost = (Number(order.plasticBagQty) || 0) * plasticBagUnitCost
        const caseBoxCost = (Number(order.caseBoxQty) || 0) * caseBoxUnitCost

        // Net income (display) = product total - delivery - bag costs
        const netIncome =
          productTotal -
          (Number(order.deliveryCost) || 0) -
          plasticBagCost -
          caseBoxCost

        acc.items += itemCount
        acc.productTotal += productTotal
        acc.netIncome += Math.max(0, netIncome)
        acc.totalCostPrice += totalCostPrice
        acc.plasticBagCost += plasticBagCost
        acc.caseBoxCost += caseBoxCost
        acc.deliveryCost += Number(order.deliveryCost) || 0
      }
      return acc
    },
    {
      items: 0,
      productTotal: 0,
      netIncome: 0,
      plasticBagCost: 0,
      caseBoxCost: 0,
      deliveryCost: 0,
    }
  )
})

function getStatusClass(status) {
  return `badge-${status}`
}

// Calculate per-order financial breakdown
function getOrderBreakdown(order) {
  const productTotal = order.total - (Number(order.deliveryCost) || 0)
  const totalCostPrice = order.items.reduce(
    (sum, item) => sum + (item.costPrice || 0) * item.quantity,
    0,
  )
  const plasticBagUnitCost = stockStore.getMaterialUnitCost('ថង់', 'N/A')
  const caseBoxUnitCost = stockStore.getMaterialUnitCost('កេស', 'N/A')
  const plasticBagCost = (Number(order.plasticBagQty) || 0) * plasticBagUnitCost
  const caseBoxCost = (Number(order.caseBoxQty) || 0) * caseBoxUnitCost
  const deliveryCost = Number(order.deliveryCost) || 0
  const netIncome = Math.max(
    0,
    productTotal - deliveryCost - plasticBagCost - caseBoxCost ,
  )

  return {
    productTotal,
    totalCostPrice,
    plasticBagCost,
    caseBoxCost,
    deliveryCost,
    netIncome,
  }
}

function viewDetails(id) {
  selectedOrderId.value = id
  showDetailModal.value = true
  activeMenuId.value = null
}

/**
 * CANCEL ORDER
 * - Pending: just cancel, stock already deducted on creation
 * - Completed: return product stock + plastic bags, remove income
 */
async function cancelOrder(id) {
  if (!confirm('តើអ្នកប្រាកដជាចង់បោះបង់ការកម្មង់នេះមែនទេ?')) return
  const order = orderStore.getOrderById(id)
  if (!order) return

  try {
    // Return product stock to inventory (for both pending and completed)
    for (const item of order.items) {
      const product = stockStore.getProductById(item.productId)
      if (product) {
        const previousQty = product.quantity
        await stockStore.adjustStock(item.productId, item.quantity, 'in')
        
        // Use stockStore.recordMovement instead of inventoryStore
        await stockStore.recordMovement({
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
    }

    // Return plastic bags (update original deduction row, don't create new)
    const pbQty = Number(order.plasticBagQty) || 0
    if (pbQty > 0) {
      await stockStore.returnPlasticBag(pbQty, order.orderNumber)
    }

    // Return case boxes (update original deduction row, don't create new)
    const cbQty = Number(order.caseBoxQty) || 0
    if (cbQty > 0) {
      await stockStore.returnCaseBox(cbQty, order.orderNumber)
    }

    // If was completed, remove the income record
    if (order.status === 'completed') {
      const targetIncome = incomeStore.incomes.find((i) => i.orderId === id)
      if (targetIncome) {
        await incomeStore.deleteIncome(targetIncome.id)
      }
    }

    await orderStore.cancelOrder(id)
    activeMenuId.value = null
  } catch (error) {
    alert('មានបញ្ហាក្នុងការលុបចោលការបញ្ជាទិញ!')
  }
}

/**
 * COMPLETE ORDER
 * - Pending -> Completed: just add income (stock already deducted on creation)
 */
async function completeOrder(id) {
  const order = orderStore.getOrderById(id)
  if (!order || order.status !== 'pending') return

  try {
    // Stock was already deducted when order was created
    // Just add income and update status inside D1
    await orderStore.completeOrder(id)

    // Income = product total - delivery - bags - costPrice
    const breakdown = getOrderBreakdown(order)
    const incomeAmount = Math.max(
      0,
      breakdown.productTotal -
      breakdown.deliveryCost -
      breakdown.plasticBagCost -
      breakdown.caseBoxCost -
      breakdown.totalCostPrice
    )

    await incomeStore.addIncome({
      date: new Date(),
      amount: incomeAmount,
      category: 'លក់ផលិតផល',
      paymentMethod: order.paymentMethod,
      description: `${order.orderNumber}`,
      customer: order.customer,
      reference: order.orderNumber,
      orderId: order.id,
    })

    activeMenuId.value = null
  } catch (error) {
    alert('មានបញ្ហាក្នុងការបញ្ចប់ការបញ្ជាទិញ!')
  }
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
        <h3>ការកម្មង់</h3>
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
              <th>តម្លៃទំនិញ</th>
              <th>ចំណូលសុទ្ធ</th>
              <th>ស្ថានភាព</th>
              <th>សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in filteredOrders" :key="order.id" class="order-main-row">
              <td>
                <strong>{{ order.orderNumber }}</strong>
              </td>
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
              <!-- Product Price (old) -->
              <td class="amount-cell">
                <strong>{{ formatCurrency(getOrderBreakdown(order).productTotal) }}</strong>
              </td>
              <!-- Net Income (new) -->
              <td class="amount-cell net-income-cell">
                <div v-if="order.status !== 'cancelled'">
                  <strong class="text-success">{{
                    formatCurrency(getOrderBreakdown(order).netIncome)
                  }}</strong>
                </div>
                <span v-else class="text-muted">—</span>
              </td>
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
                    <button
                      v-if="order.status === 'pending'"
                      class="btn-icon success"
                      @click="completeOrder(order.id)"
                      title="Complete"
                    >
                      <i class="fas fa-check"></i> <span class="mobile-label">ទូទាត់</span>
                    </button>
                    <button
                      v-if="order.status !== 'cancelled'"
                      class="btn-icon danger"
                      @click="cancelOrder(order.id)"
                      title="Cancel"
                    >
                      <i class="fas fa-times"></i> <span class="mobile-label">បោះបង់</span>
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot class="table-footer-fixed">
            <!-- Row 1: Total Product Price -->
            <tr class="total-row-product">
              <td colspan="4" class="text-right"></td>
              <td class="amount-cell">
                <strong>{{ formatCurrency(totals.productTotal) }}</strong>
              </td>
              <td class="amount-cell text-success">
                <strong>{{ formatCurrency(totals.netIncome) }}</strong>
              </td>
              <td colspan="2" class="text-muted">សរុប</td>
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
.scrollable-table-container {
  max-height: 650px;
  overflow-y: auto !important;
  overflow-x: auto;
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

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

/* Footer row styles */
.total-row-product {
  background-color: #f0f9ff !important;
}

.total-row-product td {
  padding: 12px 16px !important;
  border-top: 2px solid #3b82f6;
}

.total-row-net {
  background-color: #f0fdf4 !important;
}

.total-row-net td {
  padding: 12px 16px !important;
  border-top: 1px dashed #bbf7d0;
}

.deduction-detail {
  font-size: 0.75rem;
  color: #6b7280;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.text-success {
  color: #16a34a;
}

/* Net income cell styles */
.net-income-cell {
  min-width: 140px;
}

.net-income-cell > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.deduction-mini {
  font-size: 0.65rem;
  color: #6b7280;
  display: block;
  line-height: 1.3;
  white-space: nowrap;
}

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