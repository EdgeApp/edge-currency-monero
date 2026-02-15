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
export interface PocketChangeSetting {
  enabled: boolean
  amountPiconero: string  // Target amount per pocket in atomic units
}

export const asPocketChangeSetting = asObject({
  enabled: asBoolean,
  amountPiconero: asString
})

// PocketChange constants
export const POCKET_AMOUNTS_XMR = [0.1, 0.2, 0.3, 0.5, 0.8, 1.3]
export const POCKET_COUNT_MIN = 6
export const POCKET_COUNT_MAX = 14
