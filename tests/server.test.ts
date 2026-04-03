import { describe, it, mock } from 'node:test'
import assert from 'node:assert'
import { routeInboundMessage, type RouteContext } from '../src/server.ts'
import type { SignalEnvelope } from '../src/signal-client.ts'
import type { GroupConfig } from '../src/config.ts'

function makeCtx(overrides?: Partial<RouteContext>): RouteContext {
  return {
    allowedGroups: new Map<string, GroupConfig>([
      ['rawBase64Id', { id: 'group.abc', internalId: 'rawBase64Id', name: 'Budget', replyPrefix: '[Bot]' }],
    ]),
    notify: mock.fn(() => Promise.resolve()),
    ...overrides,
  }
}

describe('routeInboundMessage', () => {
  it('forwards group dataMessages as channel notifications', async () => {
    const ctx = makeCtx()

    await routeInboundMessage(ctx, {
      source: '+441234567890',
      sourceNumber: '+441234567890',
      sourceName: 'Kyle',
      dataMessage: {
        message: 'how much on groceries?',
        timestamp: 1234567890,
        groupInfo: { groupId: 'rawBase64Id', groupName: 'Budget' },
      },
    })

    const notifyMock = ctx.notify as unknown as ReturnType<typeof mock.fn>
    assert.strictEqual(notifyMock.mock.callCount(), 1)
    const call = notifyMock.mock.calls[0].arguments[0] as any
    assert.strictEqual(call.params.content, 'how much on groceries?')
    assert.strictEqual(call.params.meta.sender_name, 'Kyle')
    assert.strictEqual(call.params.meta.sender_number, '+441234567890')
    assert.strictEqual(call.params.meta.group_name, 'Budget')
    assert.strictEqual(call.params.meta.group_id, 'group.abc')
  })

  it('forwards sync group messages as channel notifications', async () => {
    const ctx = makeCtx()

    await routeInboundMessage(ctx, {
      source: '+441234567890',
      sourceNumber: '+441234567890',
      sourceName: 'Kyle',
      syncMessage: {
        sentMessage: {
          message: 'a message I sent',
          timestamp: 1234567890,
          groupInfo: { groupId: 'rawBase64Id', groupName: 'Budget' },
        },
      },
    })

    const notifyMock = ctx.notify as unknown as ReturnType<typeof mock.fn>
    assert.strictEqual(notifyMock.mock.callCount(), 1)
    const call = notifyMock.mock.calls[0].arguments[0] as any
    assert.strictEqual(call.params.content, 'a message I sent')
    assert.strictEqual(call.params.meta.sender_name, 'Kyle')
    assert.strictEqual(call.params.meta.group_id, 'group.abc')
  })

  it('drops messages from non-configured groups', async () => {
    const ctx = makeCtx()

    await routeInboundMessage(ctx, {
      source: '+441234567890',
      sourceNumber: '+441234567890',
      sourceName: 'Kyle',
      dataMessage: {
        message: 'hello',
        timestamp: 1234567890,
        groupInfo: { groupId: 'unknownGroupId', groupName: 'Other' },
      },
    })

    assert.strictEqual((ctx.notify as unknown as ReturnType<typeof mock.fn>).mock.callCount(), 0)
  })

  it('ignores messages without text content', async () => {
    const ctx = makeCtx()

    await routeInboundMessage(ctx, {
      source: '+441234567890',
      sourceNumber: '+441234567890',
      sourceName: 'Kyle',
      dataMessage: {
        message: '',
        timestamp: 1234567890,
        groupInfo: { groupId: 'rawBase64Id', groupName: 'Budget' },
      },
    })

    assert.strictEqual((ctx.notify as unknown as ReturnType<typeof mock.fn>).mock.callCount(), 0)
  })

  it('ignores sync messages without group info (DMs)', async () => {
    const ctx = makeCtx()

    await routeInboundMessage(ctx, {
      source: '+441234567890',
      sourceNumber: '+441234567890',
      sourceName: 'Kyle',
      syncMessage: {
        sentMessage: {
          message: 'a DM I sent',
          timestamp: 1234567890,
        },
      },
    })

    assert.strictEqual((ctx.notify as unknown as ReturnType<typeof mock.fn>).mock.callCount(), 0)
  })

  it('ignores envelopes with no dataMessage or syncMessage', async () => {
    const ctx = makeCtx()

    await routeInboundMessage(ctx, {
      source: '+441234567890',
      sourceNumber: '+441234567890',
      sourceName: 'Kyle',
    } as SignalEnvelope)

    assert.strictEqual((ctx.notify as unknown as ReturnType<typeof mock.fn>).mock.callCount(), 0)
  })

  it('prefers dataMessage over syncMessage when both present', async () => {
    const ctx = makeCtx()

    await routeInboundMessage(ctx, {
      source: '+441234567890',
      sourceNumber: '+441234567890',
      sourceName: 'Kyle',
      dataMessage: {
        message: 'from dataMessage',
        timestamp: 111,
        groupInfo: { groupId: 'rawBase64Id', groupName: 'Budget' },
      },
      syncMessage: {
        sentMessage: {
          message: 'from syncMessage',
          timestamp: 222,
          groupInfo: { groupId: 'rawBase64Id', groupName: 'Budget' },
        },
      },
    })

    const notifyMock = ctx.notify as unknown as ReturnType<typeof mock.fn>
    assert.strictEqual(notifyMock.mock.callCount(), 1)
    const call = notifyMock.mock.calls[0].arguments[0] as any
    assert.strictEqual(call.params.content, 'from dataMessage')
    assert.strictEqual(call.params.meta.timestamp, '111')
  })
})

describe('permission reply detection', () => {
  it('routeInboundMessage forwards permission-like messages (interception is in main)', async () => {
    const ctx = makeCtx()

    await routeInboundMessage(ctx, {
      source: '+441234567890',
      sourceNumber: '+441234567890',
      sourceName: 'Kyle',
      dataMessage: {
        message: 'yes abcde',
        timestamp: 1234567890,
        groupInfo: { groupId: 'rawBase64Id', groupName: 'Budget' },
      },
    })

    assert.strictEqual((ctx.notify as unknown as ReturnType<typeof mock.fn>).mock.callCount(), 1)
  })
})
