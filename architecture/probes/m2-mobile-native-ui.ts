import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants: 'mobile native ui',
  gate: 'lint',
  rule: 'porcelain(mobile-native-ui)',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/mobile/src/features/files/views/files-screen.tsx',
      content: "export { Pressable as CustomButton } from 'react-native';\n",
    },
  ],
} satisfies Probe;
