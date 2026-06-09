import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGenerators } from '@/composables/useGenerators'
import { api } from '@/api/client'
import { useIncomeStore } from '@/stores/incomeStore'
import { useStockStore } from '@/stores/stockStore'

export const useOrderStore = defineStore('orders', () => {
  const { generateId, generateOrderNumber } = useGenerators()
  const orders = ref([])

  const pendingOrders = computed(() => orders.value.filter(o => o.status === 'pending'))
  const completedOrders = computed(() => orders.value.filter(o => o.status === 'completed'))
  const cancelledOrders = computed(() => orders.value.filter(o => o.status === 'cancelled'))

  // --- Helper: Recalculate plastic bag cost from bags array ---
  function calculatePlasticBagCostFromArray(plasticBags) {
    const bags = plasticBags || []
    if (bags.length === 0) return 0

    const stockStore = useStockStore()
    let total = 0
    bags.forEach(bag => {
      const bagSize = bag.size
      const bagQty = Number(bag.qty || bag.quantity || 0)
      if (bagSize && ['S', 'M'].includes(bagSize)) {
        const unitCost = stockStore.getMaterialUnitCost('ថង់', bagSize)
        total += bagQty * unitCost
      }
    })
    return total
  }

  async function fetchOrders() {
    try {
      const data = await api.get('/orders')

      orders.value = data.map(o => {
        const plasticBags = typeof o.plastic_bags === 'string'
          ? JSON.parse(o.plastic_bags)
          : (o.plastic_bags || [])

        // Use stored cost if available, otherwise recalculate from bags array
        let plasticBagCost = Number(Number(o.plastic_bag_cost || 0).toFixed(2))
        if (plasticBagCost === 0 && plasticBags.length > 0) {
          plasticBagCost = Number(calculatePlasticBagCostFromArray(plasticBags).toFixed(2))
        }

        return {
          id: o.id,
          orderNumber: o.order_number,
          customer: o.customer,
          total: Number(Number(o.total || 0).toFixed(2)),
          deliveryCost: Number(Number(o.delivery_cost || 0).toFixed(2)),
          plasticBags: plasticBags,
          plasticBagCost: plasticBagCost,
          caseBoxQty: Number(o.case_box_qty || 0),
          paymentMethod: o.payment_method || 'cash',
          status: o.status || 'pending',
          date: o.order_date ? new Date(o.order_date) : new Date(o.created_at),
          createdAt: o.created_at ? new Date(o.created_at) : new Date(),
          updatedAt: o.updated_at ? new Date(o.updated_at) : null,
          items: typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []).map(item => ({
            id: item.id,
            productId: item.product_id,
            name: item.product_name,
            productName: item.product_name,
            quantity: Number(item.quantity || 1),
            unitPrice: Number(Number(item.unit_price || 0).toFixed(2)),
            costPrice: Number(Number(item.cost_price || 0).toFixed(2)),
            total: Number(Number(item.total || 0).toFixed(2))
          })),
          freeItems: typeof o.free_items === 'string' ? JSON.parse(o.free_items) : (o.freeItems || o.free_items || []).map(item => ({
            id: item.id,
            productId: item.product_id,
            name: item.product_name,
            productName: item.product_name,
            quantity: Number(item.quantity || 1),
            unitPrice: 0,
            costPrice: Number(Number(item.cost_price || 0).toFixed(2)),
            total: 0
          }))
        }
      })
    } catch (error) {
      console.error('Failed to fetch orders from D1:', error)
      throw error
    }
  }

  async function createOrder(orderData) {
    try {
      const newId = generateId()
      const orderNo = generateOrderNumber(orders.value.length)
      const now = new Date()

      const initialStatus = orderData.status || 'pending'

      const payload = {
        id: newId,
        order_number: orderNo,
        customer: orderData.customer || null,
        total: Number(Number(orderData.total || 0).toFixed(2)),
        delivery_cost: Number(Number(orderData.deliveryCost || 0).toFixed(2)),
        plastic_bags: JSON.stringify(orderData.plasticBags || []),
        plastic_bag_cost: Number(Number(orderData.plasticBagCost || 0).toFixed(2)),
        case_box_qty: Number(orderData.caseBoxQty || 0),
        payment_method: orderData.paymentMethod || 'cash',
        status: initialStatus,
        order_date: now.toISOString(),
        items: orderData.items.map(item => ({
          id: generateId(),
          product_id: item.productId,
          product_name: item.name || item.productName || 'ផលិតផល',
          quantity: Number(item.quantity || 1),
          unit_price: Number(Number(item.unitPrice || 0).toFixed(2)),
          cost_price: Number(Number(item.costPrice || 0).toFixed(2)),
          total: Number(Number(item.total || 0).toFixed(2))
        })),
        free_items: JSON.stringify((orderData.freeItems || []).map(item => ({
          id: generateId(),
          product_id: item.productId,
          product_name: item.name || item.productName || 'ផលិតផល',
          quantity: Number(item.quantity || 1),
          unit_price: 0,
          cost_price: Number(Number(item.costPrice || 0).toFixed(2)),
          total: 0
        })))
      }

      await api.post('/orders', payload)

      const storeOrder = {
        id: newId,
        orderNumber: orderNo,
        customer: orderData.customer || null,
        total: Number(Number(orderData.total || 0).toFixed(2)),
        deliveryCost: Number(Number(orderData.deliveryCost || 0).toFixed(2)),
        plasticBags: orderData.plasticBags || [],
        plasticBagCost: Number(Number(orderData.plasticBagCost || 0).toFixed(2)),
        caseBoxQty: Number(orderData.caseBoxQty || 0),
        paymentMethod: orderData.paymentMethod || 'cash',
        status: initialStatus,
        date: now,
        createdAt: now,
        items: orderData.items.map(item => ({
          productId: item.productId,
          name: item.name || item.productName || 'ផលិតផល',
          productName: item.name || item.productName || 'ផលិតផល',
          quantity: Number(item.quantity || 1),
          unitPrice: Number(Number(item.unitPrice || 0).toFixed(2)),
          costPrice: Number(Number(item.costPrice || 0).toFixed(2)),
          total: Number(Number(item.total || 0).toFixed(2))
        })),
        freeItems: (orderData.freeItems || []).map(item => ({
          productId: item.productId,
          name: item.name || item.productName || 'ផលិតផល',
          productName: item.name || item.productName || 'ផលិតផល',
          quantity: Number(item.quantity || 1),
          unitPrice: 0,
          costPrice: Number(Number(item.costPrice || 0).toFixed(2)),
          total: 0
        }))
      }

      orders.value.push(storeOrder)

      if (initialStatus === 'completed') {
        const incomeStore = useIncomeStore()
        const stockStore = useStockStore()

        const alreadyExists = incomeStore.incomes.some(inc => inc.orderId === newId || inc.reference === orderNo)

        if (!alreadyExists) {
          const itemsTotal = orderData.items.reduce(
            (sum, item) => sum + (Number(item.unitPrice || item.unit_price || 0) * Number(item.quantity || 1)),
            0
          )

          const deliveryCost = Number(orderData.deliveryCost !== undefined ? orderData.deliveryCost : (orderData.delivery_cost || 0))
          const totalCostPrice = orderData.items.reduce(
            (sum, item) => sum + (Number(item.costPrice || item.cost_price || 0) * Number(item.quantity || 1)),
            0
          )

          const plasticBags = orderData.plasticBags || []
          const caseBoxQty = Number(orderData.caseBoxQty !== undefined ? orderData.caseBoxQty : (orderData.case_box_qty || 0))

          let totalPlasticBagCost = 0
          plasticBags.forEach(bag => {
            const bagSize = bag.size
            const bagQty = Number(bag.qty || 0)
            if (bagSize && ['S', 'M'].includes(bagSize)) {
              const unitCost = stockStore.getMaterialUnitCost('ថង់', bagSize)
              totalPlasticBagCost += bagQty * unitCost
            }
          })

          const caseBoxProduct = stockStore.stockItems.find(item => {
            const name = (item.name || '').toLowerCase()
            return name.includes('កេស') || name.includes('box') || name.includes('case')
          })

          const caseBoxUnitCost = caseBoxProduct ? Number(caseBoxProduct.costPrice || 0) : 0.15
          const totalCaseBoxCost = caseBoxQty * caseBoxUnitCost
          const netProfit = itemsTotal - totalCostPrice - totalPlasticBagCost - totalCaseBoxCost - deliveryCost
          const incomeAmount = Number(Math.max(0, netProfit).toFixed(2))

          await incomeStore.addIncome({
            date: now,
            amount: incomeAmount,
            category: 'លក់ផលិតផល',
            paymentMethod: orderData.paymentMethod || 'cash',
            description: `${orderNo}`,
            customer: orderData.customer,
            reference: orderNo,
            orderId: newId,
          })
        }
      }

      return storeOrder
    } catch (error) {
      console.error('Failed to create order in D1:', error)
      throw error
    }
  }

  async function updateOrder(id, updates) {
    try {
      const payload = {
        customer: updates.customer,
        total: Number(Number(updates.total).toFixed(2)),
        delivery_cost: Number(Number(updates.deliveryCost).toFixed(2)),
        plastic_bags: JSON.stringify(updates.plasticBags || []),
        plastic_bag_cost: Number(Number(updates.plasticBagCost || 0).toFixed(2)),
        case_box_qty: Number(updates.caseBoxQty),
        free_items: JSON.stringify(updates.freeItems || []),
        payment_method: updates.paymentMethod,
        status: updates.status,
        updated_at: new Date().toISOString()
      }

      await api.put(`/orders/${id}`, payload)

      const index = orders.value.findIndex(o => o.id === id)
      if (index !== -1) {
        orders.value[index] = { ...orders.value[index], ...updates, updatedAt: new Date() }
        return orders.value[index]
      }
      return null
    } catch (error) {
      console.error(`Failed to update order ${id} in D1:`, error)
      throw error
    }
  }

  async function cancelOrder(id) {
    try {
      await api.patch(`/orders/${id}`, { status: 'cancelled' })

      const index = orders.value.findIndex(o => o.id === id)
      if (index !== -1) {
        orders.value[index].status = 'cancelled'
        orders.value[index].updatedAt = new Date()
        return orders.value[index]
      }
      return null
    } catch (error) {
      console.error(`Failed to cancel order ${id} in D1:`, error)
      throw error
    }
  }

  async function completeOrder(id) {
    try {
      await api.patch(`/orders/${id}`, { status: 'completed' })

      const index = orders.value.findIndex(o => o.id === id)
      if (index !== -1) {
        orders.value[index].status = 'completed'
        orders.value[index].updatedAt = new Date()
        return orders.value[index]
      }
      return null
    } catch (error) {
      console.error(`Failed to complete order ${id} in D1:`, error)
      throw error
    }
  }

  function getOrderById(id) {
    return orders.value.find(o => o.id === id)
  }

  
  async function deleteOrder(id) {
    try {
      const order = getOrderById(id)
      if (!order) {
        throw new Error(`Order ${id} not found`)
      }

      // Delete the order from backend (cascade deletes order_items and income)
      await api.delete(`/orders/${id}`)

      // Remove order from local state
      orders.value = orders.value.filter(o => o.id !== id)

      // Also remove associated income from local state
      const incomeStore = useIncomeStore()
      const income = incomeStore.getIncomeByOrderId(id)
      if (income) {
        incomeStore.incomes.value = incomeStore.incomes.value.filter(i => i.id !== income.id)
      }

      return order
    } catch (error) {
      console.error(`Failed to delete order ${id}:`, error)
      throw error
    }
  }

return {
    orders,
    pendingOrders,
    completedOrders,
    cancelledOrders,
    fetchOrders,
    createOrder,
    updateOrder,
    deleteOrder,
    cancelOrder,
    completeOrder,
    getOrderById
  }
})