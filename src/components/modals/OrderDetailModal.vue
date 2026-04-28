<script setup>
import { computed } from 'vue'
import { useOrderStore } from '@/stores/orderStore'
import { useIncomeStore } from '@/stores/incomeStore'
import { useFormatters } from '@/composables/useFormatters'

const props = defineProps({
  modelValue: Boolean,
  orderId: String
})

const emit = defineEmits(['update:modelValue'])

const orderStore = useOrderStore()
const incomeStore = useIncomeStore()
const { formatCurrency, formatDate, formatPaymentMethod } = useFormatters()

const order = computed(() => orderStore.getOrderById(props.orderId))
const linkedIncome = computed(() => order.value ? incomeStore.getIncomeByOrderId(order.value.id) : null)

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
            <h3>{{ order.orderNumber }}</h3>
            <div class="order-detail-meta">
              <div class="order-detail-meta-item">
                <span class="order-detail-meta-label">ថ្ងៃខែ</span>
                <span class="order-detail-meta-value">{{ formatDate(order.date) }}</span>
              </div>
              <div class="order-detail-meta-item">
                <span class="order-detail-meta-label">អតិថិជន</span>
                <span class="order-detail-meta-value">{{ order.customer }}</span>
              </div>
              <div class="order-detail-meta-item">
                <span class="order-detail-meta-label">ស្ថានភាព</span>
                <span class="order-detail-meta-value">
                  <span class="badge" :class="`badge-${order.status}`">
                    <template v-if="order.status === 'pending'">មិនទាន់ទូទាត់</template>
                    <template v-else-if="order.status === 'completed'">ទូទាត់រួច</template>
                    <template v-else>បានបោះបង់</template>
                  </span>
                </span>
              </div>
              <div class="order-detail-meta-item">
                <span class="order-detail-meta-label">ការបង់ប្រាក់</span>
                <span class="order-detail-meta-value">{{ formatPaymentMethod(order.paymentMethod) }}</span>
              </div>
            </div>

            <div v-if="linkedIncome" class="income-connection">
              <span class="order-detail-meta-label">Linked Income:</span>
              <span class="connected-record">
                <i class="fas fa-link"></i> {{ formatCurrency(linkedIncome.amount) }} on {{ formatDate(linkedIncome.date) }}
              </span>
            </div>
          </div>
          
          <div class="detail-table-wrapper">
            <table class="order-items-table">
              <thead>
                <tr>
                  <th>មុខទំនិញ</th>
                  <th class="text-center">ចំនួន</th>
                  <th>តម្លៃរាយ</th>
                  <th class="text-right">សរុប</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in order.items" :key="item.productId">
                  <td class="product-name-cell">{{ item.productName }}</td>
                  <td class="text-center">{{ item.quantity }}</td>
                  <td>{{ formatCurrency(item.unitPrice) }}</td>
                  <td class="text-right">{{ formatCurrency(item.total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="order-detail-summary">
            <div class="total-row">
              <span>សរុបរួម:</span>
              <span class="total-amount">{{ formatCurrency(order.total) }}</span>
            </div>
          </div>
          
          <div v-if="order.notes" class="order-notes-section">
            <strong>ចំណាំ:</strong> {{ order.notes }}
          </div>
        </div>

        <div class="modal__footer">
          <button class="btn btn-outline full-width-mobile" @click="close">បិទ</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Modal Resizing */
.responsive-detail-modal {
  max-width: 600px;
  width: 95%;
  margin: 20px auto;
}

/* Meta Information Grid */
.order-detail-meta {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}

.income-connection {
  margin-top: 0.75rem;
  padding: 8px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: var(--font-xs);
}

/* TABLE RESPONSIVE FIXES */
.detail-table-wrapper {
  width: 100%;
  overflow-x: auto; /* Allows side-scroll on very small screens */
  margin-top: 1.5rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.order-items-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 450px; /* Ensures text doesn't wrap awkwardly */
}

.order-items-table th {
  background-color: #f8fafc;
  padding: 12px;
  text-align: left;
  font-size: var(--font-xs);
  color: var(--text-secondary);
  border-bottom: 2px solid var(--border-color);
}

.order-items-table td {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: var(--font-sm);
}

.product-name-cell {
  font-weight: 500;
  color: var(--text-primary);
}

.text-right { text-align: right; }
.text-center { text-align: center; }

/* Summary Styling */
.order-detail-summary {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 2px solid var(--border-color);
}

.total-row {
  display: flex;
  justify-content: flex-end;
  gap: 20px;
  align-items: center;
  font-size: 1.1rem;
  font-weight: bold;
}

.total-amount {
  color: var(--primary-color);
  font-size: 1.3rem;
}

.order-notes-section {
  margin-top: 1rem;
  padding: 12px;
  background-color: #fffbeb;
  border-radius: 6px;
  font-size: var(--font-sm);
  color: #92400e;
}

/* MOBILE ADAPTATIONS */
@media (max-width: 500px) {
  .order-detail-meta {
    grid-template-columns: 1fr; /* Stack meta on mobile */
    gap: 0.5rem;
  }

  .modal__header h2 {
    font-size: 1.1rem;
  }

  .full-width-mobile {
    width: 100%;
  }

  .total-row {
    justify-content: space-between;
  }
}
</style>