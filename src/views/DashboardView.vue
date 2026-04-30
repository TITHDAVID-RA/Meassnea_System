<script setup>
import { ref, computed } from 'vue'
import { useIncomeStore } from '@/stores/incomeStore'
import { useExpenseStore } from '@/stores/expenseStore'
import { useOrderStore } from '@/stores/orderStore'
import { useStockStore } from '@/stores/stockStore'
import { useFormatters } from '@/composables/useFormatters'
import StatCard from '@/components/StatCard.vue'

const incomeStore = useIncomeStore()
const expenseStore = useExpenseStore()
const orderStore = useOrderStore()
const stockStore = useStockStore()
const { formatCurrency } = useFormatters()

// Date range filter
const startDate = ref('')
const endDate = ref('')

function isWithinRange(dateStr, start, end) {
  if (!dateStr) return false
  const itemDate = new Date(dateStr).setHours(0, 0, 0, 0)
  const s = start ? new Date(start).setHours(0, 0, 0, 0) : null
  const e = end ? new Date(end).setHours(23, 59, 59, 999) : null
  if (s && itemDate < s) return false
  if (e && itemDate > e) return false
  return true
}

// ========== FILTERED DATA ==========
const filteredIncomes = computed(() => {
  return incomeStore.incomes.filter((i) => isWithinRange(i.date, startDate.value, endDate.value))
})

const filteredExpenses = computed(() => {
  return expenseStore.expenses.filter((e) => isWithinRange(e.date, startDate.value, endDate.value))
})

const filteredOrders = computed(() => {
  return orderStore.orders.filter(
    (o) => isWithinRange(o.date, startDate.value, endDate.value) && o.status === 'completed', // Only include completed orders
  )
})

// ========== STOCK BY SIZE ==========
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

// ========== SUMMARY ==========
const totalIncome = computed(() => filteredIncomes.value.reduce((s, i) => s + (i.amount || 0), 0))
const totalExpense = computed(() => filteredExpenses.value.reduce((s, e) => s + (e.amount || 0), 0))

// Shows value of completed orders only
const totalOrderValue = computed(() => filteredOrders.value.reduce((s, o) => s + (o.total || 0), 0))

// Shows count of completed orders only
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
      <StatCard
        icon="fas fa-box"
        label="ស្តុក S (តូច)"
        :value="stockBySize.S"
        bg-class="bg-info"
      />
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
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  .filter-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>