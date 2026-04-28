<script setup>
import { ref, watch } from 'vue'
import { useIncomeStore } from '@/stores/incomeStore'

const props = defineProps({
  modelValue: Boolean,
  income: Object
})

const emit = defineEmits(['update:modelValue', 'save'])

const incomeStore = useIncomeStore()

const form = ref({
  date: new Date().toISOString().split('T')[0],
  amount: '',
  category: '',
  paymentMethod: 'cash',
  description: '',
  customer: '',
  reference: ''
})

const isEditing = computed(() => !!props.income)

watch(() => props.income, (newIncome) => {
  if (newIncome) {
    form.value = {
      date: new Date(newIncome.date).toISOString().split('T')[0],
      amount: newIncome.amount,
      category: newIncome.category,
      paymentMethod: newIncome.paymentMethod,
      description: newIncome.description,
      customer: newIncome.customer || '',
      reference: newIncome.reference || ''
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
    customer: '',
    reference: ''
  }
}

function save() {
  if (!form.value.date || isNaN(form.value.amount) || !form.value.category || !form.value.description) {
    alert('Please fill in all required fields')
    return
  }
  
  emit('save', { ...form.value, amount: parseFloat(form.value.amount) })
  close()
}

function close() {
  emit('update:modelValue', false)
  resetForm()
}

import { computed } from 'vue'
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="close">
      <div class="modal">
        <div class="modal__header">
          <h2>{{ isEditing ? 'កែចំណូល' : 'ចំណូលថ្មី' }}</h2>
          <button class="close-btn" @click="close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal__body">
          <form @submit.prevent="save">
            <div class="form-row">
              <div class="form-group">
                <label>ថ្ងៃខែ *</label>
                <input type="date" v-model="form.date" required>
              </div>
              <div class="form-group">
                <label>តម្លៃ *</label>
                <input type="number" v-model.number="form.amount" required min="0" step="0.01">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>ប្រភេទចំណូល *</label>
                <select v-model="form.category" required>
                  <option value="">Select category</option>
                  <option v-for="cat in incomeStore.incomeCategories" :key="cat.id" :value="cat.name">
                    {{ cat.name }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>វិធីបង់ប្រាក់ *</label>
                <select v-model="form.paymentMethod" required>
                  <option value="cash">សាច់ប្រាក់</option>
                  <option value="bank_transfer">ផ្ទេរប្រាក់តាមធនាគារ</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>កំណត់សម្គាល់ *</label>
              <input type="text" v-model="form.description" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>ឈ្មោះអថិតិជន</label>
                <input type="text" v-model="form.customer">
              </div>
              <div class="form-group">
                <label>ឯកសារយោង</label>
                <input type="text" v-model="form.reference">
              </div>
            </div>
          </form>
        </div>
        <div class="modal__footer">
          <button class="btn btn-outline" @click="close">បោះបង់</button>
          <button class="btn btn-primary" @click="save">រក្សាទុក</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>