// @flow

import type { EdgeFetchFunction } from 'edge-core-js'
import type {
  CppBridge,
  CreatedTransaction,
  DecodedAddress,
  GeneratedWallet,
  Nettype,
  Priority,
  SeedAndKeys
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

export type LoginResult = {
  new_address: boolean,
  start_height: number
}

export type CreateTransactionOptions = {
  amount: string,
  isSweepTx?: boolean,
  paymentId?: string,
  priority?: Priority,
  targetAddress: string
}

/**
 * Brings together the mymonero server, JavaScript utilities,
 * and native C++ methods into a coherent API.
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

  async decodeAddress(address: string): Promise<DecodedAddress> {
    return await this.cppBridge.decodeAddress(address, this.nettype)
  }

  async generateWallet(language: string = 'english'): Promise<GeneratedWallet> {
    return await this.cppBridge.generateWallet(language, this.nettype)
  }

  async seedAndKeysFromMnemonic(mnemonic: string): Promise<SeedAndKeys> {
    return await this.cppBridge.seedAndKeysFromMnemonic(mnemonic, this.nettype)
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
    // const asLogin = asObject({
    //   new_address: asBoolean,
    //   start_height: asNumber
    // })

    return result // TODO: Clean this
  }

  async getTransactions(keys: WalletKeys): Promise<Object[]> {
    const { address, privateSpendKey, privateViewKey, publicSpendKey } = keys
    const result = await this.fetchPostMyMonero('get_address_txs', {
      address,
      api_key: this.apiKey,
      view_key: privateViewKey
    })
    // asGetAddressTxs = asObject({
    //   blockchain_height: asNumber,
    //   scanned_block_height: asNumber,
    //   scanned_height: asNumber,
    //   start_height: asNumber,
    //   total_received: asString,
    //   transaction_height: asNumber,
    //   transactions: asArray(asObject({
    //     coinbase: asBoolean,
    //     hash: asString,
    //     height: asNumber,
    //     id: asNumber,
    //     mempool: asBoolean,
    //     mixin: asNumber,
    //     timestamp: asDate,
    //     total_received: asString,
    //     total_sent: asString,
    //     unlock_time: asNumber
    //   }))
    // })

    const parsed = await parserUtils.Parsed_AddressTransactions__async(
      this.keyImageCache,
      result,
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
    // const asAddressInfo = asObject({
    //   blockchain_height: asNumber,
    //   locked_funds: asString,
    //   rates: asObject(asNumber),
    //   scanned_block_height: asNumber,
    //   scanned_height: asNumber,
    //   spent_outputs: asArray(
    //     asObject({
    //       amount: asString,
    //       key_image: asString,
    //       mixin: asNumber,
    //       out_index: asNumber,
    //       tx_pub_key: asString
    //     })
    //   ),
    //   start_height: asNumber,
    //   total_received: asString,
    //   total_sent: asString,
    //   transaction_height: asNumber
    // })

    const parsed = await parserUtils.Parsed_AddressInfo__async(
      this.keyImageCache,
      result,
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

  async fetchPostMyMonero(cmd: string, params: any): any {
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
