import type {
  CheckRequestOriginInput,
  RequestOriginRefusal,
} from '@porcelain/access/models';
import type { Effect } from 'effect';

export type CrossOriginPolicy = CheckRequestOriginInput['crossOrigin'];

export type PresentedCredential = CheckRequestOriginInput['credential'];

export type RequestOriginVerdict =
  | { allowed: true; crossOrigin: boolean }
  | { allowed: false; refusal: RequestOriginRefusal };

export interface CheckRequestOriginUseCasePort {
  execute(input: CheckRequestOriginInput): Effect.Effect<RequestOriginVerdict>;
}
