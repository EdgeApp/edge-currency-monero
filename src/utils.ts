/**
 * Created by paul on 8/26/17.
 */

import { asArray, asObject, asOptional, asString } from 'cleaners'
import type { EdgeTransaction } from 'edge-core-js/types'

export function normalizeAddress(address: string): string {
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

export function cleanTxLogs(tx: EdgeTransaction): string {
  return JSON.stringify(asCleanTxLogs(tx))
}

/**
 * A ponyfill for `Promise.any`.
 * Once we upgrade our browser environment,
 * we can just use the built-in one instead.
 */
export async function promiseAny<T>(promises: Array<Promise<T>>): Promise<T> {
  const errors: unknown[] = []

  return await new Promise((resolve: Function, reject: Function) => {
    let pending = promises.length
    for (const promise of promises) {
      promise.then(
        value => {
          resolve(value)
        },
        error => {
          errors.push(error)
          if (--pending === 0) {
            // Match what the Node.js Promise.any does:
            reject(errors)
          }
        }
      )
    }
  })
}
