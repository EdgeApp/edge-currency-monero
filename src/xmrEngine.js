/**
 * Created by paul on 7/7/17.
 */
// @flow

import { bns } from 'biggystring'
import type { Disklet } from 'disklet'
import {
  type EdgeCurrencyEngineCallbacks,
  type EdgeCurrencyEngineOptions,
  type EdgeCurrencyInfo,
  type EdgeCurrencyTools,
  type EdgeDataDump,
  type EdgeFreshAddress,
  type EdgeIo,
  type EdgeLog,
  type EdgeMetaToken,
  type EdgeSpendInfo,
  type EdgeTransaction,
  type EdgeWalletInfo,
  InsufficientFundsError,
  NoAmountSpecifiedError,
  PendingFundsError
} from 'edge-core-js/types'
import type { CreatedTransaction, Priority } from 'react-native-mymonero-core'

import {
  type CreateTransactionOptions,
  type MyMoneroApi
} from './MyMoneroApi.js'
import {
  cleanTxLogs,
  makeMutex,
  normalizeAddress,
  validateObject
} from './utils.js'
import { currencyInfo } from './xmrInfo.js'
import { DATA_STORE_FILE, WalletLocalData } from './xmrTypes.js'

const ADDRESS_POLL_MILLISECONDS = 7000
const TRANSACTIONS_POLL_MILLISECONDS = 4000
const SAVE_DATASTORE_MILLISECONDS = 10000
// const ADDRESS_QUERY_LOOKBACK_BLOCKS = '8' // ~ 2 minutes
// const ADDRESS_QUERY_LOOKBACK_BLOCKS = (4 * 60 * 24 * 7) // ~ one week

const PRIMARY_CURRENCY = currencyInfo.currencyCode

const makeSpendMutex = makeMutex()

export class MoneroEngine {
  walletInfo: EdgeWalletInfo
  edgeTxLibCallbacks: EdgeCurrencyEngineCallbacks
  walletLocalDisklet: Disklet
  engineOn: boolean
  loggedIn: boolean
  addressesChecked: boolean
  walletLocalData: WalletLocalData
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
  currencyPlugin: EdgeCurrencyTools

