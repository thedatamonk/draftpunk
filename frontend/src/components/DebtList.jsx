import DebtCard from './DebtCard'
import GroupedDebtCard from './GroupedDebtCard'

export default function DebtList({ debts, sortBy, onSettle, onDelete, onRefresh, onAdd, isActive, hasSearch }) {
  if (debts.length === 0) {
    if (hasSearch) {
      return <p className="text-center text-gray-400 py-12">No results matching your search</p>
    }

    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-4xl mb-3">{isActive ? '(  )' : '  '}</p>
        <p className="text-gray-500 font-medium mb-1">
          {isActive ? 'No active dues' : 'No settled dues yet'}
        </p>
        <p className="text-sm text-gray-400 mb-4">
          {isActive ? 'Track money lent, borrowed, or shared expenses' : 'Settled dues will appear here'}
        </p>
        {isActive && (
          <button
            onClick={onAdd}
            className="px-4 py-2 text-sm text-white bg-gray-900 rounded-lg hover:bg-gray-800"
          >
            + Add Split
          </button>
        )}
      </div>
    )
  }

  // Group debts by trxn_id
  const grouped = new Map()
  const ungrouped = []

  for (const debt of debts) {
    if (debt.trxn_id) {
      if (!grouped.has(debt.trxn_id)) {
        grouped.set(debt.trxn_id, [])
      }
      grouped.get(debt.trxn_id).push(debt)
    } else {
      ungrouped.push(debt)
    }
  }

  // Build render items
  const items = []

  for (const debt of ungrouped) {
    items.push({
      type: 'single',
      key: debt.id,
      debt,
      sortDate: new Date(debt.created_at),
      sortAmount: debt.remaining_amount ?? debt.total_amount,
      sortName: debt.person_name.toLowerCase(),
    })
  }

  for (const [trxnId, groupDebts] of grouped) {
    const sortDate = new Date(Math.max(...groupDebts.map(d => new Date(d.created_at).getTime())))
    const sortAmount = groupDebts.reduce((sum, d) => sum + (d.remaining_amount ?? d.total_amount), 0)
    const sortName = groupDebts.map(d => d.person_name).sort()[0].toLowerCase()
    items.push({ type: 'group', key: trxnId, debts: groupDebts, sortDate, sortAmount, sortName })
  }

  // Apply sort
  if (sortBy === 'newest') {
    items.sort((a, b) => b.sortDate - a.sortDate)
  } else if (sortBy === 'amount') {
    items.sort((a, b) => b.sortAmount - a.sortAmount)
  } else if (sortBy === 'name') {
    items.sort((a, b) => a.sortName.localeCompare(b.sortName))
  }

  return (
    <div className="space-y-3">
      {items.map((item) =>
        item.type === 'group' ? (
          <GroupedDebtCard
            key={item.key}
            debts={item.debts}
            onSettle={onSettle}
            onDelete={onDelete}
            onRefresh={onRefresh}
          />
        ) : (
          <DebtCard
            key={item.key}
            debt={item.debt}
            onSettle={onSettle}
            onDelete={onDelete}
            onRefresh={onRefresh}
          />
        )
      )}
    </div>
  )
}
