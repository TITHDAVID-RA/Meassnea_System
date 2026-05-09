<script setup>
import { ref, computed } from 'vue'
import XLSX from 'xlsx-js-style'
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
  return (
    '$' +
    (Number(amount) || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

/**
 * Intelligently retrieves or estimates material unit/total pricing.
 * Placed safely at the script level so map functions can access it without reference errors.
 */
function getMaterialPrices(tx, rawQty) {
  const parsePrice = (val) => {
    if (val === undefined || val === null) return 0
    const cleanStr = String(val).replace(/[^0-9.]/g, '')
    return Number(cleanStr) || 0
  }

  let unitPrice = parsePrice(tx.unitPrice || tx.unit_price || tx.price || tx.cost || tx.costPrice || tx.cost_price || 0)
  let totalPrice = parsePrice(tx.totalPrice || tx.total_price || tx.total || 0)

  // Calculate unit price if total exists
  if (unitPrice === 0 && totalPrice > 0 && rawQty > 0) {
    unitPrice = totalPrice / rawQty
  }

  // Fallback: Lookup latest "In" price for Out transactions without pricing
  if (unitPrice === 0 && tx.type === 'out') {
    const latestInTx = stockStore.materialTransactions
      .filter(t => t.type === 'in' && t.materialName === tx.materialName && (tx.size ? t.size === tx.size : true))
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))[0]
    
    if (latestInTx) {
      unitPrice = parsePrice(latestInTx.unitPrice || latestInTx.unit_price || latestInTx.price || latestInTx.cost || latestInTx.costPrice)
    }
  }

  // Calculate total price if missing but we have a unit price
  if (totalPrice === 0 && unitPrice > 0 && rawQty > 0) {
    totalPrice = rawQty * unitPrice
  }

  return { unitPrice, totalPrice }
}

/**
 * Styles the entire worksheet with headers, full table grid borders, and unique column colors.
 */
function styleSheet(ws, theme) {
  if (!ws['!ref']) return
  const range = XLSX.utils.decode_range(ws['!ref'])

  const gridBorder = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
  }

  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
      if (!ws[cellAddress]) {
        ws[cellAddress] = { t: 'z', v: '' }
      }
      const cell = ws[cellAddress]

      const colColorList = theme.colColors || []
      const colBgColor = colColorList[col % colColorList.length] || 'F8FAFC'

      if (row === 0) {
        cell.s = {
          font: {
            bold: true,
            color: { rgb: theme.headerText || 'FFFFFF' },
            sz: 11,
            name: 'Khmer OS Battambang',
          },
          fill: { fgColor: { rgb: theme.headerBg }, patternType: 'solid' },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: '94A3B8' } },
            bottom: { style: 'medium', color: { rgb: '475569' } },
            left: { style: 'thin', color: { rgb: '94A3B8' } },
            right: { style: 'thin', color: { rgb: '94A3B8' } },
          },
        }
      } else {
        const isNumeric = cell.t === 'n' || (typeof cell.v === 'string' && cell.v.startsWith('$'))
        cell.s = {
          font: { sz: 10, name: 'Khmer OS Battambang' },
          fill: { fgColor: { rgb: colBgColor }, patternType: 'solid' },
          alignment: {
            horizontal: isNumeric ? 'right' : 'left',
            vertical: 'center',
          },
          border: gridBorder,
        }
      }
    }
  }

  const cols = []
  for (let col = range.s.c; col <= range.e.c; col++) {
    let maxWidth = 12
    for (let row = range.s.r; row <= range.e.r; row++) {
      const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })]
      if (cell && cell.v !== undefined && cell.v !== null) {
        const len = String(cell.v).length
        if (len > maxWidth) maxWidth = len
      }
    }
    cols.push({ wch: Math.min(maxWidth + 4, 40) })
  }
  ws['!cols'] = cols
  ws['!rows'] = [{ hpt: 28 }]
}

