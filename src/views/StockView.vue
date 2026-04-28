<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStockStore } from '@/stores/stockStore'
import { useExpenseStore } from '@/stores/expenseStore'
import { useFormatters } from '@/composables/useFormatters'
import StockModal from '@/components/modals/StockModal.vue'
import EmptyState from '@/components/EmptyState.vue'

const stockStore = useStockStore()
const expenseStore = useExpenseStore()
const { formatCurrency, formatDate } = useFormatters()

const search = ref('')
const startDate = ref('')
const endDate = ref('')
const selectedBatchDetail = ref(null)
const showStockModal = ref(false)
const editingBatch = ref(null)

// Dropdown State for 3-dots
const activeDropdown = ref(null)

function toggleDropdown(id) {
  activeDropdown.value = activeDropdown.value === id ? null : id
}

function closeDropdowns(e) {
  if (!e.target.closest('.action-container')) {
    activeDropdown.value = null
  }
}

onMounted(() => window.addEventListener('click', closeDropdowns))
onUnmounted(() => window.removeEventListener('click', closeDropdowns))

function showAddStock() {
  editingBatch.value = null
  showStockModal.value = true
}

function isActiveBatch(name, id) {
  const activeBatches = stockStore.stockItems
    .filter((p) => p.name === name && p.quantity > 0)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  return activeBatches.length > 0 && activeBatches[0].id === id
}

