import { Context } from 'effect';

export class PairingPlatform extends Context.Service<
  PairingPlatform,
  { readonly name: () => string }
>()('@porcelain/client/PairingPlatform') {}
