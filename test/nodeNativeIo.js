// @flow

import makeBridge from '@mymonero/mymonero-monero-client'
import type { EdgeNativeIo } from 'edge-core-js/types'
import type { NativeMyMoneroCore } from 'react-native-mymonero-core'

const bridgePromise: Promise<any> = makeBridge({})

/**
 * We are emulating the `react-native-mymonero-core` API
 * using the `@mymonero/mymonero-monero-client` WASM module.
 */
const bridge: NativeMyMoneroCore = {
  callMyMonero(name, jsonArguments) {
    return bridgePromise.then(bridge => bridge.Module[name](...jsonArguments))
  },

  methodNames: [
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
  ]
}

export const nativeIo: EdgeNativeIo = {
  'edge-currency-monero': bridge
}
