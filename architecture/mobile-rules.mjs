import { mobileNativeSourceProblem } from './policy.ts';

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
  'Text',
  'StyleSheet',
]);

export const mobileRules = {
  'mobile-native-source-owner': {
    create(context) {
      const message = mobileNativeSourceProblem(context.filename);
      return message
        ? {
            Program(node) {
              context.report({ node, message });
            },
          }
        : {};
    },
  },
  'mobile-system-chrome': {
    create(context) {
      const path = context.filename.replaceAll('\\', '/');
      if (!path.includes('/apps/mobile/src/')) return {};
      const message =
        'Let the system size and draw native chrome: a fixed frame, font size or Host size, or a hidden shared background, copies the system look by hand, because a hand-made copy breaks on the next OS design.';
      const numeric = (property) =>
        property.type === 'Property' &&
        property.value.type === 'Literal' &&
        typeof property.value.value === 'number';
      const keyOf = (property) => property.key?.name ?? property.key?.value;
      const sized = (node, keys) =>
        node?.type === 'ObjectExpression' &&
        node.properties.some(
          (property) => numeric(property) && keys.has(keyOf(property)),
        );
      const lengths = new Set([
        'width',
        'height',
        'minWidth',
        'minHeight',
        'maxWidth',
        'maxHeight',
      ]);
      return {
        CallExpression(node) {
          if (node.callee.type !== 'Identifier') return;
          const [argument] = node.arguments;
          if (
            (node.callee.name === 'frame' && sized(argument, lengths)) ||
            (node.callee.name === 'font' && sized(argument, new Set(['size'])))
          )
            context.report({ node, message });
        },
        JSXAttribute(node) {
          const name = node.name.name;
          const element = node.parent;
          if (name === 'hidesSharedBackground')
            context.report({ node, message });
          if (
            name === 'style' &&
            element?.name?.name === 'Host' &&
            node.value?.type === 'JSXExpressionContainer' &&
            sized(node.value.expression, lengths)
          )
            context.report({ node, message });
        },
      };
    },
  },
  'mobile-native-ui': {
    create(context) {
      const path = context.filename.replaceAll('\\', '/');
      if (!path.includes('/apps/mobile/src/')) return {};
      const primitive =
        /\/apps\/mobile\/src\/components\/ui\/[a-z-]+(?:\.(?:ios|android))?\.tsx?$/.test(
          path,
        );
      const message =
        'Draw custom content and controls only in components/ui; use Expo UI and expo-router for system chrome and .ios/.android modules for platform differences, because feature views compose primitives instead of duplicating them.';
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
          source === 'expo' &&
          !primitive &&
          node.specifiers?.some(
            (specifier) =>
              specifier.type === 'ImportNamespaceSpecifier' ||
              (specifier.imported?.name ?? specifier.local?.name) ===
                'requireNativeView',
          )
        )
          context.report({
            node,
            message:
              'Bind custom native renderers only inside components/ui, because features compose the public primitive instead of bypassing its rendering contract.',
          });
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
            if (
              node.importKind === 'type' ||
              specifier.importKind === 'type' ||
              node.exportKind === 'type' ||
              specifier.exportKind === 'type'
            )
              continue;
            const name = specifier.imported?.name ?? specifier.local?.name;
            if (
              specifier.type !== 'ImportSpecifier' ||
              (controls.has(name) &&
                (!primitive || name === 'Platform' || name === 'Modal'))
            )
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
