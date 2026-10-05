import { Context } from 'effect';
export const ServiceUpdateCheckOptions = Context.Service<
  '@porcelain/access/ServiceUpdateCheckOptions',
  { latestVersionTtlMs: number }
>('@porcelain/access/ServiceUpdateCheckOptions');
