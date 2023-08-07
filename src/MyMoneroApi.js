// @flow

import {
  asArray,
  asBoolean,
  asNumber,
  asObject,
  asOptional,
  asString
} from 'cleaners'
import type { EdgeFetchFunction } from 'edge-core-js'
import type {
  CppBridge,
  CreatedTransaction,
  Nettype,
  Priority
} from 'react-native-mymonero-core'

const parserUtils = require('./mymonero-utils/ResponseParser.js')

export type MyMoneroApiOptions = {
  apiKey: string,
  apiServer: string,
  fetch: EdgeFetchFunction,
  nettype?: Nettype
}

/**
 * Keys needed to uniquely identify a wallet for most operations.
 */
export type WalletKeys = {|
  address: string,
  privateSpendKey: string,
  privateViewKey: string,
  publicSpendKey: string
|}

export type BalanceResults = {
  blockHeight: number,
  lockedBalance: string,
  totalReceived: string,
  totalSent: string
}

export type CreateTransactionOptions = {
  amount: string,
  isSweepTx?: boolean,
  paymentId?: string,
  priority?: Priority,
  targetAddress: string
}

const asLoginResult = asObject({
  generated_locally: asOptional(asBoolean), // Flag from initial account creation
  new_address: asBoolean, // Whether account was just created
  start_height: asOptional(asNumber), // Account scanning start block
  view_key: asOptional(asString) // View key bytes
})
export type LoginResult = $Call<typeof asLoginResult>

const asSpentOutput = asObject({
  amount: asString, // XMR possibly being spent
  key_image: asString, // Bytes of the key image
  mixin: asNumber, // Mixin of the spend
  out_index: asNumber, // Index of source output
  tx_pub_key: asString // Bytes of the tx public key
})

/**
 * Methods for talking to the Monero Lightwallet API.
 * See https://github.com/monero-project/meta/blob/master/api/lightwallet_rest.md
 */
export class MyMoneroApi {
  // Network options:
  apiKey: string
  apiUrl: string
  nettype: Nettype

  // Dependency injection:
  cppBridge: CppBridge
  fetch: EdgeFetchFunction

  // Maps from key identifiers (a bunch of concatenated stuff) to key images:
  keyImageCache: { [keyId: string]: string }

  constructor(cppBridge: CppBridge, options: MyMoneroApiOptions) {
    this.apiKey = options.apiKey
    this.apiUrl = options.apiServer
    this.nettype = options.nettype ?? 'MAINNET'

    this.fetch = options.fetch
    this.cppBridge = cppBridge

    this.keyImageCache = {}
  }

  changeServer(apiUrl: string, apiKey: string) {
    this.apiKey = apiKey
    this.apiUrl = apiUrl
  }

  /**
   * Authenticates with the MyMonero light-wallet server.
   */
  async login(keys: WalletKeys): Promise<LoginResult> {
    const { address, privateViewKey } = keys
    const result = await this.fetchPostMyMonero('login', {
      address: address,
      api_key: this.apiKey,
      create_account: true,
      view_key: privateViewKey
    })

    return asLoginResult(result)
  }

  async getTransactions(keys: WalletKeys): Promise<Object[]> {
    const { address, privateSpendKey, privateViewKey, publicSpendKey } = keys
    const result = await this.fetchPostMyMonero('get_address_txs', {
      address,
      api_key: this.apiKey,
      view_key: privateViewKey
    })

    const asGetAddressTxs = asObject({
      blockchain_height: asNumber, // Current blockchain height
      scanned_block_height: asNumber, // Current scan progress
      scanned_height: asNumber, // Current tx scan progress
      start_height: asNumber, // Start height of response
      total_received: asString, // Sum of received outputs
      transaction_height: asOptional(asNumber),
      transactions: asArray(
        asObject({
          coinbase: asBoolean, // True if tx is coinbase
          hash: asString, // Bytes of tx hash
          height: asNumber, // Block height
          id: asNumber, // Index of tx in blockchain
          mempool: asBoolean, // True if tx is in mempool
          mixin: asNumber, // Mixin of the receive
          payment_id: asOptional(asString), // Bytes of tx payment id
          spent_outputs: asOptional(asArray(asSpentOutput)), // List of possible spends
          timestamp: asString, // Timestamp of block
          total_received: asString, // Total XMR received
          total_sent: asString, // XMR possibly being spent
          unlock_time: asNumber // Tx unlock time field
        })
      )
    })

    const parsed = await parserUtils.Parsed_AddressTransactions__async(
      this.keyImageCache,
      asGetAddressTxs(result),
      address,
      privateViewKey,
      publicSpendKey,
      privateSpendKey,
      this.cppBridge
    )
    return parsed.serialized_transactions
  }

