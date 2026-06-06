<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useOrderStore } from '@/stores/orderStore'
import { useStockStore } from '@/stores/stockStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useIncomeStore } from '@/stores/incomeStore'
import { useFormatters } from '@/composables/useFormatters'
import StatCard from '@/components/StatCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import OrderModal from '@/components/modals/OrderModal.vue'
import OrderDetailModal from '@/components/modals/OrderDetailModal.vue'

const orderStore = useOrderStore()
const stockStore = useStockStore()
const inventoryStore = useInventoryStore()
const incomeStore = useIncomeStore()
const { formatCurrency, formatDate } = useFormatters()

const search = ref('')
const statusFilter = ref('')
const startDate = ref('')
const endDate = ref('')

const showOrderModal = ref(false)
const showDetailModal = ref(false)
const selectedOrderId = ref(null)

// Material detail modal state
const showMaterialModal = ref(false)
const materialOrder = ref(null)

const activeMenuId = ref(null)

const toggleMenu = (id) => {
  activeMenuId.value = activeMenuId.value === id ? null : id
}

const closeMenus = (e) => {
  if (!e.target.closest('.action-wrapper')) activeMenuId.value = null
}

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

function getPlasticBagCost(order) {
  // If plasticBagCost is stored and valid, use it
  if (order.plasticBagCost && order.plasticBagCost > 0) {
    return order.plasticBagCost
  }

  // Fallback: calculate from plasticBags array if available
  const bags = order.plasticBags || []
  if (bags.length > 0) {
    let total = 0
    bags.forEach(bag => {
      const bagSize = bag.size
      const bagQty = Number(bag.qty || bag.quantity || 0)
      if (bagSize && ['S', 'M'].includes(bagSize)) {
        const unitCost = stockStore.getMaterialUnitCost('ថង់', bagSize)
        total += bagQty * unitCost
      }
    })
    return total
  }

  return 0
}

