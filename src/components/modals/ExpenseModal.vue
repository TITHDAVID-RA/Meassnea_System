<script setup>
import { ref, watch, computed } from 'vue'
import { useExpenseStore } from '@/stores/expenseStore'

const props = defineProps({
  modelValue: Boolean,
  expense: Object
})

const emit = defineEmits(['update:modelValue', 'save'])

const expenseStore = useExpenseStore()

const form = ref({
  date: new Date().toISOString().split('T')[0],
  amount: '',
  category: '',
  paymentMethod: 'cash',
  description: '',
  vendor: '',
  reference: ''
})

const isEditing = computed(() => !!props.expense)

watch(() => props.expense, (newExpense) => {
  if (newExpense) {
    form.value = {
      date: new Date(newExpense.date).toISOString().split('T')[0],
      amount: newExpense.amount,
      category: newExpense.category,
      paymentMethod: newExpense.paymentMethod,
      description: newExpense.description,
      vendor: newExpense.vendor || '',
      reference: newExpense.reference || ''
    }
  } else {
    resetForm()
  }
}, { immediate: true })

function resetForm() {
  form.value = {
    date: new Date().toISOString().split('T')[0],
    amount: '',
    category: '',
    paymentMethod: 'cash',
    description: '',
    vendor: '',
    reference: ''
  }
}

function save() {
  if (!form.value.date || form.value.amount === '' || !form.value.category || !form.value.description) {
    alert('សូមបំពេញព័ត៌មានដែលចាំបាច់ (*)')
    return
  }
  
  emit('save', { ...form.value, amount: parseFloat(form.value.amount) })
  close()
}

function close() {
  emit('update:modelValue', false)
  resetForm()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="close">
      <div class="modal">
        <div class="modal__header">
          <h2>{{ isEditing ? 'កែប្រែទិន្នន័យចំណាយ' : 'បន្ថែមការចំណាយថ្មី' }}</h2>
          <button class="close-btn" @click="close">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal__body">
          <form @submit.prevent="save" id="expenseForm">
            <div class="form-row">
              <div class="form-group">
                <label>កាលបរិច្ឆេទ *</label>
                <input type="date" v-model="form.date" class="filter-input" required>
              </div>
              <div class="form-group">
                <label>ចំនួនទឹកប្រាក់ ($) *</label>
                <input type="number" v-model.number="form.amount" class="filter-input" required min="0" step="0.01">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>ប្រភេទចំណាយ *</label>
                <select v-model="form.category" class="filter-input" required>
                  <option value="">ជ្រើសរើសប្រភេទ</option>
                  <option v-for="cat in expenseStore.expenseCategories" :key="cat.id" :value="cat.name">
                    {{ cat.name }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>វិធីសាស្ត្រទូទាត់ *</label>
                <select v-model="form.paymentMethod" class="filter-input" required>
                  <option value="cash">សាច់ប្រាក់</option>
                  <option value="khqr">ផ្ទេរប្រាក់តាមធនាគារ</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>បរិយាយ / គោលបំណង *</label>
              <input type="text" v-model="form.description" class="filter-input" placeholder="ឧ. ទិញសម្ភារៈការិយាល័យ" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>អ្នកផ្គត់ផ្គង់ (បើមាន)</label>
                <input type="text" v-model="form.vendor" class="filter-input">
              </div>
              <div class="form-group">
                <label>លេខយោង (បើមាន)</label>
                <input type="text" v-model="form.reference" class="filter-input" placeholder="លេខវិក្កយបត្រ">
              </div>
            </div>
          </form>
        </div>

        <div class="modal__footer">
          <button type="button" class="btn btn-outline" @click="close">បោះបង់</button>
          <button type="submit" form="expenseForm" class="btn btn-primary" @click="save">
            {{ isEditing ? 'រក្សាទុកការកែប្រែ' : 'រក្សាទុកទិន្នន័យ' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* These styles ensure consistency with your Stock and Income modals */
.form-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.filter-input {
  width: 100%;
  height: 42px;
  padding: 0.5rem 1rem;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: var(--font-sm);
  transition: all 0.2s ease;
}

.filter-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
}

@media (max-width: 480px) {
  .form-row {
    flex-direction: column;
    gap: 0;
  }
}
</style>