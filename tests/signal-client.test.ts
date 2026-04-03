import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { SignalClient } from '../src/signal-client'

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
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ timestamp: '1234567890' }), { status: 201 }))
      )
      globalThis.fetch = fetchMock as typeof fetch

      await client.sendMessage('group.abc123', 'Hello world')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('http://localhost:8080/v2/send')
      expect(options.method).toBe('POST')

      const body = JSON.parse(options.body as string)
      expect(body.number).toBe('+441234567890')
      expect(body.recipients).toEqual(['group.abc123'])
      expect(body.message).toBe('Hello world')
    })

    it('prepends reply prefix when provided', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ timestamp: '1234567890' }), { status: 201 }))
      )
      globalThis.fetch = fetchMock as typeof fetch

      await client.sendMessage('group.abc123', 'Hello world', '[Bot]')

      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)
      expect(body.message).toBe('[Bot] Hello world')
    })

    it('throws on non-201 response', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ error: 'bad' }), { status: 400 }))
      ) as typeof fetch

      expect(client.sendMessage('group.abc123', 'Hello')).rejects.toThrow()
    })
  })

  describe('sendReaction', () => {
    let client: SignalClient

    beforeEach(() => {
      client = new SignalClient('http://localhost:8080', '+441234567890')
    })

    it('sends a reaction via POST /v1/reactions/{number}', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response('', { status: 204 }))
      )
      globalThis.fetch = fetchMock as typeof fetch

      await client.sendReaction('group.abc123', '👍', '+449876543210', 1234567890)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('http://localhost:8080/v1/reactions/+441234567890')
      expect(options.method).toBe('POST')

      const body = JSON.parse(options.body as string)
      expect(body.reaction).toBe('👍')
      expect(body.recipient).toBe('group.abc123')
      expect(body.target_author).toBe('+449876543210')
      expect(body.timestamp).toBe(1234567890)
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
      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify(groups), { status: 200 }))
      )
      globalThis.fetch = fetchMock as typeof fetch

      const result = await client.listGroups()

      expect(result).toEqual(groups)
      expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
        'http://localhost:8080/v1/groups/+441234567890'
      )
    })
  })
})
