import { RequestError } from '@/shared/api/request';

export function refusalMessage(error: unknown): string | undefined {
  return error instanceof RequestError ? error.message : undefined;
}
