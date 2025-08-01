/* eslint-disable @typescript-eslint/no-var-requires */

const path = require('path');
const { EnvironmentPlugin } = require('webpack');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const { stylePaths } = require('./stylePaths');
const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || '9000';
const PROXY_HOST = process.env.PROXY_HOST || 'localhost';
const PROXY_PORT = process.env.PROXY_PORT || '4000';
const PROXY_PROTOCOL = process.env.PROXY_PROTOCOL || 'http:';
const MOCK_API_ENABLED = process.env.MOCK_API_ENABLED || 'false';
const relativeDir = path.resolve(__dirname, '..');
const APP_PREFIX = process.env.APP_PREFIX || '/workspaces';

module.exports = merge(common('development'), {
  mode: 'development',
  devtool: 'eval-source-map',
  devServer: {
    host: HOST,
    port: PORT,
    historyApiFallback: {
      index: APP_PREFIX + '/index.html',
    },
    open: [APP_PREFIX],
    static: {
      directory: path.resolve(relativeDir, 'dist'),
      publicPath: APP_PREFIX,
    },
    client: {
      overlay: true,
    },
    proxy: [
      {
        context: ['/api'],
        target: {
          host: PROXY_HOST,
          protocol: PROXY_PROTOCOL,
          port: PROXY_PORT,
        },
        changeOrigin: true,
      },
    ],
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        include: [...stylePaths],
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new EnvironmentPlugin({
      WEBPACK_REPLACE__mockApiEnabled: MOCK_API_ENABLED,
    }),
  ],
});
