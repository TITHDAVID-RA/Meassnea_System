import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useStorage } from '@/composables/useStorage'
import { useGenerators } from '@/composables/useGenerators'

const defaultAssetCategories = [
  { id: '1', name: 'Electronics' },
  { id: '2', name: 'Furniture' },
  { id: '3', name: 'Vehicles' },
  { id: '4', name: 'Machinery' },
  { id: '5', name: 'Tools' },
  { id: '6', name: 'Other' }
]


export const useAssetStore = defineStore('asset', () => {
  const { generateId } = useGenerators()
  const assets = useStorage('assets', [])
  const assetCategories = useStorage('assetCategories', defaultAssetCategories)

  // Computed Stats
  const totalCount = computed(() => assets.value.length)
  
  // FIXED: Added missing definitions for activeCount and maintenanceCount
  const activeCount = computed(() => 
    assets.value.filter(a => a.status === 'active').length
  )
  
  const maintenanceCount = computed(() => 
    assets.value.filter(a => a.status === 'maintenance').length
  )

  const totalValue = computed(() => 
    assets.value.reduce((sum, a) => sum + (Number(a.value) || 0), 0)
  )

  // Actions
  function addAsset(assetData) {
    const newAsset = {
      id: generateId(),
      ...assetData,
      date: assetData.purchaseDate || new Date().toISOString().split('T')[0],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    assets.value.push(newAsset)
    return newAsset
  }

  function updateAsset(id, updates) {
    const index = assets.value.findIndex(a => a.id === id)
    if (index !== -1) {
      assets.value[index] = { 
        ...assets.value[index], 
        ...updates, 
        updatedAt: new Date() 
      }
      return assets.value[index]
    }
    return null
  }

  function deleteAsset(id) {
    assets.value = assets.value.filter(a => a.id !== id)
  }

  function getAssetById(id) {
    return assets.value.find(a => a.id === id)
  }

  return {
    assets,
    assetCategories,
    totalCount,
    activeCount,      // Now properly defined
    maintenanceCount, // Now properly defined
    totalValue,
    addAsset,
    updateAsset,
    deleteAsset,
    getAssetById,
  }
})