async function exportAllToExcel() {
  isExporting.value = true
  try {
    const wb = XLSX.utils.book_new()
    const timestamp = new Date().toISOString().split('T')[0]

    // ── SHEET 1: Stock Products (Light Blue Theme) ──
    const stockData = stockStore.stockItems.map((s) => ({
      ឈ្មោះផលិតផល: s.name,
      ដើម: s.initialQuantity,
      បរិមាណ: s.quantity,
      តម្លៃឯកតា: fmtCurrency(s.unitPrice),
      តម្លៃដើម: fmtCurrency(s.costPrice),
      តម្លៃសរុប: fmtCurrency(s.quantity * (s.unitPrice || 0)),
      តម្លៃដើមសរុប: fmtCurrency(s.costPrice * (s.quantity || 0)),
      ស្ថានភាព:
        s.quantity === 0
          ? 'អស់ពីស្តុក'
          : s.quantity <= (s.minStockLevel || 0)
            ? 'ខ្សត់ស្តុក'
            : 'នៅមានស្តុក',
      ថ្ងៃចូលស្តុក: formatDate(s.createdAt),
    }))
    if (stockData.length > 0) {
      const wsStock = XLSX.utils.json_to_sheet(stockData)
      styleSheet(wsStock, {
        headerBg: '0284C7',
        headerText: 'FFFFFF',
        colColors: [
          'F0F9FF',
          'E0F2FE',
          'F0F9FF',
          'E0F2FE',
          'F0F9FF',
          'E0F2FE',
          'F0F9FF',
          'E0F2FE',
          'F0F9FF',
        ],
      })
      XLSX.utils.book_append_sheet(wb, wsStock, 'ស្តុកផលិតផល')
    }

    // ── SHEET 2: Material In (Light Green Theme) ──
    const materialInData = stockStore.materialTransactions
      .filter((tx) => tx.type === 'in' && tx.materialName !== 'ពលកម្ម')
      .map((tx) => {
        let qty = tx.quantity
        let rawQty = Number(tx.quantity) || 0
        let unit = 'ឯកតា'
        if (tx.materialName === 'តែ') {
          qty = qty / 1000
          rawQty = rawQty / 1000
          unit = 'kg'
        } else if (tx.materialName === 'ទាបបារាំង') {
          unit = 'kg'
        }

        const { unitPrice, totalPrice } = getMaterialPrices(tx, rawQty)

        return {
          ឈ្មោះសម្ភារៈ: tx.materialName,
          ទំហំ: tx.size,
          បរិមាណ: qty,
          ឯកតា: unit,
          តម្លៃឯកតា: fmtCurrency(unitPrice),
          តម្លៃសរុប: fmtCurrency(totalPrice),
          កាលបរិច្ឆេទចូលស្តុក: formatDate(tx.date),
        }
      })
    if (materialInData.length > 0) {
      const wsMaterialIn = XLSX.utils.json_to_sheet(materialInData)
      styleSheet(wsMaterialIn, {
        headerBg: '059669',
        headerText: 'FFFFFF',
        colColors: [
          'F0FDF4',
          'DCFCE7',
          'F0FDF4',
          'DCFCE7',
          'F0FDF4',
          'DCFCE7',
          'F0FDF4',
          'DCFCE7',
          'F0FDF4',
        ],
      })
      XLSX.utils.book_append_sheet(wb, wsMaterialIn, 'សម្ភារៈចូល')
    }

    // ── SHEET 3: Material Out (Light Red/Rose Theme) ──
    const materialOutData = stockStore.materialTransactions
      .filter((tx) => tx.type === 'out' && tx.materialName !== 'ពលកម្ម')
      .map((tx) => {
        let qty = tx.quantity
        let rawQty = Number(tx.quantity) || 0
        let unit = 'ឯកតា'
        if (tx.materialName === 'តែ') {
          qty = qty / 1000
          rawQty = rawQty / 1000
          unit = 'kg'
        } else if (tx.materialName === 'ទាបបារាំង') {
          unit = 'kg'
        }

        const { unitPrice, totalPrice } = getMaterialPrices(tx, rawQty)

        return {
          ឈ្មោះសម្ភារៈ: tx.materialName,
          ទំហំ: tx.size,
          បរិមាណ: qty,
          ឯកតា: unit,
          តម្លៃឯកតា: fmtCurrency(unitPrice),
          តម្លៃសរុប: fmtCurrency(totalPrice),
          កាលបរិច្ឆេទចេញ: formatDate(tx.date),
          កត់ត្រា: tx.notes || '',
        }
      })

    const wsMaterialOut =
      materialOutData.length > 0
        ? XLSX.utils.json_to_sheet(materialOutData)
        : XLSX.utils.json_to_sheet([
            {
              ឈ្មោះសម្ភារៈ: '',
              ទំហំ: '',
              បរិមាណ: '',
              ឯកតា: '',
              តម្លៃឯកតា: '',
              តម្លៃសរុប: '',
              កាលបរិច្ឆេទចេញ: '',
              កត់ត្រា: '',
            },
          ])

    styleSheet(wsMaterialOut, {
      headerBg: 'E11D48',
      headerText: 'FFFFFF',
      colColors: [
        'FFF1F2',
        'FFE4E6',
        'FFF1F2',
        'FFE4E6',
        'FFF1F2',
        'FFE4E6',
        'FFF1F2',
        'FFE4E6',
        'FFF1F2',
      ],
    })
    XLSX.utils.book_append_sheet(wb, wsMaterialOut, 'សម្ភារៈចេញ')

    // ── SHEET 4: Orders (Light Purple Theme) ──
    const orderData = orderStore.orders.map((o) => {
      const itemsSummary = o.items
        ? o.items
            .map((item) => `${item.name || item.productName || 'ផលិតផល'} x${item.quantity}`)
            .join(', ')
        : ''
      return {
        លេខការកម្មង់: o.orderNumber,
        អតិថិជន: o.customer?.name || o.customerName || o.customer || '',
        ស្ថានភាព: o.status,
        តម្លៃសរុប: fmtCurrency(o.total),
        ទំនិញ: itemsSummary,
        កាលបរិច្ឆេទចេញវិក្កយបត្រ: formatDate(o.createdAt),
        កត់ត្រា: o.notes || '',
      }
    })
    if (orderData.length > 0) {
      const wsOrders = XLSX.utils.json_to_sheet(orderData)
      styleSheet(wsOrders, {
        headerBg: '7C3AED',
        headerText: 'FFFFFF',
        colColors: [
          'FAF5FF',
          'F3E8FF',
          'FAF5FF',
          'F3E8FF',
          'FAF5FF',
          'F3E8FF',
          'FAF5FF',
          'F3E8FF',
          'FAF5FF',
        ],
      })
      XLSX.utils.book_append_sheet(wb, wsOrders, 'ការកម្មង់')
    }

    // ── SHEET 5: Assets (Light Orange Theme) ──
    const assetData = assetStore.assets.map((a) => ({
      ឈ្មោះទ្រព្យសម្បត្តិ: a.name,
      ប្រភេទ:
        a.category ||
        assetStore.assetCategories.find((c) => c.id === a.categoryId || c.name === a.category)
          ?.name ||
        a.categoryId ||
        a.category ||
        '',
      ទីតាំង: a.location || '',
      អ្នកកាន់កាប់: a.assignedTo || '',
      កាលបរិច្ឆេទទិញ: formatDate(a.purchaseDate || a.date),
      តម្លៃទិញចូល: fmtCurrency(a.value),
      អ្នកផ្គត់ផ្គង់: a.vendor || '',
      ការពិពណ៌នា: a.description || '',
    }))
    if (assetData.length > 0) {
      const wsAssets = XLSX.utils.json_to_sheet(assetData)
      styleSheet(wsAssets, {
        headerBg: 'EA580C',
        headerText: 'FFFFFF',
        colColors: [
          'FFF7ED',
          'FFEDD5',
          'FFF7ED',
          'FFEDD5',
          'FFF7ED',
          'FFEDD5',
          'FFF7ED',
          'FFEDD5',
          'FFF7ED',
        ],
      })
      XLSX.utils.book_append_sheet(wb, wsAssets, 'ទ្រព្យសកម្ម')
    }

    // ── SHEET 6: Income (Light Teal Theme) ──
    const incomeData = incomeStore.incomes.map((i) => ({
      ថ្ងៃខែ: formatDate(i.date),
      ទឹកប្រាក់ចំណេញសុទ្ធ: fmtCurrency(i.amount),
      ប្រភេទចំណូល:
        i.category ||
        incomeStore.incomeCategories.find((c) => c.id === i.categoryId || c.name === i.category)
          ?.name ||
        i.categoryId ||
        i.category ||
        '',
      វិធីបង់ប្រាក់:
        i.paymentMethod === 'cash'
          ? 'សាច់ប្រាក់'
          : i.paymentMethod === 'bank_transfer'
            ? 'ផ្ទេរប្រាក់តាមធនាគារ'
            : i.paymentMethod || '',
      កំណត់សម្គាល់: i.description || i.name || '',
      ឈ្មោះអតិថិជន: i.customer || '',
      ឯកសារយោង: i.reference || '',
    }))
    if (incomeData.length > 0) {
      const wsIncome = XLSX.utils.json_to_sheet(incomeData)
      styleSheet(wsIncome, {
        headerBg: '0D9488',
        headerText: 'FFFFFF',
        colColors: [
          'F0FDFA',
          'CCFBF1',
          'F0FDFA',
          'CCFBF1',
          'F0FDFA',
          'CCFBF1',
          'F0FDFA',
          'CCFBF1',
          'F0FDFA',
        ],
      })
      XLSX.utils.book_append_sheet(wb, wsIncome, 'ចំណូល')
    }

    // ── SHEET 7: Expenses (Light Pink Theme) ──
    const expenseData = expenseStore.expenses.map((e) => ({
      កាលបរិច្ឆេទ: formatDate(e.date),
      ចំនួនទឹកប្រាក់: fmtCurrency(e.amount),
      ប្រភេទចំណាយ:
        e.category ||
        expenseStore.expenseCategories.find((c) => c.id === e.categoryId || c.name === e.category)
          ?.name ||
        e.categoryId ||
        e.category ||
        '',
      វិធីសាស្ត្រទូទាត់:
        e.paymentMethod === 'cash'
          ? 'សាច់ប្រាក់'
          : e.paymentMethod === 'khqr'
            ? 'ផ្ទេរប្រាក់តាមធនាគារ'
            : e.paymentMethod || '',
      បរិយាយ: e.description || e.name || '',
      អ្នកផ្គត់ផ្គង់: e.vendor || '',
      លេខយោង: e.reference || '',
    }))
    if (expenseData.length > 0) {
      const wsExpenses = XLSX.utils.json_to_sheet(expenseData)
      styleSheet(wsExpenses, {
        headerBg: 'DB2777',
        headerText: 'FFFFFF',
        colColors: [
          'FDF2F8',
          'FCE7F3',
          'FDF2F8',
          'FCE7F3',
          'FDF2F8',
          'FCE7F3',
          'FDF2F8',
          'FCE7F3',
          'FDF2F8',
        ],
      })
      XLSX.utils.book_append_sheet(wb, wsExpenses, 'ចំណាយ')
    }

    const filename = `របាយការណ៍_${timestamp}.xlsx`
    XLSX.writeFile(wb, filename)
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
