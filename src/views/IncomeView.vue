<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useIncomeStore } from '@/stores/incomeStore'
import { useFormatters } from '@/composables/useFormatters'
import EmptyState from '@/components/EmptyState.vue'
import IncomeModal from '@/components/modals/IncomeModal.vue'

const incomeStore = useIncomeStore()
const { formatCurrency, formatDate, formatPaymentMethod } = useFormatters()

const search = ref('')
const categoryFilter = ref('')
const startDate = ref('')
const endDate = ref('')

const showModal = ref(false)
const editingIncome = ref(null)

// State for mobile dropdown menu
const activeDropdown = ref(null)

onMounted(async () => {
  window.addEventListener('click', closeDropdowns)
  try {
    // Only fetch if empty
    if (incomeStore.incomes.length === 0) {
      await incomeStore.fetchIncomes()
    }
  } catch (error) {
    console.error('Failed to load initial income view data from D1:', error)
  }
})

onUnmounted(() => {
  window.removeEventListener('click', closeDropdowns)
})

const filteredIncomes = computed(() => {
  let items = incomeStore.incomes.filter(item => {
    const matchesSearch = !search.value || 
      item.description.toLowerCase().includes(search.value.toLowerCase()) ||
      (item.customer && item.customer.toLowerCase().includes(search.value.toLowerCase()))
    const matchesCategory = !categoryFilter.value || item.category === categoryFilter.value
    const matchesDateRange = (!startDate.value || new Date(item.date) >= new Date(startDate.value)) &&
      (!endDate.value || new Date(item.date) <= new Date(endDate.value))
    return matchesSearch && matchesCategory && matchesDateRange
  })
  
  return items.sort((a, b) => new Date(b.date) - new Date(a.date))
})

const filteredTotal = computed(() => {
  return filteredIncomes.value.reduce((sum, item) => sum + (item.amount || 0), 0)
})

// UI Toggle Logic
function toggleDropdown(id) {
  activeDropdown.value = activeDropdown.value === id ? null : id
}

function closeDropdowns(e) {
  if (!e.target.closest('.action-container')) {
    activeDropdown.value = null
  }
}

function showAddIncome() {
  editingIncome.value = null
  showModal.value = true
}

function editIncome(item) {
  editingIncome.value = item
  showModal.value = true
  activeDropdown.value = null 
}

// Updated to asynchronously save updates to D1
async function saveIncome(data) {
  try {
    if (editingIncome.value) {
      await incomeStore.updateIncome(editingIncome.value.id, data)
    } else {
      await incomeStore.addIncome(data)
    }
    showModal.value = false
  } catch (error) {
    alert('មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យចំណូល!')
  }
}

