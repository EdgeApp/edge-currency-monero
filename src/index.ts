import 'regenerator-runtime/runtime'

import type { EdgeCorePlugins } from 'edge-core-js/types'

import { makeMoneroPlugin } from './moneroPlugin'

declare global {
  interface Window {
    addEdgeCorePlugins?: (plugins: EdgeCorePlugins) => void
  }
}

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
