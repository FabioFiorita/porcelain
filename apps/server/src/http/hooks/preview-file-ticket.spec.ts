import { describe, expect, it } from 'vite-plus/test';
import { previewFileTickets } from './preview-file-ticket.ts';

const file = { worktreeId: 'worktree-one', path: 'images/logo.svg' };
const start = 1_000_000;

describe('preview file tickets', () => {
  it('expires at the 30-minute deadline', () => {
    const tickets = previewFileTickets();
    const ticket = tickets.issue(file, 'device-credential', start);

    expect(tickets.redeem(file, ticket, start + 1_799_999)).toBe(
      'device-credential',
    );
    expect(tickets.redeem(file, ticket, start + 1_800_000)).toBeUndefined();
  });

  it('authenticates the worktree, path and token independently of the request', () => {
    const tickets = previewFileTickets();
    const ticket = tickets.issue(file, 'device-credential', start);
    const changed = (ticket.startsWith('a') ? 'b' : 'a') + ticket.slice(1);

    expect(
      tickets.redeem({ ...file, path: 'other.svg' }, ticket, start),
    ).toBeUndefined();
    expect(
      tickets.redeem({ ...file, worktreeId: 'worktree-two' }, ticket, start),
    ).toBeUndefined();
    expect(tickets.redeem(file, changed, start)).toBeUndefined();
    expect(previewFileTickets().redeem(file, ticket, start)).toBeUndefined();
    expect(tickets.redeem(file, ticket, start)).toBe('device-credential');
  });
});
