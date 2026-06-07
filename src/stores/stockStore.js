import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useGenerators } from '@/composables/useGenerators'
import { api } from '@/api/client' // Import central D1 API client

// --- localStorage helper with Date revival and SSR safety ---
function useLocalStorage(key, defaultValue) {
  // SSR-safe: only access localStorage in browser
  const isClient = typeof window !== 'undefined'

  const reviveDates = (data) => {
    if (Array.isArray(data)) {
      return data.map(item => {
        const revived = { ...item }
        if (item.date && typeof item.date === 'string') revived.date = new Date(item.date)
        if (item.createdAt && typeof item.createdAt === 'string') revived.createdAt = new Date(item.createdAt)
        if (item.updatedAt && typeof item.updatedAt === 'string') revived.updatedAt = new Date(item.updatedAt)
        return revived
      })
    }
    return data
  }

  const stored = isClient ? localStorage.getItem(key) : null
  const parsed = stored ? reviveDates(JSON.parse(stored)) : defaultValue
  const data = ref(parsed)

  if (isClient) {
    watch(data, (newVal) => {
      localStorage.setItem(key, JSON.stringify(newVal))
    }, { deep: true })
  }

  return data
}

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
  'ស្ទីកគ័រ',
  'ទាបបារាំង',
  'ពលកម្ម'
]

// Materials that use sizes (S, M, L)
const SIZED_MATERIALS = ['ថង់', 'ថង់វេចខ្ចប់', 'ប្រអប់', 'Leafleap', 'ស្ទីកគ័រ']

// Materials that don't have size L (ប្រអប់ and Leafleap not used for L)
const NO_SIZE_L_MATERIALS = ['ប្រអប់', 'Leafleap']

// Materials that only have M and L (no S) - ស្ទីកគ័រ
const ONLY_ML_MATERIALS = ['ស្ទីកគ័រ']

// Labor - price-only, unlimited use
const LABOR_MATERIALS = ['ពលកម្ម']

// Materials that are kg-based (no size)
const KG_MATERIALS = ['ទាបបារាំង']

