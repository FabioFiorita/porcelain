import { useDaemonSkew } from '@renderer/hooks/use-daemon-skew'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

const TOAST_ID = 'daemon-skew'

/**
 * Raises ONE toast when the daemon's build version differs from this app's — the
 * cryptic per-procedure failure ("No procedure found on path …") that the
 * version-skew guard exists to pre-empt. Deduped on the daemon version (the ref),
 * so a re-render or a refetch that returns the same skew doesn't re-toast; a genuine
 * reconnect to a differently-versioned daemon does. The fixed `id` also means sonner
 * updates the one toast in place rather than stacking. Renders nothing.
 */
export function DaemonSkewToast(): null {
  const skew = useDaemonSkew()
  const shown = useRef<string | null>(null)

  useEffect(() => {
    if (!skew) return
    if (shown.current === skew.daemonVersion) return
    shown.current = skew.daemonVersion

    toast.warning('Daemon version mismatch', {
      id: TOAST_ID,
      description: skew.message,
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
      action: {
        label: 'Environments',
        onClick: () => useSettingsDialogStore.getState().openTo('environments'),
      },
    })
  }, [skew])

  return null
}
