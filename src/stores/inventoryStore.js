import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useStorage } from '@/composables/useStorage'
import { useGenerators } from '@/composables/useGenerators'

export const useInventoryStore = defineStore('inventory', () => {
  const { generateId } = useGenerators()
  const inventoryMovements = useStorage('inventoryMovements', [])
  const purchaseOrders = useStorage('purchaseOrders', [])

  const totalMovements = computed(() => inventoryMovements.value.length)
  const pendingPOs = computed(() => purchaseOrders.value.filter(po => po.status === 'pending').length)

  function recordMovement(data) {
    const movement = {
      id: generateId(),
      ...data,
      date: new Date(),
      createdAt: new Date()
    }
    inventoryMovements.value.push(movement)
    return movement
  }

  function createPurchaseOrder(poData) {
    const newPO = {
      id: generateId(),
      ...poData,
      status: 'pending',
      createdAt: new Date()
    }
    purchaseOrders.value.push(newPO)
    return newPO
  }

  function receivePurchaseOrder(id) {
    const po = purchaseOrders.value.find(p => p.id === id)
    if (po && po.status === 'pending') {
      po.status = 'received'
      po.receivedAt = new Date()
      return po
    }
    return null
  }

  function cancelPurchaseOrder(id) {
    const po = purchaseOrders.value.find(p => p.id === id)
    if (po && po.status !== 'received') {
      po.status = 'cancelled'
      po.updatedAt = new Date()
      return po
    }
    return null
  }

  function getPurchaseOrderById(id) {
    return purchaseOrders.value.find(p => p.id === id)
  }

  function getMovementsByProduct(productId) {
    return inventoryMovements.value.filter(m => m.productId === productId)
  }

  return {
    inventoryMovements,
    purchaseOrders,
    totalMovements,
    pendingPOs,
    recordMovement,
    createPurchaseOrder,
    receivePurchaseOrder,
    cancelPurchaseOrder,
    getPurchaseOrderById,
    getMovementsByProduct
  }
})