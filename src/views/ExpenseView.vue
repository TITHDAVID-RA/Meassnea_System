<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useExpenseStore } from '@/stores/expenseStore'
import { useFormatters } from '@/composables/useFormatters'
import EmptyState from '@/components/EmptyState.vue'
import ExpenseModal from '@/components/modals/ExpenseModal.vue'

const expenseStore = useExpenseStore()
const { formatCurrency, formatDate, formatPaymentMethod } = useFormatters()

// Filter States
const search = ref('')
const categoryFilter = ref('')
const startDate = ref('')
const endDate = ref('')

// Modal States
const showModal = ref(false)
const editingExpense = ref(null)

// Dropdown State for 3-dots
const activeDropdown = ref(null)

/**
 * Filter and Sort Logic (Unchanged)
 */
const filteredExpenses = computed(() => {
  return expenseStore.expenses.filter(item => {
    const matchesSearch = !search.value || 
      item.description.toLowerCase().includes(search.value.toLowerCase()) ||
      (item.vendor && item.vendor.toLowerCase().includes(search.value.toLowerCase()))
    
    const matchesCategory = !categoryFilter.value || item.category === categoryFilter.value
    
    const itemDate = new Date(item.date).setHours(0,0,0,0)
    const start = startDate.value ? new Date(startDate.value).setHours(0,0,0,0) : null
    const end = endDate.value ? new Date(endDate.value).setHours(23,59,59,999) : null
    
    const matchesDateRange = (!start || itemDate >= start) && (!end || itemDate <= end)
    
    return matchesSearch && matchesCategory && matchesDateRange
  }).sort((a, b) => new Date(b.date) - new Date(a.date))
})

/**
 * Total Calculation (Unchanged)
 */
const filteredTotal = computed(() => {
  return filteredExpenses.value.reduce((sum, item) => sum + item.amount, 0)
})

/**
 * Actions
 */
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

function showAddExpense() {
  editingExpense.value = null
  showModal.value = true
}

function editExpense(item) {
  editingExpense.value = item
  showModal.value = true
  activeDropdown.value = null
}

function saveExpense(data) {
  if (editingExpense.value) {
    expenseStore.updateExpense(editingExpense.value.id, data)
  } else {
    expenseStore.addExpense(data)
  }
  showModal.value = false
}

function deleteExpense(id) {
  if (confirm('តើអ្នកប្រាកដថាចង់លុបទិន្នន័យចំណាយនេះមែនទេ?')) {
    expenseStore.deleteExpense(id)
    activeDropdown.value = null
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div class="search-box">
        <i class="fas fa-search search-icon"></i>
        <input type="text" placeholder="ស្វែងរកការចំណាយ..." v-model="search" class="filter-input">
      </div>
      <button class="btn btn-primary" @click="showAddExpense">
        <i class="fas fa-plus"></i> បន្ថែមការចំណាយ
      </button>
    </div>

    <div class="card">
      <div class="table-header">
        <h3>បញ្ជីចំណាយ</h3>
        <div class="filter-actions">
          <select v-model="categoryFilter" class="filter-input">
            <option value="">ប្រភេទទាំងអស់</option>
            <option v-for="cat in expenseStore.expenseCategories" :key="cat.id" :value="cat.name">
              {{ cat.name }}
            </option>
          </select>
          <input type="date" v-model="startDate" class="filter-input">
          <input type="date" v-model="endDate" class="filter-input">
        </div>
      </div>

      <div class="table-container scrollable-table-container hide-scrollbar">
        <table class="table" v-if="filteredExpenses.length > 0">
          <thead>
            <tr>
              <th>កាលបរិច្ឆេទ</th>
              <th>បរិយាយ</th>
              <th>ប្រភេទ</th>
              <th>ការទូទាត់</th>
              <th class="text-right">ចំនួនទឹកប្រាក់</th>
              <th class="text-right">សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredExpenses" :key="item.id">
              <td>{{ formatDate(item.date) }}</td>
              <td><strong>{{ item.description }}</strong></td>
              <td><span class="badge badge-danger">{{ item.category }}</span></td>
              <td>{{ formatPaymentMethod(item.paymentMethod) }}</td>
              <td class="amount-cell text-danger text-right">{{ formatCurrency(item.amount) }}</td>
              <td class="text-right action-cell">
                <div class="action-container">
                  <button class="btn-icon mobile-dots-toggle" @click.stop="toggleDropdown(item.id)">
                    <i class="fas fa-ellipsis-v"></i>
                  </button>

                  <div class="action-buttons" :class="{ 'show-mobile': activeDropdown === item.id }">
                    <button class="btn-icon" @click.stop="editExpense(item)" title="កែប្រែ">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon danger" @click.stop="deleteExpense(item.id)" title="លុប">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot class="sticky-footer">
            <tr class="total-row">
              <td colspan="4" class="text-right"><strong>សរុបការចំណាយ:</strong></td>
              <td class="amount-cell text-danger text-right" style="font-weight: 800; font-size: 1.1rem;">
                {{ formatCurrency(filteredTotal) }}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <EmptyState v-else icon="fas fa-receipt" message="មិនមានទិន្នន័យចំណាយទេ" />
      </div>
    </div>

    <ExpenseModal v-model="showModal" :expense="editingExpense" @save="saveExpense" />
  </div>
</template>

<style scoped>
/* 1. Scrollable Logic & Height Limit */
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
  background-color: #fef2f2 !important; /* Matches your total-row color */
  padding: 1rem !important;
  box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.05);
}

/* 4. Action Dropdown & Mobile Responsiveness */
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

  /* Add text label for mobile from title attribute */
  .action-buttons .btn-icon::after {
    content: attr(title);
    font-size: 14px;
  }
}

</style>