  constructor(
    currencyPlugin: EdgeCurrencyTools,
    io: EdgeIo,
    walletInfo: EdgeWalletInfo,
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
    this.walletId = walletInfo.id ? `${walletInfo.id} - ` : ''
    this.currencyInfo = currencyInfo
    this.currencyPlugin = currencyPlugin
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

  async init() {
    if (
      typeof this.walletInfo.keys.moneroAddress !== 'string' ||
      typeof this.walletInfo.keys.moneroViewKeyPrivate !== 'string' ||
      typeof this.walletInfo.keys.moneroViewKeyPublic !== 'string' ||
      typeof this.walletInfo.keys.moneroSpendKeyPublic !== 'string'
    ) {
      const pubKeys = await this.currencyPlugin.derivePublicKey(this.walletInfo)
      this.walletInfo.keys.moneroAddress = pubKeys.moneroAddress
      this.walletInfo.keys.moneroViewKeyPrivate = pubKeys.moneroViewKeyPrivate
      this.walletInfo.keys.moneroViewKeyPublic = pubKeys.moneroViewKeyPublic
      this.walletInfo.keys.moneroSpendKeyPublic = pubKeys.moneroSpendKeyPublic
    }
  }

  updateOnAddressesChecked(numTx: number, totalTxs: number) {
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
  async loginInnerLoop() {
    try {
      const result = await this.myMoneroApi.login({
        address: this.walletLocalData.moneroAddress,
        privateViewKey: this.walletLocalData.moneroViewKeyPrivate,
        privateSpendKey: this.walletInfo.keys.moneroSpendKeyPrivate,
        publicSpendKey: this.walletInfo.keys.moneroSpendKeyPublic
      })
      if ('new_address' in result && !this.loggedIn) {
        this.loggedIn = true
        this.walletLocalData.hasLoggedIn = true
        clearTimeout(this.timers.loginInnerLoop)
        delete this.timers.loginInnerLoop
        this.addToLoop('checkAddressInnerLoop', ADDRESS_POLL_MILLISECONDS)
        this.addToLoop(
          'checkTransactionsInnerLoop',
          TRANSACTIONS_POLL_MILLISECONDS
        )
        this.addToLoop('saveWalletLoop', SAVE_DATASTORE_MILLISECONDS)
      }
    } catch (e) {
      this.log.error('Error logging into mymonero', e)
    }
  }

  // ***************************************************
  // Check address for updated block height and balance
  // ***************************************************
  async checkAddressInnerLoop() {
    try {
      const addrResult = await this.myMoneroApi.getAddressInfo({
        address: this.walletLocalData.moneroAddress,
        privateViewKey: this.walletLocalData.moneroViewKeyPrivate,
        privateSpendKey: this.walletInfo.keys.moneroSpendKeyPrivate,
        publicSpendKey: this.walletInfo.keys.moneroSpendKeyPublic
      })

      if (this.walletLocalData.blockHeight !== addrResult.blockHeight) {
        this.walletLocalData.blockHeight = addrResult.blockHeight // Convert to decimal
        this.walletLocalDataDirty = true
        this.edgeTxLibCallbacks.onBlockHeightChanged(
          this.walletLocalData.blockHeight
        )
      }

      const nativeBalance = bns.sub(
        addrResult.totalReceived,
        addrResult.totalSent
      )

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

  processMoneroTransaction(tx: Object) {
    const ourReceiveAddresses: string[] = []

    const nativeNetworkFee: string = tx.fee != null ? tx.fee : '0'

    const netNativeAmount: string = bns.sub(tx.total_received, tx.total_sent)

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

  async checkTransactionsInnerLoop() {
    let checkAddressSuccess = true

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
        privateSpendKey: this.walletInfo.keys.moneroSpendKeyPrivate,
        publicSpendKey: this.walletInfo.keys.moneroSpendKeyPublic
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
      checkAddressSuccess = false
    }
    return checkAddressSuccess
  }

  findTransaction(currencyCode: string, txid: string) {
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

  sortTxByDate(a: EdgeTransaction, b: EdgeTransaction) {
    return b.date - a.date
  }

  addTransaction(currencyCode: string, edgeTransaction: EdgeTransaction) {
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
  ) {
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
  async saveWalletLoop() {
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

  doInitialCallbacks() {
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

  async addToLoop(func: string, timer: number) {
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
    return true
  }

  // *************************************
  // Public methods
  // *************************************

  async changeUserSettings(userSettings: Object): Promise<void> {
    this.currentSettings = userSettings
  }

  async startEngine() {
    this.engineOn = true
    this.doInitialCallbacks()
    this.addToLoop('loginInnerLoop', ADDRESS_POLL_MILLISECONDS)
  }

  async killEngine() {
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
    this.walletLocalData = new WalletLocalData(temp)
    this.walletLocalDataDirty = true
    this.addressesChecked = false
    await this.saveWalletLoop()
    await this.startEngine()
  }

  // synchronous
  getBlockHeight(): number {
    return parseInt(this.walletLocalData.blockHeight)
  }

  enableTokensSync(tokens: string[]) {
    for (const token of tokens) {
      if (this.walletLocalData.enabledTokens.indexOf(token) === -1) {
        this.walletLocalData.enabledTokens.push(token)
      }
    }
  }

  // asynchronous
  async enableTokens(tokens: string[]) {}

  // asynchronous
  async disableTokens(tokens: string[]) {}

  async getEnabledTokens(): Promise<string[]> {
    return []
  }

  async addCustomToken(tokenObj: any) {}

  // synchronous
  getTokenStatus(token: string) {
    return false
  }

  // synchronous
  getBalance(options: any): string {
    let currencyCode = PRIMARY_CURRENCY

    if (typeof options !== 'undefined') {
      const valid = validateObject(options, {
        type: 'object',
        properties: {
          currencyCode: { type: 'string' }
        }
      })

      if (valid) {
        currencyCode = options.currencyCode
      }
    }

    if (
      typeof this.walletLocalData.totalBalances[currencyCode] === 'undefined'
    ) {
      return '0'
    } else {
      const nativeBalance = this.walletLocalData.totalBalances[currencyCode]
      return nativeBalance
    }
  }

  // synchronous
  getNumTransactions(options: any): number {
    let currencyCode = PRIMARY_CURRENCY

    const valid = validateObject(options, {
      type: 'object',
      properties: {
        currencyCode: { type: 'string' }
      }
    })

    if (valid) {
      currencyCode = options.currencyCode
    }

    if (
      typeof this.walletLocalData.transactionsObj[currencyCode] === 'undefined'
    ) {
      return 0
    } else {
      return this.walletLocalData.transactionsObj[currencyCode].length
    }
  }

  // asynchronous
  async getTransactions(options: any): Promise<EdgeTransaction[]> {
    let currencyCode: string = PRIMARY_CURRENCY

    const valid: boolean = validateObject(options, {
      type: 'object',
      properties: {
        currencyCode: { type: 'string' }
      }
    })

    if (valid) {
      currencyCode = options.currencyCode
    }

    if (
      typeof this.walletLocalData.transactionsObj[currencyCode] === 'undefined'
    ) {
      return []
    }

    let startIndex: number = 0
    let numEntries: number = 0
    if (options === null) {
      return this.walletLocalData.transactionsObj[currencyCode].slice(0)
    }
    if (options.startIndex !== null && options.startIndex > 0) {
      startIndex = options.startIndex
      if (
        startIndex >= this.walletLocalData.transactionsObj[currencyCode].length
      ) {
        startIndex =
          this.walletLocalData.transactionsObj[currencyCode].length - 1
      }
    }
    if (options.numEntries !== null && options.numEntries > 0) {
      numEntries = options.numEntries
      if (
        numEntries + startIndex >
        this.walletLocalData.transactionsObj[currencyCode].length
      ) {
        // Don't read past the end of the transactionsObj
        numEntries =
          this.walletLocalData.transactionsObj[currencyCode].length - startIndex
      }
    }

    // Copy the appropriate entries from the arrayTransactions
    let returnArray = []

    if (numEntries) {
      returnArray = this.walletLocalData.transactionsObj[currencyCode].slice(
        startIndex,
        numEntries + startIndex
      )
    } else {
      returnArray =
        this.walletLocalData.transactionsObj[currencyCode].slice(startIndex)
    }
    return returnArray
  }

  // synchronous
  async getFreshAddress(options: any): Promise<EdgeFreshAddress> {
    if (this.walletLocalData.hasLoggedIn) {
      return { publicAddress: this.walletLocalData.moneroAddress }
    } else {
      return { publicAddress: '' }
    }
  }

  // synchronous
  async addGapLimitAddresses(addresses: string[], options: any) {}

  // synchronous
  async isAddressUsed(address: string, options: any) {
    return false
  }

  async makeSpend(edgeSpendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
    return makeSpendMutex(() => this.makeSpendInner(edgeSpendInfo))
  }

  // synchronous
  async makeSpendInner(edgeSpendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
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
    if (nativeAmount == null || bns.eq(nativeAmount, '0')) {
      throw new NoAmountSpecifiedError()
    }

    if (bns.gte(nativeAmount, this.walletLocalData.totalBalances.XMR)) {
      if (bns.gte(this.walletLocalData.lockedXmrBalance, nativeAmount)) {
        throw new PendingFundsError()
      } else {
        throw new InsufficientFundsError()
      }
    }

    const options: CreateTransactionOptions = {
      amount: bns.div(nativeAmount, '1000000000000', 12),
      isSweepTx: false, // TODO: The new SDK supports max-spend
      priority: translateFee(edgeSpendInfo.networkFeeOption),
      targetAddress: publicAddress
    }
    this.log(`Creating transaction: ${JSON.stringify(options, null, 1)}`)

    let result: CreatedTransaction
    try {
      result = await this.myMoneroApi.createTransaction(
        {
          address: this.walletLocalData.moneroAddress,
          privateViewKey: this.walletLocalData.moneroViewKeyPrivate,
          privateSpendKey: this.walletInfo.keys.moneroSpendKeyPrivate,
          publicSpendKey: this.walletInfo.keys.moneroSpendKeyPublic
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

  // asynchronous
  async signTx(edgeTransaction: EdgeTransaction): Promise<EdgeTransaction> {
    return edgeTransaction
  }

  // asynchronous
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

  // asynchronous
  async saveTx(edgeTransaction: EdgeTransaction) {
    this.addTransaction(edgeTransaction.currencyCode, edgeTransaction)

    this.edgeTxLibCallbacks.onTransactionsChanged([edgeTransaction])
  }

  getDisplayPrivateSeed() {
    if (this.walletInfo.keys && this.walletInfo.keys.moneroKey) {
      return this.walletInfo.keys.moneroKey
    }
    return ''
  }

  getDisplayPublicSeed() {
    if (this.walletInfo.keys && this.walletInfo.keys.moneroViewKeyPrivate) {
      return this.walletInfo.keys.moneroViewKeyPrivate
    }
    return ''
  }

  async dumpData(): Promise<EdgeDataDump> {
    const dataDump: EdgeDataDump = {
      walletId: this.walletId.split(' - ')[0],
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
