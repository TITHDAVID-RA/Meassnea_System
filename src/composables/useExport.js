import { ref } from 'vue'
import { utils, writeFileXLSX } from 'xlsx'
import { useAssetStore } from '@/stores/assetStore'
import { useExpenseStore } from '@/stores/expenseStore'
import { useIncomeStore } from '@/stores/incomeStore'
import { useOrderStore } from '@/stores/orderStore'
import { useStockStore } from '@/stores/stockStore'

export function useExcelExport() {
  const isExporting = ref(false)

  function formatDate(dateValue) {
    if (!dateValue) return ''
    const d = new Date(dateValue)
    if (isNaN(d.getTime())) return dateValue
    return d.toLocaleDateString('km-KH', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  function formatCurrency(amount) {
    if (amount === undefined || amount === null) return '$0.00'
    return '$' + (Number(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  async function exportAllToExcel() {
    isExporting.value = true
    try {
      const assetStore = useAssetStore()
      const expenseStore = useExpenseStore()
      const incomeStore = useIncomeStore()
      const orderStore = useOrderStore()
      const stockStore = useStockStore()

      const wb = utils.book_new()
      const timestamp = new Date().toISOString().split('T')[0]

      // ── SHEET 1: Stock Products ──
      const stockData = stockStore.stockItems.map(s => ({
        ឈ្មោះផលិតផល: s.name,
        បរិមាណ: s.quantity,
        'តម្លៃឯកតា': formatCurrency(s.unitPrice),
        'តម្លៃដើម': formatCurrency(s.costPrice),
        'តម្លៃសរុប': formatCurrency(s.quantity * (s.unitPrice || 0)),
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
            'តម្លៃឯកតា': formatCurrency(tx.unitPrice),
            'តម្លៃសរុប': formatCurrency(tx.totalPrice),
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
            'តម្លៃឯកតា': formatCurrency(tx.unitPrice),
            'តម្លៃសរុប': formatCurrency(tx.totalPrice),
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
          តម្លៃសរុប: formatCurrency(o.total),
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
        តម្លៃទិញចូល: formatCurrency(a.value),
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
        តម្លៃ: formatCurrency(i.amount),
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
        ចំនួនទឹកប្រាក់: formatCurrency(e.amount),
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

  return {
    isExporting,
    exportAllToExcel
  }
}