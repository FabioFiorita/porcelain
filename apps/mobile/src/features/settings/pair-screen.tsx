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

import {
  addEnvironment,
  describePairingProblem,
  type PairingLinkProblem,
  parsePairingLink,
} from '@/lib/environments'
import { useAccentColor } from '@/theme/colors'

/**
 * Two fields, matching what the desktop hands out: a name for this device's list, and the
 * `…/pair#token=…` link Settings → Share copies. Same link the browser client redeems, so
 * there is one pairing artefact to explain and no QR scanner to justify a camera permission.
 */
export function PairScreen(): React.JSX.Element {
  const accentColor = useAccentColor()
  const [nickname, setNickname] = useState('')
  const [link, setLink] = useState('')
  const [problem, setProblem] = useState<PairingLinkProblem | null>(null)

  function submit(): void {
    const parsed = parsePairingLink(link)
    if (!parsed.ok) {
      setProblem(parsed.problem)
      return
    }
    const trimmed = nickname.trim()
    addEnvironment(trimmed === '' ? hostOf(parsed.link.baseUrl) : trimmed, parsed.link)
    router.back()
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
              setProblem(null)
            }}
            placeholder="Pairing link"
          />
        </Section>
        <Section
          footer={
            <Text
              modifiers={[
                font({ textStyle: 'footnote' }),
                problem === null
                  ? foregroundStyle({ style: 'secondary', type: 'hierarchical' })
                  : // iOS systemRed — a rejected paste is the one thing on this screen that must shout.
                    foregroundStyle({ color: '#FF3B30', type: 'color' }),
              ]}
            >
              {problem === null
                ? 'Desktop → Settings → Share → Pair a device. Links expire 15 minutes after you create one.'
                : describePairingProblem(problem)}
            </Text>
          }
        >
          <Button
            label="Add environment"
            modifiers={[disabled(link.trim() === '')]}
            onPress={submit}
          />
        </Section>
      </Form>
    </Host>
  )
}

/** `http://beelink.local:43117` → `beelink.local` — a sane default when the name is left blank. */
function hostOf(baseUrl: string): string {
  const host = baseUrl.replace(/^https?:\/\//i, '')
  const port = host.lastIndexOf(':')
  return port === -1 ? host : host.slice(0, port)
}
