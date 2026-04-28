import { ref, watch } from 'vue'

export function useStorage(key, defaultValue = null) {
  const stored = localStorage.getItem(key)
  const data = ref(stored ? JSON.parse(stored, (k, v) => {
    if (k === 'date' || k === 'createdAt' || k === 'updatedAt' || k === 'purchaseDate') {
      return new Date(v)
    }
    return v
  }) : defaultValue)

  watch(data, (newVal) => {
    localStorage.setItem(key, JSON.stringify(newVal))
  }, { deep: true })

  return data
}