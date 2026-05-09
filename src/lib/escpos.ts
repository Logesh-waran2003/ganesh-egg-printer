// ESC/POS command builder for 58mm (32 char) thermal printer

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

const encoder = new TextEncoder()

function cmd(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes)
}

export const ESCPOS = {
  INIT: cmd(ESC, 0x40),
  LF: cmd(LF),
  CUT: cmd(GS, 0x56, 0x00),
  ALIGN_LEFT: cmd(ESC, 0x61, 0x00),
  ALIGN_CENTER: cmd(ESC, 0x61, 0x01),
  ALIGN_RIGHT: cmd(ESC, 0x61, 0x02),
  BOLD_ON: cmd(ESC, 0x45, 0x01),
  BOLD_OFF: cmd(ESC, 0x45, 0x00),
  DOUBLE_HEIGHT: cmd(ESC, 0x21, 0x10),
  DOUBLE_WIDTH: cmd(ESC, 0x21, 0x20),
  DOUBLE_SIZE: cmd(ESC, 0x21, 0x30),
  NORMAL_SIZE: cmd(ESC, 0x21, 0x00),
  FEED_LINES: (n: number) => cmd(ESC, 0x64, n),
}

export function text(str: string): Uint8Array {
  return encoder.encode(str)
}

export function line(str: string): Uint8Array {
  return concat(text(str), ESCPOS.LF)
}

export function separator(): Uint8Array {
  return line('--------------------------------')
}

export function padLine(left: string, right: string, width = 32): Uint8Array {
  const gap = width - left.length - right.length
  const padding = gap > 0 ? ' '.repeat(gap) : ' '
  return line(left + padding + right)
}

export function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}
