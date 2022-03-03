// @flow

import { type EdgeNativeIo } from 'edge-core-js/types'
import { monero_utils_promise } from 'mymonero-core-js'

/**
 * We are emulating the `react-native-mymonero-core` API
 * using the `mymonero-core-js` WASM module.
 */
const bridge: any = {}
for (const method of [
  'is_subaddress',
  'is_integrated_address',
  'new_payment_id',
  'new__int_addr_from_addr_and_short_pid',
  'decode_address',
  'newly_created_wallet',
  'are_equal_mnemonics',
  'mnemonic_from_seed',
  'seed_and_keys_from_mnemonic',
  'validate_components_for_login',
  'address_and_keys_from_seed',
  'generate_key_image',
  'generate_key_derivation',
  'derive_public_key',
  'derive_subaddress_public_key',
  'decodeRct',
  'estimated_tx_network_fee',
  'send_step1__prepare_params_for_get_decoys',
  'send_step2__try_create_transaction'
]) {
  bridge[method] = async function (...args) {
    const monero_utils = await monero_utils_promise
    return monero_utils[method](...args)
  }
}

export const nativeIo: EdgeNativeIo = {
  'edge-currency-monero': bridge
}
