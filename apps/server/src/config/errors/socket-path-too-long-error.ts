export class SocketPathTooLongError extends Error {
  override readonly name = 'SocketPathTooLongError';
  constructor(path: string, limit: number) {
    super(
      `The owner socket path ${path} is ${Buffer.byteLength(path)} bytes; ` +
        `the operating system allows ${limit}. Choose a shorter data directory.`,
    );
  }
}