const filteredBatches = computed(() => {
  return stockStore.stockItems
    .filter((item) => {
      const matchesSearch = !search.value || item.name.toLowerCase().includes(search.value.toLowerCase())
      const itemDate = new Date(item.createdAt).setHours(0, 0, 0, 0)
      const start = startDate.value ? new Date(startDate.value).setHours(0, 0, 0, 0) : null
      const end = endDate.value ? new Date(endDate.value).setHours(23, 59, 59, 999) : null
      return matchesSearch && (!start || itemDate >= start) && (!end || itemDate <= end)
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

/**
 * Calculation for Footer: Sum of Initial Quantities
 */
const totalInitialQuantity = computed(() => {
  return filteredBatches.value.reduce((sum, item) => sum + (Number(item.initialQuantity) || 0), 0)
})

const totalRemainingQuantity = computed(() => {
  return filteredBatches.value.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
})

function toggleDetail(item) {
  selectedBatchDetail.value = selectedBatchDetail.value?.id === item.id ? null : item
}

function openEditStock(item) {
  editingBatch.value = { ...item }
  showStockModal.value = true
  activeDropdown.value = null
}

function deleteBatch(id) {
  if (confirm('តើអ្នកពិតជាចង់លុបបាច់ស្តុកនេះមែនទេ?')) {
    stockStore.deleteProduct(id)
    activeDropdown.value = null
  }
}

function handleProcessStock(data) {
  if (editingBatch.value) {
    stockStore.updateProduct(editingBatch.value.id, {
      name: data.name,
      quantity: data.quantity,
      unitPrice: data.price,
      costPrice: data.costPrice,
      minStockLevel: data.minStockLevel,
      notes: data.notes,
    })
  } else {
    stockStore.addProduct({
      name: data.name,
      quantity: data.quantity,
      initialQuantity: data.quantity,
      unitPrice: data.price,
      costPrice: data.costPrice,
      minStockLevel: data.minStockLevel,
      notes: data.notes,
    })
    expenseStore.addExpense({
      date: new Date(),
      description: `ទិញទំនិញចូល: ${data.name}`,
      category: 'ស្តុកទំនិញ',
      amount: data.costPrice * data.quantity,
      paymentMethod: 'cash',
    })
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div class="search-box">
  <i class="fas fa-search search-icon"></i>
  <input 
    type="text" 
    placeholder="ស្វែងរកការកម្មង់..." 
    v-model="search" 
    class="search-input"
  />
</div>
      <button class="btn btn-primary" @click="showAddStock">
        <i class="fas fa-plus"></i> បញ្ចូលស្តុកថ្មី
      </button>
    </div>

    <div class="card">
      <div class="table-header">
        <h3>បញ្ជីស្តុកទំនិញ</h3>
        <div class="filter-actions">
          <input type="date" v-model="startDate" class="filter-input">
          <input type="date" v-model="endDate" class="filter-input">
        </div>
      </div>
      
      <div class="table-container scrollable-table-container hide-scrollbar">
        <table class="table" v-if="filteredBatches.length > 0">
          <thead>
            <tr>
              <th>ឈ្មោះទំនិញ</th>
              <th>ថ្ងៃបញ្ចូល</th>
              <th>ចំនួននៅសល់</th>
              <th>តម្លៃលក់</th>
              <th class="text-right">សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in filteredBatches" :key="item.id">
              <tr
                @click="toggleDetail(item)"
                :class="{ 'row-active': selectedBatchDetail?.id === item.id }"
                style="cursor: pointer"
              >
                <td>
                  <div class="product-info-cell">
                    <strong>{{ item.name }}</strong>
                    <div class="badge-container">
                      <span v-if="isActiveBatch(item.name, item.id)" class="badge-active">
                        <i class="fas fa-check-circle"></i> កំពុងលក់
                      </span>
                      <span v-if="item.quantity <= 0" class="badge-out">
                        <i class="fas fa-exclamation-triangle"></i> អស់ពីស្តុក
                      </span>
                    </div>
                  </div>
                </td>
                <td>{{ formatDate(item.createdAt) }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ formatCurrency(item.unitPrice) }}</td>
                <td class="text-right action-cell">
                  <div class="action-container">
                    <button class="btn-icon mobile-dots-toggle" @click.stop="toggleDropdown(item.id)">
                      <i class="fas fa-ellipsis-v"></i>
                    </button>

                    <div class="action-buttons" :class="{ 'show-mobile': activeDropdown === item.id }">
                      <button class="btn-icon" @click.stop="openEditStock(item)" title="កែប្រែ">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button class="btn-icon danger" @click.stop="deleteBatch(item.id)" title="លុប">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                </td>
              </tr>

              <tr v-if="selectedBatchDetail?.id === item.id">
                <td colspan="5" class="detail-row">
                  <div class="asset-detail-grid">
                    <div class="asset-detail-item">
                      <span class="label">ចំនួនដើម:</span>
                      <strong>{{ item.initialQuantity }}</strong>
                    </div>
                    <div class="asset-detail-item">
                      <span class="label">តម្លៃដើម:</span>
                      <strong class="text-danger">{{ formatCurrency(item.costPrice) }}</strong>
                    </div>
                    <div class="asset-detail-item">
                      <span class="label">តម្លៃដើមសរុប:</span>
                      <strong class="text-primary">{{ formatCurrency(item.initialQuantity * item.costPrice) }}</strong>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
          <tfoot class="sticky-footer">
            <tr>
              <td colspan="2" class="text-right"><strong>សរុបចំនួនស្តុកដើម</strong></td>
              <td colspan="2" class="total-amount-cell"><strong>{{ totalInitialQuantity }}</strong></td>
              <td colspan="2" class="total-amount-cell"><strong>{{ totalRemainingQuantity }}</strong></td>
            </tr>
          </tfoot>
        </table>
        <EmptyState v-else icon="fas fa-box-open" message="មិនមានទិន្នន័យស្តុកទេ" />
      </div>
    </div>
    <StockModal v-model="showStockModal" :edit-data="editingBatch" @process="handleProcessStock" />
  </div>
</template>

<style scoped>


/* Scrollable Container with 10-row limit */
.scrollable-table-container {
  max-height: 600px;
  overflow-y: auto !important;
  overflow-x: auto;
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

/* Sticky Header */
.table thead th {
  position: sticky;
  top: 0;
  background-color: #ffffff;
  z-index: 25;
  box-shadow: inset 0 -1px 0 var(--border-color);
}

/* Sticky Footer */
.sticky-footer {
  position: sticky;
  bottom: 0;
  z-index: 25;
}

.sticky-footer td {
  background-color: #fafafa !important;
  border-top: 2px solid var(--primary-color) !important;
  padding: 1rem !important;
  box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.05);
}

.total-amount-cell {
  text-align: center;
  color: var(--primary-color);
  font-size: 1.1rem;
}

/* Action Dropdown & Mobile Menu */
.action-cell { position: relative; overflow: visible !important; }
.action-container { display: inline-flex; position: relative; }

.mobile-dots-toggle {
  display: none;
  background: #f1f5f9;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
}

.action-buttons { display: flex; gap: 8px; }

@media (max-width: 1024px) {
  .mobile-dots-toggle { display: flex; }
  .action-buttons {
    display: none;
    position: absolute;
    right: 0;
    top: 35px;
    background: white;
    border: 1px solid var(--border-color);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    z-index: 100;
    flex-direction: column;
    padding: 6px;
    min-width: 120px;
  }
  .action-buttons.show-mobile { display: flex; }
  .action-buttons .btn-icon {
    width: 100%; justify-content: flex-start;
    padding: 10px; gap: 10px;
  }
  .action-buttons .btn-icon::after {
    content: attr(title); font-size: 14px;
  }
}

/* Item Badges & Labels */
.product-info-cell { display: flex; flex-direction: column; gap: 4px; }
.badge-container { display: flex; gap: 4px; }

.badge-active {
  background-color: #dcfce7; color: #15803d;
  font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; font-weight: 600;
  display: flex; align-items: center; gap: 4px;
}

.badge-out {
  background-color: #fef2f2; color: #dc2626;
  font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; font-weight: 600;
  display: flex; align-items: center; gap: 4px; border: 1px solid #fee2e2;
}

/* Expansion & Details */
.row-active { background-color: #f1f5f9; }
.detail-row {
  background: #f8fafc;
  border-left: 4px solid var(--primary-color);
  padding: 1rem 1.5rem;
}

.asset-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
}

.asset-detail-item .label {
  font-size: 0.8rem; color: #64748b; display: block; margin-bottom: 2px;
}

/* Utilities */
.text-danger { color: var(--danger-color); }
.text-primary { color: var(--primary-color); }
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>