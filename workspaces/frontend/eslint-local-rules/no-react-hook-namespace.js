module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow using React hooks through React namespace',
    },
    messages: {
      avoidNamespaceHook: 'Import React hook "{{hook}}" directly instead of using React.{{hook}}.',
    },
    schema: [],
  },
  create(context) {
    const hooks = new Set([
      'useState', 'useEffect', 'useContext', 'useReducer',
      'useCallback', 'useMemo', 'useRef', 'useLayoutEffect',
      'useImperativeHandle', 'useDebugValue', 'useDeferredValue',
      'useTransition', 'useId', 'useSyncExternalStore',
    ]);
    return {
      MemberExpression(node) {
        if (
          node.object?.name === 'React' &&
          hooks.has(node.property?.name)
        ) {
          context.report({
            node,
            messageId: 'avoidNamespaceHook',
            data: { hook: node.property.name },
          });
        }
      },
    };
  },
};
