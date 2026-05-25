<script setup>
import { ref, computed, onMounted } from 'vue'
import { useIncomeStore } from '@/stores/incomeStore'
import { useExpenseStore } from '@/stores/expenseStore'
import { useOrderStore } from '@/stores/orderStore'
import { useStockStore } from '@/stores/stockStore'
import { useAssetStore } from '@/stores/assetStore'
import { useFormatters } from '@/composables/useFormatters'
import { useExcelExport } from '@/composables/useExport'
import StatCard from '@/components/StatCard.vue'

const incomeStore = useIncomeStore()
const expenseStore = useExpenseStore()
const orderStore = useOrderStore()
const stockStore = useStockStore()
const assetStore = useAssetStore()
const { formatCurrency } = useFormatters()
const { isExporting, exportRange, exportAllToExcel } = useExcelExport()

const startDate = ref('')
const endDate = ref('')

onMounted(async () => {
  try {
    const promises = []
    if (incomeStore.incomes.length === 0) promises.push(incomeStore.fetchIncomes())
    if (expenseStore.expenses.length === 0) promises.push(expenseStore.fetchExpenses())
    if (orderStore.orders.length === 0) promises.push(orderStore.fetchOrders())
    if (stockStore.stockItems.length === 0) promises.push(stockStore.fetchStockData())
    if (assetStore.assets.length === 0) promises.push(assetStore.fetchAssets())

    if (promises.length > 0) {
      await Promise.all(promises)
    }
  } catch (error) {
    console.error('Failed to load initial analytics reports from D1:', error)
  }
})

function isWithinRange(dateStr, start, end) {
  if (!dateStr) return false
  const itemDate = new Date(dateStr).setHours(0, 0, 0, 0)
  const s = start ? new Date(start).setHours(0, 0, 0, 0) : null
  const e = end ? new Date(end).setHours(23, 59, 59, 999) : null
  if (s && itemDate < s) return false
  if (e && itemDate > e) return false
  return true
}

const filteredIncomes = computed(() => {
  return incomeStore.incomes.filter((i) => isWithinRange(i.date, startDate.value, endDate.value))
})

const filteredExpenses = computed(() => {
  return expenseStore.expenses.filter((e) => isWithinRange(e.date, startDate.value, endDate.value))
})

const filteredOrders = computed(() => {
  return orderStore.orders.filter(
    (o) => isWithinRange(o.date || o.createdAt, startDate.value, endDate.value) && o.status === 'completed',
  )
})

const stockBySize = computed(() => {
  const sizes = { S: 0, M: 0, L: 0 }
  stockStore.stockItems.forEach((item) => {
    const size = stockStore.getSizeFromProductName(item.name)
    if (size && sizes[size] !== undefined) {
      sizes[size] += item.quantity
    }
  })
  return sizes
})

const totalIncome = computed(() => filteredIncomes.value.reduce((s, i) => s + (i.amount || 0), 0))
const totalExpense = computed(() => filteredExpenses.value.reduce((s, e) => s + (e.amount || 0), 0))
const totalOrderCount = computed(() => filteredOrders.value.length)

function clearFilters() {
  startDate.value = ''
  endDate.value = ''
}
</script>

<template>
  <div class="page">
    <div class="page-header" style="flex-wrap: wrap; justify-content: end; gap: 1rem">
      <div class="filter-actions">
        <input type="date" v-model="startDate" class="filter-input" />
        <span style="color: var(--text-secondary)">to</span>
        <input type="date" v-model="endDate" class="filter-input" />
        <button v-if="startDate || endDate" class="btn btn-secondary" @click="clearFilters">
          <i class="fas fa-times"></i> Clear
        </button>

        <select v-model="exportRange" class="filter-input export-select">
          <option value="all">ទាំងអស់</option>
          <option value="3months">3 ខែចុងក្រោយ</option>
          <option value="6months">6 ខែចុងក្រោយ</option>
          <option value="1year">1 ឆ្នាំចុងក្រោយ</option>
        </select>

        <button class="btn btn-export" :disabled="isExporting" @click="exportAllToExcel">
          <span v-if="isExporting" class="spinner"></span>
          <i v-else class="fas fa-file-excel"></i>
          {{ isExporting ? 'កំពុងនាំចេញ...' : 'នាំចេញ Excel' }}
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <StatCard
        icon="fas fa-arrow-trend-up"
        label="ចំណូលសរុប"
        :value="formatCurrency(totalIncome)"
        bg-class="bg-success"
      />
      <StatCard
        icon="fas fa-arrow-trend-down"
        label="ចំណាយសរុប"
        :value="formatCurrency(totalExpense)"
        bg-class="bg-danger"
      />
      <StatCard
        icon="fas fa-shopping-basket"
        label="ចំនួនការកម្មង់ (ជោគជ័យ)"
        :value="totalOrderCount"
        bg-class="bg-warning"
      />
      <StatCard icon="fas fa-box" label="ស្តុក S (តូច)" :value="stockBySize.S" bg-class="bg-info" />
      <StatCard
        icon="fas fa-box-open"
        label="ស្តុក M (មធ្យម)"
        :value="stockBySize.M"
        bg-class="bg-primary"
      />
      <StatCard
        icon="fas fa-boxes-stacked"
        label="ស្តុក L (ធំ)"
        :value="stockBySize.L"
        bg-class="bg-secondary"
      />
    </div>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-top: 1rem;
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-input {
  height: 42px;
  padding: 0.5rem 1rem;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: var(--font-sm);
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.filter-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.export-select {
  min-width: 140px;
  cursor: pointer;
}

.btn-export {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
}

.btn-export:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.45);
}

.btn-export:active:not(:disabled) {
  transform: translateY(0);
}

.btn-export:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-end !important;
  }
  .filter-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  .filter-actions {
    justify-content: space-between;
  }
  .btn-export {
    width: 100%;
    justify-content: center;
  }
}
</style>