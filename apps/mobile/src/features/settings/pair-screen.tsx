import { Button, Form, Section, Text, TextField } from '@expo/ui/swift-ui'
import {
  autocorrectionDisabled,
  disabled,
  foregroundStyle,
  keyboardType,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { ScreenHost } from '@/components/screen-host'
import { hostOf, isPaired } from '@/lib/daemon/environment'
import { environmentActions, useEnvironments } from '@/lib/daemon/environments-store'
import { type PairingLinkProblem, parsePairingLink, redeemPairingLink } from '@/lib/daemon/pairing'
import { attachPairingCredential, verifyPairingCredential } from '@/lib/daemon/pairing-group'
import { footnote, secondary } from '@/theme/modifiers'

/** Human-readable reason a link was rejected, shown under the field that carried it. */
function describePairingProblem(problem: PairingLinkProblem): string {
  switch (problem) {
    case 'empty':
      return 'Paste the pairing link from the desktop app.'
    case 'malformed':
      return 'That does not look like a pairing link. Copy it again from Settings → Share.'
    case 'missing-token':
      return 'That link’s pairing token is missing or damaged. Links expire 15 minutes after you create one.'
    case 'foreign-token':
      return 'That token is not a pairing grant. Use the link from “Pair a device”.'
  }
}

/**
 * The group name and `…/pair#token=…` link match what the desktop hands out. The same link the
 * browser client redeems is used here, so there is one pairing artefact and no camera permission.
 */
export function PairScreen(): React.JSX.Element {
  const { environmentId } = useLocalSearchParams<{ environmentId?: string }>()
  const environments = useEnvironments()
  const target =
    typeof environmentId === 'string'
      ? (environments.find((environment) => environment.id === environmentId) ?? null)
      : null
  const [nickname, setNickname] = useState('')
  const [link, setLink] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)

  async function submit(): Promise<void> {
    if (environmentId !== undefined && (target === null || !isPaired(target))) {
      setError('That environment group is no longer available. Start a new pairing.')
      return
    }
    const parsed = parsePairingLink(link)
    if (!parsed.ok) {
      setError(describePairingProblem(parsed.problem))
      return
    }
    setPairing(true)
    try {
      const token = await redeemPairingLink(parsed.link)
      if (target !== null && isPaired(target)) {
        await attachPairingCredential(parsed.link.baseUrl, token, target.token)
        await environmentActions.addEndpoint(target.id, parsed.link.baseUrl)
        await environmentActions.setActive(target.id)
      } else {
        await verifyPairingCredential(parsed.link.baseUrl, token)
        const trimmed = nickname.trim()
        const environment = await environmentActions.add({
          baseUrl: parsed.link.baseUrl,
          nickname: trimmed === '' ? hostOf(parsed.link.baseUrl) : trimmed,
          token,
        })
        await environmentActions.setActive(environment.id)
      }
      router.back()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pairing failed.')
    } finally {
      setPairing(false)
    }
  }

  return (
    <ScreenHost>
      <Form>
        <Section title={target === null ? 'Environment group' : 'Connection group'}>
          {target === null ? (
            <TextField
              onTextChange={(value: string): void => {
                setNickname(value)
              }}
              placeholder="Group name (optional)"
            />
          ) : (
            <Text modifiers={[secondary]}>
              Add a LAN, Tailscale, or Funnel connection to {target.nickname}.
            </Text>
          )}
          <TextField
            modifiers={[
              keyboardType('url'),
              autocorrectionDisabled(true),
              textInputAutocapitalization('never'),
            ]}
            onTextChange={(value: string): void => {
              setLink(value)
              setError(null)
            }}
            placeholder="Pairing link"
          />
        </Section>
        <Section
          footer={
            <Text
              modifiers={[
                footnote,
                error === null
                  ? secondary
                  : // iOS systemRed — a rejected paste is the one thing on this screen that must shout.
                    foregroundStyle({ color: '#FF3B30', type: 'color' }),
              ]}
            >
              {error ??
                'Desktop → Settings → Share → Pair a device. Links expire 15 minutes after you create one.'}
            </Text>
          }
        >
          <Button
            label={
              pairing ? 'Pairing…' : target === null ? 'Pair environment group' : 'Add connection'
            }
            modifiers={[disabled(pairing || link.trim() === '')]}
            onPress={(): void => {
              submit()
            }}
          />
        </Section>
      </Form>
    </ScreenHost>
  )
}
