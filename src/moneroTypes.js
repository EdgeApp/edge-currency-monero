/**
 * Created by paul on 8/26/17.
 */
// @flow

import { asObject, asOptional, asString } from 'cleaners'
import { type EdgeCurrencyTools, type EdgeWalletInfo } from 'edge-core-js'
import { type Nettype } from 'react-native-mymonero-core'

export const asMoneroInitOptions = asObject({
  apiKey: asOptional(asString, '')
})

export type MoneroNetworkInfo = {
  defaultServer: string,
  nettype: Nettype
}

export type MoneroSettings = {
  mymoneroApiServers: string[]
}

export const asPrivateKeys = asObject({
  moneroKey: asString,
  moneroSpendKeyPrivate: asString,
  moneroSpendKeyPublic: asString
})
export type PrivateKeys = $Call<typeof asPrivateKeys>

export const asPublicKeys = asObject({
  moneroAddress: asString,
  moneroViewKeyPrivate: asString,
  moneroViewKeyPublic: asString,
  moneroSpendKeyPublic: asString
})
export type PublicKeys = $Call<typeof asPublicKeys>

export const asSafeWalletInfo = asObject({
  id: asString,
  type: asString,
  keys: asPublicKeys
})
export type SafeWalletInfo = $Call<typeof asSafeWalletInfo>

export const makeSafeWalletInfo = async (
  tools: EdgeCurrencyTools,
  walletInfo: EdgeWalletInfo
): Promise<SafeWalletInfo> => {
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
