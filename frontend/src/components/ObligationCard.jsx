import { useState, useEffect, useRef } from 'react'
import { updateObligation } from '../api'
import TransactionForm from './TransactionForm'

const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export default function ObligationCard({ obligation, onSettle, onDelete, onRefresh }) {
  const [showPayment, setShowPayment] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showTransactions, setShowTransactions] = useState(false)
  const [form, setForm] = useState({
    person_name: obligation.person_name,
    total_amount: obligation.total_amount,
    expected_per_cycle: obligation.expected_per_cycle || '',
    note: obligation.note || '',
  })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState(null)
  const menuRef = useRef(null)

  const isActive = obligation.status === 'active'
  const txCount = obligation.transactions.length

  // Close overflow menu on outside click
  useEffect(() => {
    if (!showMenu) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  const handleSave = async () => {
    setEditError(null)

    if (!form.person_name.trim()) {
      setEditError('Person name cannot be empty')
      return
    }

    const totalAmount = Number(form.total_amount)
    if (!totalAmount || totalAmount <= 0) {
      setEditError('Total amount must be greater than 0')
      return
    }

    if (obligation.type === 'recurring' && form.expected_per_cycle !== '') {
      const monthly = Number(form.expected_per_cycle)
      if (monthly > totalAmount) {
        setEditError('Monthly deduction cannot exceed total amount')
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        person_name: form.person_name.trim(),
        total_amount: totalAmount,
        note: form.note || null,
      }
      if (obligation.type === 'recurring' && form.expected_per_cycle !== '') {
        payload.expected_per_cycle = Number(form.expected_per_cycle)
      }
      await updateObligation(obligation.id, payload)
      setEditing(false)
      onRefresh()
    } catch {
      // keep form open on error
    } finally {
      setSaving(false)
    }
  }

  // Build metadata pieces
  const metaParts = []
  if (obligation.type === 'recurring' && obligation.expected_per_cycle) {
    metaParts.push(`${fmt.format(obligation.expected_per_cycle)}/month`)
  }
  metaParts.push(new Date(obligation.created_at).toLocaleDateString('en-IN'))

  return (
    <div className={`border border-gray-200 rounded-lg p-4 bg-white border-l-4 ${
      obligation.direction === 'i_owe' ? 'border-l-orange-400' : 'border-l-green-400'
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 truncate">{obligation.person_name}</h3>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              obligation.type === 'recurring'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {obligation.type === 'recurring' ? 'Recurring' : 'One-time'}
            </span>
          </div>
          {obligation.note && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">{obligation.note}</p>
          )}
        </div>

        <div className="flex items-start gap-2 shrink-0">
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-900">
              {fmt.format(obligation.remaining_amount)}
            </p>
            {obligation.type === 'recurring' && obligation.remaining_amount !== obligation.total_amount && (
              <p className="text-xs text-gray-400">of {fmt.format(obligation.total_amount)}</p>
            )}
          </div>

          {/* Overflow menu */}
          {isActive && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                aria-label="More actions"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10 py-1">
                  <button
                    onClick={() => { onSettle(obligation); setShowMenu(false) }}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Settle
                  </button>
                  <button
                    onClick={() => { setEditing(true); setShowMenu(false); setEditError(null) }}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { onDelete(obligation); setShowMenu(false) }}
                    className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metadata line */}
      <p className="text-xs text-gray-400 mt-1">
        {metaParts.join(' \u00b7 ')}
        {txCount > 0 && (
          <>
            {' \u00b7 '}
            <button
              onClick={() => setShowTransactions(!showTransactions)}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {txCount} payment{txCount !== 1 ? 's' : ''}
            </button>
          </>
        )}
      </p>

      {/* Settled badge */}
      {!isActive && (
        <span className="inline-block text-xs text-green-600 font-medium mt-2">Settled</span>
      )}

      {/* Action buttons */}
      {isActive && obligation.type === 'recurring' && (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setShowPayment(!showPayment)}
            className="text-xs px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
          >
            Record Payment
          </button>
        </div>
      )}

      {/* Inline edit form */}
      {editing && (
        <div className="border-t border-gray-100 mt-3 pt-3 space-y-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Person name</label>
            <input
              value={form.person_name}
              onChange={(e) => setForm({ ...form, person_name: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
              placeholder="Person name"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Total amount</label>
            <input
              type="number"
              value={form.total_amount}
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              placeholder="Total amount"
            />
          </div>
          {obligation.type === 'recurring' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Monthly deduction</label>
              <input
                type="number"
                value={form.expected_per_cycle}
                onChange={(e) => setForm({ ...form, expected_per_cycle: e.target.value })}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                placeholder="Monthly deduction"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Note</label>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
              placeholder="Note"
            />
          </div>
          {editError && <p className="text-xs text-red-600">{editError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 text-xs text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setEditError(null) }}
              className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Inline transaction history */}
      {showTransactions && txCount > 0 && (
        <div className="border-t border-gray-100 mt-3 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Transactions</p>
          <ul className="space-y-1">
            {obligation.transactions.map((tx, i) => (
              <li key={i} className="flex justify-between text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                <span>{fmt.format(tx.amount)}{tx.note ? ` \u2014 ${tx.note}` : ''}</span>
                <span className="text-gray-400">{new Date(tx.paid_at).toLocaleDateString('en-IN')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Inline payment form */}
      {showPayment && isActive && (
        <div className="mt-3">
          <TransactionForm
            obligationId={obligation.id}
            onDone={() => { setShowPayment(false); onRefresh() }}
          />
        </div>
      )}
    </div>
  )
}
