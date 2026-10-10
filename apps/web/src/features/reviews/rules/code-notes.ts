import type {
  ReviewLayer,
  ReviewResponse,
} from '@porcelain/client/reviews/rules';
import { spansLabel } from '@porcelain/client/changes/rules';

export type AgentCodeNote = {
  title: string;
  text: string;
  line: number;
  stale: boolean;
  marker?: string;
  tone?: 'agent' | 'gap';
};

type Notes = Record<string, AgentCodeNote[]>;

function add(notes: Notes, path: string, note: AgentCodeNote) {
  (notes[path] ??= []).push(note);
}

export function decisionNotes(layer: ReviewLayer, decision?: number): Notes {
  const notes: Notes = {};
  layer.steps.forEach((step, index) => {
    if (step.location.state === 'committed') return;
    const marker = `${index + 1}`;
    add(notes, step.pointer.path, {
      title:
        decision === undefined
          ? step.title
          : `${decision}. ${layer.title} · ${step.title}`,
      text: step.text,
      line:
        step.location.state === 'current'
          ? step.location.endLine
          : step.pointer.endLine,
      stale: step.location.state === 'changed',
      marker: decision === undefined ? marker : `${decision}.${marker}`,
      tone: 'agent',
    });
  });
  return notes;
}

export function gapNotes(gaps: ReviewResponse['notExplained']): Notes {
  const notes: Notes = {};
  for (const gap of gaps)
    for (const range of gap.ranges)
      add(notes, gap.path, {
        title: 'Not explained',
        text: `${spansLabel([range])} changed without an explanation from the agent.`,
        line: range.endLine,
        stale: false,
        tone: 'gap',
      });
  return notes;
}

export function mergeNotes(...sources: readonly Notes[]): Notes {
  const merged: Notes = {};
  for (const source of sources)
    for (const [path, notes] of Object.entries(source))
      for (const note of notes) add(merged, path, note);
  return merged;
}
