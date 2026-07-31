import { PlaceholderScreen } from '@/components/placeholder-screen'

export function AboutScreen() {
  return (
    <PlaceholderScreen
      title="About"
      description="Porcelain — the review layer for agentic coding."
      details={['App and daemon versions', 'Release notes', 'Licenses']}
    />
  )
}
