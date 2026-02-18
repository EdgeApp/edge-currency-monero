/**
 * Created by paul on 8/26/17.
 */

import {
  asBoolean,
  asCodec,
  asMaybe,
  asObject,
  asOptional,
  asString,
  asValue,
  Cleaner,
  uncleaner
} from 'cleaners'
import type { EdgeCurrencyTools, EdgeWalletInfo } from 'edge-core-js'
import type { Nettype } from 'react-native-mymonero-core'

export const asMoneroInitOptions = asObject({
  edgeApiKey: asOptional(asString, '')
})

export interface MoneroNetworkInfo {
  defaultServer: string
  nettype: Nettype
}

export const asMoneroUserSettings = asObject({
  enableCustomServers: asMaybe(asBoolean, false),
  moneroLightwalletServer: asMaybe(asString),
  networkPrivacy: asOptional(asValue('none', 'nym'), 'none')
})
export type MoneroUserSettings = ReturnType<typeof asMoneroUserSettings>

export const asPrivateKeys = asObject({
  moneroKey: asString,
  moneroSpendKeyPrivate: asString,
  moneroSpendKeyPublic: asString
})
export type PrivateKeys = ReturnType<typeof asPrivateKeys>

export const asPublicKeys = asObject({
  moneroAddress: asString,
  moneroViewKeyPrivate: asString,
  moneroViewKeyPublic: asString,
  moneroSpendKeyPublic: asString
})
export type PublicKeys = ReturnType<typeof asPublicKeys>

export const asSafeWalletInfo = asObject({
  id: asString,
  type: asString,
  keys: asPublicKeys
})
export type SafeWalletInfo = ReturnType<typeof asSafeWalletInfo>

export const makeSafeWalletInfo = async (
  tools: EdgeCurrencyTools,
  walletInfo: EdgeWalletInfo
): Promise<SafeWalletInfo> => {
  // @ts-expect-error
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

export const asSeenTxCheckpoint: Cleaner<number | undefined> = asCodec(
  v => (v == null ? undefined : parseInt(asString(v))),
  v => (v == null ? undefined : v.toString())
)
export const wasSeenTxCheckpoint = uncleaner(asSeenTxCheckpoint)

// PocketChange types
export const asPocketChangeSetting = asObject({
  enabled: asBoolean,
  amountPiconero: asString
})
export type PocketChangeSetting = ReturnType<typeof asPocketChangeSetting>

// PocketChange slot tracking: each slot represents a pocket output.
// A slot is "funded" when txPubKey is non-empty, "empty" otherwise.
export const asPocketSlot = asObject({
  amount: asOptional(asString, '0'),
  txPubKey: asOptional(asString, '')
})
export type PocketSlot = ReturnType<typeof asPocketSlot>

export const POCKET_SLOT_COUNT = 14
export const POCKET_SLOT_MIN = 6
export const POCKET_SLOT_MAX = 14
