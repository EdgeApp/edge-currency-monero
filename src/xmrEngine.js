/**
 * Created by paul on 7/7/17.
 */
// @flow

import { div, eq, gte, sub } from 'biggystring'
import type { Disklet } from 'disklet'
import {
  type EdgeCurrencyCodeOptions,
  type EdgeCurrencyEngineCallbacks,
  type EdgeCurrencyEngineOptions,
  type EdgeCurrencyInfo,
  type EdgeCurrencyTools,
  type EdgeDataDump,
  type EdgeEnginePrivateKeyOptions,
  type EdgeFreshAddress,
  type EdgeGetReceiveAddressOptions,
  type EdgeGetTransactionsOptions,
  type EdgeIo,
  type EdgeLog,
  type EdgeMetaToken,
  type EdgeSpendInfo,
  type EdgeToken,
  type EdgeTransaction,
  type JsonObject,
  InsufficientFundsError,
  NoAmountSpecifiedError,
  PendingFundsError
} from 'edge-core-js/types'
import type { CreatedTransaction, Priority } from 'react-native-mymonero-core'

import { DATA_STORE_FILE, MoneroLocalData } from './MoneroLocalData.js'
import {
  type CreateTransactionOptions,
  type MyMoneroApi
} from './MyMoneroApi.js'
import { cleanTxLogs, normalizeAddress } from './utils.js'
import { currencyInfo } from './xmrInfo.js'
import {
  type PrivateKeys,
  type SafeWalletInfo,
  asPrivateKeys,
  makeSafeWalletInfo
} from './xmrTypes.js'

const SYNC_INTERVAL_MILLISECONDS = 5000
const SAVE_DATASTORE_MILLISECONDS = 10000
// const ADDRESS_QUERY_LOOKBACK_BLOCKS = '8' // ~ 2 minutes
// const ADDRESS_QUERY_LOOKBACK_BLOCKS = (4 * 60 * 24 * 7) // ~ one week

const PRIMARY_CURRENCY = currencyInfo.currencyCode

export class MoneroEngine {
  walletInfo: SafeWalletInfo
  edgeTxLibCallbacks: EdgeCurrencyEngineCallbacks
  walletLocalDisklet: Disklet
  engineOn: boolean
  loggedIn: boolean
  addressesChecked: boolean
  walletLocalData: MoneroLocalData
  walletLocalDataDirty: boolean
  transactionsChangedArray: EdgeTransaction[]
  currencyInfo: EdgeCurrencyInfo
  allTokens: EdgeMetaToken[]
  myMoneroApi: MyMoneroApi
  currentSettings: any
  timers: any
  walletId: string
  io: EdgeIo
  log: EdgeLog
  currencyTools: EdgeCurrencyTools

  constructor(
    currencyTools: EdgeCurrencyTools,
    io: EdgeIo,
    walletInfo: SafeWalletInfo,
    myMoneroApi: MyMoneroApi,
    opts: EdgeCurrencyEngineOptions
  ) {
    const { walletLocalDisklet, callbacks } = opts

    this.io = io
    this.log = opts.log
    this.engineOn = false
    this.loggedIn = false
    this.addressesChecked = false
    this.walletLocalDataDirty = false
    this.transactionsChangedArray = []
    this.walletInfo = walletInfo
    this.walletId = walletInfo.id
    this.currencyInfo = currencyInfo
    this.currencyTools = currencyTools
    this.myMoneroApi = myMoneroApi

    this.allTokens = currencyInfo.metaTokens.slice(0)
    // this.customTokens = []
    this.timers = {}

    this.currentSettings = {
      ...opts.userSettings,
      ...this.currencyInfo.defaultSettings
    }

    // Hard coded for testing
    // this.walletInfo.keys.moneroKey = '389b07b3466eed587d6bdae09a3613611de9add2635432d6cd1521af7bbc3757'
    // this.walletInfo.keys.moneroAddress = '0x9fa817e5A48DD1adcA7BEc59aa6E3B1F5C4BeA9a'
    this.edgeTxLibCallbacks = callbacks
    this.walletLocalDisklet = walletLocalDisklet

    this.log(
      `Created Wallet Type ${this.walletInfo.type} for Currency Plugin ${this.currencyInfo.pluginId} `
    )
  }

