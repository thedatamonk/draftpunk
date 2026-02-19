import { useState } from 'react'
import { createObligation } from '../api'

export default function AddObligationForm({ onClose, onRefresh }) {
  const [persons, setPersons] = useState([])
  const [personInput, setPersonInput] = useState('')
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState('owes_me')
  const [type, setType] = useState('one_time')
  const [monthlyDeduction, setMonthlyDeduction] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const addPerson = () => {
    const name = personInput.trim()
    if (!name) return
    if (name.length > 50) {
      setError('Person name must be 50 characters or less')
      return
    }
    if (persons.includes(name)) {
      setPersonInput('')
      return
    }
    setPersons([...persons, name])
    setPersonInput('')
    setError(null)
  }

  const removePerson = (index) => {
    setPersons(persons.filter((_, i) => i !== index))
  }

  const handlePersonKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addPerson()
    }
    if (e.key === 'Backspace' && personInput === '' && persons.length > 0) {
      setPersons(persons.slice(0, -1))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    // Add any pending input as a person
    const pendingName = personInput.trim()
    let names = [...persons]
    if (pendingName && !names.includes(pendingName)) {
      if (pendingName.length > 50) {
        setError('Person name must be 50 characters or less')
        return
      }
      names.push(pendingName)
    }

    if (names.length === 0) {
      setError('Enter at least one person name')
      return
    }

    const totalAmount = parseFloat(amount)
    if (!totalAmount || totalAmount <= 0) {
      setError('Enter a valid amount greater than 0')
      return
    }

    if (type === 'recurring') {
      const monthly = parseFloat(monthlyDeduction)
      if (!monthly || monthly <= 0) {
        setError('Enter a valid monthly deduction amount')
        return
      }
      if (monthly > totalAmount) {
        setError('Monthly deduction cannot exceed total amount')
        return
      }
    }

    if (note.length > 200) {
      setError('Note must be 200 characters or less')
      return
    }

    setLoading(true)
    try {
      const perPerson = totalAmount / names.length
      const trxn_id = names.length > 1 ? crypto.randomUUID() : undefined

      for (const name of names) {
        await createObligation({
          person_name: name,
          type,
          direction,
          total_amount: perPerson,
          expected_per_cycle: type === 'recurring' ? parseFloat(monthlyDeduction) : undefined,
          note: note.trim() || undefined,
          trxn_id,
        })
      }

      onRefresh()
      onClose()
    } catch (err) {
      setError(err.detail || 'Failed to create split')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Add Split</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Person names — chip input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Person name(s)</label>
            <div className="w-full min-h-[38px] px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-gray-300 flex flex-wrap items-center gap-1.5">
              {persons.map((name, i) => (
                <span
                  key={i}
                  className="bg-gray-100 text-gray-700 text-sm px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => removePerson(i)}
                    className="text-gray-400 hover:text-gray-600 text-sm leading-none"
                  >
                    &times;
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={personInput}
                onChange={(e) => setPersonInput(e.target.value)}
                onKeyDown={handlePersonKeyDown}
                onBlur={addPerson}
                placeholder={persons.length === 0 ? 'e.g. Rahul' : ''}
                className="flex-1 min-w-[80px] outline-none bg-transparent py-0.5"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Press Enter to add each person</p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="0"
              step="any"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>

          {/* Direction toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setDirection('owes_me')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  direction === 'owes_me'
                    ? 'bg-white text-green-700 shadow-sm font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                They owe me
              </button>
              <button
                type="button"
                onClick={() => setDirection('i_owe')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  direction === 'i_owe'
                    ? 'bg-white text-orange-700 shadow-sm font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                I owe them
              </button>
            </div>
          </div>

          {/* Type toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setType('one_time')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  type === 'one_time'
                    ? 'bg-white text-gray-900 shadow-sm font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                One-time
              </button>
              <button
                type="button"
                onClick={() => setType('recurring')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  type === 'recurring'
                    ? 'bg-white text-gray-900 shadow-sm font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Recurring
              </button>
            </div>
          </div>

          {/* Monthly deduction (conditional) */}
          {type === 'recurring' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly deduction</label>
              <input
                type="number"
                value={monthlyDeduction}
                onChange={(e) => setMonthlyDeduction(e.target.value)}
                placeholder="0"
                min="0"
                step="any"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Dinner at Truffles"
              maxLength={200}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Split'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
