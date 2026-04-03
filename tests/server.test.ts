import { describe, it, expect, mock } from 'bun:test'
import { routeInboundMessage, type RouteContext } from '../src/server'
import type { SignalEnvelope } from '../src/signal-client'
import type { GroupConfig } from '../src/config'

function makeCtx(overrides?: Partial<RouteContext>): RouteContext {
  return {
    allowedGroups: new Map<string, GroupConfig>([
      ['rawBase64Id', { id: 'group.abc', internalId: 'rawBase64Id', name: 'Budget', replyPrefix: '[Bot]' }],
    ]),
    notify: mock(() => Promise.resolve()),
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

    expect(ctx.notify).toHaveBeenCalledTimes(1)
    const call = (ctx.notify as ReturnType<typeof mock>).mock.calls[0][0] as any
    expect(call.params.content).toBe('how much on groceries?')
    expect(call.params.meta.sender_name).toBe('Kyle')
    expect(call.params.meta.sender_number).toBe('+441234567890')
    expect(call.params.meta.group_name).toBe('Budget')
    expect(call.params.meta.group_id).toBe('group.abc')
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

    expect(ctx.notify).toHaveBeenCalledTimes(1)
    const call = (ctx.notify as ReturnType<typeof mock>).mock.calls[0][0] as any
    expect(call.params.content).toBe('a message I sent')
    expect(call.params.meta.sender_name).toBe('Kyle')
    expect(call.params.meta.group_id).toBe('group.abc')
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

    expect(ctx.notify).not.toHaveBeenCalled()
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

    expect(ctx.notify).not.toHaveBeenCalled()
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

    expect(ctx.notify).not.toHaveBeenCalled()
  })

  it('ignores envelopes with no dataMessage or syncMessage', async () => {
    const ctx = makeCtx()

    await routeInboundMessage(ctx, {
      source: '+441234567890',
      sourceNumber: '+441234567890',
      sourceName: 'Kyle',
    } as SignalEnvelope)

    expect(ctx.notify).not.toHaveBeenCalled()
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

    expect(ctx.notify).toHaveBeenCalledTimes(1)
    const call = (ctx.notify as ReturnType<typeof mock>).mock.calls[0][0] as any
    expect(call.params.content).toBe('from dataMessage')
    expect(call.params.meta.timestamp).toBe('111')
  })
})

describe('permission reply detection', () => {
  it('routeInboundMessage forwards permission-like messages (interception is in main)', async () => {
    const ctx = makeCtx()

    // "yes abcde" looks like a permission reply, but routeInboundMessage
    // doesn't know about permissions — it forwards as a normal message.
    // The interception happens in main() onMessage before routeInboundMessage.
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

    expect(ctx.notify).toHaveBeenCalledTimes(1)
  })
})
