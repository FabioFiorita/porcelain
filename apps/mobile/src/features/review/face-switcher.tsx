import { Picker, Text } from '@expo/ui/swift-ui'
import { disabled, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers'

export type ReviewFace = 'intent' | 'execution' | 'evidence'

export function FaceSwitcher({
  evidenceEnabled,
  face,
  onChange,
}: {
  evidenceEnabled: boolean
  face: ReviewFace
  onChange: (face: ReviewFace) => void
}): React.JSX.Element {
  return (
    <Picker
      modifiers={[pickerStyle('segmented')]}
      onSelectionChange={(next: string): void => {
        if (next === 'evidence' && !evidenceEnabled) return
        if (next === 'intent' || next === 'execution' || next === 'evidence') onChange(next)
      }}
      selection={face}
    >
      <Text modifiers={[tag('intent')]}>Intent</Text>
      <Text modifiers={[tag('execution')]}>Execution</Text>
      <Text modifiers={[disabled(!evidenceEnabled), tag('evidence')]}>Evidence</Text>
    </Picker>
  )
}
