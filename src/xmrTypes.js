/**
 * Created by paul on 8/26/17.
 */
// @flow

import { asObject, asString } from 'cleaners'
import {
  type EdgeCurrencyTools,
  type EdgeTransaction,
  type EdgeWalletInfo
} from 'edge-core-js'

import { currencyInfo } from './xmrInfo.js'

export const DATA_STORE_FILE = 'txEngineFolder/walletLocalData.json'
export const PRIMARY_CURRENCY = currencyInfo.currencyCode

export type MoneroSettings = {
  mymoneroApiServers: string[]
}

export class WalletLocalData {
  blockHeight: number
  lastAddressQueryHeight: number
  lockedXmrBalance: string
  nextNonce: string
  hasLoggedIn: boolean
  moneroAddress: string
  moneroViewKeyPrivate: string
  moneroViewKeyPublic: string
  moneroSpendKeyPublic: string
  totalBalances: { [currencyCode: string]: string }
  enabledTokens: string[]
  transactionsObj: { [currencyCode: string]: EdgeTransaction[] }

  constructor(jsonString: string | null) {
    this.blockHeight = 0

    const totalBalances: { [currencyCode: string]: string } = { XMR: '0' }
    this.totalBalances = totalBalances

    this.nextNonce = '0'

    this.lastAddressQueryHeight = 0
    this.lockedXmrBalance = '0'

    // Dumb extra local var needed to make Flow happy
    const transactionsObj: {
      [currencyCode: string]: EdgeTransaction[]
    } = {}
    this.transactionsObj = transactionsObj

    this.moneroAddress = ''
    this.moneroViewKeyPrivate = ''
    this.moneroViewKeyPublic = ''
    this.moneroSpendKeyPublic = ''
    this.hasLoggedIn = false
    this.enabledTokens = [PRIMARY_CURRENCY]
    if (jsonString !== null) {
      const data = JSON.parse(jsonString)

      if (typeof data.blockHeight === 'number') {
        this.blockHeight = data.blockHeight
      }
      if (typeof data.hasLoggedIn === 'boolean') {
        this.hasLoggedIn = data.hasLoggedIn
      }
      if (typeof data.lastAddressQueryHeight === 'string') {
        this.lastAddressQueryHeight = data.lastAddressQueryHeight
      }
      if (typeof data.lockedXmrBalance === 'string') {
        this.lockedXmrBalance = data.lockedXmrBalance
      }
      if (typeof data.moneroAddress === 'string') {
        this.moneroAddress = data.moneroAddress
      }
      if (typeof data.moneroViewKeyPrivate === 'string') {
        this.moneroViewKeyPrivate = data.moneroViewKeyPrivate
      }
      if (typeof data.moneroViewKeyPublic === 'string') {
        this.moneroViewKeyPublic = data.moneroViewKeyPublic
      }
      if (typeof data.moneroSpendKeyPublic === 'string') {
        this.moneroSpendKeyPublic = data.moneroSpendKeyPublic
      }
      if (typeof data.totalBalances !== 'undefined') {
        this.totalBalances = data.totalBalances
      }
      if (typeof data.enabledTokens !== 'undefined') {
        this.enabledTokens = data.enabledTokens
      }
      if (typeof data.transactionsObj !== 'undefined') {
        this.transactionsObj = data.transactionsObj
      }
    }
  }
}

export const asPrivateKeys = asObject({
  moneroKey: asString,
  moneroSpendKeyPrivate: asString,
  moneroSpendKeyPublic: asString
})
export type PrivateKeys = $Call<typeof asPrivateKeys>

export const asPublicKeys = asObject({
  moneroAddress: asString,
  moneroViewKeyPrivate: asString,
  moneroViewKeyPublic: asString,
  moneroSpendKeyPublic: asString
})
export type PublicKeys = $Call<typeof asPublicKeys>

export const asSafeWalletInfo = asObject({
  id: asString,
  type: asString,
  keys: asPublicKeys
})
export type SafeWalletInfo = $Call<typeof asSafeWalletInfo>

export const makeSafeWalletInfo = async (
  tools: EdgeCurrencyTools,
  walletInfo: EdgeWalletInfo
): Promise<SafeWalletInfo> => {
  const safeWalletInfo: SafeWalletInfo = {}
  if (
    typeof walletInfo.keys.moneroAddress !== 'string' ||
    typeof walletInfo.keys.moneroViewKeyPrivate !== 'string' ||
    typeof walletInfo.keys.moneroViewKeyPublic !== 'string' ||
    typeof walletInfo.keys.moneroSpendKeyPublic !== 'string'
  ) {
    const pubKeys = await tools.derivePublicKey(walletInfo)
    return {
      id: walletInfo.id,
      type: walletInfo.type,
      keys: {
        moneroAddress: pubKeys.moneroAddress,
        moneroViewKeyPrivate: pubKeys.moneroViewKeyPrivate,
        moneroViewKeyPublic: pubKeys.moneroViewKeyPublic,
        moneroSpendKeyPublic: pubKeys.moneroSpendKeyPublic
      }
    }
  }

  return safeWalletInfo
}
