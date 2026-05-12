import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGenerators } from '@/composables/useGenerators'
import { useIncomeStore } from '@/stores/incomeStore' // Import Income Store
import { useStockStore } from '@/stores/stockStore' // Import Stock Store
import { api } from '@/api/client' // Import the shared API client

export const useOrderStore = defineStore('order', () => {
  const { generateId, generateOrderNumber } = useGenerators()
  
  // Clean reactive array for your orders
  const orders = ref([])

  // Computed properties remain fully reactive and calculate instantly
  const totalCount = computed(() => orders.value.length)
  const totalRevenue = computed(() => 
    orders.value.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.total, 0)
  )
  const itemsSold = computed(() => 
    orders.value
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + o.items.reduce((is, item) => is + item.quantity, 0), 0)
  )

  /**
   * Fetch all orders from Cloudflare D1
   */
  async function fetchOrders() {
    try {
      const data = await api.get('/orders')
      
      // Map database snake_case columns back to camelCase frontend expectations
      orders.value = data.map(o => ({
        id: o.id,
        orderNumber: o.order_number,
        customer: o.customer,
        total: Number(Number(o.total || 0).toFixed(2)), // Safe currency rounding
        deliveryCost: Number(Number(o.delivery_cost || 0).toFixed(2)),
        plasticBagQty: Number(o.plastic_bag_qty || 0),
        caseBoxQty: Number(o.case_box_qty || 0),
        paymentMethod: o.payment_method || 'cash',
        status: o.status || 'pending',
        date: o.order_date ? new Date(o.order_date) : new Date(o.created_at),
        createdAt: o.created_at ? new Date(o.created_at) : new Date(),
        updatedAt: o.updated_at ? new Date(o.updated_at) : null,
        // Ensure items properties also map to camelCase structure
        items: typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []).map(item => ({
          id: item.id,
          productId: item.product_id,
          name: item.product_name,
          productName: item.product_name,
          quantity: Number(item.quantity || 1),
          unitPrice: Number(Number(item.unit_price || 0).toFixed(2)),
          costPrice: Number(Number(item.cost_price || 0).toFixed(2)),
          total: Number(Number(item.total || 0).toFixed(2))
        }))
      }))
    } catch (error) {
      console.error('Failed to fetch orders from D1:', error)
      throw error
    }
  }

  /**
   * Create an order in Cloudflare D1
   */
  async function createOrder(orderData) {
    try {
      const newId = generateId()
      const orderNo = generateOrderNumber(orders.value.length)
      const now = new Date()
      
      // Force initial status to what was chosen in the modal (default to 'pending' if not chosen)
      const initialStatus = orderData.status || 'pending'

      // 1. Prepare clean snake_case payload for SQLite/D1 Table (With Precision Rounding)
      const payload = {
        id: newId,
        order_number: orderNo,
        customer: orderData.customer || null,
        total: Number(Number(orderData.total || 0).toFixed(2)),
        delivery_cost: Number(Number(orderData.deliveryCost || 0).toFixed(2)),
        plastic_bag_qty: Number(orderData.plasticBagQty || 0),
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
        }))
      }

      // Save to D1 database
      await api.post('/orders', payload)

      // 2. Prepare clean camelCase state to push to local ref array (UI EXPECTS THIS)
      const storeOrder = {
        id: newId,
        orderNumber: orderNo,
        customer: orderData.customer || null,
        total: Number(Number(orderData.total || 0).toFixed(2)),
        deliveryCost: Number(Number(orderData.deliveryCost || 0).toFixed(2)),
        plasticBagQty: Number(orderData.plasticBagQty || 0),
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
        }))
      }

      // Add to local state so Vue UI updates immediately
      orders.value.push(storeOrder)

