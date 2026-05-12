import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGenerators } from '@/composables/useGenerators'
import { api } from '@/api/client' // Import central D1 API client

const defaultStockCategories = []

// Products - S, M, L + ទាបបារាំង (no size), names in Khmer
const ALLOWED_PRODUCTS = [
  'តែទាបបារាំង (S)',
  'តែទាបបារាំង (M)',
  'តែទាបបារាំង (L)',
  'ទាបបារាំង'
]

// Materials - តែ is back as sized material (grams), ទាបបារាំង is separate kg-based
const ALLOWED_MATERIALS = [
  'ថង់',
  'កេស',
  'ថង់វេចខ្ចប់',
  'ប្រអប់',
  'Leafleap',
  'ទាបបារាំង',
  'ពលកម្ម'
]

// Materials that use sizes (S, M, L)
const SIZED_MATERIALS = ['ថង់វេចខ្ចប់', 'ប្រអប់', 'Leafleap']

// Labor - price-only, unlimited use
const LABOR_MATERIALS = ['ពលកម្ម']

// Materials that are kg-based (no size)
const KG_MATERIALS = ['ទាបបារាំង']

// Materials that are no-size but quantity-based (not kg)
const NOSIZE_MATERIALS = ['ថង់', 'កេស']

// Tea grams per product size
const TEA_GRAMS_PER_SIZE = {
  S: 100,
  M: 200,
  L: 500
}

// Conversion: 1kg ទាបបារាំង = 150g តែ (for inventory display only)
const TEA_POWDER_TO_TEA_GRAMS = 150

// Extract size from product name
function getSizeFromProductName(name) {
  const match = name.match(/\((S|M|L)\)/)
  return match ? match[1] : null
}

