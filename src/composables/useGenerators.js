export function useGenerators() {
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

function generateOrderNumber(currentCount = 0) {
  const prefix = 'Meassnea'
  const nextNumber = (currentCount + 1).toString().padStart(4, '0')
  return `${prefix}-${nextNumber}`
}


  return { generateId, generateOrderNumber}
}