<script setup>
import { computed } from 'vue'
import { useOrderStore } from '@/stores/orderStore'
import { useIncomeStore } from '@/stores/incomeStore'
import { useFormatters } from '@/composables/useFormatters'

const props = defineProps({
  modelValue: Boolean,
  orderId: String,
})

const emit = defineEmits(['update:modelValue'])

const orderStore = useOrderStore()
const incomeStore = useIncomeStore()
const { formatCurrency, formatDate, formatPaymentMethod } = useFormatters()

const order = computed(() => orderStore.getOrderById(props.orderId))
const linkedIncome = computed(() =>
  order.value ? incomeStore.getIncomeByOrderId(order.value.id) : null,
)

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue && order" class="modal-overlay" @click.self="close">
      <div class="modal responsive-detail-modal">
        <div class="modal__header">
          <h2>ព័ត៌មានលម្អិតនៃការកម្មង់</h2>
          <button class="close-btn" @click="close">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal__body">
          <div class="order-detail-header">
            <div class="order-info-badge">
              <span class="order-number">#{{ order.orderNumber }}</span>
              <span :class="['status-badge', order.status]">{{ order.status }}</span>
            </div>
            <p><strong>អតិថិជន:</strong> {{ order.customer || 'ភ្ញៀវទូទៅ' }}</p>
            <p><strong>កាលបរិច្ឆេទ:</strong> {{ formatDate(order.date) }}</p>
            <p><strong>ទូទាត់តាម:</strong> {{ formatPaymentMethod(order.paymentMethod) }}</p>
          </div>

          <div class="table-container">
            <table class="order-items-table">
              <thead>
                <tr>
                  <th>មុខទំនិញ</th>
                  <th class="text-center">ចំនួន</th>
                  <th class="text-right">តម្លៃរាយ</th>
                  <th class="text-right">សរុប</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in order.items" :key="item.productId">
                  <td class="product-name-cell">{{ item.productName || 'Unknown Product' }}</td>
                  <td class="text-center">{{ item.quantity }}</td>
                  <td class="text-right">{{ formatCurrency(item.unitPrice) }}</td>
                  <td class="text-right">{{ formatCurrency(item.quantity * item.unitPrice) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="order-detail-summary">
            <div class="summary-row">
              <span>ថង់ផ្លាស្ទិកដែលបានប្រើ:</span>
              <strong>{{ order.plasticBagQty || 0 }} ថង់</strong>
            </div>
            <div class="summary-row">
              <span>ថ្លៃសេវាដឹកជញ្ជូន:</span>
              <strong>{{ formatCurrency(order.deliveryCost || 0) }}</strong>
            </div>
            <div class="total-row">
              <span>សរុបចុងក្រោយ:</span>
              <span class="total-amount">{{ formatCurrency(order.total) }}</span>
            </div>
          </div>
        </div>

        <div class="modal__footer">
          <button class="btn btn-secondary" @click="close">បិទ</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.order-detail-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.order-info-badge {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.order-number {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--primary-color);
}

.table-container {
  overflow-x: auto;
}

.order-items-table {
  width: 100%;
  border-collapse: collapse;
}

.order-items-table th,
.order-items-table td {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
}

.order-detail-summary {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.95rem;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 2px solid var(--border-color);
  font-weight: 800;
  font-size: 1.2rem;
}

.total-amount {
  color: var(--primary-color);
}

.status-badge.completed {
  color: var(--success-color);
}
.status-badge.pending {
  color: var(--warning-color);
}

.text-right {
  text-align: right;
}
.text-center {
  text-align: center;
}
</style>
