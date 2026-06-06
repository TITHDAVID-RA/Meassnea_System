<script setup>
import { computed } from 'vue'
import { useOrderStore } from '@/stores/orderStore'
import { useIncomeStore } from '@/stores/incomeStore'
import { useFormatters } from '@/composables/useFormatters'
import html2pdf from 'html2pdf.js'

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

function getSizeCode(name) {
  if (!name) return ''
  const match = name.match(/\((S|M|L)\)/)
  if (match) return `Size (${match[1].toLowerCase()})`
  return name
}

function getDescription(name) {
  if (!name) return ''
  const sizeMatch = name.match(/\((S|M|L)\)/)
  const size = sizeMatch ? sizeMatch[1] : ''
  const baseName = name.replace(/\s*\(S\)|\s*\(M\)|\s*\(L\)/, '').trim()

  const sizeLabels = { S: 'Small', M: 'Big', L: 'Large' }
  return `${baseName}(${sizeLabels[size] || size})`
}

function formatNumber(value) {
  const num = Number(value) || 0
  return num.toFixed(2)
}

async function downloadInvoice() {
  // Check if html2pdf is available
  if (typeof html2pdf === 'undefined') {
    alert('សូមដំឡើង html2pdf.js សិន (Please install html2pdf.js first)')
    console.error('html2pdf.js is not loaded. Please add:')
    console.error('<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>')
    return
  }

  const element = document.getElementById('invoice-content')
  if (!element) return

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `Invoice-${order.value?.orderNumber || 'order'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true,
      backgroundColor: '#ffffff'
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait' 
    }
  }

  try {
    await html2pdf().set(opt).from(element).save()
  } catch (error) {
    console.error('Failed to generate PDF:', error)
    alert('មានបញ្ហាក្នុងការបង្កើត PDF')
  }
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

        <!-- Invoice Content for PDF -->
        <div id="invoice-content" class="invoice-container">
          <!-- Header -->
          <div class="invoice-header">
            <div class="logo-section">
              <img src="/src/assets/មាសស្នេហ៍_final-01-removebg-preview.png" alt="Meassnea Logo" class="logo-svg" />
            </div>
            <div class="invoice-title">
              <h1>INVOICE</h1>
            </div>
          </div>

          <!-- Contact Info -->
          <div class="contact-info">
            <p><strong>Address:</strong> Mepai Village, Phuchry Commune, Mondolkiri Province</p>
            <p><strong>Contact:</strong> 097 666 4090 / 096 461 9618</p>
          </div>

          <!-- Invoice Meta -->
          <div class="invoice-meta-section">
            <div class="invoice-meta-title">
              <h2>វិក្កយបត្រ INVOICE</h2>
            </div>
            <div class="invoice-dates">
              <div class="date-row">
                <span>Invoice Date</span>
                <span class="date-line">{{ formatDate(order.date) }}</span>
              </div>
              <div class="date-row">
                <span>Due Date</span>
                <span class="date-line">{{ formatDate(order.date) }}</span>
              </div>
            </div>
          </div>

          <!-- From / To -->
          <div class="from-to-section">
            <div class="from-box">
              <h4>From:</h4>
              <p class="product-name">Product Name: តែទាបបារាំង ធម្មជាតិ</p>
              <p class="address">អាស័យដ្ឋាន: ភូមិមេបៃ ឃុំភូជ្រៃ ស្រុកកែវសីមា ខេត្តមណ្ឌលគិរី</p>
              <p class="phone">Tel: 097 666 4090 / 096 461 9618</p>
            </div>
            <div class="to-box">
              <h4>To :</h4>
              <p><strong>លេខទូរសព្ទ​:</strong> {{ order.customer || 'ភ្ញៀវទូទៅ' }}</p>

            </div>
          </div>

          <!-- Items Table -->
          <table class="invoice-table">
            <thead>
              <tr>
                <th>DESCRIPTION</th>
                <th>QTY</th>
                <th>UNIT PRICE</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in order.items" :key="item.productId">
                <td>{{ getDescription(item.productName) }}</td>
                <td>{{ item.quantity }}</td>
                <td>$ {{ formatNumber(item.unitPrice) }}</td>
                <td>$ {{ formatNumber(item.quantity * item.unitPrice) }}</td>
              </tr>
            </tbody>
          </table>

          <!-- Footer Section -->
          <div class="invoice-footer">
            <div class="bank-info">
              <div class="bank-box">
                <h4>Term & Payment</h4>
                <p>BAB Bank</p>
                <p>015 650 187</p>
                <p>Meassnea OUN</p>
              </div>
            </div>
            <div class="totals-section">
              <div class="total-row">
                <span>SUBTOTAL</span>
                <span>$ {{ formatNumber(order.total) }}</span>
              </div>
              <div class="total-row discount">
                <span>(First time) Discount%</span>
                <span class="highlight">-</span>
              </div>
              <div class="total-row grand-total">
                <span>GRAND TOTAL</span>
                <span class="highlight">$ {{ formatNumber(order.total) }}</span>
              </div>
            </div>
          </div>

          <!-- Signature -->
          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line"></div>
              <p>Meassnea</p>
            </div>
            <div class="signature-box">
              <div class="signature-line"></div>
              <p>Buyer</p>
            </div>
          </div>
        </div>

        <!-- Modal Footer Buttons -->
 <div class="modal__footer no-print">
          <button class="btn btn-download" @click="downloadInvoice">
            <i class="fas fa-download"></i> ទាញយក PDF (Download)
          </button>
          <button class="btn btn-secondary" @click="close">បិទ</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Invoice Container */
.invoice-container {
  background: #fff;
  padding: 30px 40px;
  font-family: 'Khmer', 'Helvetica Neue', Arial, sans-serif;
  color: #333;
  max-width: 800px;
  margin: 0 auto;
}

/* Header */
.invoice-header {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 2px solid #7CB342;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-placeholder {
  width: 60px;
  height: 60px;
}

.logo-svg {
  width: 250px;
  height: 150px;
}

.company-name h1 {
  font-size: 1.4rem;
  color: #7CB342;
  margin: 0;
  font-weight: 800;
}

.company-name .tagline {
  font-size: 0.85rem;
  color: #558B2F;
  margin: 2px 0 0 0;
}

.invoice-title h1 {
  font-size: 2.5rem;
  color: #C5A572;
  margin: 0;
  font-weight: 300;
  letter-spacing: 4px;
}

.product-images {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-img-placeholder {
  font-size: 3rem;
}

/* Contact Info */
.contact-info {
  text-align: center;
  margin-bottom: 20px;
  font-size: 0.85rem;
  color: #666;
}

.contact-info p {
  margin: 2px 0;
}

/* Invoice Meta */
.invoice-meta-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border: 1px solid #ddd;
  padding: 15px;
}

.invoice-meta-title h2 {
  font-size: 1.1rem;
  color: #333;
  margin: 0;
}

.invoice-dates {
  text-align: right;
}

.date-row {
  display: flex;
  gap: 10px;
  margin-bottom: 5px;
  font-size: 0.85rem;
}

.date-line {
  border-bottom: 1px dotted #999;
  min-width: 120px;
  display: inline-block;
}

/* From / To */
.from-to-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.from-box, .to-box {
  border: 1px solid #ddd;
  padding: 15px;
  font-size: 0.85rem;
}

.from-box h4, .to-box h4 {
  margin: 0 0 10px 0;
  color: #7CB342;
  font-size: 0.9rem;
}

.from-box p, .to-box p {
  margin: 4px 0;
  line-height: 1.4;
}

.from-box .product-name {
  color: #7CB342;
  font-weight: 600;
}

/* Table */
.invoice-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
  font-size: 0.85rem;
}

.invoice-table thead {
  background: #7CB342;
  color: white;
}

.invoice-table th {
  padding: 10px 8px;
  text-align: center;
  font-weight: 600;
  border: 1px solid #7CB342;
}

.invoice-table td {
  padding: 10px 8px;
  text-align: center;
  border: 1px solid #ddd;
}

.invoice-table tbody tr:nth-child(even) {
  background: #f9f9f9;
}

.invoice-table td:first-child,
.invoice-table th:first-child {
  text-align: left;
}

.invoice-table td:last-child,
.invoice-table th:last-child {
  text-align: right;
}

/* Footer */
.invoice-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 30px;
}

.bank-box {
  border: 1px solid #ddd;
  padding: 15px;
  font-size: 0.85rem;
}

.bank-box h4 {
  margin: 0 0 10px 0;
  text-align: center;
  font-size: 0.8rem;
  color: #666;
}

.bank-box p {
  margin: 4px 0;
  text-align: center;
}

.totals-section {
  border: 1px solid #ddd;
  padding: 15px;
}

.total-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 0.85rem;
  border-bottom: 1px solid #eee;
}

.total-row.discount .highlight {
  background: #C5A572;
  color: white;
  padding: 2px 15px;
  min-width: 80px;
  text-align: center;
}

.total-row.grand-total {
  border-bottom: none;
  font-weight: 700;
  font-size: 0.95rem;
}

.total-row.grand-total .highlight {
  background: #7CB342;
  color: white;
  padding: 5px 15px;
  min-width: 80px;
  text-align: center;
}

/* Signature */
.signature-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  margin-top: 40px;
}

.signature-box {
  text-align: center;
}

.signature-line {
  border-bottom: 1px solid #333;
  margin-bottom: 8px;
  height: 40px;
}

.signature-box p {
  font-size: 0.85rem;
  color: #666;
  margin: 0;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  overflow-y: auto;
}

.modal {
  background: #ffffff;
  border-radius: 12px;
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.modal__header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: #64748b;
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.close-btn:hover {
  background: #e2e8f0;
}

.modal__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  /* padding: 16px 24px; */
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-download {
  background-color: #7CB342;
  color: white;
  margin-right: auto;
}

.btn-download:hover {
  background-color: #558B2F;
}

.btn-secondary {
  background: #e2e8f0;
  color: #374151;
}

/* Hide elements when printing/downloading */
.no-print {
  display: block;
}

@media print {
  .no-print {
    display: none !important;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .invoice-container {
    padding: 15px;
  }

  .invoice-header {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }

  .from-to-section {
    grid-template-columns: 1fr;
  }

  .invoice-footer {
    grid-template-columns: 1fr;
  }

  .invoice-table {
    font-size: 0.75rem;
  }

  .invoice-table th,
  .invoice-table td {
    padding: 6px 4px;
  }
}
</style>