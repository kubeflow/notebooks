/* eslint-disable @typescript-eslint/no-var-requires */

const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const { EnvironmentPlugin } = require('webpack');
const { stylePaths } = require('./stylePaths');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserJSPlugin = require('terser-webpack-plugin');

const PRODUCTION = process.env.PRODUCTION || 'false';

module.exports = merge(common('production'), {
  mode: 'production',
  devtool: 'source-map',
  optimization: {
    minimizer: [
      new TerserJSPlugin({}),
      new CssMinimizerPlugin({
        minimizerOptions: {
          preset: ['default', { mergeLonghand: false }],
        },
      }),
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[name].bundle.css',
    }),
    new EnvironmentPlugin({
      PRODUCTION,
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        include: [...stylePaths],
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
});
