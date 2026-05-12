import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGenerators } from '@/composables/useGenerators'
import { api } from '@/api/client'

export const useInventoryStore = defineStore('inventory', () => {
  const { generateId } = useGenerators()
  const inventoryMovements = ref([])
  const purchaseOrders = ref([])

  const totalMovements = computed(() => inventoryMovements.value.length)
  const pendingPOs = computed(() => purchaseOrders.value.filter(po => po.status === 'pending').length)

  async function fetchInventoryData() {
    try {
      const [movementsData, posData] = await Promise.all([
        api.get('/inventory-movements'),
        api.get('/purchase-orders')
      ])

      inventoryMovements.value = movementsData.map(m => ({
        id: m.id,
        productId: m.product_id,
        productName: m.product_name,
        type: m.type,
        quantity: m.quantity,
        previousQuantity: m.previous_quantity,
        newQuantity: m.new_quantity,
        unitPrice: m.unit_price,
        totalValue: m.total_value,
        reference: m.reference,
        referenceId: m.reference_id,
        notes: m.notes,
        date: m.movement_date ? new Date(m.movement_date) : new Date(m.created_at),
        createdAt: m.created_at ? new Date(m.created_at) : new Date()
      }))

      purchaseOrders.value = posData.map(po => ({
        id: po.id,
        vendor: po.vendor,
        total: po.total,
        status: po.status,
        items: typeof po.items === 'string' ? JSON.parse(po.items) : po.items,
        notes: po.notes,
        createdAt: po.created_at ? new Date(po.created_at) : new Date(),
        updatedAt: po.updated_at ? new Date(po.updated_at) : null,
        receivedAt: po.received_at ? new Date(po.received_at) : null
      }))
    } catch (error) {
      console.error('Failed to load inventory data from Cloudflare D1:', error)
      throw error
    }
  }

  async function recordMovement(data) {
    try {
      const movementId = generateId()
      const now = new Date()

      let allowedType = 'adjustment'
      if (['in', 'out', 'return', 'adjustment'].includes(data.type)) {
        allowedType = data.type
      }

      const payload = {
        id: movementId,
        product_id: data.productId,
        product_name: data.productName,
        type: allowedType,                                                     // Guaranteed safe type string
        quantity: Number(data.quantity),
        previous_quantity: data.previousQuantity !== undefined ? Number(data.previousQuantity) : null, // Prevent 'undefined' error
        new_quantity: data.newQuantity !== undefined ? Number(data.newQuantity) : null,             // Prevent 'undefined' error
        unit_price: data.unitPrice !== undefined ? Number(data.unitPrice) : 0,
        total_value: data.totalValue !== undefined ? Number(data.totalValue) : 0,
        reference: data.reference || null,                                     // Prevent 'undefined' error
        reference_id: data.referenceId || null,                                 // Prevent 'undefined' error
        notes: data.notes || '',
        movement_date: now.toISOString()
      }

      await api.post('/inventory-movements', payload)

      const movement = {
        id: movementId,
        ...data,
        date: now,
        createdAt: now
      }
      inventoryMovements.value.push(movement)
      return movement
    } catch (error) {
      console.error('Failed to record stock movement to D1:', error)
      throw error
    }
  }

  async function createPurchaseOrder(poData) {
    try {
      const poId = generateId()
      const now = new Date()

      const payload = {
        id: poId,
        vendor: poData.vendor,
        total: Number(poData.total || 0),
        status: 'pending',
        items: poData.items,
        notes: poData.notes || ''
      }

      await api.post('/purchase-orders', payload)

      const newPO = {
        id: poId,
        ...poData,
        status: 'pending',
        createdAt: now
      }
      purchaseOrders.value.push(newPO)
      return newPO
    } catch (error) {
      console.error('Failed to create purchase order in D1:', error)
      throw error
    }
  }

  async function receivePurchaseOrder(id) {
    try {
      const now = new Date()

      await api.patch(`/purchase-orders/${id}`, {
        status: 'received',
        received_at: now.toISOString()
      })

      const po = purchaseOrders.value.find(p => p.id === id)
      if (po && po.status === 'pending') {
        po.status = 'received'
        po.receivedAt = now
        return po
      }
      return null
    } catch (error) {
      console.error(`Failed to receive purchase order ${id} in D1:`, error)
      throw error
    }
  }

  async function cancelPurchaseOrder(id) {
    try {
      const now = new Date()

      await api.patch(`/purchase-orders/${id}`, {
        status: 'cancelled'
      })

      const po = purchaseOrders.value.find(p => p.id === id)
      if (po && po.status !== 'received') {
        po.status = 'cancelled'
        po.updatedAt = now
        return po
      }
      return null
    } catch (error) {
      console.error(`Failed to cancel purchase order ${id} in D1:`, error)
      throw error
    }
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
    fetchInventoryData,
    recordMovement,
    createPurchaseOrder,
    receivePurchaseOrder,
    cancelPurchaseOrder,
    getPurchaseOrderById,
    getMovementsByProduct
  }
})