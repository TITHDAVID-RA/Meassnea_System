import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGenerators } from '@/composables/useGenerators'
import { api } from '@/api/client' // Import your central D1 API client

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
  
  // Replace useStorage offline states with reactive ref states
  const assets = ref([])
  const assetCategories = ref(defaultAssetCategories)

  // Computed Stats recalculate instantly once data is loaded from D1
  const totalCount = computed(() => assets.value.length)
  
  const activeCount = computed(() => 
    assets.value.filter(a => a.status === 'active').length
  )
  
  const maintenanceCount = computed(() => 
    assets.value.filter(a => a.status === 'maintenance').length
  )

  const totalValue = computed(() => 
    assets.value.reduce((sum, a) => sum + (Number(a.value) || 0), 0)
  )

  /**
   * Fetch all assets from Cloudflare D1
   */
  async function fetchAssets() {
    try {
      const data = await api.get('/assets')

      // Map backend snake_case SQLite database columns to frontend camelCase expectations
      assets.value = data.map(a => ({
        id: a.id,
        name: a.name,
        category: a.category,
        location: a.location,
        assignedTo: a.assigned_to,
        vendor: a.vendor,
        value: Number(a.value || 0),
        description: a.description || '',
        status: a.status || 'active',
        date: a.purchase_date,
        purchaseDate: a.purchase_date,
        createdAt: a.created_at ? new Date(a.created_at) : new Date(),
        updatedAt: a.updated_at ? new Date(a.updated_at) : new Date()
      }))
    } catch (error) {
      console.error('Failed to load assets from Cloudflare D1:', error)
      throw error
    }
  }

  /**
   * Add a new asset record inside Cloudflare D1
   */
  async function addAsset(assetData) {
    try {
      const newId = generateId()
      const now = new Date()
      const purchaseDateStr = assetData.purchaseDate || now.toISOString().split('T')[0]

      // Match SQLite table column schema requirements
      const payload = {
        id: newId,
        name: assetData.name,
        category: assetData.category,
        location: assetData.location || '',
        assigned_to: assetData.assignedTo || null,
        vendor: assetData.vendor || null,
        value: Number(assetData.value || 0),
        description: assetData.description || '',
        purchase_date: purchaseDateStr,
        status: assetData.status || 'active'
      }

      await api.post('/assets', payload)

      const newAsset = {
        id: newId,
        ...assetData,
        date: purchaseDateStr,
        purchaseDate: purchaseDateStr,
        createdAt: now,
        updatedAt: now
      }

      assets.value.push(newAsset)
      return newAsset
    } catch (error) {
      console.error('Failed to save asset inside D1:', error)
      throw error
    }
  }

  /**
   * Update an existing asset record inside Cloudflare D1
   */
  async function updateAsset(id, updates) {
    try {
      const payload = {
        name: updates.name,
        category: updates.category,
        location: updates.location,
        assigned_to: updates.assignedTo,
        vendor: updates.vendor,
        value: updates.value !== undefined ? Number(updates.value) : undefined,
        description: updates.description,
        purchase_date: updates.purchaseDate || updates.date,
        status: updates.status
      }

      await api.put(`/assets/${id}`, payload)

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
    } catch (error) {
      console.error(`Failed to update asset ${id} inside D1:`, error)
      throw error
    }
  }

  /**
   * Delete an asset record from Cloudflare D1
   */
  async function deleteAsset(id) {
    try {
      await api.delete(`/assets/${id}`)
      assets.value = assets.value.filter(a => a.id !== id)
    } catch (error) {
      console.error(`Failed to delete asset ${id} from D1:`, error)
      throw error
    }
  }

  function getAssetById(id) {
    return assets.value.find(a => a.id === id)
  }

  return {
    assets,
    assetCategories,
    totalCount,
    activeCount,
    maintenanceCount,
    totalValue,
    fetchAssets, // Exposed to load records from D1 when views mount
    addAsset,
    updateAsset,
    deleteAsset,
    getAssetById,
  }
})