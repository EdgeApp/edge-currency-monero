// @flow

import { div, mul, toFixed } from 'biggystring'
import {
  type EdgeCorePluginOptions,
  type EdgeDenomination,
  type EdgeEncodeUri,
  type EdgeIo,
  type EdgeLog,
  type EdgeParsedUri,
  type EdgeWalletInfo
} from 'edge-core-js/types'
import { type CppBridge as CppBridgeType } from 'react-native-mymonero-core'
import CppBridge from 'react-native-mymonero-core/src/CppBridge.js'
import { parse, serialize } from 'uri-js'

import { currencyInfo } from './moneroInfo.js'
import {
  type MoneroNetworkInfo,
  type PrivateKeys,
  type PublicKeys
} from './moneroTypes.js'

function getDenomInfo(denom: string): EdgeDenomination | void {
  return currencyInfo.denominations.find(element => {
    return element.name === denom
  })
}

function getParameterByName(param: string, url: string): string | null {
  const name = param.replace(/[[\]]/g, '\\$&')
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  const results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

export class MoneroTools {
  cppBridge: CppBridgeType
  io: EdgeIo
  log: EdgeLog
  networkInfo: MoneroNetworkInfo = {
    defaultServer: 'https://edge.mymonero.com:8443',
    nettype: 'MAINNET'
  }

  constructor(env: EdgeCorePluginOptions) {
    const { io, log, nativeIo } = env

    // Grab the raw C++ API and wrap it in argument parsing:
    const cppModule = nativeIo['edge-currency-monero']
    this.cppBridge = new CppBridge(cppModule)

    this.io = io
    this.log = log
  }

  async createPrivateKey(walletType: string) {
    const type = walletType.replace('wallet:', '')

    if (type === 'monero') {
      const result = await this.cppBridge.generateWallet(
        'english',
        this.networkInfo.nettype
      )
      const privateKeys: PrivateKeys = {
        moneroKey: result.mnemonic,
        moneroSpendKeyPrivate: result.privateSpendKey,
        moneroSpendKeyPublic: result.publicSpendKey
      }
      return privateKeys
    } else {
      throw new Error('InvalidWalletType')
    }
  }

  async derivePublicKey(walletInfo: EdgeWalletInfo) {
    const type = walletInfo.type.replace('wallet:', '')
    if (type === 'monero') {
      const result = await this.cppBridge.seedAndKeysFromMnemonic(
        walletInfo.keys.moneroKey,
        this.networkInfo.nettype
      )
      const publicKeys: PublicKeys = {
        moneroAddress: result.address,
        moneroViewKeyPrivate: result.privateViewKey,
        moneroViewKeyPublic: result.publicViewKey,
        moneroSpendKeyPublic: result.publicSpendKey
      }
      return publicKeys
    } else {
      throw new Error('InvalidWalletType')
    }
  }

  async parseUri(uri: string): Promise<EdgeParsedUri> {
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
      await this.cppBridge.decodeAddress(address, this.networkInfo.nettype)
    } catch (e) {
      throw new Error('InvalidPublicAddressError')
    }

    const amountStr = getParameterByName('amount', uri)
    if (amountStr && typeof amountStr === 'string') {
      const denom = getDenomInfo('XMR')
      if (!denom) {
        throw new Error('InternalErrorInvalidCurrencyCode')
      }
      nativeAmount = mul(amountStr, denom.multiplier)
      nativeAmount = toFixed(nativeAmount, 0, 0)
      currencyCode = 'XMR'
    }
    const uniqueIdentifier = getParameterByName('tx_payment_id', uri)
    const label = getParameterByName('label', uri)
    const message = getParameterByName('message', uri)
    const category = getParameterByName('category', uri)

    const edgeParsedUri: EdgeParsedUri = {
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
    if (label || message || category) {
      edgeParsedUri.metadata = {}
      if (label) {
        edgeParsedUri.metadata.name = label
      }
      if (message) {
        edgeParsedUri.metadata.notes = message
      }
      if (category) {
        edgeParsedUri.metadata.category = category
      }
    }

    return edgeParsedUri
  }

  async encodeUri(obj: EdgeEncodeUri): Promise<string> {
    if (!obj.publicAddress) {
      throw new Error('InvalidPublicAddressError')
    }
    try {
      await this.cppBridge.decodeAddress(
        obj.publicAddress,
        this.networkInfo.nettype
      )
    } catch (e) {
      throw new Error('InvalidPublicAddressError')
    }
    if (!obj.nativeAmount && !obj.label && !obj.message) {
      return obj.publicAddress
    } else {
      let queryString: string = ''

      if (typeof obj.nativeAmount === 'string') {
        const currencyCode: string = 'XMR'
        const nativeAmount: string = obj.nativeAmount
        const denom = getDenomInfo(currencyCode)
        if (!denom) {
          throw new Error('InternalErrorInvalidCurrencyCode')
        }
        const amount = div(nativeAmount, denom.multiplier, 12)

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
