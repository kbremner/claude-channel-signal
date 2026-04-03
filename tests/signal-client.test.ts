import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert'
import { SignalClient } from '../src/signal-client.ts'

describe('SignalClient', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('sendMessage', () => {
    let client: SignalClient

    beforeEach(() => {
      client = new SignalClient('http://localhost:8080', '+441234567890')
    })

    it('sends a message to a group via POST /v2/send', async () => {
      const fetchMock = mock.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ timestamp: '1234567890' }), { status: 201 }))
      )
      globalThis.fetch = fetchMock as typeof fetch

      await client.sendMessage('group.abc123', 'Hello world')

      assert.strictEqual(fetchMock.mock.callCount(), 1)
      const [url, options] = fetchMock.mock.calls[0].arguments as unknown as [string, RequestInit]
      assert.strictEqual(url, 'http://localhost:8080/v2/send')
      assert.strictEqual(options.method, 'POST')

      const body = JSON.parse(options.body as string)
      assert.strictEqual(body.number, '+441234567890')
      assert.deepStrictEqual(body.recipients, ['group.abc123'])
      assert.strictEqual(body.message, 'Hello world')
    })

    it('prepends reply prefix when provided', async () => {
      const fetchMock = mock.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ timestamp: '1234567890' }), { status: 201 }))
      )
      globalThis.fetch = fetchMock as typeof fetch

      await client.sendMessage('group.abc123', 'Hello world', '[Bot]')

      const body = JSON.parse((fetchMock.mock.calls[0].arguments as unknown as [string, RequestInit])[1].body as string)
      assert.strictEqual(body.message, '[Bot] Hello world')
    })

    it('throws on non-201 response', async () => {
      globalThis.fetch = mock.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ error: 'bad' }), { status: 400 }))
      ) as typeof fetch

      await assert.rejects(() => client.sendMessage('group.abc123', 'Hello'))
    })
  })

  describe('sendReaction', () => {
    let client: SignalClient

    beforeEach(() => {
      client = new SignalClient('http://localhost:8080', '+441234567890')
    })

    it('sends a reaction via POST /v1/reactions/{number}', async () => {
      const fetchMock = mock.fn(() =>
        Promise.resolve(new Response(null, { status: 204 }))
      )
      globalThis.fetch = fetchMock as typeof fetch

      await client.sendReaction('group.abc123', '👍', '+449876543210', 1234567890)

      assert.strictEqual(fetchMock.mock.callCount(), 1)
      const [url, options] = fetchMock.mock.calls[0].arguments as unknown as [string, RequestInit]
      assert.strictEqual(url, 'http://localhost:8080/v1/reactions/+441234567890')
      assert.strictEqual(options.method, 'POST')

      const body = JSON.parse(options.body as string)
      assert.strictEqual(body.reaction, '👍')
      assert.strictEqual(body.recipient, 'group.abc123')
      assert.strictEqual(body.target_author, '+449876543210')
      assert.strictEqual(body.timestamp, 1234567890)
    })
  })

  describe('listGroups', () => {
    let client: SignalClient

    beforeEach(() => {
      client = new SignalClient('http://localhost:8080', '+441234567890')
    })

    it('fetches groups from GET /v1/groups/{number}', async () => {
      const groups = [
        { id: 'group.abc', internal_id: 'rawAbc', name: 'Budget', members: ['+441234567890'] },
        { id: 'group.def', internal_id: 'rawDef', name: 'Home', members: ['+441234567890'] },
      ]
      const fetchMock = mock.fn(() =>
        Promise.resolve(new Response(JSON.stringify(groups), { status: 200 }))
      )
      globalThis.fetch = fetchMock as typeof fetch

      const result = await client.listGroups()

      assert.deepStrictEqual(result, groups)
      assert.strictEqual(
        (fetchMock.mock.calls[0].arguments as unknown as [string])[0],
        'http://localhost:8080/v1/groups/+441234567890'
      )
    })
  })
})
