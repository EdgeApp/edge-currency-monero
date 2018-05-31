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
import moneroWalletUtils from 'mymonero-core-js/monero_utils/monero_wallet_utils.js'
import { HostedMoneroAPIClient } from './HostedMoneroAPIClient/HostedMoneroAPIClient.Lite.js'

import { network_type as networkType } from 'mymonero-core-js/cryptonote_utils/nettype.js'

const MAINNET = networkType.MAINNET

// import { CurrencyInfoScheme } from './xmrSchema.js'

// export { calcMiningFee } from './miningFees.js'

// const Buffer = require('buffer/').Buffer
// const ethWallet = require('../lib/export-fixes-bundle.js').Wallet
// const EthereumUtil = require('../lib/export-fixes-bundle.js').Util

let io

const randomBuffer = (size) => {
  const array = io.random(size)
  return Buffer.from(array)
}

function getDenomInfo (denom: string) {
  return currencyInfo.denominations.find(element => {
    return element.name === denom
  })
}

// function hexToBuf (hex: string) {
//   const noHexPrefix = hex.replace('0x', '')
//   const noHexPrefixBN = new BN(noHexPrefix, 16)
//   const array = noHexPrefixBN.toArray()
//   const buf = Buffer.from(array)
//   return buf
// }
//
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
      appUserAgent_product: 'edge-currency-monero',
      appUserAgent_version: '1.1.2',
      fetch: io.fetch
      // request_conformant_module: xhr
    }
    const context = {
      HostedMoneroAPIClient_DEBUGONLY_mockSendTransactionSuccess: false,
      isDebug: false
    }
    const hostedMoneroAPIClient = new HostedMoneroAPIClient(options, context)

    const moneroPlugin: EdgeCurrencyPlugin = {
      pluginName: 'monero',
      currencyInfo,

      createPrivateKey: (walletType: string) => {
        const type = walletType.replace('wallet:', '')

        if (type === 'monero') {
          const randBuffer = randomBuffer(32)
          const randHex = randBuffer.toString('hex')
          const wallet = moneroWalletUtils.NewlyCreatedWallet('english', MAINNET, randHex)
          const moneroKey = wallet.mnemonicString
          const moneroSpendKeyPrivate = wallet.keys.spend.sec
          const moneroSpendKeyPublic = wallet.keys.spend.pub
          return {
            moneroKey,
            moneroSpendKeyPrivate,
            moneroSpendKeyPublic
          }
        } else {
          throw new Error('InvalidWalletType')
        }
      },

      derivePublicKey: (walletInfo: EdgeWalletInfo) => {
        const type = walletInfo.type.replace('wallet:', '')
        if (type === 'monero') {
          const wallet = moneroWalletUtils.SeedAndKeysFromMnemonic_sync(walletInfo.keys.moneroKey, 'english', MAINNET)
          const moneroAddress = wallet.keys.public_addr
          const moneroViewKeyPrivate = wallet.keys.view.sec
          const moneroViewKeyPublic = wallet.keys.view.pub
          const moneroSpendKeyPublic = wallet.keys.spend.pub

          return {
            moneroAddress,
            moneroViewKeyPrivate,
            moneroViewKeyPublic,
            moneroSpendKeyPublic
          }
        } else {
          throw new Error('InvalidWalletType')
        }
      },

      async makeEngine (walletInfo: EdgeWalletInfo, opts: EdgeCurrencyEngineOptions): Promise<EdgeCurrencyEngine> {
        const moneroEngine = new MoneroEngine(this, io, walletInfo, hostedMoneroAPIClient, opts)
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

        // TODO: Check if address is valid
        // const valid: boolean = EthereumUtil.isValidAddress(address)
        // if (!valid) {
        //   throw new Error('InvalidPublicAddressError')
        // }
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
        // TODO: Check if address is valid
        // const valid: boolean = EthereumUtil.isValidAddress(obj.publicAddress)
        // if (!valid) {
        //   throw new Error('InvalidPublicAddressError')
        // }
        if (!obj.nativeAmount && !obj.label && !obj.message) {
          return obj.publicAddress
        } else {
          let queryString: string = ''

          if (typeof obj.nativeAmount === 'string') {
            let currencyCode: string = 'XMR'
            const nativeAmount:string = obj.nativeAmount
            if (typeof obj.currencyCode === 'string') {
              currencyCode = obj.currencyCode
            }
            const denom = getDenomInfo(currencyCode)
            if (!denom) {
              throw new Error('InternalErrorInvalidCurrencyCode')
            }
            const amount = bns.div(nativeAmount, denom.multiplier, 12)

            queryString += 'amount=' + amount + '&'
          }
          if (obj.metadata && (obj.metadata.name || obj.metadata.message)) {
            if (typeof obj.metadata.name === 'string') {
              queryString += 'label=' + obj.metadata.name + '&'
            }
            if (typeof obj.metadata.message === 'string') {
              queryString += 'message=' + obj.metadata.message + '&'
            }
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
