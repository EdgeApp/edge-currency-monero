import {
  asArray,
  asBoolean,
  asJSON,
  asNumber,
  asObject,
  asOptional,
  asString,
  Cleaner,
  uncleaner
} from 'cleaners'

import { currencyInfo } from './moneroInfo'

export const DATA_STORE_FILE = 'txEngineFolder/walletLocalData.json'
export const PRIMARY_CURRENCY = currencyInfo.currencyCode

const asNotNull: Cleaner<unknown> = (value: unknown) => {
  if (value == null) throw new Error('Expected EdgeTransaction')
  return value
}

export type MoneroLocalData = ReturnType<typeof asMoneroLocalData>
export const asMoneroLocalData = asJSON(
  asObject({
    blockHeight: asOptional(asNumber, 0),
    hasLoggedIn: asOptional(asBoolean, false),
    lastAddressQueryHeight: asOptional(asNumber, 0),
    lockedXmrBalance: asOptional(asString, '0'),
    nextNonce: asOptional(asString, '0'),
    totalBalances: asOptional(asObject(asString), () => ({
      XMR: '0'
    })),
    enabledTokens: asOptional(asArray(asString), [PRIMARY_CURRENCY]),
    transactionsObj: asOptional(asObject(asArray(asNotNull)), () => ({}))
  })
)

export const wasMoneroLocalData = uncleaner(asMoneroLocalData)
