import { InstallerError } from './installer-error.ts';

export class NotPackagedCliError extends InstallerError {
  override readonly name = 'NotPackagedCliError';
  constructor() {
    super(
      'Service management requires the packaged Porcelain CLI. Run it with `npx @fabiofiorita/porcelain@latest service ...`.',
    );
  }
}
