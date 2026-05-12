import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGenerators } from '@/composables/useGenerators'
import { api } from '@/api/client' // Import your central D1 API client

const defaultExpenseCategories = [
  { id: '1', name: 'សភិរះប្រើប្រាស់' },
  { id: '2', name: 'បុគ្គលិកនិងប្រាក់ខែ' },
  { id: '3', name: 'ចំណាយផ្នែកទីផ្សារ boost' },
  { id: '4', name: 'ប្រម៉ូតទីផ្សារ video' },
  { id: '5', name: 'ចំណាយថ្លៃចុះទីផ្សារ' },
  { id: '6', name: 'តែប្រម៉ូត' },
  { id: '7', name: 'ការធ្វើដំណើរ' },
  { id: '8', name: 'ស្តុកទំនិញ' },
  { id: '9', name: 'វត្ថុធាតុដើម' }
]

export const useExpenseStore = defineStore('expense', () => {
  const { generateId } = useGenerators()

  // Replace useStorage offline states with reactive ref states
  const expenses = ref([])
  const expenseCategories = ref(defaultExpenseCategories)

  // Computed properties recalculate instantly when D1 data updates
  const monthlyTotal = computed(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return expenses.value
      .filter(e => new Date(e.date) >= monthStart)
      .reduce((sum, e) => sum + e.amount, 0)
  })

  const totalCount = computed(() => expenses.value.length)
  const averageExpense = computed(() => 
    totalCount.value > 0 ? expenses.value.reduce((sum, e) => sum + e.amount, 0) / totalCount.value : 0
  )

  /**
   * Load expenses list from Cloudflare D1
   */
  async function fetchExpenses() {
    try {
      const data = await api.get('/expenses')

      // Map snake_case SQLite database columns back to camelCase frontend expectations
      expenses.value = data.map(e => ({
        id: e.id,
        amount: e.amount,
        category: e.category,
        description: e.description,
        paymentMethod: e.payment_method,
        vendor: e.vendor,
        reference: e.reference,
        date: e.expense_date ? new Date(e.expense_date) : new Date(e.created_at),
        createdAt: e.created_at ? new Date(e.created_at) : new Date()
      }))
    } catch (error) {
      console.error('Failed to load expenses from Cloudflare D1:', error)
      throw error
    }
  }

  /**
   * Add a new expense record inside Cloudflare D1
   */
  async function addExpense(expenseData) {
    try {
      const newId = generateId()
      const now = new Date()
      const expenseDate = expenseData.date ? new Date(expenseData.date) : now

      // Convert frontend payload properties to match D1 backend schema columns
      const payload = {
        id: newId,
        amount: Number(expenseData.amount),
        category: expenseData.category,
        description: expenseData.description || '',
        payment_method: expenseData.paymentMethod || 'cash',
        vendor: expenseData.vendor || null,
        reference: expenseData.reference || null,
        expense_date: expenseDate.toISOString()
      }

      await api.post('/expenses', payload)

      const newExpense = {
        id: newId,
        ...expenseData,
        date: expenseDate,
        createdAt: now
      }

      expenses.value.push(newExpense)
      return newExpense
    } catch (error) {
      console.error('Failed to save expense inside D1:', error)
      throw error
    }
  }

  /**
   * Update an existing expense record inside Cloudflare D1
   */
  async function updateExpense(id, updates) {
    try {
      const payload = {
        amount: updates.amount !== undefined ? Number(updates.amount) : undefined,
        category: updates.category,
        description: updates.description,
        payment_method: updates.paymentMethod,
        vendor: updates.vendor,
        reference: updates.reference,
        expense_date: updates.date ? new Date(updates.date).toISOString() : undefined
      }

      await api.put(`/expenses/${id}`, payload)

      const index = expenses.value.findIndex(e => e.id === id)
      if (index !== -1) {
        expenses.value[index] = { 
          ...expenses.value[index], 
          ...updates,
          date: updates.date ? new Date(updates.date) : expenses.value[index].date
        }
        return expenses.value[index]
      }
      return null
    } catch (error) {
      console.error(`Failed to update expense ${id} inside D1:`, error)
      throw error
    }
  }

  /**
   * Delete an expense record from Cloudflare D1
   */
  async function deleteExpense(id) {
    try {
      await api.delete(`/expenses/${id}`)
      expenses.value = expenses.value.filter(e => e.id !== id)
    } catch (error) {
      console.error(`Failed to delete expense ${id} from D1:`, error)
      throw error
    }
  }

  function getExpenseById(id) {
    return expenses.value.find(e => e.id === id)
  }

  return {
    expenses,
    expenseCategories,
    monthlyTotal,
    totalCount,
    averageExpense,
    fetchExpenses, // Exposed to pull records from D1 when views mount
    addExpense,
    updateExpense,
    deleteExpense,
    getExpenseById
  }
})