  async init(): Promise<void> {
    const safeWalletInfo = await makeSafeWalletInfo(
      this.currencyTools,
      this.walletInfo
    )
    this.walletInfo.keys = {
      ...this.walletInfo.keys,
      ...safeWalletInfo.keys
    }
  }

  updateOnAddressesChecked(numTx: number, totalTxs: number): void {
    if (this.addressesChecked) {
      return
    }
    if (numTx !== totalTxs) {
      const progress = numTx / totalTxs
      this.edgeTxLibCallbacks.onAddressesChecked(progress)
    } else {
      this.addressesChecked = true
      this.edgeTxLibCallbacks.onAddressesChecked(1)
      this.walletLocalData.lastAddressQueryHeight =
        this.walletLocalData.blockHeight
    }
  }

  // **********************************************
  // Login to mymonero.com server
  // **********************************************
  async loginIfNewAddress(privateKeys: PrivateKeys): Promise<void> {
    try {
      const result = await this.myMoneroApi.login({
        address: this.walletLocalData.moneroAddress,
        privateViewKey: this.walletLocalData.moneroViewKeyPrivate,
        privateSpendKey: privateKeys.moneroSpendKeyPrivate,
        publicSpendKey: privateKeys.moneroSpendKeyPublic
      })
      if ('new_address' in result && !this.loggedIn) {
        this.loggedIn = true
        this.walletLocalData.hasLoggedIn = true
        this.addToLoop('saveWalletLoop', SAVE_DATASTORE_MILLISECONDS)
      }
    } catch (e) {
      this.log.error('Error logging into mymonero', e)
    }
  }

  // ***************************************************
  // Check address for updated block height and balance
  // ***************************************************
  async checkAddressInnerLoop(privateKeys: PrivateKeys): Promise<void> {
    try {
      const addrResult = await this.myMoneroApi.getAddressInfo({
        address: this.walletLocalData.moneroAddress,
        privateViewKey: this.walletLocalData.moneroViewKeyPrivate,
        privateSpendKey: privateKeys.moneroSpendKeyPrivate,
        publicSpendKey: privateKeys.moneroSpendKeyPublic
      })

      if (this.walletLocalData.blockHeight !== addrResult.blockHeight) {
        this.walletLocalData.blockHeight = addrResult.blockHeight // Convert to decimal
        this.walletLocalDataDirty = true
        this.edgeTxLibCallbacks.onBlockHeightChanged(
          this.walletLocalData.blockHeight
        )
      }

      const nativeBalance = sub(addrResult.totalReceived, addrResult.totalSent)

      if (this.walletLocalData.totalBalances.XMR !== nativeBalance) {
        this.walletLocalData.totalBalances.XMR = nativeBalance
        this.edgeTxLibCallbacks.onBalanceChanged('XMR', nativeBalance)
      }
      this.walletLocalData.lockedXmrBalance = addrResult.lockedBalance
    } catch (e) {
      this.log.error(
        'Error fetching address info: ' + this.walletLocalData.moneroAddress + e
      )
    }
  }

