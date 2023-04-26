/**
 * Created by paul on 8/26/17.
 * @flow
 */

import { asArray, asObject, asOptional, asString } from 'cleaners'
import { type EdgeTransaction } from 'edge-core-js/types'

export function normalizeAddress(address: string) {
  return address.toLowerCase().replace('0x', '')
}

const asCleanTxLogs = asObject({
  txid: asString,
  spendTargets: asOptional(
    asArray(
      asObject({
        currencyCode: asString,
        nativeAmount: asString,
        publicAddress: asString,
        uniqueIdentifier: asOptional(asString)
      })
    )
  ),
  signedTx: asString
})

export function cleanTxLogs(tx: EdgeTransaction) {
  return JSON.stringify(asCleanTxLogs(tx))
}
