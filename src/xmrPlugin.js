/**
 * Created by paul on 8/8/17.
 */
// @flow

import {
  type EdgeCorePluginOptions,
  type EdgeCurrencyEngine,
  type EdgeCurrencyEngineOptions,
  type EdgeCurrencyPlugin,
  type EdgeCurrencyTools,
  type EdgeWalletInfo
} from 'edge-core-js/types'
import CppBridge from 'react-native-mymonero-core/src/CppBridge.js'

import { makeMoneroTools } from './MoneroTools.js'
import { MyMoneroApi } from './MyMoneroApi.js'
import { MoneroEngine } from './xmrEngine.js'
import { currencyInfo } from './xmrInfo.js'
import {
  asSafeWalletInfo,
  DATA_STORE_FILE,
  WalletLocalData
} from './xmrTypes.js'

export function makeMoneroPlugin(
  opts: EdgeCorePluginOptions
): EdgeCurrencyPlugin {
  const { io, nativeIo, initOptions = { apiKey: '' } } = opts

  // Grab the raw C++ API and wrap it in argument parsing:
  const cppModule = nativeIo['edge-currency-monero']
  const cppBridge = new CppBridge(cppModule)
  const myMoneroApi = new MyMoneroApi(cppBridge, {
    apiKey: initOptions.apiKey,
    apiServer: 'https://edge.mymonero.com:8443',
    fetch: io.fetch,
    nettype: 'MAINNET'
  })

  let toolsPromise: Promise<EdgeCurrencyTools>
  function makeCurrencyTools(): Promise<EdgeCurrencyTools> {
    if (toolsPromise != null) return toolsPromise
    toolsPromise = makeMoneroTools(io, opts.log, initOptions, myMoneroApi)
    return toolsPromise
  }

  async function makeCurrencyEngine(
    walletInfo: EdgeWalletInfo,
    opts: EdgeCurrencyEngineOptions
  ): Promise<EdgeCurrencyEngine> {
    const safeWalletInfo = asSafeWalletInfo(walletInfo)

    const tools: EdgeCurrencyTools = await makeCurrencyTools()
    const moneroEngine = new MoneroEngine(
      tools,
      io,
      safeWalletInfo,
      myMoneroApi,
      opts
    )
    await moneroEngine.init()
    try {
      const result = await moneroEngine.walletLocalDisklet.getText(
        DATA_STORE_FILE
      )
      moneroEngine.walletLocalData = new WalletLocalData(result)
      moneroEngine.walletLocalData.moneroAddress =
        moneroEngine.walletInfo.keys.moneroAddress
      moneroEngine.walletLocalData.moneroViewKeyPrivate =
        moneroEngine.walletInfo.keys.moneroViewKeyPrivate
      moneroEngine.walletLocalData.moneroViewKeyPublic =
        moneroEngine.walletInfo.keys.moneroViewKeyPublic
      moneroEngine.walletLocalData.moneroSpendKeyPublic =
        moneroEngine.walletInfo.keys.moneroSpendKeyPublic
    } catch (err) {
      try {
        opts.log(err)
        opts.log('No walletLocalData setup yet: Failure is ok')
        moneroEngine.walletLocalData = new WalletLocalData(null)
        moneroEngine.walletLocalData.moneroAddress =
          moneroEngine.walletInfo.keys.moneroAddress
        moneroEngine.walletLocalData.moneroViewKeyPrivate =
          moneroEngine.walletInfo.keys.moneroViewKeyPrivate
        moneroEngine.walletLocalData.moneroViewKeyPublic =
          moneroEngine.walletInfo.keys.moneroViewKeyPublic
        moneroEngine.walletLocalData.moneroSpendKeyPublic =
          moneroEngine.walletInfo.keys.moneroSpendKeyPublic
        await moneroEngine.walletLocalDisklet.setText(
          DATA_STORE_FILE,
          JSON.stringify(moneroEngine.walletLocalData)
        )
      } catch (e) {
        opts.log.error(
          'Error writing to localDataStore. Engine not started:' + e
        )
      }
    }

    const out: EdgeCurrencyEngine = moneroEngine
    return out
  }

  return {
    currencyInfo,
    makeCurrencyEngine,
    makeCurrencyTools
  }
}