// Materials that are no-size but quantity-based (not kg)
const NOSIZE_MATERIALS = ['កេស']

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

  // Use localStorage fallback when API is unavailable
  const stockItems = ref([])
  const stockCategories = ref(defaultStockCategories)
  const materialTransactions = useLocalStorage('stock_material_transactions', [])

  // teaPricePerGram persisted in D1 via API, with localStorage fallback
  const teaPricePerGram = useLocalStorage('stock_tea_price_per_gram', 0)

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
  async function fetchSettings() {
    try {
      const settings = await api.get('/settings');
      if (settings && settings.tea_price_per_gram !== undefined) {
        teaPricePerGram.value = Number(settings.tea_price_per_gram) || 0;
        localStorage.setItem('stock_tea_price_per_gram', JSON.stringify(teaPricePerGram.value))
      }
    } catch (error) {
      console.warn('Failed to load settings from D1:', error);
      // localStorage fallback already handled by useLocalStorage
    }
  }

  async function fetchStockData() {
    try {
      // Load settings alongside stock data
      const [products, transactions] = await Promise.all([
        api.get('/products'),
        api.get('/material-transactions')
      ]);

      // Also fetch settings in parallel (don't block on failure)
      fetchSettings().catch(() => {});

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

      // Merge API data with localStorage data (API takes precedence for same ID)
      const apiTxMap = new Map()
      transactions.forEach(tx => {
        apiTxMap.set(tx.id, {
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
          hidden: tx.hidden || false,
          createdAt: tx.created_at ? new Date(tx.created_at) : new Date()
        })
      })

      // Keep local transactions that aren't in API yet (offline/queued)
      const localTxs = materialTransactions.value.filter(tx => !apiTxMap.has(tx.id))
      materialTransactions.value = [...localTxs, ...apiTxMap.values()]

      // Persist merged data
      localStorage.setItem('stock_material_transactions', JSON.stringify(materialTransactions.value))
    } catch (error) {
      console.error('Failed to load stock data from Cloudflare D1:', error)
      throw error
    }
  }

  // --- Material Cost Calculation ---
  function getTeaPricePerGram() {
    // Returns price per 100g (stored as per-gram rate, multiply by 100)
    return (Number(teaPricePerGram.value) || 0) * 100;
  }

  async function setTeaPricePerGram(pricePer100g) {
    const rate = (Number(pricePer100g) || 0) / 100;
    teaPricePerGram.value = rate;
    localStorage.setItem('stock_tea_price_per_gram', JSON.stringify(rate))
    try {
      await api.put('/settings/tea_price_per_gram', { value: rate.toString() });
    } catch (e) {
      console.error('Failed to save tea price to API (saved locally):', e);
      // Don't throw - localStorage has the value
    }
  }

  function getMaterialUnitCost(materialName, size = 'N/A') {
    const txs = materialTransactions.value
      .filter(tx => tx.materialName === materialName && tx.size === size && tx.type === 'in')
    if (txs.length === 0) return 0
    const totalQty = txs.reduce((sum, tx) => sum + tx.quantity, 0)
    const totalCost = txs.reduce((sum, tx) => sum + tx.totalPrice, 0)
    return totalQty > 0 ? totalCost / totalQty : 0
  }

  // Get the last (most recent) unit price for a material+size
  function getLastMaterialPrice(materialName, size = 'N/A') {
    const txs = materialTransactions.value
      .filter(tx => tx.materialName === materialName && tx.size === size && tx.type === 'in' && tx.unitPrice > 0)
      .sort((a, b) => new Date(b.date) - new Date(a.date))

    return txs.length > 0 ? txs[0].unitPrice : 0
  }

  // Get price label: if only 1 transaction, show "តម្លៃចុងក្រោយ", else "តម្លៃជាមធ្យម"
  function getMaterialPriceLabel(materialName, size = 'N/A') {
    const count = materialTransactions.value.filter(tx => 
      tx.materialName === materialName && tx.size === size && tx.type === 'in' && tx.unitPrice > 0
    ).length
    return count <= 1 ? 'តម្លៃចុងក្រោយ' : 'តម្លៃជាមធ្យម'
  }

  function getMaterialCostPerUnit(size) {
    if (!size || !['S', 'M', 'L'].includes(size)) return 0

    let totalCost = 0

    // Production materials only (exclude ថង់ - order-level cost)
    // Use last price (តម្លៃចុងក្រោយ) for accurate current cost
    const PRODUCTION_MATERIALS = SIZED_MATERIALS.filter(m => m !== 'ថង់')
    PRODUCTION_MATERIALS.forEach(matName => {
      // Skip materials that don't have size L
      if (size === 'L' && NO_SIZE_L_MATERIALS.includes(matName)) return
      // Skip materials that only have M and L (no S)
      if (size === 'S' && ONLY_ML_MATERIALS.includes(matName)) return
      totalCost += getLastMaterialPrice(matName, size)
    })

    const teaGrams = TEA_GRAMS_PER_SIZE[size] || 0
    const teaPrice = getTeaPricePerGram()
    if (teaGrams > 0 && teaPrice > 0) {
      totalCost += (teaGrams / 100) * teaPrice
    }

    totalCost += getLastMaterialPrice('ពលកម្ម', size)

    return totalCost
  }

  /**
   * Recalculate costPrice for all products that use a given material+size
   * Call this after material prices change (edit/delete transactions)
   */
  async function recalculateProductCostsByMaterial(materialName, size) {
    // Determine which product sizes are affected by this material
    const affectedSizes = []

    if (materialName === 'ទាបបារាំង') {
      affectedSizes.push('N/A') // ទាបបារាំង product
    } else if (materialName === 'ពលកម្ម') {
      affectedSizes.push('S', 'M', 'L')
    } else if (SIZED_MATERIALS.includes(materialName)) {
      affectedSizes.push(size)
    }

    // For each affected size, find matching products and update their costPrice
    for (const productSize of affectedSizes) {
      const productsToUpdate = stockItems.value.filter(p => {
        if (productSize === 'N/A') {
          return p.name === 'ទាបបារាំង'
        }
        return p.size === productSize && p.name !== 'ទាបបារាំង'
      })

      for (const product of productsToUpdate) {
        const newCostPrice = getMaterialCostPerUnit(productSize)
        if (newCostPrice > 0 && Math.abs(newCostPrice - product.costPrice) > 0.0001) {
          try {
            await updateProduct(product.id, { costPrice: newCostPrice })
          } catch (error) {
            console.error(`Failed to recalculate costPrice for ${product.name}:`, error)
          }
        }
      }
    }
  }


  /**
   * Check if there are enough materials to produce a given product
   * Returns { sufficient: true/false, shortages: [] }
   */
  function checkMaterialAvailability(productName, qty) {
    const size = getSizeFromProductName(productName)
    const shortages = []

    if (productName === 'ទាបបារាំង') {
      const balance = getMaterialBalance('ទាបបារាំង', 'N/A')
      if (balance < qty) {
        shortages.push({ material: 'ទាបបារាំង', size: 'N/A', needed: qty, available: balance })
      }
    } else if (size && ['S', 'M', 'L'].includes(size) && qty > 0) {
      // Check production materials (exclude ថង់ - only deducted via orders)
      const PRODUCTION_MATERIALS = SIZED_MATERIALS.filter(m => m !== 'ថង់')
      for (const matName of PRODUCTION_MATERIALS) {
        if (size === 'L' && NO_SIZE_L_MATERIALS.includes(matName)) continue
        if (size === 'S' && ONLY_ML_MATERIALS.includes(matName)) continue
        const balance = getMaterialBalance(matName, size)
        if (balance < qty) {
          shortages.push({ material: matName, size, needed: qty, available: balance })
        }
      }

      // Check tea grams - តែ is derived from ទាបបារាំង (1kg = 150g តែ)
      const teaGramsNeeded = (TEA_GRAMS_PER_SIZE[size] || 0) * qty
      if (teaGramsNeeded > 0) {
        // Calculate derived tea balance: (ទាបបារាំង kg * 150) - total តែ out + total តែ in (returns)
        const teaPowderBalanceKg = getMaterialBalance('ទាបបារាំង', 'N/A')
        const teaGramsFromPowder = teaPowderBalanceKg * TEA_POWDER_TO_TEA_GRAMS

        // Total តែ out transactions for this size
        const teaOutTotal = materialTransactions.value
          .filter(tx => (tx.type === 'out' || tx.type === 'deduction') && tx.materialName === 'តែ' && tx.size === size)
          .reduce((sum, tx) => sum + Math.abs(tx.quantity), 0)

        // Total តែ in transactions for this size (returns from product deletion)
        const teaInTotal = materialTransactions.value
          .filter(tx => tx.type === 'in' && tx.materialName === 'តែ' && tx.size === size)
          .reduce((sum, tx) => sum + tx.quantity, 0)

        const teaBalance = teaGramsFromPowder - teaOutTotal + teaInTotal

        if (teaBalance < teaGramsNeeded) {
          shortages.push({
            material: 'តែ',
            size,
            needed: teaGramsNeeded,
            available: Math.max(0, teaBalance),
            unit: 'g'
          })
        }
      }
    }

    return { sufficient: shortages.length === 0, shortages }
  }

  /**
   * Get current material balance for a specific material+size
   */
  function getMaterialBalance(materialName, size) {
    let totalIn = 0
    let totalOut = 0
    materialTransactions.value.forEach(tx => {
      if (tx.materialName === materialName && tx.size === size) {
        if (tx.type === 'in') totalIn += tx.quantity
        else if (tx.type === 'out' || tx.type === 'deduction') totalOut += Math.abs(tx.quantity)
      }
    })
    return totalIn - totalOut
  }

  /**
   * Reverse a material out transaction by finding and zeroing it.
   * This reduces totalOut instead of inflating totalIn.
   */
  async function reverseMaterialOut(materialName, size, productName, qty) {
    // Find matching out transactions for this material + product
    const txIndices = []
    materialTransactions.value.forEach((tx, index) => {
      if ((tx.type === 'out' || tx.type === 'deduction') && 
          tx.materialName === materialName && 
          tx.size === size &&
          tx.quantity > 0 &&
          tx.notes && tx.notes.includes(productName)) {
        txIndices.push(index)
      }
    })

    // Reverse each matching transaction (set quantity to 0, update notes)
    for (const txIndex of txIndices) {
      const targetTx = materialTransactions.value[txIndex]
      const updatedNotes = targetTx.notes + ' (ត្រឡប់វិញពីការលុបផលិតផល)'

      try {
        await api.put(`/material-transactions/${targetTx.id}`, {
          quantity: 0,
          notes: updatedNotes
        })

        // Use splice for proper Vue reactivity
        materialTransactions.value.splice(txIndex, 1, {
          ...targetTx,
          quantity: 0,
          notes: updatedNotes,
          updatedAt: new Date()
        })
      } catch (error) {
        console.error(`Failed to reverse material out ${materialName} ${size}:`, error)
      }
    }
  }

  // --- Product Functions ---
  async function addProduct(productData) {
    try {
      const size = getSizeFromProductName(productData.name)
      const qty = Number(productData.quantity) || 1

      // Check material availability before creating
      const { sufficient, shortages } = checkMaterialAvailability(productData.name, qty)
      if (!sufficient) {
        const shortageList = shortages.map(s => 
          `- ${s.material}${s.size !== 'N/A' ? ' (' + s.size + ')' : ''}: ត្រូវការ ${s.needed}${s.unit || ''} មានតែ ${s.available}${s.unit || ''}`
        ).join('\n')
        throw new Error('MATERIAL_SHORTAGE\n' + shortageList)
      }

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
        // Deduct production materials (exclude ថង់ - only deducted via orders)
        const PRODUCTION_MATERIALS = SIZED_MATERIALS.filter(m => m !== 'ថង់')
        for (const matName of PRODUCTION_MATERIALS) {
          // Skip materials that don't have size L
          if (size === 'L' && NO_SIZE_L_MATERIALS.includes(matName)) continue
          // Skip materials that only have M and L (no S)
          if (size === 'S' && ONLY_ML_MATERIALS.includes(matName)) continue
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
      // Build payload only with defined values to avoid D1 undefined errors
      const payload = {}

      if (updates.name !== undefined) payload.name = updates.name
      if (updates.category !== undefined) payload.category = updates.category
      if (updates.size !== undefined) payload.size = updates.size
      else if (updates.name !== undefined) payload.size = getSizeFromProductName(updates.name) || 'N/A'
      if (updates.quantity !== undefined) payload.quantity = Number(updates.quantity)
      if (updates.unitPrice !== undefined) payload.unit_price = Number(updates.unitPrice)
      if (updates.costPrice !== undefined) payload.cost_price = Number(updates.costPrice)
      if (updates.minStockLevel !== undefined) payload.min_stock_level = Number(updates.minStockLevel)

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
      const product = getProductById(id)
      if (!product) {
        throw new Error(`Product ${id} not found`)
      }

      const size = getSizeFromProductName(product.name)
      const qty = product.quantity

      // Reverse material out transactions (reduce totalOut, not inflate totalIn)
      if (product.name === 'ទាបបារាំង' && qty > 0) {
        // Reverse ទាបបារាំង out transaction
        await reverseMaterialOut('ទាបបារាំង', 'N/A', product.name, qty)
      } else if (size && ['S', 'M', 'L'].includes(size) && qty > 0) {
        // Reverse production material out transactions
        const PRODUCTION_MATERIALS = SIZED_MATERIALS.filter(m => m !== 'ថង់')
        for (const matName of PRODUCTION_MATERIALS) {
          if (size === 'L' && NO_SIZE_L_MATERIALS.includes(matName)) continue
          if (size === 'S' && ONLY_ML_MATERIALS.includes(matName)) continue
          await reverseMaterialOut(matName, size, product.name, qty)
        }

        // Reverse tea out transaction
        const teaGrams = (TEA_GRAMS_PER_SIZE[size] || 0) * qty
        if (teaGrams > 0) {
          await reverseMaterialOut('តែ', size, product.name, teaGrams)
        }
      }

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
      // Only send quantity update, not the whole product object
      await updateProduct(id, { quantity: newQty })
      return { product, previousQty }
    } catch (error) {
      console.error(`Failed to adjust stock for product ${id}:`, error)
      throw error
    }
  }

  // --- Material Functions ---
  async function materialStockIn(data) {
    let size = data.size
    if (data.materialName === 'ទាបបារាំង' || data.materialName === 'កេស') {
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
      notes: data.notes || '',
      hidden: data.hidden || false
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
        hidden: data.hidden || false,
        createdAt: new Date()
      }
      materialTransactions.value.push(transaction)

      // Recalculate product costs for affected products
      await recalculateProductCostsByMaterial(data.materialName, size || 'N/A')

      return transaction
    } catch (error) {
      console.error('Failed material stock-in inside D1:', error)
      throw error
    }
  }

  async function materialStockOut(data) {
    let size = data.size
    if (data.materialName === 'ទាបបារាំង' || data.materialName === 'កេស') {
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

  async function deductPlasticBag(size, quantity = 1, orderNumber = '') {
    // ថង់ only supports S and M sizes (no L)
    if (!size || !['S', 'M'].includes(size)) {
      console.warn('ថង់ only supports S and M sizes')
      return null
    }
    return materialStockOut({
      materialName: 'ថង់',
      size: size,
      quantity: Number(quantity),
      notes: orderNumber ? `បានកាត់ចេញតាមការកម្មង់លេខ: ${orderNumber} (${size})` : `បានកាត់ចេញដោយស្វ័យប្រវត្តិតាមរយៈការលក់ (${size})`
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

  async function returnPlasticBag(size, quantity = 1, orderNumber = '') {
    // ថង់ only supports S and M sizes (no L)
    if (!size || !['S', 'M'].includes(size)) {
      console.warn('ថង់ only supports S and M sizes')
      return null
    }

    const txIndex = materialTransactions.value.findIndex(tx =>
      tx.materialName === 'ថង់' &&
      tx.size === size &&
      tx.type === 'out' &&
      tx.notes && tx.notes.includes(orderNumber)
    )

    if (txIndex !== -1) {
      const targetTx = materialTransactions.value[txIndex]
      const updatedNotes = orderNumber ?
        `បានបន្ថែមវិញពីការបោះបង់ការកម្មង់លេខ: ${orderNumber} (${size}) (ត្រឡប់វិញ)` :
        `បានបន្ថែមវិញពីការបោះបង់ការកម្មង់ (${size}) (ត្រឡប់វិញ)`

      try {
        await api.put(`/material-transactions/${targetTx.id}`, {
          quantity: 0,
          notes: updatedNotes
        })

        // Use splice for proper Vue reactivity
        materialTransactions.value.splice(txIndex, 1, {
          ...targetTx,
          quantity: 0,
          notes: updatedNotes,
          updatedAt: new Date()
        })

        return materialTransactions.value[txIndex]
      } catch (error) {
        console.error(`Failed to update plastic bag ${size} returns inside D1:`, error)
      }
    }

    // Fallback: if original transaction not found, create a return 'in' transaction
    return materialStockIn({
      materialName: 'ថង់',
      size: size,
      quantity: Number(quantity),
      unitPrice: 0,
      totalPrice: 0,
      date: new Date(),
      notes: orderNumber ? `បានបន្ថែមវិញពីការបោះបង់ការកម្មង់លេខ: ${orderNumber} (${size})` : `បានបន្ថែមវិញពីការបោះបង់ការកម្មង់ (${size})`,
      hidden: true
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

        // Use splice for proper Vue reactivity
        materialTransactions.value.splice(txIndex, 1, {
          ...targetTx,
          quantity: 0,
          notes: updatedNotes,
          updatedAt: new Date()
        })

        return materialTransactions.value[txIndex]
      } catch (error) {
        console.error('Failed to update case box returns inside D1:', error)
      }
    }

    // Fallback: if original transaction not found, create a return 'in' transaction
    return materialStockIn({
      materialName: 'កេស',
      size: 'N/A',
      quantity: Number(quantity),
      unitPrice: 0,
      totalPrice: 0,
      date: new Date(),
      notes: orderNumber ? `បានបន្ថែមវិញពីការបោះបង់ការកម្មង់លេខ: ${orderNumber}` : 'បានបន្ថែមវិញពីការបោះបង់ការកម្មង់',
      hidden: true
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
      // Find the transaction to check if it's an 'in' transaction
      const txToDelete = materialTransactions.value.find(tx => tx.id === id)
      if (!txToDelete) {
        throw new Error(`Transaction ${id} not found`)
      }

      // If it's an 'in' transaction, check if THIS SPECIFIC transaction is in use
      if (txToDelete.type === 'in') {
        const consumedQuantity = getConsumedQuantity(txToDelete)

        // If any part of this transaction has been consumed, block deletion
        if (consumedQuantity > 0) {
          throw new Error('MATERIAL_IN_USE')
        }
      }

      await api.delete(`/material-transactions/${id}`)
      materialTransactions.value = materialTransactions.value.filter(tx => tx.id !== id)

      // Recalculate product costs for affected products
      if (txToDelete.type === 'in') {
        await recalculateProductCostsByMaterial(txToDelete.materialName, txToDelete.size)
      }
    } catch (error) {
      console.error(`Failed to delete transaction ${id} from D1:`, error)
      throw error
    }
  }

  /**
   * Check if a material transaction can be deleted using FIFO logic.
   * Returns true if the transaction can be safely deleted.
   */
  function canDeleteMaterialTransaction(tx) {
    // Only 'in' transactions can potentially be blocked
    if (tx.type !== 'in') return true

    const consumedQuantity = getConsumedQuantity(tx)

    // Can delete if none of this transaction has been consumed
    return consumedQuantity === 0
  }

  /**
   * Calculate how much of a given 'in' transaction has been consumed by 'out' transactions.
   * Uses stable FIFO ordering (by date, then by createdAt as tiebreaker).
   */
  function getConsumedQuantity(tx) {
    // Get all 'in' transactions for this material+size, sorted by date (oldest first)
    // Use stable sort: date first, then createdAt as tiebreaker to ensure consistent ordering
    const inTransactions = materialTransactions.value
      .filter(t => t.type === 'in' && t.materialName === tx.materialName && t.size === tx.size)
      .sort((a, b) => {
        const dateDiff = new Date(a.date) - new Date(b.date)
        if (dateDiff !== 0) return dateDiff
        // Stable tiebreaker: use createdAt, then id
        const createdDiff = new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        if (createdDiff !== 0) return createdDiff
        return (a.id || '').localeCompare(b.id || '')
      })

    // Get all 'out' transactions for this material+size
    const outTransactions = materialTransactions.value
      .filter(t => (t.type === 'out' || t.type === 'deduction') && t.materialName === tx.materialName && t.size === tx.size)

    // Calculate total out quantity
    const totalOut = outTransactions.reduce((sum, t) => sum + Math.abs(t.quantity), 0)

    // Calculate cumulative in quantities to find where this transaction sits
    let cumulativeIn = 0
    let consumedQuantity = 0

    for (const t of inTransactions) {
      cumulativeIn += t.quantity
      if (t.id === tx.id) {
        // This transaction starts at (cumulativeIn - t.quantity) and ends at cumulativeIn
        // If totalOut > (cumulativeIn - t.quantity), part or all of this tx is consumed
        const txStart = cumulativeIn - t.quantity
        consumedQuantity = Math.max(0, Math.min(t.quantity, totalOut - txStart))
        break
      }
    }

    return consumedQuantity
  }

  async function updateMaterialTransaction(id, updates) {
    try {
      const payload = {}
      if (updates.materialName !== undefined) payload.material_name = updates.materialName
      if (updates.size !== undefined) payload.size = updates.size
      if (updates.quantity !== undefined) payload.quantity = Number(updates.quantity)
      if (updates.unitPrice !== undefined) payload.unit_price = Number(updates.unitPrice)
      if (updates.totalPrice !== undefined) payload.total_price = Number(updates.totalPrice)
      if (updates.notes !== undefined) payload.notes = updates.notes
      if (updates.date !== undefined) payload.transaction_date = new Date(updates.date).toISOString()

      await api.put(`/material-transactions/${id}`, payload)

      const index = materialTransactions.value.findIndex(tx => tx.id === id)
      if (index !== -1) {
        const oldTx = materialTransactions.value[index]
        materialTransactions.value[index] = {
          ...materialTransactions.value[index],
          ...updates,
          updatedAt: new Date()
        }

        // Recalculate costPrice for affected products if price or quantity changed
        if (updates.unitPrice !== undefined || updates.quantity !== undefined || updates.totalPrice !== undefined) {
          await recalculateProductCostsByMaterial(
            updates.materialName || oldTx.materialName,
            updates.size || oldTx.size
          )
        }

        return materialTransactions.value[index]
      }
      return null
    } catch (error) {
      console.error(`Failed to update material transaction ${id} in D1:`, error)
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
    updateMaterialTransaction,
    canDeleteMaterialTransaction,
    getMaterialTransactions,
    checkMaterialAvailability,
    getMaterialBalance,
    getMaterialCostPerUnit,
    getMaterialUnitCost,
    getLastMaterialPrice,
    getMaterialPriceLabel,
    getTeaPricePerGram,
    setTeaPricePerGram,
    fetchSettings,
    recalculateProductCostsByMaterial,
    ALLOWED_PRODUCTS,
    ALLOWED_MATERIALS,
    SIZED_MATERIALS,
    NO_SIZE_L_MATERIALS,
    ONLY_ML_MATERIALS,
    KG_MATERIALS,
    NOSIZE_MATERIALS,
    LABOR_MATERIALS,
    TEA_GRAMS_PER_SIZE,
    TEA_POWDER_TO_TEA_GRAMS,
    getSizeFromProductName
  }
})