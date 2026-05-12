<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAssetStore } from '@/stores/assetStore'
import { useFormatters } from '@/composables/useFormatters'
import EmptyState from '@/components/EmptyState.vue'
import AssetModal from '@/components/modals/AssetModal.vue'

const assetStore = useAssetStore()
const { formatCurrency, formatDate } = useFormatters()

const search = ref('')
const showAssetModal = ref(false)
const editingAsset = ref(null)
const expandedRowId = ref(null)

// Dropdown State
const activeDropdown = ref(null)

onMounted(async () => {
  window.addEventListener('click', closeDropdowns)
  try {
    // Only fetch if empty
    if (assetStore.assets.length === 0) {
      await assetStore.fetchAssets()
    }
  } catch (error) {
    console.error('Failed to load initial assets view data from D1:', error)
  }
})

onUnmounted(() => {
  window.removeEventListener('click', closeDropdowns)
})

const filteredAssets = computed(() => {
  return assetStore.assets.filter(item => {
    const searchTerm = search.value.toLowerCase()
    return !search.value || 
      item.name.toLowerCase().includes(searchTerm) ||
      item.category.toLowerCase().includes(searchTerm) ||
      (item.assignedTo && item.assignedTo.toLowerCase().includes(searchTerm))
  }).sort((a, b) => new Date(b.purchaseDate || b.date) - new Date(a.purchaseDate || a.date))
})

const totalAssetValue = computed(() => {
  return filteredAssets.value.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
})

function toggleRow(id) {
  expandedRowId.value = expandedRowId.value === id ? null : id
}

function toggleDropdown(id) {
  activeDropdown.value = activeDropdown.value === id ? null : id
}

// Close dropdown when clicking outside
function closeDropdowns(e) {
  if (!e.target.closest('.action-container')) {
    activeDropdown.value = null
  }
}

function showAddAsset() {
  editingAsset.value = null
  showAssetModal.value = true
}

function openEdit(item) {
  editingAsset.value = { ...item }
  showAssetModal.value = true
  activeDropdown.value = null
}

// Converted to async to pause UI until D1 deletes the record
async function deleteAsset(id) {
  if (confirm('តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?')) {
    try {
      await assetStore.deleteAsset(id)
      activeDropdown.value = null
    } catch (error) {
      alert('មានបញ្ហាក្នុងការលុបទិន្នន័យទ្រព្យសកម្ម!')
    }
  }
}

