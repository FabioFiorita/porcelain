import { execFileSync } from 'node:child_process'

/** Creation time distinguishes the recorded launcher from a subsequently reused PID. */
export function windowsProcessIdentity(pid) {
  if (!Number.isInteger(pid) || pid <= 1) throw new Error('Invalid process id')
  const script = `$ErrorActionPreference='Stop'; $p=Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}"; if ($null -ne $p) { @{ started=$p.CreationDate.ToUniversalTime().Ticks.ToString(); command=$p.CommandLine } | ConvertTo-Json -Compress }`
  const text = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      encoding: 'utf8',
      windowsHide: true,
      // Cold PowerShell/CIM startup on hosted Windows can exceed 15 seconds.
      // Preserve a hard bound without treating a slow identity query as a missing process.
      timeout: 60000,
    },
  ).trim()
  return text ? JSON.parse(text) : null
}
