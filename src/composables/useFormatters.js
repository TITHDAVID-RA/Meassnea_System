export function useFormatters() {
  function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0)
  }

  function formatDate(date) {
    const d = new Date(date)
    if (!date || isNaN(d.getTime())) {
      return 'N/A'
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(d)
  }

  function formatDateTime(date) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  function formatPaymentMethod(method) {
    const methods = {
      cash: 'សាច់ប្រាក់',
      bank_transfer: 'ផ្ទេរប្រាក់តាមធនាគារ',
    }
    return methods[method] || method
  }

  return { formatCurrency, formatDate, formatDateTime, formatPaymentMethod }
}