// Converted to async to handle database persistence updates
async function handleSave(data) {
  try {
    if (editingAsset.value && editingAsset.value.id) {
      await assetStore.updateAsset(editingAsset.value.id, data)
    } else {
      await assetStore.addAsset(data)
    }
    showAssetModal.value = false
  } catch (error) {
    alert('មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យទ្រព្យសកម្ម!')
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div class="search-box">
        <i class="fas fa-search search-icon"></i>
        <input type="text" placeholder="ស្វែងរកទ្រព្យសម្បត្តិ..." v-model="search" class="filter-input" />
      </div>
      <button class="btn btn-primary" @click="showAddAsset">
        <i class="fas fa-plus"></i> បន្ថែមទ្រព្យសម្បត្តិ
      </button>
    </div>

    <div class="card">
      <div class="table-header"><h3>បញ្ជីទ្រព្យសម្បត្តិសរុប</h3></div>

      <div class="table-container scrollable-table-container hide-scrollbar">
        <table class="table" v-if="filteredAssets.length > 0">
          <thead>
            <tr>
              <th>ឈ្មោះទ្រព្យសម្បត្តិ</th>
              <th>ប្រភេទ</th>
              <th>ទីតាំង</th>
              <th>អ្នកកាន់កាប់</th>
              <th>ថ្ងៃទិញចូល</th>
              <th class="text-right">តម្លៃ</th>
              <th class="text-right">សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in filteredAssets" :key="item.id">
              <tr @click="toggleRow(item.id)" :class="{ 'row-active': expandedRowId === item.id }" style="cursor: pointer">
                <td><strong>{{ item.name }}</strong></td>
                <td><span class="category-pill">{{ item.category }}</span></td>
                <td>{{ item.location }}</td>
                <td>{{ item.assignedTo || '-' }}</td>
                <td>{{ formatDate(item.purchaseDate || item.date) }}</td>
                <td class="text-right font-bold text-primary">{{ formatCurrency(item.value) }}</td>
                
                <td class="text-right action-cell">
                  <div class="action-container">
                    <button class="btn-icon mobile-dots-toggle" @click.stop="toggleDropdown(item.id)">
                      <i class="fas fa-ellipsis-v"></i>
                    </button>

                    <div class="action-buttons" :class="{ 'show-mobile': activeDropdown === item.id }">
                      <button class="btn-icon" @click.stop="openEdit(item)" title="កែប្រែ">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button class="btn-icon danger" @click.stop="deleteAsset(item.id)" title="លុប">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                </td>
              </tr>

              <tr v-if="expandedRowId === item.id">
                <td colspan="7" class="detail-row">
                  <div class="asset-detail-grid">
                    <div class="asset-detail-item">
                      <span class="label">អ្នកផ្គត់ផ្គង់ (Vendor):</span>
                      <strong>{{ item.vendor || 'មិនមាន' }}</strong>
                    </div>
                    <div class="asset-detail-item">
                      <span class="label">ការពិពណ៌នា:</span>
                      <span class="text-secondary">{{ item.description || 'មិនមានព័ត៌មានបន្ថែម' }}</span>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
          <tfoot class="sticky-footer">
            <tr>
              <td colspan="5" class="text-right"><strong>សរុបតម្លៃទ្រព្យសម្បត្តិ:</strong></td>
              <td class="total-amount-cell text-right"><strong>{{ formatCurrency(totalAssetValue) }}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <EmptyState v-else icon="fas fa-box-open" message="មិនមានទិន្នន័យ" />
      </div>
    </div>
    <AssetModal v-model="showAssetModal" :asset="editingAsset" @save="handleSave" />
  </div>
</template>

<style scoped>
/* Scroll & Sticky Logic */
.scrollable-table-container {
  max-height: 620px;
  overflow-y: auto !important;
  overflow-x: auto;
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.table thead th {
  position: sticky; top: 0; background: #fff; z-index: 25;
  box-shadow: inset 0 -1px 0 var(--border-color); padding: 1rem;
}

.sticky-footer { position: sticky; bottom: 0; z-index: 25; }
.sticky-footer td {
  background: #fafafa !important; border-top: 2px solid var(--primary-color) !important;
  padding: 1rem !important; box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.05);
}

/* Action Dropdown Logic */
.action-cell { position: relative; overflow: visible !important; }
.action-container { display: inline-flex; position: relative; }

.mobile-dots-toggle {
  display: none; /* Hidden on desktop */
  background: #f1f5f9; border-radius: 50%;
  width: 32px; height: 32px; align-items: center; justify-content: center;
}

.action-buttons { display: flex; gap: 8px; justify-content: flex-end; }

/* Responsive Adjustments */
@media (max-width: 1024px) {
  .mobile-dots-toggle { display: flex; }

  .action-buttons {
    display: none; /* Hide default buttons */
    position: absolute; right: 0; top: 35px;
    background: white; border: 1px solid var(--border-color);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    border-radius: 8px; z-index: 100; flex-direction: column;
    padding: 5px; min-width: 120px;
  }

  .action-buttons.show-mobile { display: flex; }

  .action-buttons .btn-icon {
    width: 100%; justify-content: flex-start;
    padding: 10px; border-radius: 6px; gap: 10px;
  }

  /* Add text label from the title attribute for mobile */
  .action-buttons .btn-icon::after {
    content: attr(title); font-size: 14px; font-weight: 500;
  }
}

/* General Styling */
.row-active { background-color: #f1f5f9; }
.detail-row { background: #f8fafc; border-left: 4px solid var(--primary-color); padding: 1.5rem; }
.asset-detail-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }
.category-pill { background: #eff6ff; color: #1e40af; padding: 2px 10px; border-radius: 12px; font-size: 0.8rem; }
.text-right { text-align: right; }
.text-primary { color: var(--primary-color); }
.font-bold { font-weight: 700; }
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { scrollbar-width: none; }
</style>