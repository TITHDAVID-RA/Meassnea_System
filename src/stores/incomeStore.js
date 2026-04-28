import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useStorage } from '@/composables/useStorage'
import { useGenerators } from '@/composables/useGenerators'

const defaultIncomeCategories = [
  { id: '1', name: 'លក់ផលិតផល' },
  { id: '2', name: 'សេវាកម្ម' },
  { id: '5', name: 'ចំណូលផ្សេង' }
]

export const useIncomeStore = defineStore('income', () => {
  const { generateId } = useGenerators()
  const incomes = useStorage('incomes', [])
  const incomeCategories = useStorage('incomeCategories', defaultIncomeCategories)

  const monthlyTotal = computed(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return incomes.value
      .filter(i => new Date(i.date) >= monthStart)
      .reduce((sum, i) => sum + i.amount, 0)
  })

  const totalCount = computed(() => incomes.value.length)
  const averageIncome = computed(() => totalCount.value > 0 ? incomes.value.reduce((sum, i) => sum + i.amount, 0) / totalCount.value : 0)

  function addIncome(data) {
  const newIncome = {
    id: generateId(),
    ...data, // This spreads customer, orderId, and reference into the object
    createdAt: new Date()
  }
  incomes.value.push(newIncome)
}

  function updateIncome(id, updates) {
    const index = incomes.value.findIndex(i => i.id === id)
    if (index !== -1) {
      incomes.value[index] = { ...incomes.value[index], ...updates }
      return incomes.value[index]
    }
    return null
  }

  function deleteIncome(id) {
    incomes.value = incomes.value.filter(i => i.id !== id)
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
    addIncome,
    updateIncome,
    deleteIncome,
    getIncomeById,
    getIncomeByOrderId
  }
})