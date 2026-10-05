import { Context } from 'effect';
export interface IdSource {
  next(): string;
}

export const IdSource = Context.Service<'@porcelain/kernel/IdSource', IdSource>(
  '@porcelain/kernel/IdSource',
);
