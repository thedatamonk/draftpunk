const json = (res) => {
  if (!res.ok) return res.json().then((e) => Promise.reject(e))
  return res.json()
}

export function parseMessage(message) {
  return fetch('/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  }).then(json)
}

export function listObligations(status) {
  const params = status ? `?status=${status}` : ''
  return fetch(`/obligations${params}`).then(json)
}

export function getObligation(id) {
  return fetch(`/obligations/${id}`).then(json)
}

export function createObligation(data) {
  return fetch('/obligations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(json)
}

export function updateObligation(id, data) {
  return fetch(`/obligations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(json)
}

export function deleteObligation(id) {
  return fetch(`/obligations/${id}`, { method: 'DELETE' }).then(json)
}

export function addTransaction(id, data) {
  return fetch(`/obligations/${id}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(json)
}

export function settleObligation(id) {
  return fetch(`/obligations/${id}/settle`, { method: 'POST' }).then(json)
}
