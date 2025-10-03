import type { EdgeCurrencyInfo } from 'edge-core-js/types'

import type { MoneroUserSettings } from './moneroTypes.js'

export const MONERO_LWS_SERVER = 'https://monerolws1.edge.app'

const defaultSettings: MoneroUserSettings = {
  enableCustomServers: false,
  moneroLightwalletServer: MONERO_LWS_SERVER
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
      symbol: 'ɱ'
    }
  ],
  metaTokens: [],

  unsafeMakeSpend: true,
  unsafeSyncNetwork: true,
  chainDisplayName: 'Monero',
  assetDisplayName: 'Monero'
}
