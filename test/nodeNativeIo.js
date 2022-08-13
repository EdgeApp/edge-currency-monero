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
  'createAndSignTx',
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
  'prepareTx',
  'seedAndKeysFromMnemonic'
]) {
  bridge[method] = async function (...args) {
    const bridge = await bridgePromise
    return bridge.Module[method](...args)
  }
}

export const nativeIo: EdgeNativeIo = {
  'edge-currency-monero': bridge
}
