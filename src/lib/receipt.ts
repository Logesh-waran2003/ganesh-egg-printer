import { ESCPOS, line, separator, padLine, concat } from './escpos'
import type { Bill } from './store'
import type { Settings } from './settings'

export function buildReceipt(bill: Bill, settings: Settings): Uint8Array {
  const label = bill.type === 'white' ? 'White' : bill.type === 'brown' ? 'Brown' : 'Kaadai'
  const unit = bill.mode === 'tray' ? 'tray' : bill.mode === 'box' ? 'box' : 'egg'
  const desc = `${label} ${bill.qty}${unit} @${bill.rate}`

  const footer: Uint8Array[] = []
  if (settings.shopPhone) {
    footer.push(line(`Ph: ${settings.shopPhone}`))
  }
  footer.push(line('Thank you! Visit again.'))

  return concat(
    ESCPOS.INIT,
    ESCPOS.ALIGN_CENTER,
    ESCPOS.DOUBLE_SIZE,
    line(settings.shopName.toUpperCase()),
    ESCPOS.NORMAL_SIZE,
    ESCPOS.LF,
    ESCPOS.ALIGN_LEFT,
    padLine(`Bill #${bill.bill_no}`, ''),
    padLine('Date:', new Date(bill.created_at).toLocaleDateString('en-IN')),
    padLine('Time:', new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })),
    separator(),
    padLine(desc, `${bill.total}`),
    separator(),
    ESCPOS.BOLD_ON,
    ESCPOS.DOUBLE_HEIGHT,
    padLine('TOTAL', `Rs.${bill.total}`),
    ESCPOS.NORMAL_SIZE,
    ESCPOS.BOLD_OFF,
    separator(),
    ESCPOS.ALIGN_CENTER,
    ...footer,
    ESCPOS.FEED_LINES(3),
    ESCPOS.CUT,
  )
}
