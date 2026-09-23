export class NotPackagedCliError extends Error {
  override readonly name = 'NotPackagedCliError';
  constructor() {
    super(
      'Service management requires the packaged Porcelain CLI. Run it with `npx @fabiofiorita/porcelain@latest service ...`.',
    );
  }
}
