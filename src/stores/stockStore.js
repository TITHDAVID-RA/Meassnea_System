import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useStorage } from '@/composables/useStorage'
import { useGenerators } from '@/composables/useGenerators'

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

  const stockItems = useStorage('stockItems', [])
  const stockCategories = useStorage('stockCategories', defaultStockCategories)
  const materialTransactions = useStorage('materialTransactions', [])
  
  // User-input តែ price per gram (stored in localStorage)
  const teaPricePerGram = useStorage('teaPricePerGram', 0)

  // --- Computed States ---
  const totalProducts = computed(() => stockItems.value.length)
  const totalQuantity = computed(() => stockItems.value.reduce((sum, item) => sum + item.quantity, 0))
  const totalValue = computed(() => stockItems.value.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0))
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

  // --- Material Cost Calculation ---
  // Get តែ price per gram (USER INPUT stored as per-gram, input was per-100g)
  function getTeaPricePerGram() {
    return (Number(teaPricePerGram.value) || 0) * 100 ;
  }

  // Set/update តែ price per 100g (user input), stored as per gram internally
  function setTeaPricePerGram(pricePer100g) {
    teaPricePerGram.value = (Number(pricePer100g) || 0) / 100;
  }

  // Get the average cost per unit for a specific material + size
  function getMaterialUnitCost(materialName, size = 'N/A') {
    const txs = materialTransactions.value
      .filter(tx => tx.materialName === materialName && tx.size === size && tx.type === 'in')
    if (txs.length === 0) return 0
    const totalQty = txs.reduce((sum, tx) => sum + tx.quantity, 0)
    const totalCost = txs.reduce((sum, tx) => sum + tx.totalPrice, 0)
    return totalQty > 0 ? totalCost / totalQty : 0
  }

  // Calculate total material cost per product unit (for a given size)
  // Package bag + Box + Card + Tea (per size) + Labor (per size)
  function getMaterialCostPerUnit(size) {
    if (!size || !['S', 'M', 'L'].includes(size)) return 0

    let totalCost = 0

    // Sized materials: Package bag, Box, Card
    SIZED_MATERIALS.forEach(matName => {
      totalCost += getMaterialUnitCost(matName, size)
    })

    // Tea cost: grams needed × user-input price per gram
    const teaGrams = TEA_GRAMS_PER_SIZE[size] || 0
    const teaPrice = getTeaPricePerGram()
    if (teaGrams > 0 && teaPrice > 0) {
      totalCost += (teaGrams / 100) * teaPrice
    }

    // Labor - stored price only, unlimited use
    totalCost += getMaterialUnitCost('ពលកម្ម', size)

    return totalCost
  }

  // --- Product Functions ---
 function addProduct(productData) {
  // 1. Move this to the top! Now 'size' is initialized and ready to use.
  const size = getSizeFromProductName(productData.name)
  const qty = Number(productData.quantity) || 1
  
  let calculatedCostPrice = productData.costPrice || 0

  // 2. Now this 'if' statement will work because 'size' is defined
  if (size && ['S', 'M', 'L'].includes(size) && (!calculatedCostPrice || calculatedCostPrice <= 0)) {
    calculatedCostPrice = getMaterialCostPerUnit(size)
  }

  const newProduct = {
    id: generateId(),
    ...productData,
    costPrice: calculatedCostPrice,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  stockItems.value.push(newProduct)

  // Deduct materials based on product type
  if (productData.name === 'ទាបបារាំង') {
    // ទាបបារាំង standalone product: deduct ទាបបារាំង material in kg
    materialStockOut({
      materialName: 'ទាបបារាំង',
      size: 'N/A',
      quantity: qty,
      notes: `ផលិតផលបញ្ចូលស្តុក - ${productData.name} x${qty}`
    })
  } else if (size && qty > 0) {
    // តែទាបបារាំង (S/M/L): deduct packaging materials 1:1
    SIZED_MATERIALS.forEach(matName => {
      materialStockOut({
        materialName: matName,
        size: size,
        quantity: qty,
        notes: `ផលិតផលបញ្ចូលស្តុក - ${productData.name} x${qty}`
      })
    })

    // Deduct តែ (tea) - tracked as out transaction for display
    const teaGrams = (TEA_GRAMS_PER_SIZE[size] || 0) * qty
    if (teaGrams > 0) {
      materialStockOut({
        materialName: 'តែ',
        size: size,
        quantity: teaGrams,
        notes: `ផលិតផលបញ្ចូលស្តុក - ${productData.name} x${qty} (${teaGrams}g តែ)`
      })
    }
  }
  return newProduct
}

  function updateProduct(id, updates) {
    const index = stockItems.value.findIndex(item => item.id === id)
    if (index !== -1) {
      stockItems.value[index] = { ...stockItems.value[index], ...updates, updatedAt: new Date() }
      return stockItems.value[index]
    }
    return null
  }

  function deleteProduct(id) {
    stockItems.value = stockItems.value.filter(item => item.id !== id)
  }

  function getProductById(id) {
    return stockItems.value.find(item => item.id === id)
  }

  function adjustStock(id, quantity, type = 'out', notes = '') {
    const product = getProductById(id)
    if (!product) return null

    const qty = Number(quantity)
    if (isNaN(qty) || qty <= 0) return null

    if (type === 'out' && product.quantity < qty) return null

    const previousQty = product.quantity
    if (type === 'in') {
      product.quantity = Number(product.quantity) + qty
    } else {
      product.quantity = Number(product.quantity) - qty
    }
    product.updatedAt = new Date()
    return { product, previousQty }
  }

  // --- Material Functions ---
  function materialStockIn(data) {
    // Determine size based on material type
    let size = data.size
    if (data.materialName === 'ទាបបារាំង' || data.materialName === 'ថង់' || data.materialName === 'កេស') {
      size = 'N/A'
    }

    const transaction = {
      id: generateId(),
      materialName: data.materialName,
      size: size,
      quantity: Number(data.quantity),
      unitPrice: Number(data.unitPrice || 0),
      totalPrice: Number(data.unitPrice || 0) * Number(data.quantity),
      type: 'in',
      date: data.date || new Date(),
      notes: data.notes || '',
      createdAt: new Date()
    }
    materialTransactions.value.push(transaction)
    return transaction
  }

  function materialStockOut(data) {
    let size = data.size
    if (data.materialName === 'ទាបបារាំង' || data.materialName === 'ថង់' || data.materialName === 'កេស') {
      size = 'N/A'
    }

    const transaction = {
      id: generateId(),
      materialName: data.materialName,
      size: size,
      quantity: Number(data.quantity),
      unitPrice: 0,
      totalPrice: 0,
      type: 'out',
      date: data.date || new Date(),
      notes: data.notes || '',
      createdAt: new Date()
    }
    materialTransactions.value.push(transaction)
    return transaction
  }

  function deductPlasticBag(quantity = 1, orderNumber = '') {
    return materialStockOut({
      materialName: 'ថង់',
      size: 'N/A',
      quantity: Number(quantity),
      notes: orderNumber ? `បានកាត់ចេញតាមការកម្មង់លេខ: ${orderNumber}` : 'បានកាត់ចេញដោយស្វ័យប្រវត្តិតាមរយៈការលក់'
    })
  }

  function deductCaseBox(quantity = 1, orderNumber = '') {
    return materialStockOut({
      materialName: 'កេស',
      size: 'N/A',
      quantity: Number(quantity),
      notes: orderNumber ? `បានកាត់ចេញតាមការកម្មង់លេខ: ${orderNumber}` : 'បានកាត់ចេញដោយស្វ័យប្រវត្តិតាមរយៈការលក់'
    })
  }

  function returnPlasticBag(quantity = 1, orderNumber = '') {
    const txIndex = materialTransactions.value.findIndex(tx =>
      tx.materialName === 'ថង់' &&
      tx.type === 'out' &&
      tx.notes && tx.notes.includes(orderNumber)
    )

    if (txIndex !== -1) {
      materialTransactions.value[txIndex] = {
        ...materialTransactions.value[txIndex],
        quantity: 0,
        notes: orderNumber ?
          `បានបន្ថែមវិញពីការបោះបង់ការកម្មង់លេខ: ${orderNumber} (ត្រឡប់វិញ)` :
          'បានបន្ថែមវិញពីការបោះបង់ការកម្មង់ (ត្រឡប់វិញ)',
        updatedAt: new Date()
      }
      return materialTransactions.value[txIndex]
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

  function returnCaseBox(quantity = 1, orderNumber = '') {
    const txIndex = materialTransactions.value.findIndex(tx =>
      tx.materialName === 'កេស' &&
      tx.type === 'out' &&
      tx.notes && tx.notes.includes(orderNumber)
    )

    if (txIndex !== -1) {
      materialTransactions.value[txIndex] = {
        ...materialTransactions.value[txIndex],
        quantity: 0,
        notes: orderNumber ?
          `បានបន្ថែមវិញពីការបោះបង់ការកម្មង់លេខ: ${orderNumber} (ត្រឡប់វិញ)` :
          'បានបន្ថែមវិញពីការបោះបង់ការកម្មង់ (ត្រឡប់វិញ)',
        updatedAt: new Date()
      }
      return materialTransactions.value[txIndex]
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


  function deductMaterialsBySize(size, amount = 1) {
    SIZED_MATERIALS.forEach(matName => {
      materialStockOut({
        materialName: matName,
        size,
        quantity: amount,
        notes: `Auto deduct for product production (size ${size})`
      })
    })
  }

  function deleteMaterialTransaction(id) {
    materialTransactions.value = materialTransactions.value.filter(tx => tx.id !== id)
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