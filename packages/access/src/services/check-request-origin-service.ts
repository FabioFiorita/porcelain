import type {
  CheckRequestOriginInput,
  CheckRequestOriginResult,
} from '../models/check-request-origin.ts';
import { requestOriginCheck } from '../rules/request-origin-check.ts';

export class CheckRequestOriginService {
  execute(input: CheckRequestOriginInput): CheckRequestOriginResult {
    return requestOriginCheck(input);
  }
}
