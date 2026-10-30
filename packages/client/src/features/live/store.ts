import { AtomRef } from 'effect/reactivity';
import type { LiveSessionState } from './ports/live-update.ts';

export const liveSessionState = () => AtomRef.make<LiveSessionState>('idle');