  async getAddressInfo(keys: WalletKeys): Promise<BalanceResults> {
    const { address, privateSpendKey, privateViewKey, publicSpendKey } = keys
    const result = await this.fetchPostMyMonero('get_address_info', {
      address,
      api_key: this.apiKey,
      view_key: privateViewKey
    })

    const asAddressInfo = asObject({
      blockchain_height: asNumber, // Current blockchain height
      locked_funds: asString, // Sum of unspendable XMR
      rates: asObject(asNumber), // Rates
      scanned_block_height: asNumber, // Current scan progress
      scanned_height: asNumber, // Current tx scan progress
      spent_outputs: asOptional(asArray(asSpentOutput)), // Possible spend info
      start_height: asNumber, // Start height of response
      total_received: asString, // Sum of received XMR
      total_sent: asString, // Sum of possibly spent XMR
      transaction_height: asNumber // Total txes sent in Monero
    })

    const parsed = await parserUtils.Parsed_AddressInfo__async(
      this.keyImageCache,
      asAddressInfo(result),
      address,
      privateViewKey,
      publicSpendKey,
      privateSpendKey,
      this.cppBridge
    )
    return {
      blockHeight: parsed.blockchain_height,
      totalReceived: parsed.total_received_String,
      lockedBalance: parsed.locked_balance_String,
      totalSent: parsed.total_sent_String
    }
  }

  async createTransaction(
    keys: WalletKeys,
    opts: CreateTransactionOptions
  ): Promise<CreatedTransaction> {
    const { address, privateSpendKey, privateViewKey, publicSpendKey } = keys
    const {
      amount,
      isSweepTx = false,
      paymentId,
      priority = 1,
      targetAddress
    } = opts

    // Grab the UTXO set:
    const unspentOuts = await this.fetchPostMyMonero('get_unspent_outs', {
      address,
      amount: '0',
      api_key: this.apiKey,
      dust_threshold: '2000000000',
      mixin: 15,
      use_dust: true,
      view_key: privateViewKey
    })

    // Grab some random outputs to mix in:
    const randomOutsCb = async (count: number): Promise<any> => {
      const amounts: string[] = []
      for (let i = 0; i < count; ++i) amounts.push('0')
      return await this.fetchPostMyMonero('get_random_outs', {
        amounts,
        api_key: this.apiKey,
        count: 16
      })
    }

    // Make the transaction:
    return await this.cppBridge.createTransaction({
      destinations: [
        {
          send_amount: amount,
          to_address: targetAddress
        }
      ],
      priority,
      address,
      paymentId,
      privateViewKey,
      publicSpendKey,
      privateSpendKey,
      shouldSweep: isSweepTx,
      nettype: this.nettype,
      unspentOuts,
      randomOutsCb
    })
  }

  async broadcastTransaction(tx: string): Promise<void> {
    await this.fetchPostMyMonero('submit_raw_tx', {
      api_key: this.apiKey,
      tx
    })
  }

  // Private routines
  // ----------------

  async fetchPostMyMonero(cmd: string, params: any): Promise<any> {
    const url = `${this.apiUrl}/${cmd}`
    const response = await this.fetch(url, {
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      method: 'POST'
    })
    if (!response.ok) {
      throw new Error(
        `The server returned error code ${response.status} for ${url}`
      )
    }
    return response.json()
  }
}
