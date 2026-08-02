import { Button, Form, Section, Text, TextField } from '@expo/ui/swift-ui'
import { disabled, font, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'

import { ScreenHost } from '@/components/screen-host'

import { useReviewCommentActions } from './hooks/use-review-comments'

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export function CommentComposeScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ body?: string; id?: string; path?: string }>()
  const path = firstParam(params.path)
  const id = firstParam(params.id)
  const initialBody = firstParam(params.body)
  const [body, setBody] = useState(initialBody)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const actions = useReviewCommentActions()

  useEffect(() => {
    setBody(initialBody)
  }, [initialBody])

  async function submit(): Promise<void> {
    const trimmed = body.trim()
    if (path === '' || trimmed === '') {
      setError('Choose a file and write a comment first.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (id === '') await actions.add(path, trimmed)
      else await actions.edit(id, trimmed)
      router.back()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the comment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenHost>
      <Form>
        <Section title={id === '' ? 'Comment on file' : 'Edit comment'}>
          <Text modifiers={[font({ textStyle: 'footnote' })]}>{path}</Text>
          <TextField
            axis="vertical"
            modifiers={[textInputAutocapitalization('sentences')]}
            onTextChange={(value: string): void => setBody(value)}
            placeholder="What should the agent check or change?"
          />
        </Section>
        <Section>
          <Button
            label={saving ? 'Saving…' : id === '' ? 'Add comment' : 'Save comment'}
            modifiers={[disabled(saving || body.trim() === '' || path === '')]}
            onPress={(): void => {
              submit()
            }}
            systemImage="paperplane"
          />
          {error === null ? null : <Text>{error}</Text>}
        </Section>
      </Form>
    </ScreenHost>
  )
}
