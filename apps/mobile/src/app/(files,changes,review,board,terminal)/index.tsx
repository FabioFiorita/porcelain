import { useSegments } from 'expo-router'

import { TabPlaceholder } from '@/components/tab-placeholder'

const TAB_COPY = {
  board: {
    detail: 'The repo queue will live in this stack.',
    eyebrow: 'Native starter',
    title: 'Board',
  },
  changes: {
    detail: 'Working tree changes and history will live in this stack.',
    eyebrow: 'Native starter',
    title: 'Changes',
  },
  files: {
    detail: 'Repository navigation will begin here.',
    eyebrow: 'Native starter',
    title: 'Files',
  },
  review: {
    detail: 'Intent, Execution, and Evidence will meet here.',
    eyebrow: 'Where agent work becomes trusted work',
    title: 'Review',
  },
  terminal: {
    detail: 'Daemon-owned terminal sessions will live in this stack.',
    eyebrow: 'Native starter',
    title: 'Terminal',
  },
} as const

export default function TabRoute() {
  const [segment] = useSegments()
  const route = segment.slice(1, -1) as keyof typeof TAB_COPY

  return <TabPlaceholder {...TAB_COPY[route]} />
}
