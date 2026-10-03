import type {
  ServiceUpdateState,
  ServiceUpdateTarget,
} from '@porcelain/access/models';
import type { ServiceUpdateRunner } from '../../src/ports/service-update-runner.ts';

export class ScriptedServiceUpdateRunner implements ServiceUpdateRunner {
  private state: ServiceUpdateState;
  private readonly attempts: (readonly ServiceUpdateState[])[];
  private readonly stepMs: number;

  constructor(
    initial: ServiceUpdateState,
    attempts: (readonly ServiceUpdateState[])[],
    stepMs: number,
  ) {
    this.state = initial;
    this.attempts = attempts;
    this.stepMs = stepMs;
  }

  read(): Promise<ServiceUpdateState> {
    return Promise.resolve(structuredClone(this.state));
  }

  start(_input: ServiceUpdateTarget): Promise<void> {
    const next = this.attempts.shift();
    const [claimed = this.state, ...later] = next ?? [];
    this.state = claimed;
    later.forEach((state, index) => {
      setTimeout(
        () => {
          this.state = state;
        },
        (index + 1) * this.stepMs,
      );
    });
    return Promise.resolve();
  }
}
