module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          chrome: 110,
        },
        useBuiltIns: 'usage',
        corejs: '3',
      },
    ],
    '@babel/preset-react',
    '@babel/preset-typescript',
  ],
  env: {
    test: {
      plugins: [
        [
          'istanbul',
          {
            exclude: [
              '**/__tests__/**',
              '**/__mocks__/**',
              '**/generated/**',
              '**/shared/mock/**',
              '**/*.d.ts',
            ],
          },
        ],
      ],
    },
  },
};
