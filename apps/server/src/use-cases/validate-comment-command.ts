import type {
  CommentCommand,
  CommentThread,
} from '../models/comment-thread.ts';
import { InvalidCommentError } from './errors/invalid-comment-error.ts';

function validAnchor(anchor: CommentThread['anchor']): boolean {
  const path = anchor.filePath;
  const validPath =
    path.length > 0 &&
    path.length <= 4096 &&
    !/^[a-z]:/i.test(path) &&
    !path.includes('\\') &&
    !path.includes('\0') &&
    path
      .split('/')
      .every(
        (part) =>
          part !== '' &&
          part !== '.' &&
          part !== '..' &&
          part.toLowerCase() !== '.git',
      );
  const validEvidence = [anchor.revision, anchor.contentFingerprint].every(
    (value) => value === undefined || (value.length > 0 && value.length <= 256),
  );
  return (
    validPath &&
    validEvidence &&
    (anchor.kind === 'file' ||
      (Number.isInteger(anchor.startLine) &&
        Number.isInteger(anchor.endLine) &&
        anchor.startLine >= 1 &&
        anchor.endLine >= anchor.startLine &&
        anchor.endLine <= 2147483647))
  );
}
export function validateCommentCommand(command: CommentCommand): void {
  if (command.kind === 'create' || command.kind === 'reply') {
    if (
      command.body.length > 16000 ||
      command.body.trim().length === 0 ||
      command.body.includes('\0')
    )
      throw new InvalidCommentError();
  }
  if (command.kind === 'create' && !validAnchor(command.anchor))
    throw new InvalidCommentError();
}
