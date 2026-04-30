import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import DashboardView from '@/views/DashboardView.vue'
import StockView from '@/views/StockView.vue'
import OrdersView from '@/views/OrdersView.vue'
import AssetsView from '@/views/AssetsView.vue'
import IncomeView from '@/views/IncomeView.vue'
import ExpenseView from '@/views/ExpenseView.vue'
import LoginView from '@/views/LoginView.vue'

const routes = [
  { 
    path: '/login', 
    name: 'login', 
    component: LoginView, 
    meta: { title: 'ចូលប្រើប្រាស់', public: true } 
  },
  { 
    path: '/', 
    name: 'dashboard', 
    component: DashboardView, 
    meta: { title: 'គ្រប់គ្រង' } 
  },
  { 
    path: '/stock', 
    name: 'stock', 
    component: StockView, 
    meta: { title: 'គ្រប់គ្រងស្តុកទំនិញ' } 
  },
  { 
    path: '/orders', 
    name: 'orders', 
    component: OrdersView, 
    meta: { title: 'គ្រប់គ្រងការកម្មង់' } 
  },
  { 
    path: '/assets', 
    name: 'assets', 
    component: AssetsView, 
    meta: { title: 'គ្រប់គ្រងស្តុកអីវ៉ាន់' } 
  },
  { 
    path: '/income', 
    name: 'income', 
    component: IncomeView, 
    meta: { title: 'ចំណូល' } 
  },
  { 
    path: '/expense', 
    name: 'expense', 
    component: ExpenseView, 
    meta: { title: 'ចំណាយ' } 
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from) => {
  const { isAuthenticated } = useAuth()

  // Allow public routes (login page)
  if (to.meta.public) {
    document.title = `${to.meta.title} | Meassnea System`
    return true
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated()) {
    return { path: '/login' }
  }

  // Set page title
  document.title = `${to.meta.title} | Meassnea System`
  return true
})

export default router