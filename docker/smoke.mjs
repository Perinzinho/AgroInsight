// Run from the repository root: docker compose exec -T api node --input-type=module < docker/smoke.mjs
import assert from 'node:assert/strict'

const request = (path, options = {}) => fetch(`http://web${path}`, {
  ...options,
  headers: { Host: 'localhost', ...options.headers },
  signal: AbortSignal.timeout(10000),
})

const page = await request('/')
assert.equal(page.status, 200)
const html = await page.text()
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map((match) => match[1])
assert.ok(assets.length > 0, 'Built frontend assets must exist')
for (const asset of assets) assert.equal((await request(asset)).status, 200)
assert.equal((await request('/data/missing.json')).status, 404)
assert.equal((await request('/.env')).status, 404)

const manifest = await request('/data/manifest.json')
assert.equal(manifest.headers.get('cache-control'), 'no-store')
const dataset = await manifest.json()
const status = await request('/api/ai/status', { headers: { Origin: 'http://localhost:5174' } })
assert.equal(status.status, 200)
const availability = await status.json()
assert.equal(availability.dataReady, true)
assert.equal(availability.datasetVersion, dataset.generatedAt)

assert.equal((await request('/api/ai/status', { headers: { Origin: 'https://external.example' } })).status, 403)
assert.equal((await request('/api/ai/status', { headers: { Host: 'external.example' } })).status, 403)
const post = (body) => request('/api/ai/assist', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
assert.equal((await post({})).status, 400)
const body = { mode: 'analysis', filters: { from: '2026-02-19', to: '2026-02-25', trapCodes: [], pestKeys: [] },
  datasetVersion: 'outdated-smoke-test', history: [] }
assert.equal((await post(body)).status, 409)
assert.equal((await post({ content: 'x'.repeat(65536) })).status, 413)
if (!availability.configured) {
  const response = await post({ ...body, datasetVersion: availability.datasetVersion })
  assert.equal(response.status, 503)
  assert.equal((await response.json()).error.code, 'AI_NOT_CONFIGURED')
}
console.log('OK: frontend, assets, dataset, API proxy, host/origin validation, request limits and dataset version. No provider calls.')
