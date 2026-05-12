import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGenerators } from '@/composables/useGenerators'
import { api } from '@/api/client' // Import your central D1 API client

const defaultIncomeCategories = [
  { id: '1', name: 'លក់ផលិតផល' },
  { id: '2', name: 'សេវាកម្ម' },
  { id: '5', name: 'ចំណូលផ្សេង' }
]

export const useIncomeStore = defineStore('income', () => {
  const { generateId } = useGenerators()

  // Replace useStorage offline states with reactive ref states
  const incomes = ref([])
  const incomeCategories = ref(defaultIncomeCategories)

  // Computed properties recalculate instantly when D1 data updates
  const monthlyTotal = computed(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return incomes.value
      .filter(i => new Date(i.date) >= monthStart)
      .reduce((sum, i) => sum + i.amount, 0)
  })

  const totalCount = computed(() => incomes.value.length)
  const averageIncome = computed(() => 
    totalCount.value > 0 ? incomes.value.reduce((sum, i) => sum + i.amount, 0) / totalCount.value : 0
  )

  /**
   * Load incomes list from Cloudflare D1
   */
  async function fetchIncomes() {
    try {
      const data = await api.get('/incomes')

      // Map snake_case SQLite variables back to camelCase frontend expectations with safe decimal rounding
      incomes.value = data.map(i => ({
        id: i.id,
        orderId: i.order_id,
        amount: Number(Number(i.amount || 0).toFixed(2)), // Fix decimal precision from DB
        category: i.category,
        paymentMethod: i.payment_method,
        description: i.description,
        customer: i.customer,
        reference: i.reference,
        date: i.income_date ? new Date(i.income_date) : new Date(i.created_at),
        createdAt: i.created_at ? new Date(i.created_at) : new Date()
      }))
    } catch (error) {
      console.error('Failed to load incomes from Cloudflare D1:', error)
      throw error
    }
  }

  /**
   * Add a new income record inside Cloudflare D1
   */
  async function addIncome(data) {
    try {
      const newId = generateId()
      const now = new Date()

      // Convert frontend payload properties to match D1 backend schema columns with safe rounding
      const payload = {
        id: newId,
        order_id: data.orderId || null,
        amount: Number(Number(data.amount || 0).toFixed(2)), // Ensure rounded value is stored in DB
        category: data.category,
        payment_method: data.paymentMethod || 'cash',
        description: data.description || '',
        customer: data.customer || null,
        reference: data.reference || null,
        income_date: data.date ? new Date(data.date).toISOString() : now.toISOString()
      }

      await api.post('/incomes', payload)

      const newIncome = {
        id: newId,
        ...data,
        amount: payload.amount, // Push the formatted number to local state
        date: data.date ? new Date(data.date) : now,
        createdAt: now
      }

      incomes.value.push(newIncome)
    } catch (error) {
      console.error('Failed to save income inside D1:', error)
      throw error
    }
  }

  /**
   * Update an existing income record inside Cloudflare D1
   */
  async function updateIncome(id, updates) {
    try {
      const payload = {
        order_id: updates.orderId,
        amount: updates.amount !== undefined ? Number(Number(updates.amount).toFixed(2)) : undefined, // Round on updates
        category: updates.category,
        payment_method: updates.paymentMethod,
        description: updates.description,
        customer: updates.customer,
        reference: updates.reference,
        income_date: updates.date ? new Date(updates.date).toISOString() : undefined
      }

      await api.put(`/incomes/${id}`, payload)

      const index = incomes.value.findIndex(i => i.id === id)
      if (index !== -1) {
        // Prepare local updates ensuring safe numbers
        const sanitizedUpdates = { ...updates }
        if (updates.amount !== undefined) {
          sanitizedUpdates.amount = Number(Number(updates.amount).toFixed(2))
        }

        incomes.value[index] = { ...incomes.value[index], ...sanitizedUpdates }
        return incomes.value[index]
      }
      return null
    } catch (error) {
      console.error(`Failed to update income ${id} inside D1:`, error)
      throw error
    }
  }

  /**
   * Delete an income record from Cloudflare D1
   */
  async function deleteIncome(id) {
    try {
      await api.delete(`/incomes/${id}`)
      incomes.value = incomes.value.filter(i => i.id !== id)
    } catch (error) {
      console.error(`Failed to delete income ${id} from D1:`, error)
      throw error
    }
  }

  function getIncomeById(id) {
    return incomes.value.find(i => i.id === id)
  }

  function getIncomeByOrderId(orderId) {
    return incomes.value.find(i => i.orderId === orderId)
  }

  return {
    incomes,
    incomeCategories,
    monthlyTotal,
    totalCount,
    averageIncome,
    fetchIncomes,
    addIncome,
    updateIncome,
    deleteIncome,
    getIncomeById,
    getIncomeByOrderId
  }
})