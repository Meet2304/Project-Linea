import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { StringDecoder } from 'node:string_decoder'
import type { ApiResult, PlayerCommandRequest, PlayerErrorReason } from '../shared/types'
import { parseSessions, type MediaSession } from './smtcState'

const REASONS = new Set<PlayerErrorReason>([
  'source_unavailable',
  'session_unavailable',
  'unsupported_command',
  'command_rejected',
  'timeout',
  'invalid_request'
])
export class SmtcBridge extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null
  private stopped = true
  private ready = false
  private epoch = 0
  private id = 0
  private failures = 0
  private restart: ReturnType<typeof setTimeout> | null = null
  private startup: ReturnType<typeof setTimeout> | null = null
  private pending = new Map<
    number,
    { resolve: (r: ApiResult<unknown>) => void; timer: ReturnType<typeof setTimeout> }
  >()
  constructor(private readonly path: string) {
    super()
  }
  start(): void {
    if (!this.stopped) return
    this.stopped = false
    this.launch()
  }
  stop(): void {
    this.stopped = true
    if (this.restart) clearTimeout(this.restart)
    this.restart = null
    this.disconnect('source_unavailable')
  }
  resume(): void {
    if (this.stopped) return
    this.disconnect('source_unavailable')
    if (this.restart) clearTimeout(this.restart)
    this.restart = null
    this.launch()
  }
  private disconnect(reason: PlayerErrorReason): void {
    if (this.startup) clearTimeout(this.startup)
    this.startup = null
    this.ready = false
    const child = this.child
    this.child = null
    child?.stdin.end()
    child?.kill()
    for (const p of this.pending.values()) {
      clearTimeout(p.timer)
      p.resolve({ ok: false, reason })
    }
    this.pending.clear()
  }
  private fail(reason: PlayerErrorReason): void {
    this.disconnect(reason)
    if (this.stopped || this.restart) return
    this.emit('unavailable')
    const delay = [1000, 5000, 30000][Math.min(this.failures++, 2)]
    this.restart = setTimeout(() => {
      this.restart = null
      this.launch()
    }, delay)
  }
  private launch(): void {
    if (this.stopped || this.child) return
    const child = spawn(this.path, ['--parent', String(process.pid)], {
      windowsHide: true,
      shell: false,
      stdio: 'pipe'
    })
    this.child = child
    this.epoch++
    const decoder = new StringDecoder('utf8')
    let buffer = ''
    let logged = 0
    this.startup = setTimeout(() => this.fail('timeout'), 5000)
    child.on('error', () => {
      if (this.child === child) this.fail('source_unavailable')
    })
    child.on('exit', () => {
      if (this.child === child) this.fail('source_unavailable')
    })
    child.stdin.on('error', () => {
      if (this.child === child) this.fail('source_unavailable')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      if (logged < 4096) {
        console.error('SMTC:', chunk.toString('utf8').slice(0, 4096 - logged))
        logged += chunk.length
      }
    })
    child.stdout.on('data', (chunk: Buffer) => {
      if (this.child !== child) return
      buffer += decoder.write(chunk)
      if (buffer.length > 4 * 1024 * 1024) {
        this.fail('source_unavailable')
        return
      }
      let end: number
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end)
        buffer = buffer.slice(end + 1)
        try {
          this.message(JSON.parse(line))
        } catch {
          this.fail('source_unavailable')
          return
        }
        if (this.child !== child) return
      }
    })
  }
  private message(m: Record<string, unknown>): void {
    if (!m || m.v !== 1) throw new Error('Protocol version')
    if (m.type === 'ready') {
      if (this.ready) throw new Error('Duplicate ready')
      if (this.startup) clearTimeout(this.startup)
      this.startup = null
      this.ready = true
      this.emit('ready')
      return
    }
    if (m.type === 'changed') {
      this.emit('changed')
      return
    }
    if (m.type !== 'response' || typeof m.id !== 'number' || typeof m.ok !== 'boolean')
      throw new Error('Protocol response')
    const pending = this.pending.get(m.id)
    if (!pending) return
    if (!m.ok && !REASONS.has(m.reason as PlayerErrorReason)) throw new Error('Protocol error')
    this.pending.delete(m.id)
    clearTimeout(pending.timer)
    pending.resolve(
      m.ok ? { ok: true, data: m.data } : { ok: false, reason: m.reason as PlayerErrorReason }
    )
  }
  private request(fields: Record<string, unknown>): Promise<ApiResult<unknown>> {
    if (!this.child || !this.ready)
      return Promise.resolve({ ok: false, reason: 'source_unavailable' })
    const id = ++this.id
    return new Promise((resolve) => {
      this.pending.set(id, { resolve, timer: setTimeout(() => this.fail('timeout'), 5000) })
      this.child?.stdin.write(JSON.stringify({ v: 1, id, ...fields }) + '\n')
    })
  }
  async read(): Promise<ApiResult<MediaSession[]>> {
    const epoch = this.epoch
    const result = await this.request({ method: 'snapshot' })
    if (!result.ok) {
      if (result.reason === 'source_unavailable') this.fail(result.reason)
      return result
    }
    try {
      const sessions = parseSessions(result.data).map((s) => ({
        ...s,
        id: String(epoch) + ':' + s.id
      }))
      this.failures = 0
      return { ok: true, data: sessions }
    } catch {
      this.fail('source_unavailable')
      return { ok: false, reason: 'source_unavailable' }
    }
  }
  async command(request: PlayerCommandRequest): Promise<ApiResult<null>> {
    const prefix = String(this.epoch) + ':'
    if (!request.sessionId.startsWith(prefix)) return { ok: false, reason: 'session_unavailable' }
    const { type, ...args } = request.command
    const result = await this.request({
      method: 'command',
      sessionId: request.sessionId.slice(prefix.length),
      mediaRevision: request.mediaRevision,
      command: type,
      ...args
    })
    return result.ok ? { ok: true, data: null } : result
  }
}
