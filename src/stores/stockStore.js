import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useStorage } from '@/composables/useStorage'
import { useGenerators } from '@/composables/useGenerators'

const defaultStockCategories = [

]

export const useStockStore = defineStore('stock', () => {
  const { generateId } = useGenerators()
  
  const stockItems = useStorage('stockItems', [])
  const stockCategories = useStorage('stockCategories', defaultStockCategories)
  
  const totalProducts = computed(() => stockItems.value.length)
  const totalQuantity = computed(() => stockItems.value.reduce((sum, item) => sum + item.quantity, 0))
  const totalValue = computed(() => stockItems.value.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0))
  const lowStockCount = computed(() => stockItems.value.filter(item => item.quantity <= item.minStockLevel).length)
  const outOfStockCount = computed(() => stockItems.value.filter(item => item.quantity === 0).length)
  
  const lowStockItems = computed(() => 
    stockItems.value.filter(item => item.quantity <= item.minStockLevel).sort((a, b) => a.quantity - b.quantity)
  )

  function addProduct(productData) {
    const newProduct = {
      id: generateId(),
      ...productData,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    stockItems.value.push(newProduct)
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

  function adjustStock(id, quantity, type, notes = '') {
    const product = getProductById(id)
    if (!product) return null
    
    const previousQty = product.quantity
    if (type === 'in') {
      product.quantity += quantity
    } else if (type === 'out') {
      if (quantity > product.quantity) return null
      product.quantity -= quantity
    }
    product.updatedAt = new Date()
    return { product, previousQty }
  }

  function addCategory(name) {
    const newCategory = { id: generateId(), name }
    stockCategories.value.push(newCategory)
    return newCategory
  }

  return {
    stockItems,
    stockCategories,
    totalProducts,
    totalQuantity,
    totalValue,
    lowStockCount,
    outOfStockCount,
    lowStockItems,
    addProduct,
    updateProduct,
    deleteProduct,
    getProductById,
    adjustStock,
    addCategory
  }
})