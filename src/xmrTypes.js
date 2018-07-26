/**
 * Created by paul on 8/26/17.
 */
// @flow

import type { EdgeTransaction } from 'edge-core-js'
import { currencyInfo } from './currencyInfoXMR.js'
export const DATA_STORE_FOLDER = 'txEngineFolder'
export const DATA_STORE_FILE = 'walletLocalData.json'
export const PRIMARY_CURRENCY = currencyInfo.currencyCode

export type MoneroSettings = {
  mymoneroApiServers: Array<string>
}

export type SendFundsOptions = {
  isRingCT: boolean,
  target_address: string, // currency-ready wallet address, but not an OA address (resolve before calling)
  nettype: string,
  amount: number, // number
  wallet__keyImage_cache: Object,
  wallet__public_address: string,
  wallet__private_keys: Object,
  wallet__public_keys: Object,
  hostedMoneroAPIClient: Object,
  monero_openalias_utils: Object,
  payment_id: string | null,
  mixin: number,
  simple_priority: number,
  doNotBroadcast: boolean
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
  enabledTokens: Array<string>
  transactionsObj: { [currencyCode: string]: Array<EdgeTransaction> }

  constructor (jsonString: string | null) {
    this.blockHeight = 0

    const totalBalances: { [currencyCode: string]: string } = { XMR: '0' }
    this.totalBalances = totalBalances

    this.nextNonce = '0'

    this.lastAddressQueryHeight = 0
    this.lockedXmrBalance = '0'

    // Dumb extra local var needed to make Flow happy
    const transactionsObj: {
      [currencyCode: string]: Array<EdgeTransaction>
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
