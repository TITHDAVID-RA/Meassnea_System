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

function printOrder() {
  const printContent = document.querySelector('.printable-area')
  if (!printContent) return

  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.top = '-9999px'
  iframe.style.left = '-9999px'
  iframe.style.width = '0'
  iframe.style.height = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice - ${order.value?.orderNumber || ''}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Khmer', 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; color: #000; }

        .print-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .print-header h1 { font-size: 1.5rem; margin: 0 0 5px 0; }
        .print-header p { margin: 0; color: #4b5563; font-size: 0.9rem; }

        .order-header { margin-bottom: 1rem; padding-bottom: 0.8rem; border-bottom: 1px solid #000; }
        .order-header p { margin: 4px 0; font-size: 0.9rem; }
        .order-number { font-size: 1.1rem; font-weight: 800; }

        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin: 1rem 0; }
        th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: 700; }
        td { border: 1px solid #e2e8f0; padding: 8px; }
        tr:nth-child(even) { background: #f8fafc; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }

        .summary { margin-top: 1rem; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 4px; }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85rem; }
        .total-row { display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 2px solid #000; font-weight: 800; font-size: 1rem; }
        .total-amount { font-size: 1.1rem; }
        .section-title { font-size: 0.8rem; font-weight: 700; color: #374151; margin-bottom: 4px; text-transform: uppercase; }
        .plastic-bags { margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #cbd5e1; }

        .footer { text-align: center; margin-top: 30px; font-size: 0.85rem; color: #4b5563; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
      </style>
    </head>
    <body>
      ${printContent.outerHTML}
    </body>
    </html>
  `)
  doc.close()

  // Wait for styles to load then print
  setTimeout(() => {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
    setTimeout(() => document.body.removeChild(iframe), 1000)
  }, 250)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue && order" class="modal-overlay" @click.self="close">
      <div class="modal responsive-detail-modal">
        <div class="modal__header no-print">
          <h2>ព័ត៌មានលម្អិតនៃការកម្មង់</h2>
          <button class="close-btn" @click="close">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal__body printable-area">
          <div class="print-header">
            <h1>ប្រព័ន្ធគ្រប់គ្រងការលក់ Meassnea</h1>
            <p>វិក្កយបត្របញ្ជាទិញ / Invoice</p>
          </div>

          <div class="order-header">
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

          <div class="summary">
            <!-- Plastic Bags by size -->
            <div v-if="order.plasticBags && order.plasticBags.length > 0" class="plastic-bags">
              <div class="section-title">ថង់ផ្លាស្ទិក</div>
              <div v-for="(bag, idx) in order.plasticBags" :key="idx" class="summary-row">
                <span>ថង់ {{ bag.size }}:</span>
                <strong>{{ bag.qty || 0 }} ថង់</strong>
              </div>
            </div>
            <div class="summary-row">
              <span>ថ្លៃសេវាដឹកជញ្ជូន:</span>
              <strong>{{ formatCurrency(order.deliveryCost || 0) }}</strong>
            </div>
            <div class="summary-row">
              <span>ចំនួនកេស:</span>
              <strong>{{ order.caseBoxQty || 0 }} កេស</strong>
            </div>
            <div class="total-row">
              <span>សរុបចុងក្រោយ:</span>
              <span class="total-amount">{{ formatCurrency(order.total) }}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>សូមអរគុណចំពោះការគាំទ្ររបស់លោកអ្នក! / Thank you for your support!</p>
        </div>

        <div class="modal__footer no-print">
          <button class="btn btn-print" @click="printOrder">
            <i class="fas fa-print"></i> បោះពុម្ភ (Print)
          </button>
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

.plastic-bags-section {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #e2e8f0;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 6px;
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

/* Print button */
.btn-print {
  background-color: #10b981;
  color: white;
  margin-right: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.btn-print:hover {
  background-color: #059669;
}

/* Print button */
.btn-print {
  background-color: #10b981;
  color: white;
  margin-right: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.btn-print:hover {
  background-color: #059669;
}

/* Hide print elements on screen */
.print-header,
.footer {
  display: none;
}

/* 🖨️ SCREEN: Show modal normally */
@media screen {
  .modal-overlay {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

</style>