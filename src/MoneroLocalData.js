// @flow

import { type EdgeTransaction } from 'edge-core-js'

import { currencyInfo } from './xmrInfo.js'

export const DATA_STORE_FILE = 'txEngineFolder/walletLocalData.json'
export const PRIMARY_CURRENCY = currencyInfo.currencyCode

export class MoneroLocalData {
  blockHeight: number
  lastAddressQueryHeight: number
  lockedXmrBalance: string
  nextNonce: string
  hasLoggedIn: boolean
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