  processMoneroTransaction(tx: any): void {
    const ourReceiveAddresses: string[] = []

    const nativeNetworkFee: string = tx.fee != null ? tx.fee : '0'

    const netNativeAmount: string = sub(tx.total_received, tx.total_sent)

    if (netNativeAmount.slice(0, 1) !== '-') {
      ourReceiveAddresses.push(this.walletLocalData.moneroAddress.toLowerCase())
    }

    let blockHeight = tx.height
    if (tx.mempool) {
      blockHeight = 0
    }

    const date = Date.parse(tx.timestamp) / 1000

    let edgeTransaction: EdgeTransaction = {
      txid: tx.hash,
      date,
      currencyCode: 'XMR',
      blockHeight,
      nativeAmount: netNativeAmount,
      networkFee: nativeNetworkFee,
      ourReceiveAddresses,
      signedTx: '',
      otherParams: {},
      walletId: this.walletId
    }

    const idx = this.findTransaction(PRIMARY_CURRENCY, tx.hash)
    if (idx === -1) {
      this.log(`New transaction: ${tx.hash}`)

      // New transaction not in database
      this.addTransaction(PRIMARY_CURRENCY, edgeTransaction)

      this.edgeTxLibCallbacks.onTransactionsChanged(
        this.transactionsChangedArray
      )
      this.transactionsChangedArray = []
    } else {
      // Already have this tx in the database. See if anything changed
      const transactionsArray: EdgeTransaction[] =
        this.walletLocalData.transactionsObj[PRIMARY_CURRENCY]
      const edgeTx = transactionsArray[idx]

      if (edgeTx.blockHeight !== edgeTransaction.blockHeight) {
        // The native amounts returned from the API take some time before they're accurate. We can trust the amounts we saved instead.
        edgeTransaction = {
          ...edgeTransaction,
          nativeAmount: edgeTx.nativeAmount
        }

        this.log(`Update transaction: ${tx.hash} height:${tx.blockNumber}`)
        this.updateTransaction(PRIMARY_CURRENCY, edgeTransaction, idx)
        this.edgeTxLibCallbacks.onTransactionsChanged(
          this.transactionsChangedArray
        )
        this.transactionsChangedArray = []
      }
    }
  }

