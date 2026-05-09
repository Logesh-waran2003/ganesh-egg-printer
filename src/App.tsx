import { useState, useCallback, useEffect } from 'react'
import { connectPrinter, disconnectPrinter, isConnected, sendData } from './lib/bluetooth'
import { buildReceipt } from './lib/receipt'
import { saveBill, getBills, removeBill, type Bill } from './lib/store'
import { getSettings, saveSettings, type Settings } from './lib/settings'
import './App.css'

type EggType = 'white' | 'brown' | 'quail'
type SellMode = 'loose' | 'tray'
type Page = 'pos' | 'history' | 'settings'
type Field = 'qty' | 'rate'

const QUICK_LOOSE = [6, 10, 12, 15]
const QUICK_TRAY = [1, 2, 3, 5]
const QUICK_QUAIL = [1, 2, 3, 5]

function App() {
  const [page, setPage] = useState<Page>('pos')
  const [connected, setConnected] = useState(false)

  const [tab, setTab] = useState<EggType>('white')
  const [mode, setMode] = useState<SellMode>('loose')
  const [qty, setQty] = useState('')
  const [rateStr, setRateStr] = useState('')
  const [activeField, setActiveField] = useState<Field>('qty')
  const [printing, setPrinting] = useState(false)
  const [undo, setUndo] = useState<Bill | null>(null)

  const settings = getSettings()

  const getDefaultRate = () => {
    if (tab === 'quail') return settings.quailBoxRate
    if (mode === 'tray') return tab === 'white' ? settings.whiteTrayRate : settings.brownTrayRate
    return tab === 'white' ? settings.whiteEggRate : settings.brownEggRate
  }

  const rate = Number(rateStr) || getDefaultRate()
  const total = (Number(qty) || 0) * rate

  const handleKey = useCallback((key: string) => {
    const current = activeField === 'qty' ? qty : rateStr
    let next: string
    if (key === 'C') next = ''
    else if (key === 'DEL') next = current.slice(0, -1)
    else next = current + key

    if (activeField === 'qty') setQty(next)
    else setRateStr(next)
  }, [activeField, qty, rateStr])

  const handleQuick = (val: number) => {
    setQty(val.toString())
    setActiveField('qty')
  }

  const resetForm = () => {
    setQty('')
    setRateStr('')
    setActiveField('qty')
  }

  const handleTabChange = (t: EggType) => {
    setTab(t)
    if (t === 'quail') setMode('loose')
    resetForm()
  }

  const handleModeChange = (m: SellMode) => {
    setMode(m)
    resetForm()
  }

  const handleConnect = async () => {
    try {
      await connectPrinter()
      setConnected(true)
    } catch (e: any) {
      alert('Connection failed: ' + e.message)
    }
  }

  const handleDisconnect = () => {
    disconnectPrinter()
    setConnected(false)
  }

  const handlePrint = async () => {
    if (total === 0) return
    const bill: Bill = {
      id: Date.now().toString(),
      date: new Date().toLocaleString('en-IN'),
      type: tab,
      mode: tab === 'quail' ? 'box' : mode,
      qty: Number(qty) || 0,
      rate,
      total,
    }
    saveBill(bill)
    setUndo(bill)

    if (isConnected()) {
      setPrinting(true)
      try {
        await sendData(buildReceipt(bill))
      } catch (e: any) {
        alert('Print failed: ' + e.message)
      }
      setPrinting(false)
    }

    resetForm()
  }

  const handleUndo = () => {
    if (undo) {
      removeBill(undo.id)
      setUndo(null)
    }
  }

  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 4000)
    return () => clearTimeout(t)
  }, [undo])

  if (page === 'history') return <History onBack={() => setPage('pos')} />
  if (page === 'settings') return <SettingsPage onBack={() => setPage('pos')} />

  const quickValues = tab === 'quail' ? QUICK_QUAIL : mode === 'tray' ? QUICK_TRAY : QUICK_LOOSE
  const unitLabel = tab === 'quail' ? 'Boxes (12 eggs)' : mode === 'tray' ? 'Trays' : 'Eggs'

  return (
    <div className="app">
      <div className="header">
        <h1>Ganesh Egg Centre</h1>
        <div className="header-btns">
          {connected ? (
            <button onClick={handleDisconnect} className="btn-header btn-connected">Connected</button>
          ) : (
            <button onClick={handleConnect} className="btn-header">Connect Printer</button>
          )}
          <button onClick={() => setPage('history')} className="btn-header">Bills</button>
          <button onClick={() => setPage('settings')} className="btn-header">Settings</button>
        </div>
      </div>

      {/* Egg type tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'white' ? 'tab-active' : ''}`} onClick={() => handleTabChange('white')}>White</button>
        <button className={`tab ${tab === 'brown' ? 'tab-active' : ''}`} onClick={() => handleTabChange('brown')}>Brown</button>
        <button className={`tab ${tab === 'quail' ? 'tab-active' : ''}`} onClick={() => handleTabChange('quail')}>Quail</button>
      </div>

      {/* Loose / Tray toggle */}
      {tab !== 'quail' && (
        <div className="subtabs">
          <button className={`subtab ${mode === 'loose' ? 'subtab-active' : ''}`} onClick={() => handleModeChange('loose')}>Loose</button>
          <button className={`subtab ${mode === 'tray' ? 'subtab-active' : ''}`} onClick={() => handleModeChange('tray')}>Tray</button>
        </div>
      )}

      {/* Quick actions */}
      <div className="quick">
        {quickValues.map(v => (
          <button key={v} className="quick-btn" onClick={() => handleQuick(v)}>{v}</button>
        ))}
      </div>

      {/* Fields */}
      <div className="fields">
        <div className={`field ${activeField === 'qty' ? 'field-active' : ''}`} onClick={() => setActiveField('qty')}>
          <div className="field-name">{unitLabel}</div>
          <div className="field-num">{qty || '0'}</div>
        </div>
        <div className="field-multiply">×</div>
        <div className={`field field-small ${activeField === 'rate' ? 'field-active' : ''}`} onClick={() => setActiveField('rate')}>
          <div className="field-name">Rate</div>
          <div className="field-num">₹{rateStr || getDefaultRate()}</div>
        </div>
        <div className="field-equals">= ₹{total}</div>
      </div>

      {/* Numpad */}
      <div className="numpad">
        {['1','2','3','4','5','6','7','8','9','C','0','DEL'].map(key => (
          <button key={key} className={`numkey ${key === 'C' ? 'numkey-clear' : ''} ${key === 'DEL' ? 'numkey-del' : ''}`} onClick={() => handleKey(key)}>
            {key}
          </button>
        ))}
      </div>

      <button onClick={handlePrint} disabled={printing || total === 0} className="btn-action">
        {printing ? 'Printing...' : isConnected() ? 'Print Bill' : 'Save Bill'}
      </button>

      {/* Undo toast */}
      {undo && (
        <div className="undo-toast">
          <span>Bill saved — ₹{undo.total}</span>
          <button onClick={handleUndo}>Undo</button>
        </div>
      )}
    </div>
  )
}

