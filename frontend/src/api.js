const json = (res) => {
  if (!res.ok) return res.json().then((e) => Promise.reject(e))
  return res.json()
}

export function listObligations(status) {
  const params = status ? `?status=${status}` : ''
  return fetch(`/debts${params}`).then(json)
}

export function getObligation(id) {
  return fetch(`/debts/${id}`).then(json)
}

export function createObligation(data) {
  return fetch('/debts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(json)
}

export function updateObligation(id, data) {
  return fetch(`/debts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(json)
}

export function deleteObligation(id) {
  return fetch(`/debts/${id}`, { method: 'DELETE' }).then(json)
}

export function addTransaction(id, data) {
  return fetch(`/debts/${id}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(json)
}

export function settleObligation(id) {
  return fetch(`/debts/${id}/settle`, { method: 'POST' }).then(json)
}
