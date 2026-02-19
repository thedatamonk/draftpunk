import { useState, useEffect, useCallback, useMemo } from 'react'
import { listObligations } from './api'
import AddObligationForm from './components/AddObligationForm'
import ObligationList from './components/ObligationList'
import ConfirmDialog from './components/ConfirmDialog'
import { settleObligation, deleteObligation } from './api'

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export default function App() {
  const [obligations, setObligations] = useState([])
  const [allActive, setAllActive] = useState([])
  const [activeTab, setActiveTab] = useState('active')
  const [directionFilter, setDirectionFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const fetchObligations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listObligations(activeTab)
      setObligations(data)
      if (activeTab === 'active') setAllActive(data)
    } catch (err) {
      setError(err.detail || 'Failed to load obligations')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  const refreshAll = useCallback(async () => {
    try {
      const [tabData, activeData] = await Promise.all([
        listObligations(activeTab),
        activeTab !== 'active' ? listObligations('active') : Promise.resolve(null),
      ])
      setObligations(tabData)
      if (activeData) setAllActive(activeData)
      else setAllActive(tabData)
    } catch (err) {
      setError(err.detail || 'Failed to load obligations')
    }
  }, [activeTab])

  useEffect(() => {
    fetchObligations()
  }, [fetchObligations])

  useEffect(() => {
    const interval = setInterval(refreshAll, 5000)
    return () => clearInterval(interval)
  }, [refreshAll])

  // Summary stats from allActive
  const stats = useMemo(() => {
    let owedToYou = 0
    let youOwe = 0
    for (const o of allActive) {
      if (o.direction === 'i_owe') youOwe += o.remaining_amount
      else owedToYou += o.remaining_amount
    }
    return { owedToYou, youOwe, net: owedToYou - youOwe }
  }, [allActive])

  const directionFiltered = activeTab === 'active' && directionFilter !== 'all'
    ? obligations.filter((o) =>
        directionFilter === 'i_owe'
          ? o.direction === 'i_owe'
          : o.direction !== 'i_owe'
      )
    : obligations

  const filtered = searchQuery
    ? directionFiltered.filter((o) =>
        o.person_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : directionFiltered

  const handleSettle = (ob) => {
    setConfirm({
      message: `Mark ${ob.person_name}'s dues (${formatINR(ob.remaining_amount)}) as fully settled?`,
      action: async () => {
        await settleObligation(ob.id)
        setConfirm(null)
        refreshAll()
      },
    })
  }

  const handleDelete = (ob) => {
    setConfirm({
      message: `Delete ${ob.person_name}'s dues? This cannot be undone.`,
      action: async () => {
        await deleteObligation(ob.id)
        setConfirm(null)
        refreshAll()
      },
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header with Add button */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" />
              <path d="M8 7h6" />
              <path d="M8 11h4" />
            </svg>
            Splitbook
          </h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 text-sm text-white bg-gray-900 rounded-lg hover:bg-gray-800 flex items-center gap-1.5"
          >
            <span className="text-base leading-none">+</span> Add Split
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5">Track splits and dues</p>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
              <p className="text-xs text-green-600 mb-0.5">Owed to you</p>
              <p className="text-sm font-semibold text-green-800">{formatINR(stats.owedToYou)}</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5">
              <p className="text-xs text-orange-600 mb-0.5">You owe</p>
              <p className="text-sm font-semibold text-orange-800">{formatINR(stats.youOwe)}</p>
            </div>
            <div className={`rounded-lg px-3 py-2.5 border ${
              stats.net >= 0
                ? 'bg-gray-50 border-gray-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <p className="text-xs text-gray-500 mb-0.5">Net balance</p>
              <p className={`text-sm font-semibold ${stats.net >= 0 ? 'text-gray-900' : 'text-red-700'}`}>
                {stats.net >= 0 ? '+' : ''}{formatINR(stats.net)}
              </p>
            </div>
          </div>

        {/* Tabs + Search + Sort */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => { setActiveTab('active'); setDirectionFilter('all') }}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === 'active'
                  ? 'bg-white text-gray-900 shadow-sm font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => { setActiveTab('settled'); setDirectionFilter('all') }}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === 'settled'
                  ? 'bg-white text-gray-900 shadow-sm font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Settled
            </button>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name..."
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            <option value="newest">Newest first</option>
            <option value="amount">Highest amount</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>

        {/* Direction sub-tabs (Active tab only) */}
        {activeTab === 'active' && (
          <div className="flex gap-2 mb-4">
            {[
              { key: 'all', label: 'All' },
              { key: 'owes_me', label: 'They owe me' },
              { key: 'i_owe', label: 'I owe' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setDirectionFilter(key)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  directionFilter === key
                    ? key === 'i_owe'
                      ? 'bg-orange-100 text-orange-700 font-medium'
                      : key === 'owes_me'
                        ? 'bg-green-100 text-green-700 font-medium'
                        : 'bg-gray-200 text-gray-800 font-medium'
                    : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm text-red-600 mb-2">{error}</p>
            <button
              onClick={fetchObligations}
              className="text-sm text-gray-600 underline hover:text-gray-800"
            >
              Retry
            </button>
          </div>
        ) : (
          <ObligationList
            obligations={filtered}
            sortBy={sortBy}
            onSettle={handleSettle}
            onDelete={handleDelete}
            onRefresh={refreshAll}
            onAdd={() => setShowAddForm(true)}
            isActive={activeTab === 'active'}
            hasSearch={!!searchQuery}
          />
        )}
      </div>

      {showAddForm && (
        <AddObligationForm
          onClose={() => setShowAddForm(false)}
          onRefresh={refreshAll}
        />
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.action}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
