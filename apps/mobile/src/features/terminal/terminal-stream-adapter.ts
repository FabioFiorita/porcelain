import { REQUEST_TIMEOUT_MS } from '@porcelain/client-runtime/session/transport'
import {
  createTerminalStreamState,
  type TerminalRecovery,
  type TerminalRequest,
  type TerminalRequestFailure,
  type TerminalStreamEffect,
  type TerminalStreamState,
} from '@porcelain/client-runtime/terminal'
import {
  MAX_TERMINAL_WRITE_CODE_UNITS,
  type TerminalClientFrame,
  type TerminalServerFrame,
} from '@porcelain/contracts/terminal'
import { randomUUID } from 'expo-crypto'
import { useEffect } from 'react'

import { type DaemonSession, daemonSession } from '@/lib/daemon/session'

type TerminalAttachedFrame = Extract<TerminalServerFrame, { t: 'terminal:attached' }>
type TerminalImagePastedFrame = Extract<TerminalServerFrame, { t: 'terminal:image-pasted' }>
type TerminalFilePastedFrame = Extract<TerminalServerFrame, { t: 'terminal:file-pasted' }>
type TerminalCreateInput = Omit<
  Extract<TerminalClientFrame, { t: 'terminal:create' }>,
  'reqId' | 't'
>
type TerminalPasteImageInput = Omit<
  Extract<TerminalClientFrame, { t: 'terminal:paste-image' }>,
  'reqId' | 't'
>
type TerminalPasteFileInput = Omit<
  Extract<TerminalClientFrame, { t: 'terminal:paste-file' }>,
  'reqId' | 't'
>

export type TerminalAttachResult = Pick<
  TerminalAttachedFrame,
  'scrollback' | 'status' | 'exitCode' | 'epoch' | 'sequence'
>

export type TerminalPasteResult =
  | Pick<TerminalImagePastedFrame, 'result' | 'path'>
  | Pick<TerminalFilePastedFrame, 'result' | 'path'>

export type TerminalAdapterFailure = TerminalRequestFailure | { readonly reason: 'not-requestable' }

export type TerminalStreamListeners = {
  readonly onData?: (id: string, data: string) => void
  readonly onExit?: (id: string, exitCode: number) => void
  readonly onScrollback?: (id: string, scrollback: string) => void
  readonly onRecovery?: (recovery: TerminalRecovery) => void
}

type TimerHandle = ReturnType<typeof setTimeout>

export type MobileTerminalAdapterOptions = {
  readonly requestId?: () => string
  readonly now?: () => number
  readonly requestTimeoutMs?: number
  readonly schedule?: (run: () => void, delayMs: number) => TimerHandle
  readonly cancel?: (handle: TimerHandle) => void
}

type PendingRequest =
  | {
      readonly kind: 'create'
      readonly timer: TimerHandle
      readonly resolve: (id: string) => void
      readonly reject: (failure: TerminalAdapterFailure) => void
    }
  | {
      readonly kind: 'attach'
      readonly timer: TimerHandle
      readonly resolve: (result: TerminalAttachResult) => void
      readonly reject: (failure: TerminalAdapterFailure) => void
    }
  | {
      readonly kind: 'paste-image' | 'paste-file'
      readonly timer: TimerHandle
      readonly resolve: (result: TerminalPasteResult) => void
      readonly reject: (failure: TerminalAdapterFailure) => void
    }

type PendingWithoutTimer = Omit<PendingRequest, 'timer'>

export type MobileTerminalAdapter = {
  readonly createTerminal: (input: TerminalCreateInput) => Promise<string>
  readonly attachTerminal: (id: string) => Promise<TerminalAttachResult>
  readonly detachTerminal: (id: string) => void
  readonly isTerminalAttached: (id: string) => boolean
  readonly writeTerminal: (id: string, data: string) => void
  readonly resizeTerminal: (id: string, cols: number, rows: number) => void
  readonly killTerminal: (id: string) => void
  readonly pasteImageToTerminal: (input: TerminalPasteImageInput) => Promise<TerminalPasteResult>
  readonly pasteFileToTerminal: (input: TerminalPasteFileInput) => Promise<TerminalPasteResult>
  readonly subscribe: (listeners: TerminalStreamListeners) => () => void
  readonly dispose: () => void
}

