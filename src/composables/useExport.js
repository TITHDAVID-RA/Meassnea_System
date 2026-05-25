import { ref } from 'vue'
import XLSX from 'xlsx-js-style'
import { useAssetStore } from '@/stores/assetStore'
import { useExpenseStore } from '@/stores/expenseStore'
import { useIncomeStore } from '@/stores/incomeStore'
import { useOrderStore } from '@/stores/orderStore'
import { useStockStore } from '@/stores/stockStore'

export function useExcelExport() {
  const isExporting = ref(false)
  const exportRange = ref('all') // 'all' | '3months' | '6months' | '1year'

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

  function getDateRange() {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    let start = null

    switch (exportRange.value) {
      case '3months':
        start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate(), 0, 0, 0, 0)
        break
      case '6months':
        start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 0, 0, 0, 0)
        break
      case '1year':
        start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 0, 0, 0, 0)
        break
      default:
        return { start: null, end: null }
    }
    return { start, end }
  }

  function isWithinRange(dateStr, start, end) {
    if (!dateStr) return false
    const itemDate = new Date(dateStr).getTime()
    if (start && itemDate < start.getTime()) return false
    if (end && itemDate > end.getTime()) return false
    return true
  }

  function getMaterialPrices(tx, rawQty) {
    const stockStore = useStockStore()
    const parsePrice = (val) => {
      if (val === undefined || val === null) return 0
      const cleanStr = String(val).replace(/[^0-9.]/g, '')
      return Number(cleanStr) || 0
    }

    let unitPrice = parsePrice(tx.unitPrice || tx.unit_price || tx.price || tx.cost || tx.costPrice || tx.cost_price || 0)
    let totalPrice = parsePrice(tx.totalPrice || tx.total_price || tx.total || 0)

    if (unitPrice === 0 && totalPrice > 0 && rawQty > 0) {
      unitPrice = totalPrice / rawQty
    }

    if (unitPrice === 0 && tx.type === 'out') {
      const latestInTx = stockStore.materialTransactions
        .filter(t => t.type === 'in' && t.materialName === tx.materialName && (tx.size ? t.size === tx.size : true))
        .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))[0]

      if (latestInTx) {
        unitPrice = parsePrice(latestInTx.unitPrice || latestInTx.unit_price || latestInTx.price || latestInTx.cost || latestInTx.costPrice)
      }
    }

    if (totalPrice === 0 && unitPrice > 0 && rawQty > 0) {
      totalPrice = rawQty * unitPrice
    }

    return { unitPrice, totalPrice }
  }

  function getPlasticBagDisplay(order) {
    if (!order.plasticBags || !Array.isArray(order.plasticBags) || order.plasticBags.length === 0) {
      return 'គ្មាន'
    }
    return order.plasticBags.map(b => `${b.size}x${b.qty}`).join(', ')
  }

  function getPlasticBagCostDisplay(order) {
    if (!order.plasticBagCost || order.plasticBagCost === 0) return '$0.00'
    return formatCurrency(order.plasticBagCost)
  }

  function styleSheet(ws, theme) {
    if (!ws['!ref']) return
    const range = XLSX.utils.decode_range(ws['!ref'])

    const gridBorder = {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } }
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
            font: { bold: true, color: { rgb: theme.headerText || 'FFFFFF' }, sz: 11, name: 'Khmer OS Battambang' },
            fill: { fgColor: { rgb: theme.headerBg }, patternType: 'solid' },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'thin', color: { rgb: '94A3B8' } },
              bottom: { style: 'medium', color: { rgb: '475569' } },
              left: { style: 'thin', color: { rgb: '94A3B8' } },
              right: { style: 'thin', color: { rgb: '94A3B8' } }
            }
          }
        } else {
          const isNumeric = cell.t === 'n' || (typeof cell.v === 'string' && cell.v.startsWith('$'))
          cell.s = {
            font: { sz: 10, name: 'Khmer OS Battambang' },
            fill: { fgColor: { rgb: colBgColor }, patternType: 'solid' },
            alignment: { horizontal: isNumeric ? 'right' : 'left', vertical: 'center' },
            border: gridBorder
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
      const assetStore = useAssetStore()
      const expenseStore = useExpenseStore()
      const incomeStore = useIncomeStore()
      const orderStore = useOrderStore()
      const stockStore = useStockStore()

      const { start, end } = getDateRange()
      const wb = XLSX.utils.book_new()
      const timestamp = new Date().toISOString().split('T')[0]

      // ── SHEET 1: Stock Products (Light Blue Theme) ──
      const stockData = stockStore.stockItems.map(s => ({
        ឈ្មោះផលិតផល: s.name,
        ដើម: s.initialQuantity,
        បរិមាណ: s.quantity,
        'តម្លៃឯកតា': formatCurrency(s.unitPrice),
        'តម្លៃដើម': formatCurrency(s.costPrice),
        'តម្លៃសរុប': formatCurrency(s.quantity * (s.unitPrice || 0)),
        'តម្លៃដើមសរុប': formatCurrency(s.costPrice * (s.quantity || 0)),
        ស្ថានភាព: s.quantity === 0 ? 'អស់ពីស្តុក' : (s.quantity <= (s.minStockLevel || 0) ? 'ខ្សត់ស្តុក' : 'នៅមានស្តុក'),
        'ថ្ងៃចូលស្តុក': formatDate(s.createdAt),
      }))
      if (stockData.length > 0) {
        const wsStock = XLSX.utils.json_to_sheet(stockData)
        styleSheet(wsStock, {
          headerBg: '0284C7',
          headerText: 'FFFFFF',
          colColors: ['F0F9FF', 'E0F2FE', 'F0F9FF', 'E0F2FE', 'F0F9FF', 'E0F2FE', 'F0F9FF', 'E0F2FE', 'F0F9FF']
        })
        XLSX.utils.book_append_sheet(wb, wsStock, 'ស្តុកផលិតផល')
      }

      // ── SHEET 2: Material In (Light Green Theme) ──
      const materialInData = stockStore.materialTransactions
        .filter(tx => tx.type === 'in' && tx.materialName !== 'ពលកម្ម' && isWithinRange(tx.date, start, end))
        .map(tx => {
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
            'តម្លៃឯកតា': formatCurrency(unitPrice),
            'តម្លៃសរុប': formatCurrency(totalPrice),
            កាលបរិច្ឆេទចូលស្តុក: formatDate(tx.date),
          }
        })
      if (materialInData.length > 0) {
        const wsMaterialIn = XLSX.utils.json_to_sheet(materialInData)
        styleSheet(wsMaterialIn, {
          headerBg: '059669',
          headerText: 'FFFFFF',
          colColors: ['F0FDF4', 'DCFCE7', 'F0FDF4', 'DCFCE7', 'F0FDF4', 'DCFCE7', 'F0FDF4', 'DCFCE7', 'F0FDF4']
        })
        XLSX.utils.book_append_sheet(wb, wsMaterialIn, 'សម្ភារៈចូល')
      }

      // ── SHEET 3: Material Out (Light Red/Rose Theme) ──
      const materialOutData = stockStore.materialTransactions
        .filter(tx => tx.type === 'out' && tx.materialName !== 'ពលកម្ម' && isWithinRange(tx.date, start, end))
        .map(tx => {
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
            'តម្លៃឯកតា': formatCurrency(unitPrice),
            'តម្លៃសរុប': formatCurrency(totalPrice),
            កាលបរិច្ឆេទចេញ: formatDate(tx.date),
            កត់ត្រា: tx.notes || ''
          }
        })

      const wsMaterialOut = materialOutData.length > 0
        ? XLSX.utils.json_to_sheet(materialOutData)
        : XLSX.utils.json_to_sheet([{
          ឈ្មោះសម្ភារៈ: '', ទំហំ: '', បរិមាណ: '', ឯកតា: '', តម្លៃឯកតា: '', តម្លៃសរុប: '', កាលបរិច្ឆេទចេញ: '', កត់ត្រា: ''
        }])

      styleSheet(wsMaterialOut, {
        headerBg: 'E11D48',
        headerText: 'FFFFFF',
        colColors: ['FFF1F2', 'FFE4E6', 'FFF1F2', 'FFE4E6', 'FFF1F2', 'FFE4E6', 'FFF1F2', 'FFE4E6', 'FFF1F2']
      })
      XLSX.utils.book_append_sheet(wb, wsMaterialOut, 'សម្ភារៈចេញ')

      // ── SHEET 4: Orders (Light Purple Theme) ──
      const orderData = orderStore.orders
        .filter(o => isWithinRange(o.date || o.createdAt, start, end))
        .map(o => {
          const itemsSummary = o.items ? o.items.map(item => `${item.name || item.productName || 'ផលិតផល'} x${item.quantity}`).join(', ') : ''
          return {
            លេខការកម្មង់: o.orderNumber,
            អតិថិជន: o.customer?.name || o.customerName || o.customer || '',
            ស្ថានភាព: o.status,
            តម្លៃសរុប: formatCurrency(o.total),
            ទំនិញ: itemsSummary,
            ថង់: getPlasticBagDisplay(o),
            'ថ្លៃថង់': getPlasticBagCostDisplay(o),
            កាលបរិច្ឆេទចេញវិក្កយបត្រ: formatDate(o.createdAt),
            កត់ត្រា: o.notes || ''
          }
        })
      if (orderData.length > 0) {
        const wsOrders = XLSX.utils.json_to_sheet(orderData)
        styleSheet(wsOrders, {
          headerBg: '7C3AED',
          headerText: 'FFFFFF',
          colColors: ['FAF5FF', 'F3E8FF', 'FAF5FF', 'F3E8FF', 'FAF5FF', 'F3E8FF', 'FAF5FF', 'F3E8FF', 'FAF5FF']
        })
        XLSX.utils.book_append_sheet(wb, wsOrders, 'ការកម្មង់')
      }

      // ── SHEET 5: Assets (Light Orange Theme) ──
      const assetData = assetStore.assets
        .filter(a => isWithinRange(a.purchaseDate || a.date, start, end))
        .map(a => ({
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
        const wsAssets = XLSX.utils.json_to_sheet(assetData)
        styleSheet(wsAssets, {
          headerBg: 'EA580C',
          headerText: 'FFFFFF',
          colColors: ['FFF7ED', 'FFEDD5', 'FFF7ED', 'FFEDD5', 'FFF7ED', 'FFEDD5', 'FFF7ED', 'FFEDD5', 'FFF7ED']
        })
        XLSX.utils.book_append_sheet(wb, wsAssets, 'ទ្រព្យសកម្ម')
      }

      // ── SHEET 6: Income (Light Teal Theme) ──
      const incomeData = incomeStore.incomes
        .filter(i => isWithinRange(i.date, start, end))
        .map(i => ({
          ថ្ងៃខែ: formatDate(i.date),
          ទឹកប្រាក់ចំណេញសុទ្ធ: formatCurrency(i.amount),
          ប្រភេទចំណូល: i.category || incomeStore.incomeCategories.find(c => c.id === i.categoryId || c.name === i.category)?.name || i.categoryId || i.category || '',
          វិធីបង់ប្រាក់: i.paymentMethod === 'cash' ? 'សាច់ប្រាក់' : (i.paymentMethod === 'bank_transfer' ? 'ផ្ទេរប្រាក់តាមធនាគារ' : i.paymentMethod || ''),
          កំណត់សម្គាល់: i.description || i.name || '',
          ឈ្មោះអតិថិជន: i.customer || '',
          ឯកសារយោង: i.reference || ''
        }))
      if (incomeData.length > 0) {
        const wsIncome = XLSX.utils.json_to_sheet(incomeData)
        styleSheet(wsIncome, {
          headerBg: '0D9488',
          headerText: 'FFFFFF',
          colColors: ['F0FDFA', 'CCFBF1', 'F0FDFA', 'CCFBF1', 'F0FDFA', 'CCFBF1', 'F0FDFA', 'CCFBF1', 'F0FDFA']
        })
        XLSX.utils.book_append_sheet(wb, wsIncome, 'ចំណូល')
      }

      // ── SHEET 7: Expenses (Light Pink Theme) ──
      const expenseData = expenseStore.expenses
        .filter(e => isWithinRange(e.date, start, end))
        .map(e => ({
          កាលបរិច្ឆេទ: formatDate(e.date),
          ចំនួនទឹកប្រាក់: formatCurrency(e.amount),
          ប្រភេទចំណាយ: e.category || expenseStore.expenseCategories.find(c => c.id === e.categoryId || c.name === e.category)?.name || e.categoryId || e.category || '',
          វិធីសាស្ត្រទូទាត់: e.paymentMethod === 'cash' ? 'សាច់ប្រាក់' : (e.paymentMethod === 'khqr' ? 'ផ្ទេរប្រាក់តាមធនាគារ' : e.paymentMethod || ''),
          បរិយាយ: e.description || e.name || '',
          អ្នកផ្គត់ផ្គង់: e.vendor || '',
          លេខយោង: e.reference || ''
        }))
      if (expenseData.length > 0) {
        const wsExpenses = XLSX.utils.json_to_sheet(expenseData)
        styleSheet(wsExpenses, {
          headerBg: 'DB2777',
          headerText: 'FFFFFF',
          colColors: ['FDF2F8', 'FCE7F3', 'FDF2F8', 'FCE7F3', 'FDF2F8', 'FCE7F3', 'FDF2F8', 'FCE7F3', 'FDF2F8']
        })
        XLSX.utils.book_append_sheet(wb, wsExpenses, 'ចំណាយ')
      }

      const rangeLabel = exportRange.value === 'all' ? 'ទាំងអស់' : 
                        exportRange.value === '3months' ? '3ខែចុងក្រោយ' :
                        exportRange.value === '6months' ? '6ខែចុងក្រោយ' : '1ឆ្នាំចុងក្រោយ'
      const filename = `របាយការណ៍_${rangeLabel}_${timestamp}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (error) {
      console.error('Excel export failed:', error)
    } finally {
      isExporting.value = false
    }
  }

  return {
    isExporting,
    exportRange,
    exportAllToExcel
  }
}