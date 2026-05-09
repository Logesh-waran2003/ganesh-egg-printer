import { ESCPOS, line, separator, padLine, concat } from './escpos'
import type { Bill } from './store'

export function buildReceipt(bill: Bill): Uint8Array {
  const label = bill.type === 'white' ? 'White' : bill.type === 'brown' ? 'Brown' : 'Quail'
  const unit = bill.mode === 'tray' ? 'tray' : bill.mode === 'box' ? 'box' : 'egg'
  const desc = `${label} ${bill.qty}${unit} @${bill.rate}`

  return concat(
    ESCPOS.INIT,
    ESCPOS.ALIGN_CENTER,
    ESCPOS.DOUBLE_SIZE,
    line('GANESH EGG CENTRE'),
    ESCPOS.NORMAL_SIZE,
    ESCPOS.LF,
    ESCPOS.ALIGN_LEFT,
    padLine('Date:', bill.date.split(',')[0] || bill.date),
    padLine('Time:', bill.date.split(',')[1]?.trim() || ''),
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
    line('Thank you!'),
    ESCPOS.FEED_LINES(3),
    ESCPOS.CUT,
  )
}
