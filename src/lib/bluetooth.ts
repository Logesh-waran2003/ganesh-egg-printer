const PRINTER_SERVICE = '000018f0-0000-1000-8000-00805f9b34fb'
const PRINTER_CHARACTERISTIC = '00002af1-0000-1000-8000-00805f9b34fb'
const MAX_CHUNK = 100 // bytes per write

let device: BluetoothDevice | null = null
let characteristic: BluetoothRemoteGATTCharacteristic | null = null

export async function connectPrinter(): Promise<string> {
  device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [PRINTER_SERVICE] }],
    optionalServices: [PRINTER_SERVICE],
  })
  const server = await device.gatt!.connect()
  const service = await server.getPrimaryService(PRINTER_SERVICE)
  characteristic = await service.getCharacteristic(PRINTER_CHARACTERISTIC)
  return device.name || 'Unknown Printer'
}

export function isConnected(): boolean {
  return !!device?.gatt?.connected && !!characteristic
}

export async function disconnectPrinter() {
  device?.gatt?.disconnect()
  device = null
  characteristic = null
}

export async function sendData(data: Uint8Array) {
  if (!characteristic) throw new Error('Printer not connected')
  // Send in chunks to avoid buffer overflow
  for (let i = 0; i < data.length; i += MAX_CHUNK) {
    const chunk = data.slice(i, i + MAX_CHUNK)
    await characteristic.writeValueWithoutResponse(chunk)
  }
}
