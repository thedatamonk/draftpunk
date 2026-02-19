import { useState, useEffect, useRef } from 'react'
import { updateObligation } from '../api'
import TransactionForm from './TransactionForm'

const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

const avatarColors = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
]

function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

export default function GroupedObligationCard({ obligations, onSettle, onDelete, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [payingId, setPayingId] = useState(null)
  const [menuId, setMenuId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [showTransactionsId, setShowTransactionsId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState(null)
  const menuRef = useRef(null)

  const first = obligations[0]
  const note = first.note
  const direction = first.direction
  const type = first.type
  const createdAt = first.created_at

  const totalRemaining = obligations.reduce((sum, o) => sum + o.remaining_amount, 0)
  const totalAmount = obligations.reduce((sum, o) => sum + o.total_amount, 0)

  // Close overflow menu on outside click
  useEffect(() => {
    if (menuId === null) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuId])

  const startEditing = (ob) => {
    setEditingId(ob.id)
    setEditForm({
      person_name: ob.person_name,
      total_amount: ob.total_amount,
      expected_per_cycle: ob.expected_per_cycle || '',
      note: ob.note || '',
    })
    setEditError(null)
    setMenuId(null)
  }

  const handleSave = async (obId) => {
    setEditError(null)

    if (!editForm.person_name.trim()) {
      setEditError('Person name cannot be empty')
      return
    }

    const totalAmt = Number(editForm.total_amount)
    if (!totalAmt || totalAmt <= 0) {
      setEditError('Total amount must be greater than 0')
      return
    }

    const ob = obligations.find(o => o.id === obId)
    if (ob?.type === 'recurring' && editForm.expected_per_cycle !== '') {
      const monthly = Number(editForm.expected_per_cycle)
      if (monthly > totalAmt) {
        setEditError('Monthly deduction cannot exceed total amount')
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        person_name: editForm.person_name.trim(),
        total_amount: totalAmt,
        note: editForm.note || null,
      }
      if (ob?.type === 'recurring' && editForm.expected_per_cycle !== '') {
        payload.expected_per_cycle = Number(editForm.expected_per_cycle)
      }
      await updateObligation(obId, payload)
      setEditingId(null)
      onRefresh()
    } catch {
      // keep form open on error
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`border border-gray-200 rounded-lg bg-white border-l-4 ${
      direction === 'i_owe' ? 'border-l-orange-400' : 'border-l-green-400'
    }`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start justify-between gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 truncate">
              {note || 'Split expense'}
            </h3>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              type === 'recurring'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {type === 'recurring' ? 'Recurring' : 'One-time'}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {obligations.length} people
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(createdAt).toLocaleDateString('en-IN')}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-900">
              {fmt.format(totalRemaining)}
            </p>
            {type === 'recurring' && totalRemaining !== totalAmount && (
              <p className="text-xs text-gray-400">of {fmt.format(totalAmount)}</p>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Person rows (expanded) */}
      {expanded && (
        <div className="border-t border-gray-100">
          {obligations.map((ob) => {
            const isSettled = ob.status === 'settled'
            const isPayingThis = payingId === ob.id
            const isMenuOpen = menuId === ob.id
            const isEditing = editingId === ob.id
            const isShowingTx = showTransactionsId === ob.id
            const txCount = ob.transactions.length

            // Build per-person metadata
            const metaParts = []
            if (ob.type === 'recurring' && ob.expected_per_cycle) {
              metaParts.push(`${fmt.format(ob.expected_per_cycle)}/month`)
            }

            return (
              <div key={ob.id} className={`px-4 py-3 border-b border-gray-50 last:border-b-0 ${isSettled ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 ${getAvatarColor(ob.person_name)}`}>
                    {ob.person_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + metadata */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ob.person_name}</p>
                    <p className="text-xs text-gray-400">
                      {metaParts.length > 0 && metaParts.join(' \u00b7 ')}
                      {metaParts.length > 0 && txCount > 0 && ' \u00b7 '}
                      {txCount > 0 && (
                        <button
                          onClick={() => setShowTransactionsId(isShowingTx ? null : ob.id)}
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          {txCount} payment{txCount !== 1 ? 's' : ''}
                        </button>
                      )}
                    </p>
                  </div>

                  {/* Amount + overflow menu */}
                  <div className="flex items-start gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {fmt.format(ob.remaining_amount)}
                      </p>
                      {ob.type === 'recurring' && ob.remaining_amount !== ob.total_amount && (
                        <p className="text-[10px] text-gray-400">of {fmt.format(ob.total_amount)}</p>
                      )}
                    </div>

                    {!isSettled && (
                      <div className="relative" ref={isMenuOpen ? menuRef : undefined}>
                        <button
                          onClick={() => setMenuId(isMenuOpen ? null : ob.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                          aria-label="More actions"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        {isMenuOpen && (
                          <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10 py-1">
                            <button
                              onClick={() => { onSettle(ob); setMenuId(null) }}
                              className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Settle
                            </button>
                            <button
                              onClick={() => startEditing(ob)}
                              className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => { onDelete(ob); setMenuId(null) }}
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

                {/* Per-person action buttons */}
                {!isSettled && ob.type === 'recurring' && (
                  <div className="flex items-center gap-2 mt-2 ml-11">
                    <button
                      onClick={() => setPayingId(isPayingThis ? null : ob.id)}
                      className="text-xs px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
                    >
                      Record Payment
                    </button>
                  </div>
                )}

                {isSettled && (
                  <span className="inline-block text-xs text-green-600 font-medium mt-2 ml-11">Settled</span>
                )}

                {/* Inline edit form */}
                {isEditing && (
                  <div className="ml-11 mt-2 space-y-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Person name</label>
                      <input
                        value={editForm.person_name}
                        onChange={(e) => setEditForm({ ...editForm, person_name: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                        placeholder="Person name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Total amount</label>
                      <input
                        type="number"
                        value={editForm.total_amount}
                        onChange={(e) => setEditForm({ ...editForm, total_amount: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="Total amount"
                      />
                    </div>
                    {ob.type === 'recurring' && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Monthly deduction</label>
                        <input
                          type="number"
                          value={editForm.expected_per_cycle}
                          onChange={(e) => setEditForm({ ...editForm, expected_per_cycle: e.target.value })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          placeholder="Monthly deduction"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Note</label>
                      <input
                        value={editForm.note}
                        onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                        placeholder="Note"
                      />
                    </div>
                    {editError && <p className="text-xs text-red-600">{editError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(ob.id)}
                        disabled={saving}
                        className="px-3 py-1 text-xs text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditError(null) }}
                        className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline transaction history */}
                {isShowingTx && txCount > 0 && (
                  <div className="ml-11 mt-2">
                    <p className="text-xs font-medium text-gray-500 mb-1">Transactions</p>
                    <ul className="space-y-1">
                      {ob.transactions.map((tx, i) => (
                        <li key={i} className="flex justify-between text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                          <span>{fmt.format(tx.amount)}{tx.note ? ` \u2014 ${tx.note}` : ''}</span>
                          <span className="text-gray-400">{new Date(tx.paid_at).toLocaleDateString('en-IN')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Inline payment form */}
                {isPayingThis && (
                  <div className="ml-11 mt-2">
                    <TransactionForm
                      obligationId={ob.id}
                      onDone={() => { setPayingId(null); onRefresh() }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
