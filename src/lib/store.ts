import { supabase } from './supabase'

export interface Bill {
  id: number
  bill_no: number
  user_id: string
  type: 'white' | 'brown' | 'quail'
  mode: 'loose' | 'tray' | 'box'
  qty: number
  rate: number
  total: number
  created_at: string
}

interface PendingBill {
  type: string
  mode: string
  qty: number
  rate: number
  total: number
  created_at: string
}

const QUEUE_KEY = 'gec_offline_queue'

function getQueue(): PendingBill[] {
  const raw = localStorage.getItem(QUEUE_KEY)
  return raw ? JSON.parse(raw) : []
}

function setQueue(q: PendingBill[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export async function syncQueue() {
  const queue = getQueue()
  if (queue.length === 0) return
  const synced: number[] = []
  for (let i = 0; i < queue.length; i++) {
    const { error } = await supabase.from('bills').insert(queue[i])
    if (!error) synced.push(i)
    else break // stop on first failure
  }
  if (synced.length > 0) {
    setQueue(queue.filter((_, i) => !synced.includes(i)))
  }
}

export async function saveBill(bill: { type: string; mode: string; qty: number; rate: number; total: number }): Promise<Bill> {
  const payload = { ...bill, created_at: new Date().toISOString() }

  const { data, error } = await supabase
    .from('bills')
    .insert(payload)
    .select()
    .single()

  if (error) {
    // Offline — queue it
    const queue = getQueue()
    queue.push(payload)
    setQueue(queue)
    // Return a fake bill for UI
    return {
      id: -Date.now(),
      bill_no: 0,
      user_id: '',
      type: bill.type as Bill['type'],
      mode: bill.mode as Bill['mode'],
      qty: bill.qty,
      rate: bill.rate,
      total: bill.total,
      created_at: payload.created_at,
    }
  }

  // Try syncing any queued bills
  syncQueue()
  return data
}

export async function getBills(): Promise<Bill[]> {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

export async function removeBill(id: number) {
  if (id < 0) return // offline bill, can't delete from server
  const { error } = await supabase.from('bills').delete().eq('id', id)
  if (error) throw error
}

export function exportBillsCSV(bills: Bill[]): string {
  const header = 'Bill No,Date,Type,Mode,Qty,Rate,Total'
  const rows = bills.map(b => `${b.bill_no},${b.created_at},${b.type},${b.mode},${b.qty},${b.rate},${b.total}`)
  return [header, ...rows].join('\n')
}

export function getPendingCount(): number {
  return getQueue().length
}