const defaultOptions: Required<MobileTerminalAdapterOptions> = {
  requestId: randomUUID,
  now: () => Date.now(),
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  schedule: (run, delayMs) => setTimeout(run, delayMs),
  cancel: (handle) => clearTimeout(handle),
}

function mergeOptions(
  options: MobileTerminalAdapterOptions,
): Required<MobileTerminalAdapterOptions> {
  return { ...defaultOptions, ...options }
}

export function createMobileTerminalAdapter(
  session: DaemonSession,
  options: MobileTerminalAdapterOptions = {},
): MobileTerminalAdapter {
  const settings = mergeOptions(options)
  const state: TerminalStreamState = createTerminalStreamState()
  const listeners = new Set<TerminalStreamListeners>()
  const pending = new Map<string, PendingRequest>()
  const queued = new Map<string, TerminalRequest>()
  let disposed = false

  const emit = (effect: TerminalStreamEffect): void => {
    if (effect.type === 'data') {
      for (const listener of listeners) listener.onData?.(effect.frame.id, effect.frame.data)
      return
    }
    if (effect.type === 'exit') {
      for (const listener of listeners) listener.onExit?.(effect.frame.id, effect.frame.exitCode)
      return
    }
    if (effect.type === 'recovery-required') {
      for (const listener of listeners) listener.onRecovery?.(effect.recovery)
      for (const id of effect.recovery.reattach) issueRecoveryAttach(id)
      return
    }

    const requestId = effect.request.reqId
    const entry = pending.get(requestId)
    if (entry === undefined) return
    pending.delete(requestId)
    queued.delete(requestId)
    settings.cancel(entry.timer)
    if (effect.type === 'request-failed') {
      entry.reject(effect.failure)
      return
    }
    settleSuccess(entry, effect)
  }

  const dispatch = (effects: readonly TerminalStreamEffect[]): void => {
    for (const effect of effects) emit(effect)
  }

  function sendOrQueue(request: TerminalRequest): void {
    if (session.runtime.status() === 'open') session.runtime.send(request.frame)
    else queued.set(request.reqId, request)
  }

  function register(request: TerminalRequest, entry: PendingWithoutTimer): void {
    const delay = Math.max(0, request.deadline - settings.now())
    const timer = settings.schedule(() => dispatch(state.expire(settings.now())), delay)
    pending.set(request.reqId, { ...entry, timer } as PendingRequest)
    sendOrQueue(request)
  }

  function startRequest<T>(
    create: (requestId: string, deadline: number) => TerminalRequest | undefined,
    makeEntry: (
      resolve: (value: T) => void,
      reject: (failure: TerminalAdapterFailure) => void,
    ) => PendingWithoutTimer,
  ): Promise<T> {
    session.start()
    const now = settings.now()
    const request = create(settings.requestId(), now + settings.requestTimeoutMs)
    if (request === undefined) return Promise.reject({ reason: 'not-requestable' as const })
    return new Promise<T>((resolve, reject) => {
      register(
        request,
        makeEntry(resolve, (failure) => {
          reject(failure)
        }),
      )
    })
  }

  function settleSuccess(
    entry: PendingRequest,
    effect: Extract<TerminalStreamEffect, { type: 'request-succeeded' }>,
  ): void {
    switch (entry.kind) {
      case 'create':
        if (effect.frame.t === 'terminal:created') entry.resolve(effect.frame.id)
        return
      case 'attach':
        if (effect.frame.t !== 'terminal:attached') return
        for (const listener of listeners)
          listener.onScrollback?.(effect.frame.id, effect.frame.scrollback)
        entry.resolve({
          scrollback: effect.frame.scrollback,
          status: effect.frame.status,
          exitCode: effect.frame.exitCode,
          epoch: effect.frame.epoch,
          sequence: effect.frame.sequence,
        })
        return
      case 'paste-image':
        if (effect.frame.t === 'terminal:image-pasted')
          entry.resolve({ result: effect.frame.result, path: effect.frame.path })
        return
      case 'paste-file':
        if (effect.frame.t === 'terminal:file-pasted')
          entry.resolve({ result: effect.frame.result, path: effect.frame.path })
    }
  }

  function issueRecoveryAttach(id: string): void {
    const now = settings.now()
    const request = state.requestAttach(id, settings.requestId(), now + settings.requestTimeoutMs)
    if (request === undefined) return
    register(request, {
      kind: 'attach',
      resolve: () => undefined,
      reject: () => undefined,
    })
  }

  function flushQueue(): void {
    if (session.runtime.status() !== 'open') return
    for (const request of queued.values()) {
      if (pending.has(request.reqId)) session.runtime.send(request.frame)
    }
    queued.clear()
  }

  const offFrame = session.onTerminalFrame((frame) => dispatch(state.receive(frame)))
  const offReady = session.onDaemonReady(flushQueue)
  const offReconnect = session.onDaemonReconnect(() => dispatch(state.reconnect()))
  const offClose = session.onDaemonClose(() => {
    dispatch(state.close())
    queued.clear()
  })

  const adapter: MobileTerminalAdapter = {
    createTerminal: (input) =>
      startRequest(
        (requestId, deadline) =>
          state.requestCreate({ t: 'terminal:create', ...input }, requestId, deadline),
        (resolve, reject) => ({ kind: 'create', resolve, reject }),
      ),
    attachTerminal: (id) =>
      startRequest(
        (requestId, deadline) => state.requestAttach(id, requestId, deadline),
        (resolve, reject) => ({ kind: 'attach', resolve, reject }),
      ),
    detachTerminal: (id): void => {
      const frame = state.detach(id, settings.requestId())
      if (frame !== undefined && session.runtime.status() === 'open') session.runtime.send(frame)
    },
    isTerminalAttached: (id) => state.state(id) !== undefined,
    writeTerminal: (id, data): void => {
      if (data === '') return
      for (let offset = 0; offset < data.length; offset += MAX_TERMINAL_WRITE_CODE_UNITS) {
        const frame = state.write(
          id,
          data.slice(offset, offset + MAX_TERMINAL_WRITE_CODE_UNITS),
          settings.requestId(),
        )
        if (frame !== undefined && session.runtime.status() === 'open') session.runtime.send(frame)
      }
    },
    resizeTerminal: (id, cols, rows): void => {
      const frame = state.resize(id, cols, rows, settings.requestId())
      if (frame !== undefined && session.runtime.status() === 'open') session.runtime.send(frame)
    },
    killTerminal: (id): void => {
      const frame = state.kill(id, settings.requestId())
      if (frame !== undefined && session.runtime.status() === 'open') session.runtime.send(frame)
    },
    pasteImageToTerminal: (input) =>
      startRequest(
        (requestId, deadline) =>
          state.requestPasteImage({ t: 'terminal:paste-image', ...input }, requestId, deadline),
        (resolve, reject) => ({ kind: 'paste-image', resolve, reject }),
      ),
    pasteFileToTerminal: (input) =>
      startRequest(
        (requestId, deadline) =>
          state.requestPasteFile({ t: 'terminal:paste-file', ...input }, requestId, deadline),
        (resolve, reject) => ({ kind: 'paste-file', resolve, reject }),
      ),
    subscribe: (next) => {
      if (disposed) return () => undefined
      listeners.add(next)
      return () => listeners.delete(next)
    },
    dispose: (): void => {
      if (disposed) return
      disposed = true
      offFrame()
      offReady()
      offReconnect()
      offClose()
      dispatch(state.close())
      queued.clear()
      listeners.clear()
    },
  }

  return adapter
}

const adapters = new WeakMap<DaemonSession, MobileTerminalAdapter>()

export function mobileTerminalAdapter(): MobileTerminalAdapter {
  const existing = adapters.get(daemonSession)
  if (existing !== undefined) return existing
  const created = createMobileTerminalAdapter(daemonSession)
  adapters.set(daemonSession, created)
  return created
}

let streamConsumers = 0
let stopSharedStream: (() => void) | null = null

/** Keep one native stream subscription while mobile routes overlap during transitions. */
export function useMobileTerminalStream(listeners: TerminalStreamListeners): void {
  const adapter = mobileTerminalAdapter()
  useEffect(() => {
    streamConsumers += 1
    if (stopSharedStream === null) stopSharedStream = adapter.subscribe(listeners)
    return () => {
      streamConsumers -= 1
      if (streamConsumers !== 0) return
      stopSharedStream?.()
      stopSharedStream = null
    }
  }, [adapter, listeners])
}
