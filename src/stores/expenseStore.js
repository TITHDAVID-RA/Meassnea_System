import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useStorage } from '@/composables/useStorage'
import { useGenerators } from '@/composables/useGenerators'

const defaultExpenseCategories = [
  { id: '1', name: 'សភិរះប្រើប្រាស់' },
  { id: '2', name: 'បុគ្គលិកនិងប្រាក់ខែ' },
  { id: '3', name: 'ចំណាយផ្នែកទីផ្សារ boost' },
  { id: '4', name: 'ប្រម៉ូតទីផ្សារ video' },
  { id: '5', name: 'ចំណាយថ្លៃចុះទីផ្សារ' },
  { id: '6', name: 'តែប្រម៉ូត' },
  { id: '7', name: 'ការធ្វើដំណើរ' },
  { id: '8', name: 'ស្តុកទំនិញ' },
]

export const useExpenseStore = defineStore('expense', () => {
  const { generateId } = useGenerators()
  const expenses = useStorage('expenses', [])
  const expenseCategories = useStorage('expenseCategories', defaultExpenseCategories)

  const monthlyTotal = computed(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return expenses.value
      .filter(e => new Date(e.date) >= monthStart)
      .reduce((sum, e) => sum + e.amount, 0)
  })

  const totalCount = computed(() => expenses.value.length)
  const averageExpense = computed(() => totalCount.value > 0 ? expenses.value.reduce((sum, e) => sum + e.amount, 0) / totalCount.value : 0)

  function addExpense(expenseData) {
    const newExpense = {
      id: generateId(),
      ...expenseData,
      date: new Date(expenseData.date)
    }
    expenses.value.push(newExpense)
    return newExpense
  }

  function updateExpense(id, updates) {
    const index = expenses.value.findIndex(e => e.id === id)
    if (index !== -1) {
      expenses.value[index] = { ...expenses.value[index], ...updates }
      return expenses.value[index]
    }
    return null
  }

  function deleteExpense(id) {
    expenses.value = expenses.value.filter(e => e.id !== id)
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
    addExpense,
    updateExpense,
    deleteExpense,
    getExpenseById
  }
})