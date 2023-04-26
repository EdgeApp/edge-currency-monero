/**
 * Created by paul on 8/26/17.
 * @flow
 */

import { asArray, asObject, asOptional, asString } from 'cleaners'
import { type EdgeTransaction } from 'edge-core-js/types'
import { validate } from 'jsonschema'

export function normalizeAddress(address: string) {
  return address.toLowerCase().replace('0x', '')
}

export function validateObject(object: any, schema: any) {
  const result = validate(object, schema)

  if (result.errors.length === 0) {
    return true
  } else {
    for (const n in result.errors) {
      const errMsg = result.errors[n].message
      console.log('ERROR: validateObject:' + errMsg)
    }
    return false
  }
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