function SettingsPage({ onBack }: { onBack: () => void }) {
  const [s, setS] = useState<Settings>(getSettings())
  const [saved, setSaved] = useState(false)

  const update = (key: keyof Settings, val: string) => {
    setS({ ...s, [key]: Number(val) || 0 })
    setSaved(false)
  }

  const handleSave = () => {
    saveSettings(s)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="app">
      <div className="header">
        <button onClick={onBack} className="btn-header">Back</button>
        <h1>Settings</h1>
      </div>
      <div className="settings-list">
        <div className="setting-group">
          <div className="setting-title">White Eggs</div>
          <div className="setting-row"><label>Per Egg</label><input type="number" value={s.whiteEggRate} onChange={e => update('whiteEggRate', e.target.value)} /></div>
          <div className="setting-row"><label>Per Tray</label><input type="number" value={s.whiteTrayRate} onChange={e => update('whiteTrayRate', e.target.value)} /></div>
        </div>
        <div className="setting-group">
          <div className="setting-title">Brown Eggs</div>
          <div className="setting-row"><label>Per Egg</label><input type="number" value={s.brownEggRate} onChange={e => update('brownEggRate', e.target.value)} /></div>
          <div className="setting-row"><label>Per Tray</label><input type="number" value={s.brownTrayRate} onChange={e => update('brownTrayRate', e.target.value)} /></div>
        </div>
        <div className="setting-group">
          <div className="setting-title">Quail Eggs</div>
          <div className="setting-row"><label>Per Box (12 eggs)</label><input type="number" value={s.quailBoxRate} onChange={e => update('quailBoxRate', e.target.value)} /></div>
        </div>
      </div>
      <button onClick={handleSave} className="btn-action">{saved ? 'Saved!' : 'Save'}</button>
    </div>
  )
}

function History({ onBack }: { onBack: () => void }) {
  const bills = getBills()
  const todayStr = new Date().toLocaleDateString('en-IN')
  const todayBills = bills.filter(b => b.date.includes(todayStr))
  const todayTotal = todayBills.reduce((s, b) => s + b.total, 0)

  return (
    <div className="app">
      <div className="header">
        <button onClick={onBack} className="btn-header">Back</button>
        <h1>Bills</h1>
      </div>
      <div className="today-box">
        <div className="today-label">Today's Total</div>
        <div className="today-amount">₹{todayTotal}</div>
        <div className="today-count">{todayBills.length} bills</div>
      </div>
      <div className="bill-list">
        {bills.length === 0 && <p className="empty">No bills yet</p>}
        {bills.map(b => (
          <div key={b.id} className="bill-row">
            <div className="bill-time">{b.date.split(',')[1]?.trim()}</div>
            <div className="bill-type">{b.type}</div>
            <div className="bill-info">{b.qty} {b.mode}</div>
            <div className="bill-total">₹{b.total}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
