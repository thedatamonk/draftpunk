import ObligationCard from './ObligationCard'
import GroupedObligationCard from './GroupedObligationCard'

export default function ObligationList({ obligations, sortBy, onSettle, onDelete, onRefresh, onAdd, isActive, hasSearch }) {
  if (obligations.length === 0) {
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

  // Group obligations by trxn_id
  const grouped = new Map()
  const ungrouped = []

  for (const ob of obligations) {
    if (ob.trxn_id) {
      if (!grouped.has(ob.trxn_id)) {
        grouped.set(ob.trxn_id, [])
      }
      grouped.get(ob.trxn_id).push(ob)
    } else {
      ungrouped.push(ob)
    }
  }

  // Build render items
  const items = []

  for (const ob of ungrouped) {
    items.push({
      type: 'single',
      key: ob.id,
      obligation: ob,
      sortDate: new Date(ob.created_at),
      sortAmount: ob.remaining_amount ?? ob.total_amount,
      sortName: ob.person_name.toLowerCase(),
    })
  }

  for (const [trxnId, obs] of grouped) {
    const sortDate = new Date(Math.max(...obs.map(o => new Date(o.created_at).getTime())))
    const sortAmount = obs.reduce((sum, o) => sum + (o.remaining_amount ?? o.total_amount), 0)
    const sortName = obs.map(o => o.person_name).sort()[0].toLowerCase()
    items.push({ type: 'group', key: trxnId, obligations: obs, sortDate, sortAmount, sortName })
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
          <GroupedObligationCard
            key={item.key}
            obligations={item.obligations}
            onSettle={onSettle}
            onDelete={onDelete}
            onRefresh={onRefresh}
          />
        ) : (
          <ObligationCard
            key={item.key}
            obligation={item.obligation}
            onSettle={onSettle}
            onDelete={onDelete}
            onRefresh={onRefresh}
          />
        )
      )}
    </div>
  )
}
