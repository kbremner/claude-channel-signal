export interface GroupConfig {
  id: string          // REST API format: "group.<double-base64>" — used for POST /v2/send
  internalId: string  // signal-cli format: raw base64 — matches groupInfo.groupId in received messages
  name: string
  replyPrefix: string
}

export interface Config {
  baseUrl: string
  accountNumber: string
  groups: GroupConfig[]
}

export function loadConfig(): Config {
  const baseUrl = process.env.SIGNAL_BASE_URL ?? 'http://localhost:8080'
  const accountNumber = process.env.SIGNAL_ACCOUNT ?? ''

  const groupsJson = process.env.SIGNAL_GROUPS
  let groups: GroupConfig[] = []
  if (groupsJson) {
    groups = JSON.parse(groupsJson)
  }

  return { baseUrl, accountNumber, groups }
}
