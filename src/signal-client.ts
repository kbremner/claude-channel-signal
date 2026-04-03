import WebSocket from 'ws'

export interface SignalGroup {
  id: string
  internal_id: string
  name: string
  members: string[]
}

// In json-rpc mode, /v1/receive/{number} is a WebSocket endpoint.
// Messages are the `params` from signal-cli's JSON-RPC `receive`
// notification, which wraps the envelope:
// {"envelope": {"source": "...", "dataMessage": {...}}, "account": "..."}
// The REST API sends this `params` object as-is over the WebSocket.
//
// Group IDs in received messages (dataMessage.groupInfo.groupId) are raw
// base64 (e.g. "/rVuoI8GTZr..."). The REST API's own endpoints use a
// double-encoded format: "group." + base64(raw_id). Config stores both
// formats: `id` for outbound (POST /v2/send) and `internalId` for
// matching inbound messages.

export interface SignalEnvelope {
  source: string
  sourceNumber: string
  sourceName: string
  dataMessage?: {
    message: string
    timestamp: number
    groupInfo?: { groupId: string; groupName: string }
  }
  syncMessage?: {
    sentMessage?: {
      message: string
      timestamp: number
      groupInfo?: { groupId: string; groupName: string }
      destination?: string | null
    }
  }
}

interface WebSocketMessage {
  envelope: SignalEnvelope
  account?: string
}

type MessageHandler = (envelope: SignalEnvelope) => void

export class SignalClient {
  private baseUrl: string
  private accountNumber: string
  private ws: WebSocket | null = null
  private messageHandler: MessageHandler | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(baseUrl: string, accountNumber: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.accountNumber = accountNumber
  }

  async sendMessage(recipient: string, text: string, prefix?: string): Promise<void> {
    const message = prefix ? `${prefix} ${text}` : text
    const response = await fetch(`${this.baseUrl}/v2/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: this.accountNumber,
        recipients: [recipient],
        message,
      }),
    })
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to send message: ${response.status} ${error}`)
    }
  }

  async sendReaction(
    recipient: string,
    emoji: string,
    targetAuthor: string,
    timestamp: number
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v1/reactions/${this.accountNumber}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reaction: emoji,
        recipient,
        target_author: targetAuthor,
        timestamp,
      }),
    })
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to send reaction: ${response.status} ${error}`)
    }
  }

  async listGroups(): Promise<SignalGroup[]> {
    const response = await fetch(
      `${this.baseUrl}/v1/groups/${this.accountNumber}`
    )
    if (!response.ok) {
      throw new Error(`Failed to list groups: ${response.status}`)
    }
    return response.json()
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  connect(): void {
    const wsUrl = `${this.baseUrl.replace(/^http/, 'ws')}/v1/receive/${this.accountNumber}`
    this.ws = new WebSocket(wsUrl)

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as WebSocketMessage
        if (!msg.envelope) return
        this.messageHandler?.(msg.envelope)
      } catch {
        // ignore unparseable messages
      }
    })

    this.ws.on('close', () => {
      this.scheduleReconnect()
    })

    this.ws.on('error', () => {
      this.ws?.close()
    })
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 5000)
  }
}
