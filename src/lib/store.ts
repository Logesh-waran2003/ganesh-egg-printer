export interface Bill {
  id: string
  date: string
  type: 'white' | 'brown' | 'quail'
  mode: 'loose' | 'tray' | 'box'
  qty: number
  rate: number
  total: number
}

const STORAGE_KEY = 'gec_bills'

export function saveBill(bill: Bill) {
  const bills = getBills()
  bills.unshift(bill)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bills))
}

export function getBills(): Bill[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : []
}

export function removeBill(id: string) {
  const bills = getBills().filter(b => b.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bills))
}
