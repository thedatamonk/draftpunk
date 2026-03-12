const json = (res) => {
  if (!res.ok) return res.json().then((e) => Promise.reject(e))
  return res.json()
}

export function listDebts(status) {
  const params = status ? `?status=${status}` : ''
  return fetch(`/debts${params}`).then(json)
}

export function getDebt(id) {
  return fetch(`/debts/${id}`).then(json)
}

export function createDebt(data) {
  return fetch('/debts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(json)
}

export function updateDebt(id, data) {
  return fetch(`/debts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(json)
}

export function deleteDebt(id) {
  return fetch(`/debts/${id}`, { method: 'DELETE' }).then(json)
}

export function addTransaction(id, data) {
  return fetch(`/debts/${id}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(json)
}

export function settleDebt(id) {
  return fetch(`/debts/${id}/settle`, { method: 'POST' }).then(json)
}

export function subscribeEvents(onEvent) {
  const source = new EventSource('/events')
  source.onmessage = (e) => {
    onEvent(JSON.parse(e.data))
  }
  source.onerror = () => {
    // Browser auto-reconnects EventSource on error
  }
  return () => source.close()
}