export const useStockStore = defineStore('stock', () => {
  const { generateId } = useGenerators()

  // Replace browser useStorage offline states with reactive ref states
  const stockItems = ref([])
  const stockCategories = ref(defaultStockCategories)
  const materialTransactions = ref([])
  
  // teaPricePerGram continues to write locally to save persistent settings
  const teaPricePerGram = ref(Number(localStorage.getItem('teaPricePerGram')) || 0)

  // --- Computed States ---
  const totalProducts = computed(() => stockItems.value.length)
  const totalQuantity = computed(() => stockItems.value.reduce((sum, item) => sum + item.quantity, 0))
  const totalValue = computed(() => stockItems.value.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || item.unit_price || 0)), 0))
  const lowStockCount = computed(() => stockItems.value.filter(item => item.quantity <= item.minStockLevel).length)
  const outOfStockCount = computed(() => stockItems.value.filter(item => item.quantity === 0).length)

  const lowStockItems = computed(() =>
    stockItems.value.filter(item => item.quantity <= item.minStockLevel).sort((a, b) => a.quantity - b.quantity)
  )

  const materialSummary = computed(() => {
    const summary = {}
    materialTransactions.value.forEach(tx => {
      const key = `${tx.materialName}|${tx.size}`
      if (!summary[key]) {
        summary[key] = {
          materialName: tx.materialName,
          size: tx.size,
          totalIn: 0,
          totalOut: 0,
          balance: 0,
          avgPrice: 0,
          totalSpent: 0
        }
      }
      if (tx.type === 'in') {
        summary[key].totalIn += tx.quantity
        summary[key].balance += tx.quantity
        summary[key].totalSpent += tx.totalPrice
      } else {
        summary[key].totalOut += tx.quantity
        summary[key].balance -= tx.quantity
      }
    })
    Object.values(summary).forEach(s => {
      if (s.totalIn > 0) s.avgPrice = s.totalSpent / s.totalIn
    })
    return Object.values(summary).sort((a, b) => a.materialName.localeCompare(b.materialName))
  })

  const lowMaterialCount = computed(() => materialSummary.value.filter(m => m.balance <= 50).length)
  const totalMaterialQuantity = computed(() => materialSummary.value.reduce((sum, m) => sum + m.balance, 0))

  /**
   * Loads product information and material ledger logs directly from Cloudflare D1
   */
  async function fetchStockData() {
    try {
      const [products, transactions] = await Promise.all([
        api.get('/products'),
        api.get('/material-transactions')
      ])

      // Map snake_case columns back to your local camelCase states
      stockItems.value = products.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        size: p.size,
        quantity: p.quantity,
        initialQuantity: p.initial_quantity,
        unitPrice: p.unit_price,
        costPrice: p.cost_price,
        minStockLevel: p.min_stock_level,
        createdAt: p.created_at ? new Date(p.created_at) : new Date(),
        updatedAt: p.updated_at ? new Date(p.updated_at) : new Date()
      }))

      materialTransactions.value = transactions.map(tx => ({
        id: tx.id,
        materialId: tx.material_id,
        materialName: tx.material_name,
        size: tx.size,
        quantity: tx.quantity,
        unitPrice: tx.unit_price,
        totalPrice: tx.total_price,
        type: tx.type,
        date: tx.transaction_date ? new Date(tx.transaction_date) : new Date(tx.created_at),
        notes: tx.notes || '',
        createdAt: tx.created_at ? new Date(tx.created_at) : new Date()
      }))
    } catch (error) {
      console.error('Failed to load stock data from Cloudflare D1:', error)
      throw error
    }
  }

  // --- Material Cost Calculation ---
  function getTeaPricePerGram() {
    return (Number(teaPricePerGram.value) || 0) * 100;
  }

  function setTeaPricePerGram(pricePer100g) {
    const rate = (Number(pricePer100g) || 0) / 100;
    teaPricePerGram.value = rate;
    localStorage.setItem('teaPricePerGram', rate.toString());
  }

  function getMaterialUnitCost(materialName, size = 'N/A') {
    const txs = materialTransactions.value
      .filter(tx => tx.materialName === materialName && tx.size === size && tx.type === 'in')
    if (txs.length === 0) return 0
    const totalQty = txs.reduce((sum, tx) => sum + tx.quantity, 0)
    const totalCost = txs.reduce((sum, tx) => sum + tx.totalPrice, 0)
    return totalQty > 0 ? totalCost / totalQty : 0
  }

  function getMaterialCostPerUnit(size) {
    if (!size || !['S', 'M', 'L'].includes(size)) return 0

    let totalCost = 0

    SIZED_MATERIALS.forEach(matName => {
      totalCost += getMaterialUnitCost(matName, size)
    })

    const teaGrams = TEA_GRAMS_PER_SIZE[size] || 0
    const teaPrice = getTeaPricePerGram()
    if (teaGrams > 0 && teaPrice > 0) {
      totalCost += (teaGrams / 100) * teaPrice
    }

    totalCost += getMaterialUnitCost('ពលកម្ម', size)

    return totalCost
  }

  // --- Product Functions ---
  async function addProduct(productData) {
    try {
      const size = getSizeFromProductName(productData.name)
      const qty = Number(productData.quantity) || 1
      
      let calculatedCostPrice = productData.costPrice || 0

      if (size && ['S', 'M', 'L'].includes(size) && (!calculatedCostPrice || calculatedCostPrice <= 0)) {
        calculatedCostPrice = getMaterialCostPerUnit(size)
      }

      const newId = generateId()
      const now = new Date()

      // SQLite mapping payload
      const payload = {
        id: newId,
        name: productData.name,
        category: productData.category || '',
        size: size || 'N/A',
        quantity: qty,
        initial_quantity: Number(productData.initialQuantity || qty),
        unit_price: Number(productData.unitPrice || 0),
        cost_price: Number(calculatedCostPrice),
        min_stock_level: Number(productData.minStockLevel || 0)
      }

      await api.post('/products', payload)

      const newProduct = {
        id: newId,
        name: productData.name,
        category: productData.category,
        size: size,
        quantity: qty,
        initialQuantity: productData.initialQuantity || qty,
        unitPrice: productData.unitPrice || 0,
        costPrice: calculatedCostPrice,
        minStockLevel: productData.minStockLevel || 0,
        createdAt: now,
        updatedAt: now
      }
      stockItems.value.push(newProduct)

      // Deduct matching materials recursively inside backend logs
      if (productData.name === 'ទាបបារាំង') {
        await materialStockOut({
          materialName: 'ទាបបារាំង',
          size: 'N/A',
          quantity: qty,
          notes: `ផលិតផលបញ្ចូលស្តុក - ${productData.name} x${qty}`
        })
      } else if (size && qty > 0) {
        for (const matName of SIZED_MATERIALS) {
          await materialStockOut({
            materialName: matName,
            size: size,
            quantity: qty,
            notes: `ផលិតផលបញ្ចូលស្តុក - ${productData.name} x${qty}`
          })
        }

        const teaGrams = (TEA_GRAMS_PER_SIZE[size] || 0) * qty
        if (teaGrams > 0) {
          await materialStockOut({
            materialName: 'តែ',
            size: size,
            quantity: teaGrams,
            notes: `ផលិតផលបញ្ចូលស្តុក - ${productData.name} x${qty} (${teaGrams}g តែ)`
          })
        }
      }
      return newProduct
    } catch (error) {
      console.error('Failed to create product in D1:', error)
      throw error
    }
  }

  async function updateProduct(id, updates) {
    try {
      const payload = {
        name: updates.name,
        category: updates.category,
        size: updates.size || getSizeFromProductName(updates.name) || 'N/A',
        quantity: Number(updates.quantity),
        unit_price: Number(updates.unitPrice),
        cost_price: Number(updates.costPrice),
        min_stock_level: Number(updates.minStockLevel)
      }

      await api.put(`/products/${id}`, payload)

      const index = stockItems.value.findIndex(item => item.id === id)
      if (index !== -1) {
        stockItems.value[index] = { ...stockItems.value[index], ...updates, updatedAt: new Date() }
        return stockItems.value[index]
      }
      return null
    } catch (error) {
      console.error(`Failed to update product ${id} in D1:`, error)
      throw error
    }
  }

  async function deleteProduct(id) {
    try {
      await api.delete(`/products/${id}`)
      stockItems.value = stockItems.value.filter(item => item.id !== id)
    } catch (error) {
      console.error(`Failed to delete product ${id} from D1:`, error)
      throw error
    }
  }

  function getProductById(id) {
    return stockItems.value.find(item => item.id === id)
  }

  async function adjustStock(id, quantity, type = 'out', notes = '') {
    const product = getProductById(id)
    if (!product) return null

    const qty = Number(quantity)
    if (isNaN(qty) || qty <= 0) return null

    if (type === 'out' && product.quantity < qty) return null

    const previousQty = product.quantity
    const newQty = type === 'in' ? Number(product.quantity) + qty : Number(product.quantity) - qty

    try {
      await updateProduct(id, { ...product, quantity: newQty })
      return { product, previousQty }
    } catch (error) {
      console.error(`Failed to adjust stock for product ${id}:`, error)
      throw error
    }
  }

  // --- Material Functions ---
  async function materialStockIn(data) {
    let size = data.size
    if (data.materialName === 'ទាបបារាំង' || data.materialName === 'ថង់' || data.materialName === 'កេស') {
      size = 'N/A'
    }

    const newId = generateId()
    const now = data.date ? new Date(data.date) : new Date()

    const payload = {
      id: newId,
      material_id: data.materialId || null,
      material_name: data.materialName,
      size: size || 'N/A',
      quantity: Number(data.quantity),
      unit_price: Number(data.unitPrice || 0),
      total_price: Number(data.unitPrice || 0) * Number(data.quantity),
      type: 'in',
      notes: data.notes || ''
    }

    try {
      await api.post('/material-transactions', payload)

      const transaction = {
        id: newId,
        materialName: data.materialName,
        size: size,
        quantity: Number(data.quantity),
        unitPrice: Number(data.unitPrice || 0),
        totalPrice: Number(data.unitPrice || 0) * Number(data.quantity),
        type: 'in',
        date: now,
        notes: data.notes || '',
        createdAt: new Date()
      }
      materialTransactions.value.push(transaction)
      return transaction
    } catch (error) {
      console.error('Failed material stock-in inside D1:', error)
      throw error
    }
  }

  async function materialStockOut(data) {
    let size = data.size
    if (data.materialName === 'ទាបបារាំង' || data.materialName === 'ថង់' || data.materialName === 'កេស') {
      size = 'N/A'
    }

    const newId = generateId()
    const now = data.date ? new Date(data.date) : new Date()

    const payload = {
      id: newId,
      material_id: data.materialId || null,
      material_name: data.materialName,
      size: size || 'N/A',
      quantity: Number(data.quantity),
      unit_price: 0,
      total_price: 0,
      type: 'out',
      notes: data.notes || ''
    }

    try {
      await api.post('/material-transactions', payload)

      const transaction = {
        id: newId,
        materialName: data.materialName,
        size: size,
        quantity: Number(data.quantity),
        unitPrice: 0,
        totalPrice: 0,
        type: 'out',
        date: now,
        notes: data.notes || '',
        createdAt: new Date()
      }
      materialTransactions.value.push(transaction)
      return transaction
    } catch (error) {
      console.error('Failed material stock-out inside D1:', error)
      throw error
    }
  }

  async function deductPlasticBag(quantity = 1, orderNumber = '') {
    return materialStockOut({
      materialName: 'ថង់',
      size: 'N/A',
      quantity: Number(quantity),
      notes: orderNumber ? `បានកាត់ចេញតាមការកម្មង់លេខ: ${orderNumber}` : 'បានកាត់ចេញដោយស្វ័យប្រវត្តិតាមរយៈការលក់'
    })
  }

  async function deductCaseBox(quantity = 1, orderNumber = '') {
    return materialStockOut({
      materialName: 'កេស',
      size: 'N/A',
      quantity: Number(quantity),
      notes: orderNumber ? `បានកាត់ចេញតាមការកម្មង់លេខ: ${orderNumber}` : 'បានកាត់ចេញដោយស្វ័យប្រវត្តិតាមរយៈការលក់'
    })
  }

  async function returnPlasticBag(quantity = 1, orderNumber = '') {
    const txIndex = materialTransactions.value.findIndex(tx =>
      tx.materialName === 'ថង់' &&
      tx.type === 'out' &&
      tx.notes && tx.notes.includes(orderNumber)
    )

    if (txIndex !== -1) {
      const targetTx = materialTransactions.value[txIndex]
      const updatedNotes = orderNumber ?
        `បានបន្ថែមវិញពីការបោះបង់ការកម្មង់លេខ: ${orderNumber} (ត្រឡប់វិញ)` :
        'បានបន្ថែមវិញពីការបោះបង់ការកម្មង់ (ត្រឡប់វិញ)'

      try {
        // Zero out the historical deduction
        await api.put(`/material-transactions/${targetTx.id}`, {
          quantity: 0,
          notes: updatedNotes
        })

        materialTransactions.value[txIndex] = {
          ...targetTx,
          quantity: 0,
          notes: updatedNotes,
          updatedAt: new Date()
        }
        return materialTransactions.value[txIndex]
      } catch (error) {
        console.error('Failed to update plastic bag returns inside D1:', error)
      }
    }

    return materialStockIn({
      materialName: 'ថង់',
      size: 'N/A',
      quantity: Number(quantity),
      unitPrice: 0,
      totalPrice: 0,
      date: new Date(),
      notes: orderNumber ? `បានបន្ថែមវិញពីការបោះបង់ការកម្មង់លេខ: ${orderNumber}` : 'បានបន្ថែមវិញពីការបោះបង់ការកម្មង់'
    })
  }

  async function returnCaseBox(quantity = 1, orderNumber = '') {
    const txIndex = materialTransactions.value.findIndex(tx =>
      tx.materialName === 'កេស' &&
      tx.type === 'out' &&
      tx.notes && tx.notes.includes(orderNumber)
    )

    if (txIndex !== -1) {
      const targetTx = materialTransactions.value[txIndex]
      const updatedNotes = orderNumber ?
        `បានបន្ថែមវិញពីការបោះបង់ការកម្មង់លេខ: ${orderNumber} (ត្រឡប់វិញ)` :
        'បានបន្ថែមវិញពីការបោះបង់ការកម្មង់ (ត្រឡប់វិញ)'

      try {
        await api.put(`/material-transactions/${targetTx.id}`, {
          quantity: 0,
          notes: updatedNotes
        })

        materialTransactions.value[txIndex] = {
          ...targetTx,
          quantity: 0,
          notes: updatedNotes,
          updatedAt: new Date()
        }
        return materialTransactions.value[txIndex]
      } catch (error) {
        console.error('Failed to update case box returns inside D1:', error)
      }
    }

    return materialStockIn({
      materialName: 'កេស',
      size: 'N/A',
      quantity: Number(quantity),
      unitPrice: 0,
      totalPrice: 0,
      date: new Date(),
      notes: orderNumber ? `បានបន្ថែមវិញពីការបោះបង់ការកម្មង់លេខ: ${orderNumber}` : 'បានបន្ថែមវិញពីការបោះបង់ការកម្មង់'
    })
  }

  async function deductMaterialsBySize(size, amount = 1) {
    for (const matName of SIZED_MATERIALS) {
      await materialStockOut({
        materialName: matName,
        size,
        quantity: amount,
        notes: `Auto deduct for product production (size ${size})`
      })
    }
  }

  async function deleteMaterialTransaction(id) {
    try {
      await api.delete(`/material-transactions/${id}`)
      materialTransactions.value = materialTransactions.value.filter(tx => tx.id !== id)
    } catch (error) {
      console.error(`Failed to delete transaction ${id} from D1:`, error)
      throw error
    }
  }

  function getMaterialTransactions(materialName, size) {
    return materialTransactions.value
      .filter(tx => tx.materialName === materialName && tx.size === size)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }

  return {
    stockItems,
    stockCategories,
    materialTransactions,
    teaPricePerGram,
    totalProducts,
    totalQuantity,
    totalValue,
    lowStockCount,
    outOfStockCount,
    lowStockItems,
    materialSummary,
    lowMaterialCount,
    totalMaterialQuantity,
    fetchStockData, // Expose fetchStockData to sync metrics
    addProduct,
    updateProduct,
    deleteProduct,
    getProductById,
    adjustStock,
    materialStockIn,
    materialStockOut,
    deductPlasticBag,
    returnPlasticBag,
    deductCaseBox,
    returnCaseBox,
    deductMaterialsBySize,
    deleteMaterialTransaction,
    getMaterialTransactions,
    getMaterialCostPerUnit,
    getMaterialUnitCost,
    getTeaPricePerGram,
    setTeaPricePerGram,
    ALLOWED_PRODUCTS,
    ALLOWED_MATERIALS,
    SIZED_MATERIALS,
    KG_MATERIALS,
    NOSIZE_MATERIALS,
    LABOR_MATERIALS,
    TEA_GRAMS_PER_SIZE,
    TEA_POWDER_TO_TEA_GRAMS,
    getSizeFromProductName
  }
})