const totals = computed(() => {
  return filteredOrders.value.reduce(
    (acc, order) => {
      if (order.status === 'completed' || order.status === 'pending') {
        const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
        const productTotal = order.items.reduce(
          (sum, item) => sum + (item.unitPrice || 0) * item.quantity,
          0,
        )
        const deliveryCost = Number(order.deliveryCost) || 0
        const plasticBagCost = getPlasticBagCost(order)
        const caseBoxUnitCost = stockStore.getMaterialUnitCost('កេស', 'N/A')
        const caseBoxCost = (Number(order.caseBoxQty) || 0) * caseBoxUnitCost

        const netIncome = Math.max(
          0,
          productTotal - deliveryCost - plasticBagCost - caseBoxCost
        )

        acc.items += itemCount
        acc.productTotal += productTotal
        acc.netIncome += netIncome
        acc.plasticBagCost += plasticBagCost
        acc.caseBoxCost += caseBoxCost
        acc.deliveryCost += deliveryCost
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

function getOrderBreakdown(order) {
  const productTotal = order.items.reduce(
    (sum, item) => sum + (item.unitPrice || 0) * item.quantity,
    0,
  )
  const deliveryCost = Number(order.deliveryCost || order.delivery_cost || 0)
  const plasticBagCost = getPlasticBagCost(order)
  const caseBoxQty = Number(order.caseBoxQty || order.case_box_qty || 0)
  const caseBoxUnitCost = stockStore.getMaterialUnitCost('កេស', 'N/A')
  const caseBoxCost = caseBoxQty * caseBoxUnitCost

  const netIncome = Math.max(
    0,
    productTotal - deliveryCost - plasticBagCost - caseBoxCost
  )

  return {
    productTotal,
    deliveryCost,
    plasticBagCost,
    caseBoxCost,
    netIncome,
  }
}

function viewDetails(id) {
  selectedOrderId.value = id
  showDetailModal.value = true
  activeMenuId.value = null
}

// Open material usage modal
function viewMaterials(order) {
  materialOrder.value = order
  showMaterialModal.value = true
  activeMenuId.value = null
}

// Get material breakdown for the modal
function getMaterialBreakdown(order) {
  const breakdown = []

  // Plastic bags
  const bags = order.plasticBags || []
  if (bags.length > 0) {
    bags.forEach(bag => {
      const bagSize = bag.size
      const bagQty = Number(bag.qty || bag.quantity || 0)
      if (bagSize && ['S', 'M'].includes(bagSize) && bagQty > 0) {
        const unitCost = stockStore.getMaterialUnitCost('ថង់', bagSize)
        const lastPrice = stockStore.getLastMaterialPrice('ថង់', bagSize)
        breakdown.push({
          name: `ថង់ ${bagSize}`,
          quantity: bagQty,
          unitCost: unitCost,
          lastPrice: lastPrice,
          totalCost: bagQty * unitCost,
          type: 'plastic'
        })
      }
    })
  }

  // Case boxes
  const caseBoxQty = Number(order.caseBoxQty || 0)
  if (caseBoxQty > 0) {
    const unitCost = stockStore.getMaterialUnitCost('កេស', 'N/A')
    const lastPrice = stockStore.getLastMaterialPrice('កេស', 'N/A')
    breakdown.push({
      name: 'កេស',
      quantity: caseBoxQty,
      unitCost: unitCost,
      lastPrice: lastPrice,
      totalCost: caseBoxQty * unitCost,
      type: 'case'
    })
  }

  // Free items (no cost shown in modal)
  const freeItems = order.freeItems || []
  if (freeItems.length > 0) {
    freeItems.forEach(item => {
      const qty = Number(item.quantity || 1)
      if (qty > 0) {
        breakdown.push({
          name: `${item.productName || item.name || 'ទំនិញឥតគិតថ្លៃ'} (ឥតគិតថ្លៃ)`,
          quantity: qty,
          unitCost: 0,
          lastPrice: 0,
          totalCost: 0,
          type: 'free'
        })
      }
    })
  }

  // Delivery
  const deliveryCost = Number(order.deliveryCost || 0)
  if (deliveryCost > 0) {
    breakdown.push({
      name: 'ថ្លៃដឹកជញ្ជូន',
      quantity: 1,
      unitCost: deliveryCost,
      lastPrice: deliveryCost,
      totalCost: deliveryCost,
      type: 'delivery'
    })
  }

  return breakdown
}

async function cancelOrder(id) {
  if (!confirm('តើអ្នកប្រាកដជាចង់បោះបង់ការកម្មង់នេះមែនទេ?')) return
  const order = orderStore.getOrderById(id)
  if (!order) return

  try {
    // Return product stock (deducted at order creation regardless of status)
    for (const item of order.items) {
      const product = stockStore.getProductById(item.productId)
      if (product) {
        const previousQty = product.quantity
        await stockStore.adjustStock(item.productId, item.quantity, 'in')

        await inventoryStore.recordMovement({
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

    // Return free items stock
    const freeItems = order.freeItems || []
    for (const item of freeItems) {
      const product = stockStore.getProductById(item.productId)
      if (product) {
        const previousQty = product.quantity
        await stockStore.adjustStock(item.productId, item.quantity, 'in')

        await inventoryStore.recordMovement({
          productId: product.id,
          productName: product.name,
          type: 'return',
          quantity: item.quantity,
          previousQuantity: previousQty,
          newQuantity: product.quantity,
          unitPrice: 0,
          totalValue: 0,
          reference: order.orderNumber,
          referenceId: order.id,
          notes: 'Free item returned - order cancelled',
        })
      }
    }

    // Return plastic bags (deducted at order creation)
    const bags = order.plasticBags || []
    for (const bag of bags) {
      const qty = Number(bag.qty || 0)
      if (qty > 0 && ['S', 'M'].includes(bag.size)) {
        await stockStore.returnPlasticBag(bag.size, qty, order.orderNumber)
      }
    }

    // Return case boxes (deducted at order creation)
    const cbQty = Number(order.caseBoxQty) || 0
    if (cbQty > 0) {
      await stockStore.returnCaseBox(cbQty, order.orderNumber)
    }

    // Delete income record only if order was completed
    if (order.status === 'completed') {
      const targetIncome = incomeStore.incomes.find((i) => i.orderId === id)
      if (targetIncome) {
        await incomeStore.deleteIncome(targetIncome.id)
      }
    }

    await orderStore.cancelOrder(id)
    activeMenuId.value = null
  } catch (error) {
    console.error('Cancel order error:', error)
    alert('មានបញ្ហាក្នុងការលុបចោលការបញ្ជាទិញ!')
  }
}

async function completeOrder(id) {
  const order = orderStore.getOrderById(id)
  if (!order || order.status !== 'pending') return

  try {
    await orderStore.completeOrder(id)

    // Calculate income the SAME WAY as createOrder()
    const itemsTotal = order.items.reduce(
      (sum, item) => sum + (Number(item.unitPrice || 0) * Number(item.quantity || 1)),
      0
    )
    const deliveryCost = Number(order.deliveryCost || 0)
    const totalCostPrice = order.items.reduce(
      (sum, item) => sum + (Number(item.costPrice || 0) * Number(item.quantity || 1)),
      0
    )

    // Calculate plastic bag cost from bags array
    const plasticBags = order.plasticBags || []
    let totalPlasticBagCost = 0
    plasticBags.forEach(bag => {
      const bagSize = bag.size
      const bagQty = Number(bag.qty || bag.quantity || 0)
      if (bagSize && ['S', 'M'].includes(bagSize)) {
        const unitCost = stockStore.getMaterialUnitCost('ថង់', bagSize)
        totalPlasticBagCost += bagQty * unitCost
      }
    })

    // Calculate case box cost
    const caseBoxQty = Number(order.caseBoxQty || 0)
    const caseBoxUnitCost = stockStore.getMaterialUnitCost('កេស', 'N/A')
    const totalCaseBoxCost = caseBoxQty * caseBoxUnitCost

    // Net profit = items total - cost price - plastic bags - case boxes - delivery
    const netProfit = itemsTotal - totalCostPrice - totalPlasticBagCost - totalCaseBoxCost - deliveryCost
    const incomeAmount = Number(Math.max(0, netProfit).toFixed(2))

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
    console.error('Complete order error:', error)
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
              <th>លេខទូរសព្ទ</th>
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
              <td class="amount-cell">
                <strong>{{ formatCurrency(getOrderBreakdown(order).productTotal) }}</strong>
              </td>
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
                      class="btn-icon info"
                      @click="viewMaterials(order)"
                      title="មើលវត្ថុធាតុដើម"
                    >
                      <i class="fas fa-box-open"></i> <span class="mobile-label">មើលវត្ថុធាតុដើម</span>
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

    <!-- Material Usage Modal -->
    <div v-if="showMaterialModal" class="modal-overlay" @click="showMaterialModal = false">
      <div class="modal-content material-modal" @click.stop>
        <div class="modal-header">
          <h3>
            <i class="fas fa-box-open"></i>
            វត្ថុធាតុដើមប្រើប្រាស់ — {{ materialOrder?.orderNumber }}
          </h3>
          <button class="modal-close" @click="showMaterialModal = false">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div v-if="materialOrder" class="material-breakdown">

            <table class="material-table">
              <thead>
                <tr>
                  <th>វត្ថុធាតុដើម</th>
                  <th>ចំនួន</th>
                  <th>តម្លៃជាមធ្យម</th>
                  <th>តម្លៃចុងក្រោយ</th>
                  <th>ថ្លៃរួម</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in getMaterialBreakdown(materialOrder)" :key="idx">
                  <td>
                    <div class="material-name">
                      <i
                        :class="{
                          'fas fa-shopping-bag': item.type === 'plastic',
                          'fas fa-box': item.type === 'case',
                          'fas fa-truck': item.type === 'delivery',
                          'fas fa-gift': item.type === 'free'
                        }"
                      ></i>
                      <span>{{ item.name }}</span>
                    </div>
                  </td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ formatCurrency(item.unitCost) }}</td>
                  <td>{{ formatCurrency(item.lastPrice) }}</td>
                  <td class="text-primary">
                    <strong>{{ formatCurrency(item.totalCost) }}</strong>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" class="text-right"><strong>សរុបថ្លៃវត្ថុធាតុដើម:</strong></td>
                  <td class="text-primary">
                    <strong>{{ formatCurrency(getMaterialBreakdown(materialOrder).reduce((s, i) => s + i.totalCost, 0)) }}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>

          </div>
        </div>
      </div>
    </div>
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

/* Material Modal Styles */
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
  max-width: 600px;
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

.modal-header h3 i {
  color: #3b82f6;
}

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

.modal-body {
  padding: 1.5rem;
}

.breakdown-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.summary-item .label {
  font-size: 0.75rem;
  color: #64748b;
}

.summary-item strong {
  font-size: 0.95rem;
  color: #1e293b;
}

.material-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.material-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  background: #f1f5f9;
  color: #475569;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.material-table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  color: #334155;
}

.material-table tbody tr:hover {
  background: #f8fafc;
}

.material-table tfoot td {
  background: #f0fdf4;
  border-top: 2px solid #bbf7d0;
  padding: 1rem;
  font-size: 1rem;
}

.material-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.material-name i {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 0.8rem;
}

.material-name i.fa-shopping-bag {
  background: #dbeafe;
  color: #2563eb;
}

.material-name i.fa-box {
  background: #dcfce7;
  color: #16a34a;
}

.material-name i.fa-truck {
  background: #fef3c7;
  color: #d97706;
}

.material-name i.fa-gift {
  background: #fce7f3;
  color: #db2777;
}

.text-primary {
  color: #2563eb;
}

.material-note {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #1e40af;
}

.material-note i {
  color: #3b82f6;
}

/* Button styles */
.btn-icon.info {
  color: #3b82f6;
}

.btn-icon.info:hover {
  background: #eff6ff;
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
  .btn-icon.info {
    color: #3b82f6;
  }

  .mobile-label {
    display: inline;
    font-size: 0.9rem;
  }

  .modal-content {
    max-width: 95vw;
    margin: 0.5rem;
  }

  .breakdown-summary {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .material-table {
    font-size: 0.8rem;
  }

  .material-table th,
  .material-table td {
    padding: 0.5rem 0.5rem;
  }
}
</style>