import { Button, Form, Section, Text, TextField, useNativeState } from '@expo/ui/swift-ui'
import { disabled } from '@expo/ui/swift-ui/modifiers'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert } from 'react-native'

import { DaemonGate } from '@/components/daemon-gate'
import { ScreenHost } from '@/components/screen-host'
import { useActiveRepo } from '@/lib/daemon/repo'

import { nextTerminalNumber } from './terminal-naming'
import { useTerminalSessions } from './use-terminal-sessions'
import { useTerminalStream } from './use-terminal-stream'

let terminalNumberFloor = 0

export function NewTerminalScreen(): React.JSX.Element {
  return (
    <DaemonGate requires="repo">
      <NewTerminalForm />
    </DaemonGate>
  )
}

function NewTerminalForm(): React.JSX.Element {
  const repo = useActiveRepo()
  const roster = useTerminalSessions(true)
  const stream = useTerminalStream(null)
  const [name, setName] = useState(() => nextName(roster.sessions.map((session) => session.name)))
  const [cwd, setCwd] = useState(repo?.path ?? '')
  const [nameEdited, setNameEdited] = useState(false)
  const [cwdEdited, setCwdEdited] = useState(false)
  const [creating, setCreating] = useState(false)
  const nativeName = useNativeState(name)
  const nativeCwd = useNativeState(cwd)

  useEffect(() => {
    if (nameEdited) return
    const next = nextName(roster.sessions.map((session) => session.name))
    nativeName.set(next)
    setName(next)
  }, [nameEdited, nativeName, roster.sessions])

  useEffect(() => {
    if (cwdEdited || repo === null) return
    nativeCwd.set(repo.path)
    setCwd(repo.path)
  }, [cwdEdited, nativeCwd, repo])

  async function submit(): Promise<void> {
    const trimmedName = name.trim()
    const trimmedCwd = cwd.trim()
    if (trimmedName === '' || trimmedCwd === '') {
      Alert.alert('Start a shell', 'Name and cwd are required.')
      return
    }
    setCreating(true)
    try {
      const id = await stream.create({ cwd: trimmedCwd, name: trimmedName })
      if (id === '') {
        Alert.alert(
          'Terminal limit reached',
          'The daemon is at its 64-terminal limit. Kill one and try again.',
        )
        return
      }
      router.replace({ params: { id }, pathname: '/session/[id]' })
    } catch (error) {
      Alert.alert('Could not start terminal', error instanceof Error ? error.message : 'Try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <ScreenHost>
      <Form>
        <Section title="New terminal">
          <TextField
            onTextChange={(value: string): void => {
              setNameEdited(true)
              nativeName.set(value)
              setName(value)
            }}
            placeholder="Name"
            text={nativeName}
          />
          <TextField
            onTextChange={(value: string): void => {
              setCwdEdited(true)
              nativeCwd.set(value)
              setCwd(value)
            }}
            placeholder="Daemon path"
            text={nativeCwd}
          />
        </Section>
        <Section footer={<Text>Paths are resolved on the daemon host, not on this iPhone.</Text>}>
          <Button
            label={creating ? 'Starting…' : 'Start shell'}
            modifiers={[disabled(creating || name.trim() === '' || cwd.trim() === '')]}
            onPress={(): void => {
              submit()
            }}
            systemImage="terminal"
          />
        </Section>
      </Form>
    </ScreenHost>
  )
}

function nextName(existingNames: readonly string[]): string {
  terminalNumberFloor = nextTerminalNumber(existingNames, terminalNumberFloor)
  return `Terminal ${terminalNumberFloor}`
}
