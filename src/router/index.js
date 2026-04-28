import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import StockView from '@/views/StockView.vue'
import OrdersView from '@/views/OrdersView.vue'
import AssetsView from '@/views/AssetsView.vue'
import IncomeView from '@/views/IncomeView.vue'
import ExpenseView from '@/views/ExpenseView.vue'

const routes = [
  { path: '/', name: 'dashboard', component: DashboardView, meta: { title: 'គ្រប់គ្រង' } },
  { path: '/stock', name: 'stock', component: StockView, meta: { title: 'គ្រប់គ្រងស្តុកទំនិញ' } },
  { path: '/orders', name: 'orders', component: OrdersView, meta: { title: 'គ្រប់គ្រងការកម្មង់' } },
  { path: '/assets', name: 'assets', component: AssetsView, meta: { title: 'គ្រប់គ្រងស្តុកអីវ៉ាន់' } },
  { path: '/income', name: 'income', component: IncomeView, meta: { title: 'ចំណូល' } },
  { path: '/expense', name: 'expense', component: ExpenseView, meta: { title: 'ចំណាយ' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

/**
 * UPDATED: Removed next() to fix deprecation warning
 */
router.beforeEach((to, from) => {
  document.title = `Meassnea System`
  // Return nothing or true to allow the navigation
  return true 
})

export default router