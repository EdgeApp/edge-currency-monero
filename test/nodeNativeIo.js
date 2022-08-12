// @flow

import makeBridge from '@mymonero/mymonero-monero-client'
import { type EdgeNativeIo } from 'edge-core-js/types'

const bridgePromise = makeBridge({})

/**
 * We are emulating the `react-native-mymonero-core` API
 * using the `@mymonero/mymonero-monero-client` WASM module.
 */
const bridge: any = {}
for (const method of [
  'addressAndKeysFromSeed',
  'compareMnemonics',
  'createTransaction',
  'decodeAddress',
  'estimateTxFee',
  'generateKeyImage',
  'generatePaymentId',
  'generateWallet',
  'isIntegratedAddress',
  'isSubaddress',
  'isValidKeys',
  'mnemonicFromSeed',
  'newIntegratedAddress',
  'seedAndKeysFromMnemonic'
]) {
  bridge[method] = async function (...args) {
    const bridge = await bridgePromise
    return bridge[method](...args)
  }
}

export const nativeIo: EdgeNativeIo = {
  'edge-currency-monero': bridge
}
