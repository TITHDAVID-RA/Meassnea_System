import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useStorage } from '@/composables/useStorage'
import { useGenerators } from '@/composables/useGenerators'

export const useOrderStore = defineStore('order', () => {
  const { generateId, generateOrderNumber } = useGenerators()
  const orders = useStorage('orders', [])

  const totalCount = computed(() => orders.value.length)
  const totalRevenue = computed(() => 
    orders.value.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.total, 0)
  )
  const itemsSold = computed(() => 
    orders.value
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + o.items.reduce((is, item) => is + item.quantity, 0), 0)
  )

  function createOrder(orderData) {
    const newOrder = {
      id: generateId(),
      orderNumber: generateOrderNumber(orders.value.length),
      createdAt: new Date(),
      status: 'pending', 
      ...orderData, 
    }
    orders.value.push(newOrder)
    return newOrder
  }

  function updateOrder(id, updates) {
    const index = orders.value.findIndex(o => o.id === id)
    if (index !== -1) {
      orders.value[index] = { ...orders.value[index], ...updates, updatedAt: new Date() }
      return orders.value[index]
    }
    return null
  }

  function completeOrder(id) {
    const order = orders.value.find(o => o.id === id)
    if (order && order.status === 'pending') {
      order.status = 'completed'
      order.updatedAt = new Date()
      return order
    }
    return null
  }

  function cancelOrder(id) {
    const order = orders.value.find(o => o.id === id)
    if (order && order.status !== 'cancelled') {
      order.status = 'cancelled'
      order.updatedAt = new Date()
      return order
    }
    return null
  }

  function getOrderById(id) {
    return orders.value.find(o => o.id === id)
  }

  function deleteOrder(id) {
    const index = orders.value.findIndex(o => o.id === id)
    if (index !== -1) orders.value.splice(index, 1)
  }

  return {
    orders,
    totalCount,
    totalRevenue,
    itemsSold,
    createOrder,
    updateOrder,
    deleteOrder,
    completeOrder,
    cancelOrder,
    getOrderById
  }
})