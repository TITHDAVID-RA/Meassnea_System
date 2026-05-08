<script setup>
import { ref, computed } from 'vue'
import { utils, writeFileXLSX } from 'xlsx'
import { useIncomeStore } from '@/stores/incomeStore'
import { useExpenseStore } from '@/stores/expenseStore'
import { useOrderStore } from '@/stores/orderStore'
import { useStockStore } from '@/stores/stockStore'
import { useAssetStore } from '@/stores/assetStore'
import { useFormatters } from '@/composables/useFormatters'
import StatCard from '@/components/StatCard.vue'

const incomeStore = useIncomeStore()
const expenseStore = useExpenseStore()
const orderStore = useOrderStore()
const stockStore = useStockStore()
const assetStore = useAssetStore()
const { formatCurrency } = useFormatters()

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

const filteredIncomes = computed(() => {
  return incomeStore.incomes.filter((i) => isWithinRange(i.date, startDate.value, endDate.value))
})

const filteredExpenses = computed(() => {
  return expenseStore.expenses.filter((e) => isWithinRange(e.date, startDate.value, endDate.value))
})

const filteredOrders = computed(() => {
  return orderStore.orders.filter(
    (o) => isWithinRange(o.date, startDate.value, endDate.value) && o.status === 'completed',
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
const totalOrderValue = computed(() => filteredOrders.value.reduce((s, o) => s + (o.total || 0), 0))
const totalOrderCount = computed(() => filteredOrders.value.length)
const netProfit = computed(() => totalIncome.value - totalExpense.value)

const isExporting = ref(false)

function formatDate(dateValue) {
  if (!dateValue) return ''
  const d = new Date(dateValue)
  if (isNaN(d.getTime())) return dateValue
  return d.toLocaleDateString('km-KH', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function fmtCurrency(amount) {
  if (amount === undefined || amount === null) return '$0.00'
  return '$' + (Number(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function exportAllToExcel() {
  isExporting.value = true
  try {
    const wb = utils.book_new()
    const timestamp = new Date().toISOString().split('T')[0]

    // ── SHEET 1: Stock Products ──
    const stockData = stockStore.stockItems.map(s => ({
      ឈ្មោះផលិតផល: s.name,
      បរិមាណ: s.quantity,
      'តម្លៃឯកតា': fmtCurrency(s.unitPrice),
      'តម្លៃដើម': fmtCurrency(s.costPrice),
      'តម្លៃសរុប': fmtCurrency(s.quantity * (s.unitPrice || 0)),
      'កម្រិតអប្បបរមា': s.minStockLevel || 0,
      ស្ថានភាព: s.quantity === 0 ? 'អស់ស្តុក' : (s.quantity <= (s.minStockLevel || 0) ? 'ខ្សត់' : 'មាន'),
      បង្កើត: formatDate(s.createdAt),
      ធ្វើបច្ចុប្បន្នភាព: formatDate(s.updatedAt)
    }))
    if (stockData.length > 0) {
      const wsStock = utils.json_to_sheet(stockData)
      utils.book_append_sheet(wb, wsStock, 'ស្តុកផលិតផល')
    }

    // ── SHEET 2: Material In (សម្ភារៈចូល) ──
    const materialInData = stockStore.materialTransactions
      .filter(tx => tx.type === 'in' && tx.materialName !== 'ពលកម្ម')
      .map(tx => {
        let qty = tx.quantity
        let unit = 'ឯកតា'
        if (tx.materialName === 'តែ') {
          qty = qty / 1000
          unit = 'kg'
        } else if (tx.materialName === 'ទាបបារាំង') {
          unit = 'kg'
        }
        return {
          ឈ្មោះសម្ភារៈ: tx.materialName,
          ទំហំ: tx.size,
          បរិមាណ: qty,
          ឯកតា: unit,
          'តម្លៃឯកតា': fmtCurrency(tx.unitPrice),
          'តម្លៃសរុប': fmtCurrency(tx.totalPrice),
          កាលបរិច្ឆេទ: formatDate(tx.date),
          កត់ត្រា: tx.notes || '',
          បង្កើត: formatDate(tx.createdAt)
        }
      })
    if (materialInData.length > 0) {
      const wsMaterialIn = utils.json_to_sheet(materialInData)
      utils.book_append_sheet(wb, wsMaterialIn, 'សម្ភារៈចូល')
    }

    // ── SHEET 3: Material Out (សម្ភារៈចេញ) ──
    const materialOutData = stockStore.materialTransactions
      .filter(tx => tx.type === 'out' && tx.materialName !== 'ពលកម្ម')
      .map(tx => {
        let qty = tx.quantity
        let unit = 'ឯកតា'
        if (tx.materialName === 'តែ') {
          qty = qty / 1000
          unit = 'kg'
        } else if (tx.materialName === 'ទាបបារាំង') {
          unit = 'kg'
        }
        return {
          ឈ្មោះសម្ភារៈ: tx.materialName,
          ទំហំ: tx.size,
          បរិមាណ: qty,
          ឯកតា: unit,
          'តម្លៃឯកតា': fmtCurrency(tx.unitPrice),
          'តម្លៃសរុប': fmtCurrency(tx.totalPrice),
          កាលបរិច្ឆេទ: formatDate(tx.date),
          កត់ត្រា: tx.notes || '',
          បង្កើត: formatDate(tx.createdAt)
        }
      })
    if (materialOutData.length > 0) {
      const wsMaterialOut = utils.json_to_sheet(materialOutData)
      utils.book_append_sheet(wb, wsMaterialOut, 'សម្ភារៈចេញ')
    }

    // ── SHEET 4: Orders ──
    const orderData = orderStore.orders.map(o => {
      const itemsSummary = o.items ? o.items.map(item => `${item.name || item.productName || 'ផលិតផល'} x${item.quantity}`).join(', ') : ''
      return {
        លេខការកម្មង់: o.orderNumber,
        អតិថិជន: o.customer?.name || o.customerName || o.customer || '',
        ទូរស័ព្ទ: o.customer?.phone || o.phone || '',
        ស្ថានភាព: o.status,
        តម្លៃសរុប: fmtCurrency(o.total),
        ទំនិញ: itemsSummary,
        កាលបរិច្ឆេទ: formatDate(o.createdAt),
        ធ្វើបច្ចុប្បន្នភាព: formatDate(o.updatedAt),
        កត់ត្រា: o.notes || ''
      }
    })
    if (orderData.length > 0) {
      const wsOrders = utils.json_to_sheet(orderData)
      utils.book_append_sheet(wb, wsOrders, 'ការកម្មង់')
    }

    // ── SHEET 5: Assets (matches AssetModal.vue) ──
    const assetData = assetStore.assets.map(a => ({
      ឈ្មោះទ្រព្យសម្បត្តិ: a.name,
      ប្រភេទ: a.category || assetStore.assetCategories.find(c => c.id === a.categoryId || c.name === a.category)?.name || a.categoryId || a.category || '',
      ទីតាំង: a.location || '',
      អ្នកកាន់កាប់: a.assignedTo || '',
      កាលបរិច្ឆេទទិញ: formatDate(a.purchaseDate || a.date),
      តម្លៃទិញចូល: fmtCurrency(a.value),
      អ្នកផ្គត់ផ្គង់: a.vendor || '',
      ការពិពណ៌នា: a.description || ''
    }))
    if (assetData.length > 0) {
      const wsAssets = utils.json_to_sheet(assetData)
      utils.book_append_sheet(wb, wsAssets, 'ទ្រព្យសកម្ម')
    }

    // ── SHEET 6: Income (matches IncomeModal.vue) ──
    const incomeData = incomeStore.incomes.map(i => ({
      ថ្ងៃខែ: formatDate(i.date),
      តម្លៃ: fmtCurrency(i.amount),
      ប្រភេទចំណូល: i.category || incomeStore.incomeCategories.find(c => c.id === i.categoryId || c.name === i.category)?.name || i.categoryId || i.category || '',
      វិធីបង់ប្រាក់: i.paymentMethod === 'cash' ? 'សាច់ប្រាក់' : (i.paymentMethod === 'bank_transfer' ? 'ផ្ទេរប្រាក់តាមធនាគារ' : i.paymentMethod || ''),
      កំណត់សម្គាល់: i.description || i.name || '',
      ឈ្មោះអតិថិជន: i.customer || '',
      ឯកសារយោង: i.reference || ''
    }))
    if (incomeData.length > 0) {
      const wsIncome = utils.json_to_sheet(incomeData)
      utils.book_append_sheet(wb, wsIncome, 'ចំណូល')
    }

    // ── SHEET 7: Expenses (matches ExpenseModal.vue) ──
    const expenseData = expenseStore.expenses.map(e => ({
      កាលបរិច្ឆេទ: formatDate(e.date),
      ចំនួនទឹកប្រាក់: fmtCurrency(e.amount),
      ប្រភេទចំណាយ: e.category || expenseStore.expenseCategories.find(c => c.id === e.categoryId || c.name === e.category)?.name || e.categoryId || e.category || '',
      វិធីសាស្ត្រទូទាត់: e.paymentMethod === 'cash' ? 'សាច់ប្រាក់' : (e.paymentMethod === 'khqr' ? 'ផ្ទេរប្រាក់តាមធនាគារ' : e.paymentMethod || ''),
      បរិយាយ: e.description || e.name || '',
      អ្នកផ្គត់ផ្គង់: e.vendor || '',
      លេខយោង: e.reference || ''
    }))
    if (expenseData.length > 0) {
      const wsExpenses = utils.json_to_sheet(expenseData)
      utils.book_append_sheet(wb, wsExpenses, 'ចំណាយ')
    }

    const filename = `របាយការណ៍_${timestamp}.xlsx`
    writeFileXLSX(wb, filename)
  } catch (error) {
    console.error('Excel export failed:', error)
  } finally {
    isExporting.value = false
  }
}

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
        <button class="btn btn-export" :disabled="isExporting" @click="exportAllToExcel">
          <span v-if="isExporting" class="spinner"></span>
          <i v-else class="fas fa-file-excel"></i>
          {{ isExporting ? 'កំពុងនាំចេញ...' : 'នាំចេញ Excel' }}
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <StatCard icon="fas fa-arrow-trend-up" label="ចំណូលសរុប" :value="formatCurrency(totalIncome)" bg-class="bg-success" />
      <StatCard icon="fas fa-arrow-trend-down" label="ចំណាយសរុប" :value="formatCurrency(totalExpense)" bg-class="bg-danger" />
      <StatCard icon="fas fa-shopping-basket" label="ចំនួនការកម្មង់ (ជោគជ័យ)" :value="totalOrderCount" bg-class="bg-warning" />
      <StatCard icon="fas fa-box" label="ស្តុក S (តូច)" :value="stockBySize.S" bg-class="bg-info" />
      <StatCard icon="fas fa-box-open" label="ស្តុក M (មធ្យម)" :value="stockBySize.M" bg-class="bg-primary" />
      <StatCard icon="fas fa-boxes-stacked" label="ស្តុក L (ធំ)" :value="stockBySize.L" bg-class="bg-secondary" />
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


@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .activity-grid {
    grid-template-columns: 1fr;
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