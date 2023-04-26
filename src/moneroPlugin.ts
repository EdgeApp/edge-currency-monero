/**
 * Created by paul on 8/8/17.
 */
// @flow

import {
  type EdgeCorePluginOptions,
  type EdgeCurrencyPlugin
} from 'edge-core-js/types'

import { makeCurrencyEngine } from './MoneroEngine.js'
import { currencyInfo } from './moneroInfo.js'
import { MoneroTools } from './MoneroTools.js'

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
