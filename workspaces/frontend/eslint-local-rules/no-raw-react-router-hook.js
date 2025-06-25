module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow use of raw react-router-dom hooks. Use typed wrappers instead.',
    },
    messages: {
      avoidRawHook:
        'Use "{{typedHook}}" from `~/app/routerHelper` instead of raw React Router hook "{{rawHook}}".',
    },
    schema: [],
  },

  create(context) {
    const forbiddenHooks = {
      useNavigate: 'useTypedNavigate',
      useParams: 'useTypedParams',
      useSearchParams: 'useTypedSearchParams',
      useLocation: 'useTypedLocation',
    };

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'react-router-dom') {
          return;
        }

        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            Object.prototype.hasOwnProperty.call(forbiddenHooks, specifier.imported.name)
          ) {
            context.report({
              node: specifier,
              messageId: 'avoidRawHook',
              data: {
                rawHook: specifier.imported.name,
                typedHook: forbiddenHooks[specifier.imported.name],
              },
            });
          }
        }
      },
    };
  },
};
