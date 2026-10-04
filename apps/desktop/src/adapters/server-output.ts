function marker(token: string): Buffer {
  return Buffer.from(`\0Porcelain output complete: ${token}\0`);
}

export async function finishServerOutput(token: string): Promise<void> {
  const end = marker(token);
  await Promise.all([
    new Promise<void>((resolve) => process.stdout.end(end, resolve)),
    new Promise<void>((resolve) =>
      process.stderr.end(
        Buffer.concat([Buffer.from('Porcelain server: closed\n'), end]),
        resolve,
      ),
    ),
  ]);
}

export function drainServerOutput(
  input: NodeJS.ReadableStream | null,
  token: string,
  accept: (chunk: Buffer) => void,
): Promise<void> {
  if (input === null)
    return Promise.reject(new Error('The server output pipe is missing'));
  const end = marker(token);
  let pending = Buffer.alloc(0);
  let completed = false;
  const drained = Promise.withResolvers<void>();
  const emit = (chunk: Buffer) => {
    if (chunk.length > 0) accept(chunk);
  };
  input.on('data', (chunk: Buffer) => {
    if (completed) {
      emit(chunk);
      return;
    }
    const buffered = Buffer.concat([pending, chunk]);
    const position = buffered.indexOf(end);
    if (position !== -1) {
      emit(buffered.subarray(0, position));
      emit(buffered.subarray(position + end.length));
      pending = Buffer.alloc(0);
      completed = true;
      drained.resolve();
      return;
    }
    const start = buffered.lastIndexOf(0);
    const tail = buffered.subarray(start);
    pending =
      start !== -1 &&
      tail.length < end.length &&
      end.subarray(0, tail.length).equals(tail)
        ? tail
        : Buffer.alloc(0);
    emit(buffered.subarray(0, buffered.length - pending.length));
  });
  input.once('error', (error: unknown) => drained.reject(error));
  input.once('end', () => {
    if (!completed) {
      emit(pending);
      drained.reject(
        new Error('The server output ended without its shutdown marker'),
      );
    }
  });
  return drained.promise;
}
