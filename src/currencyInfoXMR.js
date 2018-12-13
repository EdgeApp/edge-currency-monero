/* global */
// @flow

import type { EdgeCurrencyInfo } from 'edge-core-js'
import type { MoneroSettings } from './xmrTypes.js'

const otherSettings: MoneroSettings = {
  mymoneroApiServers: [
    'https://edge.mymonero.com:8443'
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
  requiredConfirmations: 10,
  walletTypes: [
    'wallet:monero'
  ],

  defaultSettings,

  addressExplorer: 'https://xmrchain.net/tx/%s',
  transactionExplorer: 'https://xmrchain.net/tx/%s',

  denominations: [
    // An array of Objects of the possible denominations for this currency
    {
      name: 'XMR',
      multiplier: '1000000000000',
      symbol: '‎ɱ'
    }
  ],
  symbolImage: 'https://developer.airbitz.co/content/monero-logo-solo-64.png', // Base64 encoded png image of the currency symbol (optional)
  symbolImageDarkMono: 'https://developer.airbitz.co/content/monero-logo-solo-64.png', // Base64 encoded png image of the currency symbol (optional)
  metaTokens: []
}
