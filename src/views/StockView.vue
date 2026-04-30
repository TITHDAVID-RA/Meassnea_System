<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStockStore } from '@/stores/stockStore'
import { useExpenseStore } from '@/stores/expenseStore'
import { useFormatters } from '@/composables/useFormatters'
import StockModal from '@/components/modals/StockModal.vue'
import MaterialModal from '@/components/modals/MaterialModal.vue'
import EmptyState from '@/components/EmptyState.vue'

const stockStore = useStockStore()
const expenseStore = useExpenseStore()
const { formatCurrency, formatDate } = useFormatters()

const search = ref('')
const startDate = ref('')
const endDate = ref('')
const selectedBatchDetail = ref(null)
const showStockModal = ref(false)
const editingBatch = ref(null)

// Material modal
const showMaterialModal = ref(false)

// Material expand state - which material row is expanded
const expandedMaterial = ref(null)

// Dropdown State
const activeDropdown = ref(null)

function toggleDropdown(id) {
  activeDropdown.value = activeDropdown.value === id ? null : id
}

function closeDropdowns(e) {
  if (!e.target.closest('.action-container')) {
    activeDropdown.value = null
  }
}

function clearAllFilters() {
  search.value = ''
  startDate.value = ''
  endDate.value = ''
}

onMounted(() => window.addEventListener('click', closeDropdowns))
onUnmounted(() => window.removeEventListener('click', closeDropdowns))

function showAddStock() {
  editingBatch.value = null
  showStockModal.value = true
}

function showMaterialIn() {
  showMaterialModal.value = true
}

function isActiveBatch(name, id) {
  const activeBatches = stockStore.stockItems
    .filter((p) => p.name === name && p.quantity > 0)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  return activeBatches.length > 0 && activeBatches[0].id === id
}

function matchesDateFilter(itemDateStr) {
  const itemDate = new Date(itemDateStr).setHours(0, 0, 0, 0)
  const start = startDate.value ? new Date(startDate.value).setHours(0, 0, 0, 0) : null
  const end = endDate.value ? new Date(endDate.value).setHours(23, 59, 59, 999) : null
  return (!start || itemDate >= start) && (!end || itemDate <= end)
}

