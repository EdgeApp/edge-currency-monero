// @flow

import { div, mul, toFixed } from 'biggystring'
import {
  type EdgeCurrencyTools,
  type EdgeDenomination,
  type EdgeEncodeUri,
  type EdgeIo,
  type EdgeLog,
  type EdgeParsedUri,
  type EdgeWalletInfo
} from 'edge-core-js/types'
import { parse, serialize } from 'uri-js'

import { MyMoneroApi } from './MyMoneroApi.js'
import { currencyInfo } from './xmrInfo.js'
import { type PrivateKeys, type PublicKeys } from './xmrTypes.js'

type InitOptions = {
  apiKey: string
}

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

export async function makeMoneroTools(
  io: EdgeIo,
  log: EdgeLog,
  initOptions: InitOptions,
  myMoneroApi: MyMoneroApi
): Promise<EdgeCurrencyTools> {
  log(`Creating Currency Plugin for monero`)

  const moneroPlugin: EdgeCurrencyTools = {
    pluginName: 'monero',
    currencyInfo,
    myMoneroApi,

    createPrivateKey: async (walletType: string) => {
      const type = walletType.replace('wallet:', '')

      if (type === 'monero') {
        const result = await myMoneroApi.generateWallet()
        const privateKeys: PrivateKeys = {
          moneroKey: result.mnemonic,
          moneroSpendKeyPrivate: result.privateSpendKey,
          moneroSpendKeyPublic: result.publicSpendKey
        }
        return privateKeys
      } else {
        throw new Error('InvalidWalletType')
      }
    },

    derivePublicKey: async (walletInfo: EdgeWalletInfo) => {
      const type = walletInfo.type.replace('wallet:', '')
      if (type === 'monero') {
        const result = await myMoneroApi.seedAndKeysFromMnemonic(
          walletInfo.keys.moneroKey
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
    },

    parseUri: async (uri: string): Promise<EdgeParsedUri> => {
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
        await myMoneroApi.decodeAddress(address)
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
    },

    encodeUri: async (obj: EdgeEncodeUri): Promise<string> => {
      if (!obj.publicAddress) {
        throw new Error('InvalidPublicAddressError')
      }
      try {
        await myMoneroApi.decodeAddress(obj.publicAddress)
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

  return moneroPlugin
}