// 3. AUTO-CREATE INCOME RECORD IF ORDER WAS CREATED AS "COMPLETED"
      if (initialStatus === 'completed') {
        const incomeStore = useIncomeStore()
        const stockStore = useStockStore()
        
        // Safety check: ការពារកុំឱ្យទិន្នន័យស្ទួនក្នុងតារាង Income
        const alreadyExists = incomeStore.incomes.some(inc => inc.orderId === newId || inc.reference === orderNo)
        
        if (!alreadyExists) {
          // ក. គណនាតម្លៃទំនិញសុទ្ធ (Items Total - មិនទាន់បូកបញ្ចូលថ្លៃដឹកជញ្ជូនឡើយ)
          const itemsTotal = orderData.items.reduce(
            (sum, item) => sum + (Number(item.unitPrice || item.unit_price || 0) * Number(item.quantity || 1)),
            0
          )

          // ខ. ទាញយកថ្លៃដឹក (Delivery Cost) ជាលេខ
          const deliveryCost = Number(orderData.deliveryCost !== undefined ? orderData.deliveryCost : (orderData.delivery_cost || 0))

          // គ. គណនាតម្លៃដើមផលិតផលសរុប (Total Cost Price of Products)
          const totalCostPrice = orderData.items.reduce(
            (sum, item) => sum + (Number(item.costPrice || item.cost_price || 0) * Number(item.quantity || 1)),
            0
          )
          
          // ឃ. ទាញយកចំនួនថង់ និងកេសដែលបានប្រើប្រាស់
          const plasticBagQty = Number(orderData.plasticBagQty !== undefined ? orderData.plasticBagQty : (orderData.plastic_bag_qty || 0))
          const caseBoxQty = Number(orderData.caseBoxQty !== undefined ? orderData.caseBoxQty : (orderData.case_box_qty || 0))

          // ង. ទាញយកតម្លៃដើមរបស់ "ថង់" និង "កេស" ពី stockStore ជាក់ស្តែង
          const plasticBagProduct = stockStore.stockItems.find(item => {
            const name = (item.name || '').toLowerCase()
            return name.includes('ថង់') || name.includes('bag') || name.includes('plastic')
          })
          
          const caseBoxProduct = stockStore.stockItems.find(item => {
            const name = (item.name || '').toLowerCase()
            return name.includes('កេស') || name.includes('box') || name.includes('case')
          })

          const plasticBagUnitCost = plasticBagProduct ? Number(plasticBagProduct.costPrice || 0) : 0.10
          const caseBoxUnitCost = caseBoxProduct ? Number(caseBoxProduct.costPrice || 0) : 0.15

          // ច. គណនាថ្លៃថង់ និងកេសសរុប
          const totalPlasticBagCost = plasticBagQty * plasticBagUnitCost
          const totalCaseBoxCost = caseBoxQty * caseBoxUnitCost

          // ឆ. រូបមន្តគណនាដែលប្រើប្រាស់ itemsTotal ដកនឹងថ្លៃដឹក (deliveryCost) ចំៗ៖
          // ចំណូលសុទ្ធ = តម្លៃទំនិញសុទ្ធ (Items Total) - តម្លៃដើមផលិតផលសរុប - ថ្លៃថង់ - ថ្លៃកេស - ថ្លៃដឹក
          const netProfit = itemsTotal - totalCostPrice - totalPlasticBagCost - totalCaseBoxCost - deliveryCost
          
          // កម្រិតក្បៀសត្រឹមត្រូវ ២ខ្ទង់
          const incomeAmount = Number(Math.max(0, netProfit).toFixed(2))

          // បោះទិន្នន័យទៅ Console ងាយស្រួលផ្ទៀងផ្ទាត់មើលក្នុង Browser (F12 -> Console)
          console.log('=== ផ្ទៀងផ្ទាត់ការគណនា Meassnea ថ្មី ===')
          console.log('តម្លៃទំនិញសុទ្ធ (Items Total):', itemsTotal)
          console.log('តម្លៃដើមផលិតផលសរុប (Total Cost Price):', totalCostPrice)
          console.log('ថ្លៃថង់សរុប (Total Plastic Bag Cost):', totalPlasticBagCost)
          console.log('ថ្លៃកេសសរុប (Total Case Box Cost):', totalCaseBoxCost)
          console.log('ថ្លៃដឹកដកចេញ (Delivery Cost Deducted):', deliveryCost)
          console.log('ប្រាក់ចំណេញសុទ្ធ (Net Profit):', incomeAmount)

          await incomeStore.addIncome({
            date: now,
            amount: incomeAmount, // បញ្ជូនប្រាក់ចំណេញដែលបានដកថ្លៃដឹកចេញពី Items Total រួចរាល់
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

  /**
   * Update an order in Cloudflare D1
   */
  async function updateOrder(id, updates) {
    try {
      const payload = {
        customer: updates.customer,
        total: Number(Number(updates.total).toFixed(2)),
        delivery_cost: Number(Number(updates.deliveryCost).toFixed(2)),
        plastic_bag_qty: Number(updates.plasticBagQty),
        case_box_qty: Number(updates.caseBoxQty),
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

  /**
   * Complete an order (updates status to 'completed')
   */
  async function completeOrder(id) {
    try {
      await api.patch(`/orders/${id}`, { status: 'completed' })

      const order = orders.value.find(o => o.id === id)
      if (order && order.status === 'pending') {
        order.status = 'completed'
        order.updatedAt = new Date()
        return order
      }
      return null
    } catch (error) {
      console.error(`Failed to complete order ${id} in D1:`, error)
      throw error
    }
  }

  /**
   * Cancel an order (updates status to 'cancelled')
   */
  async function cancelOrder(id) {
    try {
      await api.patch(`/orders/${id}`, { status: 'cancelled' })

      const order = orders.value.find(o => o.id === id)
      if (order && order.status !== 'cancelled') {
        order.status = 'cancelled'
        order.updatedAt = new Date()
        return order
      }
      return null
    } catch (error) {
      console.error(`Failed to cancel order ${id} in D1:`, error)
      throw error
    }
  }

  /**
   * Find an order in local memory (sync helper for UI)
   */
  function getOrderById(id) {
    return orders.value.find(o => o.id === id)
  }

  /**
   * Delete an order from Cloudflare D1
   */
  async function deleteOrder(id) {
    try {
      await api.delete(`/orders/${id}`)
      
      const index = orders.value.findIndex(o => o.id === id)
      if (index !== -1) {
        orders.value.splice(index, 1)
      }
    } catch (error) {
      console.error(`Failed to delete order ${id} from D1:`, error)
      throw error
    }
  }

  return {
    orders,
    totalCount,
    totalRevenue,
    itemsSold,
    fetchOrders,
    createOrder,
    updateOrder,
    deleteOrder,
    completeOrder,
    cancelOrder,
    getOrderById
  }
})