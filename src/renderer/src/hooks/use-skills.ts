import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'

export function useSkillsInfo():
  | { version: string; installCommand: string; upgradeCommand: string }
  | undefined {
  // Shell-only — the browser client hides the Agents section, so this is never queried there.
  const { data } = shellTrpc.skillsInfo.useQuery(undefined, {
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !isBrowser,
  })
  return data
}
