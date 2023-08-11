// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { MoneroSettings } from './moneroTypes.js'

const otherSettings: MoneroSettings = {
  mymoneroApiServers: ['https://edge.mymonero.com:8443']
}

const defaultSettings: any = {
  otherSettings
}

export const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'XMR',
  displayName: 'Monero',
  pluginId: 'monero',
  requiredConfirmations: 10,
  walletType: 'wallet:monero',

  defaultSettings,

  addressExplorer: 'https://xmrchain.net/search?value=%s',
  transactionExplorer:
    'https://blockchair.com/monero/transaction/%s?from=edgeapp',

  denominations: [
    // An array of Objects of the possible denominations for this currency
    {
      name: 'XMR',
      multiplier: '1000000000000',
      symbol: '‎ɱ'
    }
  ],
  metaTokens: [],

  unsafeMakeSpend: true,
  unsafeSyncNetwork: true
}
