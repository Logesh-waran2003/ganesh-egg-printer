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

export async function saveBill(bill: { type: string; mode: string; qty: number; rate: number; total: number }): Promise<Bill> {
  const { data, error } = await supabase
    .from('bills')
    .insert(bill)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getBills(): Promise<Bill[]> {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function removeBill(id: number) {
  const { error } = await supabase.from('bills').delete().eq('id', id)
  if (error) throw error
}

export function exportBillsCSV(bills: Bill[]): string {
  const header = 'Bill No,Date,Type,Mode,Qty,Rate,Total'
  const rows = bills.map(b => `${b.bill_no},${b.created_at},${b.type},${b.mode},${b.qty},${b.rate},${b.total}`)
  return [header, ...rows].join('\n')
}
