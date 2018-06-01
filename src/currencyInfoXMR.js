/* global */
// @flow

import type { EdgeCurrencyInfo } from 'edge-core-js'
import type { MoneroSettings } from './xmrTypes.js'

const otherSettings: MoneroSettings = {
  mymoneroApiServers: [
    'https://api.mymonero.com:8443'
  ]
}

const defaultSettings: any = {
  otherSettings
}

export const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'XMR',
  currencyName: 'Monero',
  pluginName: 'monero',
  walletTypes: [
    'wallet:monero'
  ],

  defaultSettings,

  addressExplorer: 'https://moneroblocks.info/search/%s',
  transactionExplorer: 'https://moneroblocks.info/tx/%s',

  denominations: [
    // An array of Objects of the possible denominations for this currency
    {
      name: 'XMR',
      multiplier: '1000000000000',
      symbol: '‎ɱ'
    }
  ],
  symbolImage: 'https://developer.airbitz.co/content/monero-symbol-orange-64.png', // Base64 encoded png image of the currency symbol (optional)
  symbolImageDarkMono: 'https://developer.airbitz.co/content/monero-symbol-64-87939D.png', // Base64 encoded png image of the currency symbol (optional)
  metaTokens: []
}
