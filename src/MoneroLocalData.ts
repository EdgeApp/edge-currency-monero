import {
  asArray,
  asBoolean,
  asCodec,
  asEither,
  asJSON,
  asNull,
  asNumber,
  asObject,
  asOptional,
  asString,
  asTuple,
  Cleaner,
  uncleaner
} from 'cleaners'
import type { EdgeTokenId } from 'edge-core-js'

import { asPocketChangeSetting } from './moneroTypes'

export const DATA_STORE_FILE = 'txEngineFolder/walletLocalData.json'
export const PRIMARY_CURRENCY_TOKEN_ID = null

const asNotNull: Cleaner<unknown> = (value: unknown) => {
  if (value == null) throw new Error('Expected EdgeTransaction')
  return value
}

const asMap = <K, V>(
  asKey: Cleaner<K>,
  asValue: Cleaner<V>
): Cleaner<Map<K, V>> => {
  return asCodec(
    value => {
      const unknownEntries =
        value instanceof Map ? Array.from(value.entries()) : value
      // TODO: Merge "Expected a Map" to TypeError message
      const entries = asArray(asTuple(asKey, asValue))(unknownEntries)
      return new Map(entries)
    },
    map => {
      const entries = map.entries()
      const entriesArray = Array.from(entries)
      return entriesArray
    }
  )
}

const asEdgeToken: Cleaner<EdgeTokenId> = asEither(asString, asNull)
const asCompatibleEdgeToken: Cleaner<EdgeTokenId> = (value: unknown) => {
  // Backwards compatibility when the token used to be currencyCode
  if (value === 'XMR') return null
  return asEdgeToken(value)
}

export type MoneroLocalData = ReturnType<typeof asMoneroLocalData>
export const asMoneroLocalData = asJSON(
  asObject({
    blockHeight: asOptional(asNumber, 0),
    hasLoggedIn: asOptional(asBoolean, false),
    lastAddressQueryHeight: asOptional(asNumber, 0),
    lockedXmrBalance: asOptional(asString, '0'),
    nextNonce: asOptional(asString, '0'),
    totalBalances: asOptional(
      asMap(asEdgeToken, asString),
      () => new Map([[null, '0']])
    ),
    enabledTokens: asOptional(asArray(asCompatibleEdgeToken), [
      PRIMARY_CURRENCY_TOKEN_ID
    ]),
    transactionsObj: asOptional(
      asMap(asEdgeToken, asArray(asNotNull)),
      () => new Map<EdgeTokenId, unknown[]>()
    ),
    pocketChangeSetting: asOptional(asPocketChangeSetting)
  })
)

export const wasMoneroLocalData = uncleaner(asMoneroLocalData)
