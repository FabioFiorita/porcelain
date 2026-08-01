import { Button, Form, Host, Section, Text, TextField } from '@expo/ui/swift-ui'
import {
  autocorrectionDisabled,
  disabled,
  font,
  foregroundStyle,
  keyboardType,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers'
import { router } from 'expo-router'
import { useState } from 'react'

import { hostOf } from '@/lib/daemon/environment'
import { environmentActions } from '@/lib/daemon/environments-store'
import { type PairingLinkProblem, parsePairingLink, redeemPairingLink } from '@/lib/daemon/pairing'
import { useAccentColor } from '@/theme/colors'

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
 * Two fields, matching what the desktop hands out: a name for this device's list, and the
 * `…/pair#token=…` link Settings → Share copies. Same link the browser client redeems, so
 * there is one pairing artefact to explain and no QR scanner to justify a camera permission.
 */
export function PairScreen(): React.JSX.Element {
  const accentColor = useAccentColor()
  const [nickname, setNickname] = useState('')
  const [link, setLink] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)

  async function submit(): Promise<void> {
    const parsed = parsePairingLink(link)
    if (!parsed.ok) {
      setError(describePairingProblem(parsed.problem))
      return
    }
    setPairing(true)
    try {
      const token = await redeemPairingLink(parsed.link)
      const trimmed = nickname.trim()
      const environment = await environmentActions.add({
        baseUrl: parsed.link.baseUrl,
        nickname: trimmed === '' ? hostOf(parsed.link.baseUrl) : trimmed,
        token,
      })
      await environmentActions.setActive(environment.id)
      router.back()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pairing failed.')
    } finally {
      setPairing(false)
    }
  }

  return (
    <Host seedColor={accentColor} style={{ flex: 1 }} useViewportSizeMeasurement>
      <Form>
        <Section title="Environment">
          <TextField
            onTextChange={(value: string): void => {
              setNickname(value)
            }}
            placeholder="Nickname"
          />
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
                font({ textStyle: 'footnote' }),
                error === null
                  ? foregroundStyle({ style: 'secondary', type: 'hierarchical' })
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
            label={pairing ? 'Pairing…' : 'Add environment'}
            modifiers={[disabled(pairing || link.trim() === '')]}
            onPress={(): void => {
              submit()
            }}
          />
        </Section>
      </Form>
    </Host>
  )
}
