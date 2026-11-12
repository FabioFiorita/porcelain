import { File } from '@pierre/diffs/react';
import {
  WorkerPoolManager,
  type RenderFileRequest,
  type WorkerRequest,
  type WorkerResponse,
} from '@pierre/diffs/worker';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { vi } from 'vitest';
import {
  PierreCodeView,
  PierreWorkers,
} from '@/features/workspace/adapters/pierre-workers';
import {
  PIERRE_DECISION_THEME,
  PIERRE_HIGHLIGHTER,
  PIERRE_THEME,
} from '@/shared/lib/pierre';

export function observePierreWorkers() {
  const requests: WorkerRequest[] = [];
  const responses: WorkerResponse[] = [];
  const replies = new WeakMap<WorkerRequest, WorkerResponse>();
  const pending = new Map<Worker, Map<string, WorkerRequest>>();
  const active = new Set<Worker>();
  const cacheReads = vi.spyOn(
    WorkerPoolManager.prototype,
    'getFileResultCache',
  );
  const observed = new Map<
    Worker,
    (event: MessageEvent<WorkerResponse>) => void
  >();
  const postMessage: unknown = Object.getOwnPropertyDescriptor(
    Worker.prototype,
    'postMessage',
  )?.value;
  const terminate: unknown = Object.getOwnPropertyDescriptor(
    Worker.prototype,
    'terminate',
  )?.value;
  if (typeof postMessage !== 'function' || typeof terminate !== 'function')
    throw new Error(
      'Worker observation needs the native dispatch and termination methods.',
    );
  const dispatch = vi
    .spyOn(Worker.prototype, 'postMessage')
    .mockImplementation(function (
      this: Worker,
      message: WorkerRequest,
      options?: StructuredSerializeOptions | Transferable[],
    ) {
      if (!observed.has(this)) {
        const receive = (event: MessageEvent<WorkerResponse>) => {
          responses.push(event.data);
          const request = pending.get(this)?.get(event.data.id);
          if (request) replies.set(request, event.data);
        };
        this.addEventListener('message', receive);
        observed.set(this, receive);
      }
      active.add(this);
      requests.push(message);
      const workerRequests =
        pending.get(this) ?? new Map<string, WorkerRequest>();
      workerRequests.set(message.id, message);
      pending.set(this, workerRequests);
      Reflect.apply(postMessage, this, [message, options]);
    });
  const disposal = vi
    .spyOn(Worker.prototype, 'terminate')
    .mockImplementation(function (this: Worker) {
      active.delete(this);
      Reflect.apply(terminate, this, []);
    });
  return {
    active: () => active.size,
    files: (path: string) =>
      requests.filter(
        (request): request is RenderFileRequest =>
          request.type === 'file' && request.file.name === path,
      ),
    responses: () => responses,
    responseFor: (request: WorkerRequest | undefined) =>
      request ? replies.get(request) : undefined,
    originFor: (request: WorkerRequest) =>
      [...pending.values()].findIndex(
        (requests) => requests.get(request.id) === request,
      ),
    cached: (path: string) => {
      const request = requests.findLast(
        (request) => request.type === 'file' && request.file.name === path,
      );
      if (request?.type !== 'file' || !request.file.cacheKey) return false;
      const key = request.file.cacheKey;
      return cacheReads.mock.contexts.some(
        (pool) =>
          pool instanceof WorkerPoolManager &&
          pool.inspectCaches().fileCache.has(key),
      );
    },
    dispose() {
      dispatch.mockRestore();
      disposal.mockRestore();
      cacheReads.mockRestore();
      for (const [worker, receive] of observed)
        worker.removeEventListener('message', receive);
    },
  };
}

export function createMixedPierrePanes() {
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  return {
    show() {
      root.render(
        <StrictMode>
          <PierreWorkers>
            <File
              file={{
                name: 'standard.ts',
                contents: 'export const standard = 1;',
                cacheKey: 'standard-1',
              }}
              options={{
                theme: PIERRE_THEME,
                preferredHighlighter: PIERRE_HIGHLIGHTER,
              }}
            />
            <PierreCodeView
              review
              items={[
                {
                  id: 'review',
                  type: 'file',
                  file: {
                    name: 'review.ts',
                    contents: 'export const review = 2;',
                    cacheKey: 'review-1',
                  },
                },
              ]}
              options={{
                theme: PIERRE_DECISION_THEME,
                preferredHighlighter: PIERRE_HIGHLIGHTER,
              }}
              style={{ height: 200 }}
            />
          </PierreWorkers>
        </StrictMode>,
      );
    },
    hide() {
      root.render(null);
    },
    dispose() {
      root.unmount();
      element.remove();
    },
  };
}
