/* global  __dirname, module, require */

const path = require('path')

const babelOptions = {
  // For debugging, just remove "@babel/preset-env":
  presets: ['@babel/preset-env', '@babel/preset-typescript'],
  plugins: [['@babel/plugin-transform-for-of', { assumeArray: true }]],
  cacheDirectory: true
}

module.exports = {
  devtool: 'source-map',
  entry: './src/index.ts',
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: { loader: 'babel-loader', options: babelOptions }
      }
    ]
  },
  output: {
    filename: 'edge-currency-monero.ts',
    path: path.join(path.resolve(__dirname), 'lib/react-native')
  },
  resolve: {
    aliasFields: ['react-native'],
    extensions: ['.ts', '.js'],
    mainFields: ['react-native', 'module', 'main']
  }
}