// Updated to asynchronously execute deletion from D1
async function deleteIncome(id) {
  if (confirm('តើអ្នកប្រាកដថាចង់លុបទិន្នន័យចំណូលនេះមែនទេ?')) {
    try {
      await incomeStore.deleteIncome(id)
      activeDropdown.value = null
    } catch (error) {
      alert('មានបញ្ហាក្នុងការលុបទិន្នន័យចំណូល!')
    }
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
          placeholder="ស្វែងរកចំណូល..." 
          v-model="search"
          class="filter-input"
        >
      </div>
      <button class="btn btn-primary" @click="showAddIncome">
        <i class="fas fa-plus"></i> បន្ថែមចំណូល
      </button>
    </div>

    <div class="card">
      <div class="table-header">
        <h3>បញ្ជីចំណូល</h3>
        <div class="filter-actions">
          <select v-model="categoryFilter" class="filter-input">
            <option value="">ប្រភេទទាំងអស់</option>
            <option v-for="cat in incomeStore.incomeCategories" :key="cat.id" :value="cat.name">
              {{ cat.name }}
            </option>
          </select>
          <input type="date" v-model="startDate" class="filter-input">
          <input type="date" v-model="endDate" class="filter-input">
        </div>
      </div>

      <div class="table-container scrollable-table-container hide-scrollbar">
        <table class="table" v-if="filteredIncomes.length > 0">
          <thead>
            <tr>
              <th>កាលបរិច្ឆេទ</th>
              <th>បរិយាយ</th>
              <th>ប្រភេទ</th>
              <th>អតិថិជន</th>
              <th>ការទូទាត់</th>
              <th class="text-right">ចំនួនទឹកប្រាក់</th>
              <th class="text-right">សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredIncomes" :key="item.id">
              <td>{{ formatDate(item.date) }}</td>
              <td>
                <div class="desc-cell">
                  <strong>{{ item.description }}</strong>
                  <span v-if="item.orderId" class="connected-record">
                    <i class="fas fa-link"></i> ការកម្មង់
                  </span>
                </div>
              </td>
              <td><span class="badge badge-success">{{ item.category }}</span></td>
              <td>{{ item.customer || '-' }}</td>
              <td>{{ formatPaymentMethod(item.paymentMethod) }}</td>
              <td class="text-right amount-cell">
                {{ formatCurrency(item.amount) }}
              </td>
              <td class="text-right action-cell">
                <div class="action-container">
                  <button class="btn-icon mobile-dots-toggle" @click.stop="toggleDropdown(item.id)">
                    <i class="fas fa-ellipsis-v"></i>
                  </button>

                  <div class="action-buttons" :class="{ 'show-mobile': activeDropdown === item.id }">
                    <button class="btn-icon" @click.stop="editIncome(item)" title="កែប្រែ">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon danger" @click.stop="deleteIncome(item.id)" title="លុប">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot class="sticky-footer">
            <tr class="total-row">
              <td colspan="5" class="text-right"><strong>សរុបទឹកប្រាក់:</strong></td>
              <td class="text-right total-amount">
                <strong>{{ formatCurrency(filteredTotal) }}</strong>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <EmptyState v-else icon="fas fa-receipt" message="មិនមានទិន្នន័យចំណូលទេ" />
      </div>
    </div>

    <IncomeModal 
      v-model="showModal"
      :income="editingIncome"
      @save="saveIncome"
    />
  </div>
</template>

<style scoped>


/* 1. Table Height & Scroll Logic */
.scrollable-table-container {
  max-height: 600px; /* Limits to ~10 rows */
  overflow-y: auto !important;
  overflow-x: auto;
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

/* 2. Sticky Header */
.table thead th {
  position: sticky;
  top: 0;
  background-color: #ffffff;
  z-index: 20;
  box-shadow: inset 0 -1px 0 var(--border-color);
}

/* 3. Sticky Footer */
.sticky-footer {
  position: sticky;
  bottom: 0;
  z-index: 20;
}

.sticky-footer td {
  background-color: #daffdd !important; /* Matches your total-row color */
  padding: 1rem !important;
  box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.05);
}

.total-amount {
  color: var(--success-color);
  font-weight: 800;
  font-size: 1.1rem;
}

/* 4. Action Buttons & 3-Dot Dropdown */
.action-cell {
  position: relative;
  overflow: visible !important;
}

.action-container {
  display: inline-flex;
  position: relative;
}

.mobile-dots-toggle {
  display: none;
  background: var(--bg-color);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.amount-cell {
  color: var(--success-color);
  font-weight: 700;
}

.connected-record {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--primary-color);
  background: #eff6ff;
  padding: 2px 6px;
  border-radius: 4px;
  margin-top: 4px;
}

/* Responsive UI */
@media (max-width: 1024px) {
  .mobile-dots-toggle {
    display: flex;
  }

  .action-buttons {
    display: none;
    position: absolute;
    right: 0;
    top: 35px;
    background: white;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-lg);
    border-radius: 8px;
    z-index: 100;
    flex-direction: column;
    padding: 6px;
    min-width: 120px;
  }

  .action-buttons.show-mobile {
    display: flex;
  }

  .action-buttons .btn-icon {
    width: 100%;
    justify-content: flex-start;
    padding: 10px;
    gap: 10px;
  }

  .action-buttons .btn-icon::after {
    content: attr(title);
    font-size: 14px;
  }
}

.text-right {
  text-align: right;
}


</style>