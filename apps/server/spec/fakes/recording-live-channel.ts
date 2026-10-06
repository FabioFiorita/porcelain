import { Effect, Queue } from 'effect';
import type { LiveChannel } from '../../src/ports/live-channel.ts';

type SentNotice = Parameters<LiveChannel['send']>[0];

export class RecordingLiveChannel implements LiveChannel {
  private readonly history: SentNotice[] = [];
  private readonly messages: Queue.Queue<SentNotice>;
  private readonly controls: Queue.Queue<'ping' | 'terminated'>;
  private readonly onSend: (notice: SentNotice) => Effect.Effect<void>;

  constructor(seed: {
    messages: Queue.Queue<SentNotice>;
    controls: Queue.Queue<'ping' | 'terminated'>;
    onSend: (notice: SentNotice) => Effect.Effect<void>;
  }) {
    this.messages = seed.messages;
    this.controls = seed.controls;
    this.onSend = seed.onSend;
  }

  send(notice: SentNotice): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      yield* this.onSend(notice);
      this.history.push(notice);
      yield* Queue.offer(this.messages, notice);
    });
  }

  ping(): Effect.Effect<void> {
    return Queue.offer(this.controls, 'ping').pipe(Effect.asVoid);
  }

  terminate(): Effect.Effect<void> {
    return Queue.offer(this.controls, 'terminated').pipe(Effect.asVoid);
  }

  next(): Effect.Effect<SentNotice> {
    return Queue.take(this.messages);
  }

  nextControl(): Effect.Effect<'ping' | 'terminated'> {
    return Queue.take(this.controls);
  }

  notices(): readonly SentNotice[] {
    return this.history;
  }
}
