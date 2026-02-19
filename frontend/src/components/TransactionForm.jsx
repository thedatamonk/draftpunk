import { useState } from 'react'
import { addTransaction } from '../api'

export default function TransactionForm({ obligationId, onDone }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid amount greater than 0')
      return
    }
    if (note.length > 200) {
      setError('Note must be 200 characters or less')
      return
    }
    setSubmitting(true)
    try {
      await addTransaction(obligationId, {
        amount: Number(amount),
        note: note || undefined,
      })
      onDone()
    } catch (err) {
      setError(err.detail || 'Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-gray-50 rounded-md mt-2 space-y-2">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Amount</label>
          <input
            type="number"
            min="1"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Note</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
            maxLength={200}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-1.5 text-sm text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}
