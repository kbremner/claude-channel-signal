import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const CONFIG_DIR = join(homedir(), '.claude', 'channels', 'signal')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

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

const DEFAULT_CONFIG: Config = {
  baseUrl: 'http://localhost:8080',
  accountNumber: '',
  groups: [],
}

export async function loadConfig(): Promise<Config> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n')
}

export function getConfigDir(): string {
  return CONFIG_DIR
}
