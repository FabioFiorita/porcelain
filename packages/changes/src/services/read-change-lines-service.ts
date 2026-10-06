import { ReadChangeLinesOptions } from '../ports/read-change-lines-options.ts';
import { Effect, Context, Layer } from 'effect';
import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import {
  type ChangeLines,
  type LineRangeProblem,
} from '../models/change-lines.ts';
import { type ReadChangeLinesInput } from '../models/read-change-lines.ts';
import {
  lineRangeProblem,
  sliceChangeLines,
} from '../rules/slice-change-lines.ts';

export class ReadChangeLinesService extends Context.Service<
  ReadChangeLinesService,
  {
    readonly execute: (
      input: ReadChangeLinesInput,
    ) => Effect.Effect<ChangeLines, InvalidLineRangeError>;
  }
>()('@porcelain/changes/ReadChangeLinesService') {
  static readonly layer = Layer.effect(
    ReadChangeLinesService,
    Effect.gen(function* () {
      const optionsCapability = yield* ReadChangeLinesOptions;
      function operationFailure(
        problem: LineRangeProblem,
      ): InvalidLineRangeError {
        switch (problem.kind) {
          case 'reversed-range':
            return new InvalidLineRangeError();
        }
      }
      return {
        execute: Effect.fn('ReadChangeLinesService.execute')(function* (
          input: ReadChangeLinesInput,
        ): Effect.fn.Return<ChangeLines, InvalidLineRangeError> {
          const problem = lineRangeProblem(input);
          if (problem) return yield* Effect.fail(operationFailure(problem));
          return sliceChangeLines(input, optionsCapability.maxLines);
        }),
      };
    }),
  );
}