const filteredBatches = computed(() => {
  return stockStore.stockItems
    .filter((item) => {
      const matchesSearch =
        !search.value || item.name.toLowerCase().includes(search.value.toLowerCase())
      return matchesSearch && matchesDateFilter(item.createdAt)
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

// Helper to translate material names to Khmer
function getKhmerMaterialName(name) {
  const map = {
    'plastic bag': 'ថង់',
    'package bag': 'ថង់វិចខ្ចប់',
    'card': 'Leafleap',
    'tea': 'សាច់តែ',
    'labor': 'ពលកម្ម',
  }
  const key = name?.toLowerCase()?.trim()
  return map[key] || name
}

// Group material transactions by material name for expandable rows
const materialGroups = computed(() => {
  const groups = {}
  stockStore.materialTransactions
    .filter((tx) => tx.type === 'in' && matchesDateFilter(tx.date))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((tx) => {
      const khmerName = getKhmerMaterialName(tx.materialName)
      if (!groups[khmerName]) {
        groups[khmerName] = {
          materialName: khmerName,
          originalName: tx.materialName,
          sizes: {},
          totalQty: 0,
          totalValue: 0,
          latestDate: tx.date,
        }
      }
      const sizeKey = tx.size || 'N/A'
      if (!groups[khmerName].sizes[sizeKey]) {
        groups[khmerName].sizes[sizeKey] = {
          size: sizeKey,
          totalIn: 0,
          totalOut: 0,
          balance: 0,
          totalSpent: 0,
          transactions: [],
        }
      }
      const sizeGroup = groups[khmerName].sizes[sizeKey]
      sizeGroup.totalIn += tx.quantity
      sizeGroup.totalSpent += tx.totalPrice
      sizeGroup.transactions.push(tx)
      groups[khmerName].totalQty += tx.quantity
      groups[khmerName].totalValue += tx.totalPrice
    })

  // Calculate balance by subtracting out transactions
  stockStore.materialTransactions
    .filter((tx) => tx.type === 'out')
    .forEach((tx) => {
      const khmerName = getKhmerMaterialName(tx.materialName)
      const group = groups[khmerName]
      if (group) {
        const sizeKey = tx.size || 'N/A'
        if (group.sizes[sizeKey]) {
          group.sizes[sizeKey].totalOut += tx.quantity
        }
      }
    })

  // Calculate final balances
  Object.values(groups).forEach((group) => {
    Object.values(group.sizes).forEach((sizeGroup) => {
      sizeGroup.balance = sizeGroup.totalIn - sizeGroup.totalOut
      sizeGroup.avgPrice = sizeGroup.totalIn > 0 ? sizeGroup.totalSpent / sizeGroup.totalIn : 0
    })
  })

  return Object.values(groups).sort((a, b) => a.materialName.localeCompare(b.materialName))
})

const totalRemainingQuantity = computed(() => {
  return filteredBatches.value.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
})

function toggleDetail(item) {
  selectedBatchDetail.value = selectedBatchDetail.value?.id === item.id ? null : item
}

function toggleMaterialExpand(materialName) {
  expandedMaterial.value = expandedMaterial.value === materialName ? null : materialName
}

function openEditStock(item) {
  editingBatch.value = { ...item }
  showStockModal.value = true
  activeDropdown.value = null
}

function deleteBatch(id) {
  if (confirm('តើអ្នកពិតជាចង់លុបបាច់ស្តុកនេះមែនទេ?')) {
    stockStore.deleteProduct(id)
  }
}

function handleProcessStock(data) {
  if (editingBatch.value) {
    stockStore.updateProduct(editingBatch.value.id, { ...data })
  } else {
    stockStore.addProduct({ ...data, initialQuantity: data.quantity })
    expenseStore.addExpense({
      date: new Date(),
      description: `ទិញទំនិញចូល: ${data.name} (${data.quantity})`,
      category: 'ស្តុកទំនិញ',
      amount: data.costPrice * data.quantity,
      paymentMethod: 'cash',
    })
  }
}

function handleMaterialSave(data) {
  // Save each entry as individual transaction
  data.entries.forEach((entry) => {
    const tx = stockStore.materialStockIn({
      ...entry,
      date: data.date,
    })
    if (tx) {
      expenseStore.addExpense({
        date: data.date,
        description: `${entry.materialName} (${entry.size}) - (${entry.quantity})`,
        category: 'វត្ថុធាតុដើម',
        amount: tx.totalPrice,
        paymentMethod: 'cash',
      })
    }
  })
}
</script>

<template>
  <div class="page">
    <!-- Product Stock Section -->
<div class="date-filter-card">
      <div class="left">
        <div class="search-box">
          <i class="fas fa-search search-icon"></i>
          <input type="text" placeholder="ស្វែងរកទំនិញ..." v-model="search" class="search-input" />
        </div>
        <div class="date-inputs">
          <div class="date-field">
            <input type="date" v-model="startDate" class="form-input date-input" />
          </div>
          <div class="date-field">
            <input type="date" v-model="endDate" class="form-input date-input" />
          </div>
        </div>
      </div>
      <div class="right">
        <!-- Fixed: Method call instead of inline logic[cite: 18] -->
        <button class="btn btn-secondary" @click="clearAllFilters">
          <i class="fas fa-times"></i> សម្អាត
        </button>
        <button class="btn btn-primary" @click="showAddStock">
          <i class="fas fa-plus"></i> បញ្ចូលស្តុកថ្មី
        </button>
      </div>
    </div>

    <div class="card">
      <div class="table-header"><h3>បញ្ជីស្តុកទំនិញ</h3></div>
      <div class="table-container scrollable-table-container hide-scrollbar">
        <table class="table">
          <thead>
            <tr>
              <th>ឈ្មោះទំនិញ</th>
              <th>ថ្ងៃបញ្ចូល</th>
              <th>ចំនួននៅសល់</th>
              <th>តម្លៃលក់</th>
              <th class="text-right">សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in filteredBatches" :key="item.id">
              <tr
                @click="toggleDetail(item)"
                :class="{ 'row-active': selectedBatchDetail?.id === item.id }"
                style="cursor: pointer"
              >
                <td>
                  <div class="product-info-cell">
                    <strong>{{ item.name }}</strong>
                    <div class="badge-container">
                      <span v-if="isActiveBatch(item.name, item.id)" class="badge-active">
                        <i class="fas fa-check-circle"></i> កំពុងលក់
                      </span>
                      <span v-if="item.quantity <= 0" class="badge-out">
                        <i class="fas fa-exclamation-triangle"></i> អស់ពីស្តុក
                      </span>
                    </div>
                  </div>
                </td>
                <td>{{ formatDate(item.createdAt) }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ formatCurrency(item.unitPrice) }}</td>
                <td class="text-right action-cell">
                  <div class="action-container">
                    <button
                      class="btn-icon mobile-dots-toggle"
                      @click.stop="toggleDropdown(item.id)"
                    >
                      <i class="fas fa-ellipsis-v"></i>
                    </button>

                    <div
                      class="action-buttons"
                      :class="{ 'show-mobile': activeDropdown === item.id }"
                    >
                      <button class="btn-icon" @click.stop="openEditStock(item)" title="កែប្រែ">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button
                        class="btn-icon danger"
                        @click.stop="deleteBatch(item.id)"
                        title="លុប"
                      >
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                </td>
              </tr>

              <tr v-if="selectedBatchDetail?.id === item.id">
                <td colspan="5" class="detail-row">
                  <div class="asset-detail-grid">
                    <div class="asset-detail-item">
                      <span class="label">ចំនួនដើម:</span>
                      <strong>{{ item.initialQuantity }}</strong>
                    </div>
                    <div class="asset-detail-item">
                      <span class="label">តម្លៃដើម:</span>
                      <strong class="text-danger">{{ formatCurrency(item.costPrice) }}</strong>
                    </div>
                    <div class="asset-detail-item">
                      <span class="label">តម្លៃដើមសរុប:</span>
                      <strong class="text-primary">{{
                        formatCurrency(item.initialQuantity * item.costPrice)
                      }}</strong>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
          <tfoot class="sticky-footer">
            <tr>
              <td colspan="2" class="text-right"><strong>សរុបចំនួនស្តុក</strong></td>
              <td class="total-amount-cell">
                <strong>{{ totalRemainingQuantity }}</strong>
              </td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Material Stock Section -->
    <div class="page-header material-header">
      <button class="btn btn-success" @click="showMaterialIn">
        <i class="fas fa-plus-circle"></i> ទិញចូលថ្មី
      </button>
    </div>

    <div class="card">
      <div class="table-header"><h3>ស្តុកវត្ថុធាតុដើម</h3></div>
      <div class="table-container scrollable-table-container hide-scrollbar">
        <table class="table material-table" v-if="materialGroups.length > 0">
          <thead>
            <tr>
              <th>ឈ្មោះវត្ថុធាតុដើម</th>
              <th>ទំហំ</th>
              <th>នៅសល់</th>
              <th>តម្លៃសរុប</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in materialGroups" :key="group.materialName">
              <!-- Main Row - Click to expand -->
              <tr
                class="material-main-row"
                @click="toggleMaterialExpand(group.materialName)"
                :class="{ expanded: expandedMaterial === group.materialName }"
              >
                <td>
                  <div class="material-name-cell">
                    <i
                      class="fas expand-icon"
                      :class="
                        expandedMaterial === group.materialName
                          ? 'fa-chevron-down'
                          : 'fa-chevron-right'
                      "
                    ></i>
                    <strong>{{ group.materialName }}</strong>
                  </div>
                </td>
                <td>
                  <span class="size-count-badge">{{ Object.keys(group.sizes).length }} ទំហំ</span>
                </td>
                <td>
                  <strong class="total-qty">
                    {{ Object.values(group.sizes).reduce((sum, s) => sum + s.balance, 0) }}
                  </strong>
                </td>
                <td class="text-primary">
                  <strong>{{ formatCurrency(group.totalValue) }}</strong>
                </td>
                <td class="text-right">
                  <span class="expand-hint">
                    {{ expandedMaterial === group.materialName ? 'បិទ' : 'មើលលម្អិត' }}
                  </span>
                </td>
              </tr>

              <!-- Expanded Detail Row -->
              <tr v-if="expandedMaterial === group.materialName" class="material-detail-row">
                <td colspan="5">
                  <div class="material-detail-panel">
                    <div class="detail-header">
                      <span>លម្អិតតាមទំហំ</span>
                    </div>
                    <div class="size-detail-grid">
                      <div
                        v-for="sizeGroup in Object.values(group.sizes)"
                        :key="sizeGroup.size"
                        class="size-detail-card"
                        :class="{ 'low-stock': sizeGroup.balance <= 10 }"
                      >
                        <div class="size-title">ទំហំ {{ sizeGroup.size }}</div>
                        <div class="size-stats">
                          <div class="stat">
                            <span class="stat-label">នៅសល់</span>
                            <span
                              class="stat-value"
                              :class="{ 'text-danger': sizeGroup.balance <= 0 }"
                            >
                              {{ sizeGroup.balance }}
                            </span>
                          </div>
                          <div class="stat">
                            <span class="stat-label">បានទិញចូល</span>
                            <span class="stat-value text-success">+{{ sizeGroup.totalIn }}</span>
                          </div>
                          <div class="stat">
                            <span class="stat-label">បានប្រើ</span>
                            <span class="stat-value text-warning">-{{ sizeGroup.totalOut }}</span>
                          </div>
                          <div class="stat">
                            <span class="stat-label">តម្លៃជាមធ្យម</span>
                            <span class="stat-value">{{ formatCurrency(sizeGroup.avgPrice) }}</span>
                          </div>
                        </div>

                        <!-- Transaction History -->
                        <div class="tx-history">
                          <div class="tx-header">ប្រវត្តិប្រតិបត្តិការ</div>
                          <div class="tx-scroll hide-scrollbar">
                            <div
                              v-for="tx in sizeGroup.transactions.slice(0, 3)"
                              :key="tx.id"
                              class="tx-item"
                            >
                              <span class="tx-date">{{ formatDate(tx.date) }}</span>
                              <span class="tx-qty text-success">+{{ tx.quantity }}</span>
                              <span class="tx-unit-price"
                                >{{ formatCurrency(tx.totalPrice / tx.quantity) }}/ឯកតា</span
                              >
                              <span class="tx-price">{{ formatCurrency(tx.totalPrice) }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        <EmptyState v-else icon="fas fa-boxes" message="គ្មានវត្ថុធាតុដើមនៅក្នុងស្តុក" />
      </div>
    </div>

    <StockModal v-model="showStockModal" :edit-data="editingBatch" @process="handleProcessStock" />
    <MaterialModal v-model="showMaterialModal" @save="handleMaterialSave" />
  </div>
</template>

<style scoped>
.date-filter-card {
  display: flex;
  flex-direction: column; 
  gap: 12px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.left {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.right {
  display: flex;
  flex-direction: column; 
  gap: 8px;
  width: 100%;
}

.date-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr; /* Two columns for dates on mobile[cite: 18] */
  gap: 8px;
  width: 100%;
}

.date-input {
  width: 100%;
  padding: 8px;
  font-size: 0.85rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #374151;
}

.date-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

/* ========== Table & Layout ========== */
.scrollable-table-container {
  max-height: 500px;
  overflow-y: auto !important;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.table thead th {
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
}
.sticky-footer {
  position: sticky;
  bottom: 0;
  z-index: 10;
}
.sticky-footer td {
  background: #fafafa !important;
  border-top: 2px solid var(--primary-color) !important;
}
.total-amount-cell {
  text-align: center;
  color: var(--primary-color);
  font-weight: bold;
}

/* Action buttons */
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
  background: #f1f5f9;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
}
.action-buttons {
  display: flex;
  gap: 8px;
}

@media (max-width: 1024px) {
  .mobile-dots-toggle {
    display: flex;
  }
  .action-buttons {
    display: none;
    position: absolute;
    right: 0;
    top: 35px;
    background: white;
    border: 1px solid var(--border-color);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    z-index: 100;
    flex-direction: column;
    padding: 6px;
    min-width: 120px;
  }
  .action-buttons.show-mobile {
    display: flex;
  }
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
}
/* Updated: Desktop layout restorations[cite: 18] */
@media (min-width: 1024px) {
  .date-filter-card {
    flex-direction: row; /* Side-by-side on desktop[cite: 18] */
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
  }

  .left {
    flex-direction: row;
    align-items: center;
    flex: 1;
  }

  .search-box {
    max-width: 300px;
  }

  .date-inputs {
    grid-template-columns: auto auto; /* Flexible width on desktop[cite: 18] */
    width: auto;
  }

  .date-input {
    width: 150px;
  }

  .right {
    flex-direction: row; /* Horizontal buttons[cite: 18] */
    width: auto;
    margin-left: 20px;
  }

  .btn {
    width: auto;
    padding: 10px 18px;
  }
}
.btn-icon.success {
  color: #16a34a;
}
.btn-icon.success:hover {
  background: #dcfce7;
}

/* Detail row */
.row-active {
  background-color: #f1f5f9;
}
.detail-row {
  background: #f8fafc;
  border-left: 4px solid var(--primary-color);
  padding: 1rem 1.5rem;
}
.asset-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
}
.asset-detail-item .label {
  font-size: 0.8rem;
  color: #64748b;
  display: block;
  margin-bottom: 2px;
}

/* Product info */
.product-info-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.badge-container {
  display: flex;
  gap: 4px;
}
.badge-active {
  background-color: #dcfce7;
  color: #15803d;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}
.badge-out {
  background-color: #fef2f2;
  color: #dc2626;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #fee2e2;
}

/* Material section */
.material-header {
  margin-top: 2rem;
  justify-content: flex-end;
}
.btn-success {
  background: #16a34a;
  color: white;
}
.btn-success:hover {
  background: #15803d;
}

/* Material Table Styles */
.material-table {
  cursor: pointer;
}

.material-main-row {
  transition: background-color 0.2s;
}

.material-main-row:hover {
  background-color: #f8fafc;
}

.material-main-row.expanded {
  background-color: #eff6ff;
  border-left: 3px solid #3b82f6;
}

.material-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.expand-icon {
  color: #64748b;
  font-size: 0.8rem;
  transition: transform 0.2s;
  width: 20px;
  text-align: center;
}

.size-count-badge {
  background: #e0e7ff;
  color: #4338ca;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.total-qty {
  color: #0369a1;
  font-size: 1.1rem;
}

.expand-hint {
  font-size: 0.8rem;
  color: #64748b;
}

/* Material Detail Panel */
.material-detail-row {
  background: #f8fafc;
}

.material-detail-row > td {
  padding: 0 !important;
}

.material-detail-panel {
  padding: 16px 20px;
}

.detail-header {
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
}

.size-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.size-detail-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
}

.size-detail-card.low-stock {
  border-color: #fca5a5;
  background: #fef2f2;
}

.size-title {
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
}

.size-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 0.7rem;
  color: #64748b;
}

.stat-value {
  font-size: 0.95rem;
  font-weight: 700;
}

.text-success {
  color: #16a34a;
}
.text-warning {
  color: #d97706;
}
.text-danger {
  color: #dc2626;
}
.text-primary {
  color: var(--primary-color);
}

/* Transaction History */
.tx-history {
  border-top: 1px solid #e2e8f0;
  padding-top: 8px;
}

.tx-header {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 6px;
}

.tx-scroll {
  max-height: 120px;
  overflow-y: auto;
}

.tx-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  font-size: 0.8rem;
  border-bottom: 1px dashed #f1f5f9;
  gap: 8px;
}

.tx-date {
  color: #64748b;
  min-width: 80px;
}

.tx-qty {
  font-weight: 600;
  min-width: 40px;
}

.tx-unit-price {
  color: #059669;
  font-weight: 600;
  font-size: 0.75rem;
}

.tx-price {
  color: #0369a1;
  font-weight: 600;
  min-width: 70px;
  text-align: right;
}

/* Buttons */
.btn {
  padding: 8px 16px;
  border-radius: 6px;
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
.btn-primary:hover {
  background: #2563eb;
}

/* Hide scrollbar utility */
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

  
</style>