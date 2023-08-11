// @flow

import 'regenerator-runtime/runtime'

import { makeMoneroPlugin } from './moneroPlugin.js'

const edgeCorePlugins = {
  monero: makeMoneroPlugin
}

export default edgeCorePlugins

if (
  typeof window !== 'undefined' &&
  typeof window.addEdgeCorePlugins === 'function'
) {
  window.addEdgeCorePlugins(edgeCorePlugins)
}