  async checkTransactionsInnerLoop(privateKeys: PrivateKeys): Promise<void> {
    // TODO: support partial query by block height once API supports it
    // const endBlock:number = 999999999
    // let startBlock:number = 0
    // if (this.walletLocalData.lastAddressQueryHeight > ADDRESS_QUERY_LOOKBACK_BLOCKS) {
    //   // Only query for transactions as far back as ADDRESS_QUERY_LOOKBACK_BLOCKS from the last time we queried transactions
    //   startBlock = this.walletLocalData.lastAddressQueryHeight - ADDRESS_QUERY_LOOKBACK_BLOCKS
    // }

    try {
      const transactions = await this.myMoneroApi.getTransactions({
        address: this.walletLocalData.moneroAddress,
        privateViewKey: this.walletLocalData.moneroViewKeyPrivate,
        privateSpendKey: privateKeys.moneroSpendKeyPrivate,
        publicSpendKey: privateKeys.moneroSpendKeyPublic
      })

      this.log('Fetched transactions count: ' + transactions.length)

      // Get transactions
      // Iterate over transactions in address
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i]
        this.processMoneroTransaction(tx)
        if (i % 10 === 0) {
          this.updateOnAddressesChecked(i, transactions.length)
        }
      }
      this.updateOnAddressesChecked(transactions.length, transactions.length)
    } catch (e) {
      this.log.error('checkTransactionsInnerLoop', e)
    }
  }

  findTransaction(currencyCode: string, txid: string): any {
    if (
      typeof this.walletLocalData.transactionsObj[currencyCode] === 'undefined'
    ) {
      return -1
    }

    const currency = this.walletLocalData.transactionsObj[currencyCode]
    return currency.findIndex(element => {
      return normalizeAddress(element.txid) === normalizeAddress(txid)
    })
  }

  sortTxByDate(a: EdgeTransaction, b: EdgeTransaction): number {
    return b.date - a.date
  }

  addTransaction(currencyCode: string, edgeTransaction: EdgeTransaction): void {
    // Add or update tx in transactionsObj
    const idx = this.findTransaction(currencyCode, edgeTransaction.txid)

    if (idx === -1) {
      this.log.warn(
        'addTransaction: adding and sorting:' +
          edgeTransaction.txid +
          edgeTransaction.nativeAmount
      )
      if (
        typeof this.walletLocalData.transactionsObj[currencyCode] ===
        'undefined'
      ) {
        this.walletLocalData.transactionsObj[currencyCode] = []
      }
      this.walletLocalData.transactionsObj[currencyCode].push(edgeTransaction)

      // Sort
      this.walletLocalData.transactionsObj[currencyCode].sort(this.sortTxByDate)
      this.walletLocalDataDirty = true
      this.transactionsChangedArray.push(edgeTransaction)
    } else {
      this.updateTransaction(currencyCode, edgeTransaction, idx)
    }
  }

  updateTransaction(
    currencyCode: string,
    edgeTransaction: EdgeTransaction,
    idx: number
  ): void {
    // Update the transaction
    this.walletLocalData.transactionsObj[currencyCode][idx] = edgeTransaction
    this.walletLocalDataDirty = true
    this.transactionsChangedArray.push(edgeTransaction)
    this.log.warn(
      'updateTransaction' + edgeTransaction.txid + edgeTransaction.nativeAmount
    )
  }

  // *************************************
  // Save the wallet data store
  // *************************************
  async saveWalletLoop(): Promise<void> {
    if (this.walletLocalDataDirty) {
      try {
        this.log('walletLocalDataDirty. Saving...')
        const walletJson = JSON.stringify(this.walletLocalData)
        await this.walletLocalDisklet.setText(DATA_STORE_FILE, walletJson)
        this.walletLocalDataDirty = false
      } catch (err) {
        this.log.error('saveWalletLoop', err)
      }
    }
  }

  doInitialCallbacks(): void {
    for (const currencyCode of this.walletLocalData.enabledTokens) {
      try {
        this.edgeTxLibCallbacks.onBalanceChanged(
          currencyCode,
          this.walletLocalData.totalBalances[currencyCode]
        )
      } catch (e) {
        this.log.error('Error for currencyCode', currencyCode, e)
      }
    }
  }

  async addToLoop(func: string, timer: number): Promise<void> {
    try {
      // $FlowFixMe
      await this[func]()
    } catch (e) {
      this.log.error('Error in Loop:', func, e)
    }
    if (this.engineOn) {
      this.timers[func] = setTimeout(() => {
        if (this.engineOn) {
          this.addToLoop(func, timer)
        }
      }, timer)
    }
  }

  // *************************************
  // Public methods
  // *************************************

  async changeUserSettings(userSettings: Object): Promise<void> {
    this.currentSettings = userSettings
  }

  async startEngine(): Promise<void> {
    this.engineOn = true
    this.doInitialCallbacks()
  }

  async killEngine(): Promise<void> {
    // Set status flag to false
    this.engineOn = false
    this.loggedIn = false
    // Clear Inner loops timers
    for (const timer in this.timers) {
      clearTimeout(this.timers[timer])
    }
    this.timers = {}
  }

  async resyncBlockchain(): Promise<void> {
    await this.killEngine()
    const temp = JSON.stringify({
      enabledTokens: this.walletLocalData.enabledTokens,
      // networkFees: this.walletLocalData.networkFees,
      moneroAddress: this.walletLocalData.moneroAddress,
      moneroViewKeyPrivate: this.walletLocalData.moneroViewKeyPrivate
    })
    this.walletLocalData = new MoneroLocalData(temp)
    this.walletLocalDataDirty = true
    this.addressesChecked = false
    await this.saveWalletLoop()
    await this.startEngine()
  }

  async syncNetwork(opts: EdgeEnginePrivateKeyOptions): Promise<number> {
    const xmrPrivateKeys = asPrivateKeys(opts.privateKeys)

    // Login only if not logged in
    if (!this.loggedIn) {
      await this.loginIfNewAddress(xmrPrivateKeys)
    }

    // Always check address
    await this.checkAddressInnerLoop(xmrPrivateKeys)
    // Always check transactions
    await this.checkTransactionsInnerLoop(xmrPrivateKeys)

    return SYNC_INTERVAL_MILLISECONDS
  }

  getBlockHeight(): number {
    return parseInt(this.walletLocalData.blockHeight)
  }

  async enableTokens(tokens: string[]): Promise<void> {}

  async disableTokens(tokens: string[]): Promise<void> {}

  async getEnabledTokens(): Promise<string[]> {
    return []
  }

  async addCustomToken(tokenObj: EdgeToken): Promise<void> {}

  getTokenStatus(token: string): boolean {
    return false
  }

  getBalance(options: EdgeCurrencyCodeOptions = {}): string {
    const { currencyCode = PRIMARY_CURRENCY } = options

    if (
      typeof this.walletLocalData.totalBalances[currencyCode] === 'undefined'
    ) {
      return '0'
    } else {
      const nativeBalance = this.walletLocalData.totalBalances[currencyCode]
      return nativeBalance
    }
  }

  getNumTransactions(options: EdgeCurrencyCodeOptions = {}): number {
    const { currencyCode = PRIMARY_CURRENCY } = options

    if (
      typeof this.walletLocalData.transactionsObj[currencyCode] === 'undefined'
    ) {
      return 0
    } else {
      return this.walletLocalData.transactionsObj[currencyCode].length
    }
  }

  async getTransactions(
    options: EdgeGetTransactionsOptions = {}
  ): Promise<EdgeTransaction[]> {
    let { currencyCode = PRIMARY_CURRENCY, startIndex = 0 } = options
    // $FlowFixMe This does not exist in the core types:
    let numEntries: number = options.numEntries ?? 0

    if (this.walletLocalData.transactionsObj[currencyCode] == null) {
      return []
    }

    if (
      startIndex >= this.walletLocalData.transactionsObj[currencyCode].length
    ) {
      startIndex = this.walletLocalData.transactionsObj[currencyCode].length - 1
    }
    if (
      numEntries + startIndex >
      this.walletLocalData.transactionsObj[currencyCode].length
    ) {
      // Don't read past the end of the transactionsObj
      numEntries =
        this.walletLocalData.transactionsObj[currencyCode].length - startIndex
    }

    // Copy the appropriate entries from the arrayTransactions:
    if (numEntries > 0) {
      return this.walletLocalData.transactionsObj[currencyCode].slice(
        startIndex,
        numEntries + startIndex
      )
    } else {
      return this.walletLocalData.transactionsObj[currencyCode].slice(
        startIndex
      )
    }
  }

  async getFreshAddress(
    options: EdgeGetReceiveAddressOptions
  ): Promise<EdgeFreshAddress> {
    if (this.walletLocalData.hasLoggedIn) {
      return { publicAddress: this.walletLocalData.moneroAddress }
    } else {
      return { publicAddress: '' }
    }
  }

  async addGapLimitAddresses(addresses: string[]): Promise<void> {}

  async isAddressUsed(address: string): Promise<boolean> {
    return false
  }

  async getMaxSpendable(
    edgeSpendInfo: EdgeSpendInfo,
    opts?: EdgeEnginePrivateKeyOptions
  ): Promise<string> {
    const privateKeys = asPrivateKeys(opts?.privateKeys)
    const [spendTarget] = edgeSpendInfo.spendTargets
    const { publicAddress } = spendTarget
    if (publicAddress == null) {
      throw new TypeError('Missing destination address')
    }

    const options = {
      amount: '0',
      isSweepTx: true,
      priority: translateFee(edgeSpendInfo.networkFeeOption),
      targetAddress: publicAddress
    }

    const result = await this.createMyMoneroTransaction(options, privateKeys)
    return result.final_total_wo_fee
  }

  async createMyMoneroTransaction(
    options: CreateTransactionOptions,
    privateKeys: PrivateKeys
  ): Promise<CreatedTransaction> {
    try {
      return await this.myMoneroApi.createTransaction(
        {
          address: this.walletLocalData.moneroAddress,
          privateViewKey: this.walletLocalData.moneroViewKeyPrivate,
          privateSpendKey: privateKeys.moneroSpendKeyPrivate,
          publicSpendKey: privateKeys.moneroSpendKeyPublic
        },
        options
      )
    } catch (e) {
      // This error is specific to mymonero-core-js: github.com/mymonero/mymonero-core-cpp/blob/a53e57f2a376b05bb0f4d851713321c749e5d8d9/src/monero_transfer_utils.hpp#L112-L162
      this.log.error(e.message)
      const regex = / Have (\d*\.?\d+) XMR; need (\d*\.?\d+) XMR./gm
      const subst = `\nHave: $1 XMR.\nNeed: $2 XMR.`
      const msgFormatted = e.message.replace(regex, subst)
      throw new Error(msgFormatted)
    }
  }

  async makeSpend(
    edgeSpendInfo: EdgeSpendInfo,
    opts?: EdgeEnginePrivateKeyOptions
  ): Promise<EdgeTransaction> {
    const privateKeys = asPrivateKeys(opts?.privateKeys)

    // Monero can only have one output
    // TODO: The new SDK fixes this!
    if (edgeSpendInfo.spendTargets.length !== 1) {
      throw new Error('Error: only one output allowed')
    }

    const [spendTarget] = edgeSpendInfo.spendTargets
    const { publicAddress, nativeAmount } = spendTarget
    if (publicAddress == null) {
      throw new TypeError('Missing destination address')
    }
    if (nativeAmount == null || eq(nativeAmount, '0')) {
      throw new NoAmountSpecifiedError()
    }

    if (gte(nativeAmount, this.walletLocalData.totalBalances.XMR)) {
      if (gte(this.walletLocalData.lockedXmrBalance, nativeAmount)) {
        throw new PendingFundsError()
      } else {
        throw new InsufficientFundsError()
      }
    }

    const options: CreateTransactionOptions = {
      amount: div(nativeAmount, '1000000000000', 12),
      isSweepTx: false,
      priority: translateFee(edgeSpendInfo.networkFeeOption),
      targetAddress: publicAddress
    }
    this.log(`Creating transaction: ${JSON.stringify(options, null, 1)}`)

    const result: CreatedTransaction = await this.createMyMoneroTransaction(
      options,
      privateKeys
    )

    const date = Date.now() / 1000

    this.log(`Total sent: ${result.total_sent}, Fee: ${result.used_fee}`)
    const edgeTransaction: EdgeTransaction = {
      txid: result.tx_hash,
      date,
      currencyCode: 'XMR', // currencyCode
      blockHeight: 0, // blockHeight
      nativeAmount: '-' + result.total_sent,
      networkFee: result.used_fee,
      ourReceiveAddresses: [], // ourReceiveAddresses
      signedTx: result.serialized_signed_tx,
      txSecret: result.tx_key,
      walletId: this.walletId
    }
    this.log.warn(`makeSpend edgeTransaction ${cleanTxLogs(edgeTransaction)}`)
    return edgeTransaction
  }

  async signTx(
    edgeTransaction: EdgeTransaction,
    privateKeys: JsonObject
  ): Promise<EdgeTransaction> {
    return edgeTransaction
  }

  async broadcastTx(
    edgeTransaction: EdgeTransaction
  ): Promise<EdgeTransaction> {
    try {
      await this.myMoneroApi.broadcastTransaction(edgeTransaction.signedTx)
      this.log.warn(`broadcastTx success ${cleanTxLogs(edgeTransaction)}`)
      return edgeTransaction
    } catch (e) {
      this.log.error(
        `broadcastTx failed: ${String(e)} ${cleanTxLogs(edgeTransaction)}`
      )
      if (e instanceof Error && e.message.includes(' 422 ')) {
        throw new Error(
          'The Monero network rejected this transaction. You may need to wait for more confirmations'
        )
      } else {
        throw e
      }
    }
  }

  async saveTx(edgeTransaction: EdgeTransaction): Promise<void> {
    await this.addTransaction(edgeTransaction.currencyCode, edgeTransaction)

    this.edgeTxLibCallbacks.onTransactionsChanged([edgeTransaction])
  }

  getDisplayPrivateSeed(privateKeys: JsonObject): string {
    const xmrPrivateKeys = asPrivateKeys(privateKeys)
    return xmrPrivateKeys.moneroKey
  }

  getDisplayPublicSeed(): string {
    if (this.walletInfo.keys && this.walletInfo.keys.moneroViewKeyPrivate) {
      return this.walletInfo.keys.moneroViewKeyPrivate
    }
    return ''
  }

  async dumpData(): Promise<EdgeDataDump> {
    const dataDump: EdgeDataDump = {
      walletId: this.walletId,
      walletType: this.walletInfo.type,
      pluginType: this.currencyInfo.pluginId,
      data: {
        walletLocalData: this.walletLocalData
      }
    }
    return dataDump
  }
}

function translateFee(fee?: string): Priority {
  if (fee === 'low') return 1
  if (fee === 'high') return 4
  return 2
}
