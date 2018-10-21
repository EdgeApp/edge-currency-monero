/**
 * Created by paul on 8/8/17.
 */
// @flow
import { currencyInfo } from './currencyInfoXMR.js'
import { MoneroEngine } from './currencyEngineXMR.js'
import { DATA_STORE_FILE, DATA_STORE_FOLDER, WalletLocalData } from './xmrTypes.js'
import type {
  EdgeCurrencyEngine,
  EdgeCurrencyEngineOptions,
  EdgeParsedUri,
  EdgeEncodeUri,
  EdgeCurrencyPlugin,
  EdgeCurrencyPluginFactory,
  EdgeWalletInfo
} from 'edge-core-js'
import { parse, serialize } from 'uri-js'
import { bns } from 'biggystring'

import { MyMoneroApi } from 'mymonero-core-js'

let request

if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
  // $FlowFixMe
  request = new XMLHttpRequest() // eslint-disable-line no-undef
} else {
  request = require('request')
}

let io

function getDenomInfo (denom: string) {
  return currencyInfo.denominations.find(element => {
    return element.name === denom
  })
}

function getParameterByName (param, url) {
  const name = param.replace(/[[\]]/g, '\\$&')
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  const results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

export const moneroCurrencyPluginFactory: EdgeCurrencyPluginFactory = {
  pluginType: 'currency',
  pluginName: currencyInfo.pluginName,

  async makePlugin (opts: any): Promise<EdgeCurrencyPlugin> {
    io = opts.io

    console.log(`Creating Currency Plugin for monero`)
    const options = {
      appUserAgentProduct: 'tester',
      appUserAgentVersion: '0.0.1',
      apiServer: 'https://edge.mymonero.com:8443',
      fetch: io.fetch,
      request,
      randomBytes: io.random
    }
    const myMoneroApi = new MyMoneroApi(options)
    await myMoneroApi.init()

    const moneroPlugin: EdgeCurrencyPlugin = {
      pluginName: 'monero',
      currencyInfo,

      createPrivateKey: async (walletType: string) => {
        const type = walletType.replace('wallet:', '')

        if (type === 'monero') {
          const result = await myMoneroApi.createWallet()
          return {
            moneroKey: result.mnemonic,
            moneroSpendKeyPrivate: result.moneroSpendKeyPrivate,
            moneroSpendKeyPublic: result.moneroSpendKeyPublic
          }
        } else {
          throw new Error('InvalidWalletType')
        }
      },

      derivePublicKey: async (walletInfo: EdgeWalletInfo) => {
        const type = walletInfo.type.replace('wallet:', '')
        if (type === 'monero') {
          const result = await myMoneroApi.createWalletFromMnemonic(walletInfo.keys.moneroKey)
          return {
            moneroAddress: result.moneroAddress,
            moneroViewKeyPrivate: result.moneroViewKeyPrivate,
            moneroViewKeyPublic: result.moneroViewKeyPublic,
            moneroSpendKeyPublic: result.moneroSpendKeyPublic
          }
        } else {
          throw new Error('InvalidWalletType')
        }
      },

      async makeEngine (walletInfo: EdgeWalletInfo, opts: EdgeCurrencyEngineOptions): Promise<EdgeCurrencyEngine> {
        const moneroEngine = new MoneroEngine(this, io, walletInfo, myMoneroApi, opts)
        await moneroEngine.init()
        try {
          const result =
            await moneroEngine.walletLocalFolder
              .folder(DATA_STORE_FOLDER)
              .file(DATA_STORE_FILE)
              .getText(DATA_STORE_FOLDER, 'walletLocalData')

          moneroEngine.walletLocalData = new WalletLocalData(result)
          moneroEngine.walletLocalData.moneroAddress = moneroEngine.walletInfo.keys.moneroAddress
          moneroEngine.walletLocalData.moneroViewKeyPrivate = moneroEngine.walletInfo.keys.moneroViewKeyPrivate
          moneroEngine.walletLocalData.moneroViewKeyPublic = moneroEngine.walletInfo.keys.moneroViewKeyPublic
          moneroEngine.walletLocalData.moneroSpendKeyPublic = moneroEngine.walletInfo.keys.moneroSpendKeyPublic
        } catch (err) {
          try {
            console.log(err)
            console.log('No walletLocalData setup yet: Failure is ok')
            moneroEngine.walletLocalData = new WalletLocalData(null)
            moneroEngine.walletLocalData.moneroAddress = moneroEngine.walletInfo.keys.moneroAddress
            moneroEngine.walletLocalData.moneroViewKeyPrivate = moneroEngine.walletInfo.keys.moneroViewKeyPrivate
            moneroEngine.walletLocalData.moneroViewKeyPublic = moneroEngine.walletInfo.keys.moneroViewKeyPublic
            moneroEngine.walletLocalData.moneroSpendKeyPublic = moneroEngine.walletInfo.keys.moneroSpendKeyPublic
            await moneroEngine.walletLocalFolder
              .folder(DATA_STORE_FOLDER)
              .file(DATA_STORE_FILE)
              .setText(JSON.stringify(moneroEngine.walletLocalData))
          } catch (e) {
            console.log('Error writing to localDataStore. Engine not started:' + err)
          }
        }
        return moneroEngine
      },

      parseUri: (uri: string) => {
        const parsedUri = parse(uri)
        let address: string
        let nativeAmount: string | null = null
        let currencyCode: string | null = null

        if (
          typeof parsedUri.scheme !== 'undefined' &&
          parsedUri.scheme !== 'monero'
        ) {
          throw new Error('InvalidUriError') // possibly scanning wrong crypto type
        }
        if (typeof parsedUri.host !== 'undefined') {
          address = parsedUri.host
        } else if (typeof parsedUri.path !== 'undefined') {
          address = parsedUri.path
        } else {
          throw new Error('InvalidUriError')
        }
        address = address.replace('/', '') // Remove any slashes

        try {
          // verify address is decodable for currency
          myMoneroApi.decodeAddress(address)
        } catch (e) {
          throw new Error('InvalidPublicAddressError')
        }

        const amountStr = getParameterByName('amount', uri)
        if (amountStr && typeof amountStr === 'string') {
          const denom = getDenomInfo('XMR')
          if (!denom) {
            throw new Error('InternalErrorInvalidCurrencyCode')
          }
          nativeAmount = bns.mul(amountStr, denom.multiplier)
          nativeAmount = bns.toFixed(nativeAmount, 0, 0)
          currencyCode = 'XMR'
        }
        const uniqueIdentifier = getParameterByName('tx_payment_id', uri)
        const label = getParameterByName('label', uri)
        const message = getParameterByName('message', uri)

        const edgeParsedUri:EdgeParsedUri = {
          publicAddress: address
        }
        if (nativeAmount) {
          edgeParsedUri.nativeAmount = nativeAmount
        }
        if (currencyCode) {
          edgeParsedUri.currencyCode = currencyCode
        }
        if (uniqueIdentifier) {
          edgeParsedUri.uniqueIdentifier = uniqueIdentifier
        }
        if (label || message) {
          edgeParsedUri.metadata = {}
          if (label) {
            edgeParsedUri.metadata.name = label
          }
          if (message) {
            edgeParsedUri.metadata.message = message
          }
        }

        return edgeParsedUri
      },

      encodeUri: (obj: EdgeEncodeUri) => {
        if (!obj.publicAddress) {
          throw new Error('InvalidPublicAddressError')
        }
        try {
          myMoneroApi.decodeAddress(obj.publicAddress)
        } catch (e) {
          throw new Error('InvalidPublicAddressError')
        }
        if (!obj.nativeAmount && !obj.label && !obj.message) {
          return obj.publicAddress
        } else {
          let queryString: string = ''

          if (typeof obj.nativeAmount === 'string') {
            const currencyCode: string = 'XMR'
            const nativeAmount:string = obj.nativeAmount
            const denom = getDenomInfo(currencyCode)
            if (!denom) {
              throw new Error('InternalErrorInvalidCurrencyCode')
            }
            const amount = bns.div(nativeAmount, denom.multiplier, 12)

            queryString += 'amount=' + amount + '&'
          }
          if (typeof obj.label === 'string') {
            queryString += 'label=' + obj.label + '&'
          }
          if (typeof obj.message === 'string') {
            queryString += 'message=' + obj.message + '&'
          }
          queryString = queryString.substr(0, queryString.length - 1)

          const serializeObj = {
            scheme: 'monero',
            path: obj.publicAddress,
            query: queryString
          }
          const url = serialize(serializeObj)
          return url
        }
      }
    }

    async function initPlugin (opts: any) {
      return moneroPlugin
    }
    return initPlugin(opts)
  }
}
