/**
 * Created by paul on 8/8/17.
 */

import type {
  EdgeCorePluginOptions,
  EdgeCurrencyPlugin
} from 'edge-core-js/types'

import { makeCurrencyEngine } from './MoneroEngine'
import { currencyInfo } from './moneroInfo'
import { MoneroTools } from './MoneroTools'

export function makeMoneroPlugin(
  env: EdgeCorePluginOptions
): EdgeCurrencyPlugin {
  const tools = new MoneroTools(env)

  return {
    currencyInfo,

    async makeCurrencyEngine(walletInfo, opts) {
      return await makeCurrencyEngine(env, tools, walletInfo, opts)
    },

    async makeCurrencyTools() {
      return tools
    }
  }
}
