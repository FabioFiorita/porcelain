import * as DialogPrimitive from '@rn-primitives/dialog'
import { SymbolView } from 'expo-symbols'
import * as React from 'react'
import {
  type GestureResponderEvent,
  Platform,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type ViewProps,
} from 'react-native'
import { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated'
import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens'
import { ModalBackdrop } from '@/components/ui/modal-backdrop'
import { NativeOnlyAnimatedView } from '@/components/ui/native-only-animated-view'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment

function DialogOverlay({
  className,
  children,
  onPress,
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, 'asChild'> & {
  children?: React.ReactNode
}) {
  const { onOpenChange } = DialogPrimitive.useRootContext()

  function dismissIfBackdrop(event: GestureResponderEvent) {
    onPress?.(event)
    if (event.target === event.currentTarget && !event.isDefaultPrevented()) {
      onOpenChange(false)
    }
  }

  return (
    <FullWindowOverlay>
      <DialogPrimitive.Overlay
        className={cn(
          'absolute bottom-0 left-0 right-0 top-0 z-50 flex items-center justify-center p-3',
          Platform.select({
            web: 'animate-in fade-in-0 fixed cursor-default bg-black/40 backdrop-blur-sm [&>*]:cursor-auto',
          }),
          className,
        )}
        style={Platform.OS === 'web' ? undefined : StyleSheet.absoluteFill}
        {...props}
        asChild={Platform.OS !== 'web'}
      >
        {Platform.OS === 'web' ? (
          children
        ) : (
          <NativeOnlyAnimatedView
            entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(140).reduceMotion(ReduceMotion.System)}
            style={StyleSheet.absoluteFill}
          >
            <ModalBackdrop
              accessibilityLabel="Dismiss"
              onPress={dismissIfBackdrop}
              testID="porcelain-dialog-backdrop"
            />
            <View
              pointerEvents="box-none"
              style={[
                StyleSheet.absoluteFill,
                { alignItems: 'center', justifyContent: 'center', padding: 12 },
              ]}
            >
              <NativeOnlyAnimatedView
                entering={FadeIn.delay(40).reduceMotion(ReduceMotion.System)}
                exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.System)}
              >
                {children}
              </NativeOnlyAnimatedView>
            </View>
          </NativeOnlyAnimatedView>
        )}
      </DialogPrimitive.Overlay>
    </FullWindowOverlay>
  )
}

function DialogContent({
  className,
  portalHost,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  portalHost?: string
}) {
  return (
    <DialogPortal hostName={portalHost}>
      <DialogOverlay>
        <DialogPrimitive.Content
          className={cn(
            'bg-background border-border z-50 mx-auto flex w-full max-w-[calc(100%-2rem)] flex-col gap-4 overflow-hidden rounded-xl border p-6 shadow-lg shadow-black/20 sm:max-w-lg',
            Platform.select({
              web: 'animate-in fade-in-0 zoom-in-95 duration-200',
            }),
            className,
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close
            className={cn(
              'absolute right-4 top-4 rounded opacity-70 active:opacity-100',
              Platform.select({
                web: 'ring-offset-background focus:ring-ring data-[state=open]:bg-accent transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2',
              }),
            )}
            hitSlop={12}
          >
            <DialogCloseIcon />
            <Text className="sr-only">Close</Text>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogOverlay>
    </DialogPortal>
  )
}

/** SF Symbol close — avoids lucide/RNSVG red "U" placeholders on the current iOS dev client. */
function DialogCloseIcon(): React.JSX.Element {
  const tint = useColorScheme() === 'dark' ? '#F5F7FA' : '#171A1C'
  return (
    <SymbolView
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      name={{ android: 'close', ios: 'xmark' }}
      size={16}
      tintColor={tint}
      weight="medium"
    />
  )
}

function DialogHeader({ className, ...props }: ViewProps) {
  return (
    <View className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />
  )
}

function DialogFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-foreground text-lg font-semibold leading-none', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
