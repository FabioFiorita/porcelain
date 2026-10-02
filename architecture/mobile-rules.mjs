const controls = new Set([
  'Button',
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
  'TextInput',
  'Switch',
  'Modal',
  'Platform',
]);

export const mobileRules = {
  'mobile-native-ui': {
    create(context) {
      const path = context.filename.replaceAll('\\', '/');
      if (!path.includes('/apps/mobile/src/')) return {};
      const message =
        'Use Expo UI for standard controls and .ios/.android capability modules for platform differences; custom touch controls and Platform branches duplicate native behavior.';
      const check = (node) => {
        const source = node.source?.value;
        const runtime =
          node.importKind !== 'type' &&
          node.exportKind !== 'type' &&
          ((node.specifiers?.length ?? 0) === 0 ||
            node.specifiers.some(
              (specifier) =>
                specifier.importKind !== 'type' &&
                specifier.exportKind !== 'type',
            ));
        if (
          runtime &&
          ((source === 'expo-router/native-tabs' &&
            !path.endsWith('/shell/phone-tabs.tsx')) ||
            (path.includes('/shell/tablet-') &&
              /(?:^|\/)phone-tabs(?:\.tsx?)?$/.test(source ?? '')))
        )
          context.report({
            node,
            message:
              'Keep NativeTabs in the phone shell; the tablet owns its root SplitView and master/detail selections, so embedding the phone navigator cannot replace the agreed tablet layout.',
          });
        if (source === 'react-native') {
          for (const specifier of node.specifiers ?? []) {
            const name = specifier.imported?.name ?? specifier.local?.name;
            if (specifier.type !== 'ImportSpecifier' || controls.has(name))
              context.report({ node: specifier, message });
          }
          if (node.type === 'ExportAllDeclaration')
            context.report({ node, message });
        }
        if (
          (source === '@expo/ui/swift-ui' ||
            source?.startsWith('@expo/ui/swift-ui/') ||
            source === '@expo/ui/jetpack-compose' ||
            source?.startsWith('@expo/ui/jetpack-compose/')) &&
          !/\.(?:ios|android)\.tsx?$/.test(path)
        )
          context.report({
            node,
            message:
              'Import the universal Expo UI component first; a missing capability belongs in a .ios/.android module, so product views stay platform independent.',
          });
      };
      return {
        ImportDeclaration: check,
        ExportNamedDeclaration: check,
        ExportAllDeclaration: check,
      };
    },
  },
};
