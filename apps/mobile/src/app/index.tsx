import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Text as UiText } from '@/components/ui/text'

export default function Index(): React.JSX.Element {
  const [name, setName] = useState('')
  const [status, setStatus] = useState('Ready to build')

  return (
    <View className="flex-1 bg-background" style={{ flex: 1 }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-6 px-5 pb-10 pt-4"
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-muted-foreground">
                  PORCELAIN / MOBILE
                </Text>
                <Badge>
                  <Text>NativeWind v5</Text>
                </Badge>
              </View>
              <Text className="text-left text-4xl font-extrabold tracking-tight">
                A reusable native surface.
              </Text>
              <Text className="text-base leading-6 text-muted-foreground">
                The mobile UI is now composed from Tailwind utilities and copied-in Reusables, ready
                for the rest of the product to grow around it.
              </Text>
            </View>

            <View className="gap-2 rounded-lg border border-border bg-card px-4 pb-3 pt-3.5">
              <UiText className="font-medium">Foundation online</UiText>
              <UiText className="text-sm leading-relaxed text-muted-foreground">
                This page is plain React Native. No SwiftUI Host, custom row canvas, or DOM bridge
                is involved.
              </UiText>
            </View>

            <Card>
              <CardHeader>
                <CardTitle>Try the primitives</CardTitle>
                <CardDescription>
                  These components come from the React Native Reusables registry.
                </CardDescription>
              </CardHeader>
              <CardContent className="gap-4">
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Your name</Text>
                  <Input
                    accessibilityLabel="Your name"
                    onChangeText={setName}
                    placeholder="Fabio"
                    value={name}
                  />
                </View>
                <View className="flex-row flex-wrap gap-2">
                  <Button
                    onPress={() => {
                      setStatus(name.trim() === '' ? 'Give the button a name' : `Hello, ${name}`)
                    }}
                  >
                    <UiText>Primary action</UiText>
                  </Button>
                  <Button
                    onPress={() => {
                      setStatus('Outline action pressed')
                    }}
                    variant="outline"
                  >
                    <UiText>Outline</UiText>
                  </Button>
                  <Button
                    onPress={() => {
                      setStatus('Secondary action pressed')
                    }}
                    variant="secondary"
                  >
                    <UiText>Secondary</UiText>
                  </Button>
                </View>
              </CardContent>
              <CardFooter className="flex-col items-start gap-3">
                <Separator />
                <Text className="text-sm text-muted-foreground">{status}</Text>
              </CardFooter>
            </Card>

            <View className="gap-2">
              <Text className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Web vocabulary, native canvas
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {['background', 'card', 'primary', 'muted', 'border'].map((token) => (
                  <Badge key={token} variant="outline">
                    <UiText>{token}</UiText>
                  </Badge>
                ))}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}
