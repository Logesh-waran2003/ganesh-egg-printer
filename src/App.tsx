import { useState, useCallback, useEffect, useRef } from 'react'
import { connectPrinter, disconnectPrinter, isConnected, sendData } from './lib/bluetooth'
import { buildReceipt } from './lib/receipt'
import { saveBill, getBills, removeBill, exportBillsCSV, type Bill } from './lib/store'
import { signIn, signOut, getProfile, onAuthChange, type Profile } from './lib/auth'
import { getSettings, saveSettings, type Settings } from './lib/settings'
import type { User } from '@supabase/supabase-js'
import './App.css'

type EggType = 'white' | 'brown' | 'quail'
type SellMode = 'loose' | 'tray'
type Page = 'pos' | 'history' | 'settings'
type Field = 'qty' | 'rate'

const QUICK_LOOSE = [1, 2, 3, 6, 10, 12, 15]
const QUICK_TRAY = [1, 2, 3, 5]
const QUICK_QUAIL = [1, 2, 3, 5]
const MAX_DIGITS = 4

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = onAuthChange(async (u) => {
      setUser(u)
      if (u) {
        const p = await getProfile(u.id)
        setProfile(p)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="app loading">Loading...</div>
  if (!user || !profile) return <LoginPage />

  return <POS profile={profile} onLogout={() => signOut()} />
}

function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn(username, password)
    } catch (err: any) {
      setError(err.message || 'Login failed')
    }
    setSubmitting(false)
  }

  return (
    <div className="app login-page">
      <div className="login-box">
        <h1>Ganesh Egg Centre</h1>
        <p className="login-subtitle">Login to continue</p>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <div className="password-field">
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}>
              {showPass ? 'Hide' : 'Show'}
            </button>
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={submitting} className="btn-action">
            {submitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

function POS({ profile, onLogout }: { profile: Profile; onLogout: () => void }) {
  const [page, setPage] = useState<Page>('pos')
  const [connected, setConnected] = useState(false)
  const [settings, setSettings] = useState<Settings>(getSettings)

  const [tab, setTab] = useState<EggType>('white')
  const [mode, setMode] = useState<SellMode>('loose')
  const [qty, setQty] = useState('')
  const [rateStr, setRateStr] = useState('')
  const [activeField, setActiveField] = useState<Field>('qty')
  const [printing, setPrinting] = useState(false)
  const [undo, setUndo] = useState<{ bill: Bill; countdown: number } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const isAdmin = profile.role === 'admin'

  const getDefaultRate = () => {
    if (tab === 'quail') return settings.quailBoxRate
    if (mode === 'tray') return tab === 'white' ? settings.whiteTrayRate : settings.brownTrayRate
    return tab === 'white' ? settings.whiteEggRate : settings.brownEggRate
  }

  const rate = Number(rateStr) || getDefaultRate()
  const total = Math.round((Number(qty) || 0) * rate)

  const handleKey = useCallback((key: string) => {
    const current = activeField === 'qty' ? qty : rateStr
    let next: string
    if (key === 'clear') next = ''
    else if (key === 'back') next = current.slice(0, -1)
    else if (key === '.') {
      if (activeField === 'qty') return
      if (current.includes('.')) return
      next = current + '.'
    } else {
      if (current.length >= MAX_DIGITS) return
      next = current + key
    }
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
    try {
      const bill = await saveBill({
        type: tab,
        mode: tab === 'quail' ? 'box' : mode,
        qty: Number(qty) || 0,
        rate,
        total,
      })
      startUndo(bill)

      if (isConnected()) {
        setPrinting(true)
        try {
          await sendData(buildReceipt(bill, settings))
        } catch (e: any) {
          alert('Print failed: ' + e.message)
        }
        setPrinting(false)
      }
    } catch (e: any) {
      alert('Save failed: ' + e.message)
    }

    resetForm()
  }

  const startUndo = (bill: Bill) => {
    if (undoTimer.current) clearInterval(undoTimer.current)
    setUndo({ bill, countdown: 6 })
    undoTimer.current = setInterval(() => {
      setUndo(prev => {
        if (!prev || prev.countdown <= 1) {
          if (undoTimer.current) clearInterval(undoTimer.current)
          return null
        }
        return { ...prev, countdown: prev.countdown - 1 }
      })
    }, 1000)
  }

  const handleUndo = async () => {
    if (undo) {
      try {
        await removeBill(undo.bill.id)
      } catch (_) { /* ignore if delete fails */ }
      setUndo(null)
      if (undoTimer.current) clearInterval(undoTimer.current)
    }
  }

  useEffect(() => {
    return () => { if (undoTimer.current) clearInterval(undoTimer.current) }
  }, [])

  const refreshSettings = () => setSettings(getSettings())

  if (page === 'history') return <History onBack={() => setPage('pos')} settings={settings} isAdmin={isAdmin} />
  if (page === 'settings') return <SettingsPage onBack={() => { refreshSettings(); setPage('pos') }} isAdmin={isAdmin} onLogout={onLogout} />

  const quickValues = tab === 'quail' ? QUICK_QUAIL : mode === 'tray' ? QUICK_TRAY : QUICK_LOOSE
  const unitLabel = tab === 'quail' ? 'Boxes (12 eggs)' : mode === 'tray' ? 'Trays' : 'Eggs'

  return (
    <div className="app">
      <div className="header">
        <h1>{settings.shopName}</h1>
        <button onClick={() => setPage('history')} className="btn-header">Bills</button>
        <button onClick={() => setPage('settings')} className="btn-header btn-settings">⚙</button>
      </div>

      {/* User info + printer */}
      <div className="status-bar">
        <span className="user-badge">{profile.name} ({profile.role})</span>
        {connected ? (
          <button onClick={handleDisconnect} className="printer-status printer-on">Printer ✓</button>
        ) : (
          <button onClick={handleConnect} className="printer-status printer-off">Connect Printer</button>
        )}
      </div>

      {/* Egg type tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'white' ? 'tab-active' : ''}`} onClick={() => handleTabChange('white')}>White</button>
        <button className={`tab ${tab === 'brown' ? 'tab-active' : ''}`} onClick={() => handleTabChange('brown')}>Brown</button>
        <button className={`tab ${tab === 'quail' ? 'tab-active' : ''}`} onClick={() => handleTabChange('quail')}>Kaadai</button>
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
          <button key={v} className={`quick-btn ${qty === v.toString() ? 'quick-btn-active' : ''}`} onClick={() => handleQuick(v)}>{v}</button>
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
        {['1','2','3','4','5','6','7','8','9','.','0','back'].map(key => (
          <button key={key} className={`numkey ${key === '.' ? 'numkey-dot' : ''} ${key === 'back' ? 'numkey-back' : ''}`} onClick={() => handleKey(key)}>
            {key === 'back' ? '←' : key}
          </button>
        ))}
      </div>
      <div className="numpad-bottom">
        <button className="numkey numkey-clear" onClick={() => handleKey('clear')}>Clear</button>
      </div>

      <button onClick={handlePrint} disabled={printing || total === 0} className="btn-action">
        {printing ? 'Printing...' : isConnected() ? 'Print Bill' : 'Save Bill'}
      </button>

      {/* Undo toast */}
      {undo && (
        <div className="undo-toast">
          <span>Bill #{undo.bill.bill_no} saved — ₹{undo.bill.total}</span>
          <button onClick={handleUndo}>Undo ({undo.countdown}s)</button>
        </div>
      )}
    </div>
  )
}

function SettingsPage({ onBack, isAdmin, onLogout }: { onBack: () => void; isAdmin: boolean; onLogout: () => void }) {
  const [s, setS] = useState<Settings>(getSettings())
  const [saved, setSaved] = useState(false)

  const update = (key: keyof Settings, val: string) => {
    const isNum = ['whiteEggRate','whiteTrayRate','brownEggRate','brownTrayRate','quailBoxRate'].includes(key)
    setS({ ...s, [key]: isNum ? (Number(val) || 0) : val })
    setSaved(false)
  }

  const handleSave = () => {
    saveSettings(s)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleExport = async () => {
    const bills = await getBills()
    const csv = exportBillsCSV(bills)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ganesh-egg-bills-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <div className="header">
        <button onClick={onBack} className="btn-header">← Back</button>
        <h1>Settings</h1>
      </div>
      <div className="settings-list">
        {isAdmin && (
          <>
            <div className="setting-group">
              <div className="setting-title">Shop Details</div>
              <div className="setting-row"><label>Shop Name</label><input type="text" value={s.shopName} onChange={e => update('shopName', e.target.value)} /></div>
              <div className="setting-row"><label>Phone (for receipt)</label><input type="tel" value={s.shopPhone} onChange={e => update('shopPhone', e.target.value)} placeholder="98xxxxxxxx" /></div>
            </div>
            <div className="setting-group">
              <div className="setting-title">White Eggs</div>
              <div className="setting-row"><label>Per Egg (₹)</label><input type="number" value={s.whiteEggRate} onChange={e => update('whiteEggRate', e.target.value)} /></div>
              <div className="setting-row"><label>Per Tray (₹)</label><input type="number" value={s.whiteTrayRate} onChange={e => update('whiteTrayRate', e.target.value)} /></div>
            </div>
            <div className="setting-group">
              <div className="setting-title">Brown Eggs</div>
              <div className="setting-row"><label>Per Egg (₹)</label><input type="number" value={s.brownEggRate} onChange={e => update('brownEggRate', e.target.value)} /></div>
              <div className="setting-row"><label>Per Tray (₹)</label><input type="number" value={s.brownTrayRate} onChange={e => update('brownTrayRate', e.target.value)} /></div>
            </div>
            <div className="setting-group">
              <div className="setting-title">Kaadai Eggs</div>
              <div className="setting-row"><label>Per Box - 12 eggs (₹)</label><input type="number" value={s.quailBoxRate} onChange={e => update('quailBoxRate', e.target.value)} /></div>
            </div>
            <div className="setting-group">
              <div className="setting-title">Data</div>
              <button onClick={handleExport} className="btn-export">Download All Bills (CSV)</button>
            </div>
          </>
        )}
        {!isAdmin && (
          <div className="setting-group">
            <p style={{ color: '#888', fontSize: '0.85rem' }}>Only admin can change settings.</p>
          </div>
        )}
      </div>
      {isAdmin && <button onClick={handleSave} className="btn-action btn-save">{saved ? '✓ Saved!' : 'Save Settings'}</button>}
      <button onClick={onLogout} className="btn-action btn-logout">Logout</button>
    </div>
  )
}

function History({ onBack, settings, isAdmin }: { onBack: () => void; settings: Settings; isAdmin: boolean }) {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBills().then(b => { setBills(b); setLoading(false) })
  }, [])

  const todayStr = new Date().toLocaleDateString('en-IN')
  const todayBills = bills.filter(b => new Date(b.created_at).toLocaleDateString('en-IN') === todayStr)

  // Group by date
  const grouped: Record<string, Bill[]> = {}
  bills.forEach(b => {
    const date = new Date(b.created_at).toLocaleDateString('en-IN')
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(b)
  })

  const calcSummary = (dateBills: Bill[]) => {
    let totalEggs = 0
    let totalAmt = 0
    dateBills.forEach(b => {
      totalAmt += b.total
      if (b.mode === 'loose') totalEggs += b.qty
      else if (b.mode === 'tray') totalEggs += b.qty * 30
      else if (b.mode === 'box') totalEggs += b.qty * 12
    })
    return { totalEggs, totalAmt }
  }

  const todaySummary = calcSummary(todayBills)

  const handleReprint = async (bill: Bill) => {
    if (!isConnected()) {
      alert('Connect printer first')
      return
    }
    try {
      await sendData(buildReceipt(bill, settings))
    } catch (e: any) {
      alert('Print failed: ' + e.message)
    }
  }

  if (loading) return <div className="app loading">Loading bills...</div>

  return (
    <div className="app">
      <div className="header">
        <button onClick={onBack} className="btn-header">← Back</button>
        <h1>Bills</h1>
      </div>
      <div className="today-box">
        <div className="today-label">{isAdmin ? "Today's Total (All)" : "Today's Summary"}</div>
        <div className="today-amount">₹{todaySummary.totalAmt}</div>
        <div className="today-stats">
          <span>{todaySummary.totalEggs} eggs sold</span>
          <span>{todayBills.length} bills</span>
        </div>
      </div>
      <div className="bill-list">
        {bills.length === 0 && <p className="empty">No bills yet</p>}
        {Object.entries(grouped).map(([date, dateBills]) => {
          const summary = calcSummary(dateBills)
          return (
          <div key={date} className="bill-group">
            <div className="bill-date-header">
              <span>{date === todayStr ? 'Today' : date}</span>
              <span className="bill-date-summary">{summary.totalEggs} eggs · ₹{summary.totalAmt}</span>
            </div>
            {dateBills.map(b => (
              <div key={b.id} className="bill-row">
                <div className="bill-no">#{b.bill_no}</div>
                <div className="bill-time">{new Date(b.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="bill-info">{b.qty} {b.type} {b.mode}</div>
                <div className="bill-total">₹{b.total}</div>
                <button onClick={() => handleReprint(b)} className="btn-reprint">Print</button>
              </div>
            ))}
          </div>
          )
        })}
      </div>
    </div>
  )
}

export default App
