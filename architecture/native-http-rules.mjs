const routeSource = /\/apps\/server\/src\/http\/routes\/.+\.ts$/;
const rawMethods = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'route',
  'all',
  'register',
  'addHook',
]);

export const nativeHttpRules = {
  'feature-route-registrations': {
    create(context) {
      if (
        !routeSource.test(context.filename.replaceAll('\\', '/')) ||
        /\.spec\.ts$/.test(context.filename)
      )
        return {};
      return {
        CallExpression(node) {
          const callee = node.callee;
          if (
            callee.type === 'MemberExpression' &&
            rawMethods.has(
              callee.computed ? callee.property?.value : callee.property?.name,
            )
          )
            context.report({
              node,
              message:
                'Register feature endpoints through the typed Effect group, because raw transport registrations bypass the shared contract and scope policy.',
            });
        },
      };
    },
  },
};
