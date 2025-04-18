/**
 * Created by paul on 7/7/17.
 */

import { add, div, eq, gte, lt, sub } from 'biggystring'
import type { Disklet } from 'disklet'
import {
  EdgeCorePluginOptions,
  EdgeCurrencyEngine,
  EdgeCurrencyEngineCallbacks,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyInfo,
  EdgeDataDump,
  EdgeEnginePrivateKeyOptions,
  EdgeFreshAddress,
  EdgeGetReceiveAddressOptions,
  EdgeIo,
  EdgeLog,
  EdgeMemo,
  EdgeSpendInfo,
  EdgeToken,
  EdgeTokenId,
  EdgeTokenIdOptions,
  EdgeTransaction,
  EdgeTransactionEvent,
  EdgeWalletInfo,
  InsufficientFundsError,
  JsonObject,
  NoAmountSpecifiedError,
  PendingFundsError
} from 'edge-core-js/types'
import type { CreatedTransaction, Priority } from 'react-native-mymonero-core'

import { currencyInfo } from './moneroInfo'
import {
  asMoneroLocalData,
  DATA_STORE_FILE,
  MoneroLocalData,
  wasMoneroLocalData
} from './MoneroLocalData'
import { MoneroTools } from './MoneroTools'
import {
  asMoneroInitOptions,
  asMoneroUserSettings,
  asPrivateKeys,
  asSafeWalletInfo,
  asSeenTxCheckpoint,
  makeSafeWalletInfo,
  MoneroUserSettings,
  PrivateKeys,
  SafeWalletInfo,
  wasSeenTxCheckpoint
} from './moneroTypes'
import {
  CreateTransactionOptions,
  MyMoneroApi,
  ParsedTransaction
} from './MyMoneroApi'
import { cleanTxLogs, normalizeAddress } from './utils'

const SYNC_INTERVAL_MILLISECONDS = 5000
const SAVE_DATASTORE_MILLISECONDS = 10000
// const ADDRESS_QUERY_LOOKBACK_BLOCKS = '8' // ~ 2 minutes
// const ADDRESS_QUERY_LOOKBACK_BLOCKS = (4 * 60 * 24 * 7) // ~ one week

const PRIMARY_CURRENCY_TOKEN_ID = null

export class MoneroEngine implements EdgeCurrencyEngine {
  apiKey: string
  walletInfo: SafeWalletInfo
  edgeTxLibCallbacks: EdgeCurrencyEngineCallbacks
  walletLocalDisklet: Disklet
  engineOn: boolean
  loggedIn: boolean
  addressesChecked: boolean
  walletLocalData!: MoneroLocalData
  walletLocalDataDirty: boolean
  transactionEventArray: EdgeTransactionEvent[]
  currencyInfo: EdgeCurrencyInfo
  myMoneroApi: MyMoneroApi
  currentSettings: MoneroUserSettings
  timers: any
  walletId: string
  io: EdgeIo
  log: EdgeLog
  currencyTools: MoneroTools
  seenTxCheckpoint: number | undefined

  constructor(
    env: EdgeCorePluginOptions,
    tools: MoneroTools,
    walletInfo: EdgeWalletInfo,
    opts: EdgeCurrencyEngineOptions
  ) {
    const { callbacks, userSettings = {}, walletLocalDisklet } = opts
    const initOptions = asMoneroInitOptions(env.initOptions ?? {})
    const { networkInfo } = tools

    this.apiKey = initOptions.apiKey
    this.io = env.io
    this.log = opts.log
    this.engineOn = false
    this.loggedIn = false
    this.addressesChecked = false
    this.walletLocalDataDirty = false
    this.transactionEventArray = []
    this.walletInfo = walletInfo as any // We derive the public keys at init
    this.walletId = walletInfo.id
    this.currencyInfo = currencyInfo
    this.currencyTools = tools
    this.myMoneroApi = new MyMoneroApi(tools.cppBridge, {
      apiKey: initOptions.apiKey,
      apiServer: networkInfo.defaultServer,
      fetch: env.io.fetch,
      nettype: networkInfo.nettype
    })
    this.seenTxCheckpoint = asSeenTxCheckpoint(opts.seenTxCheckpoint)

    // this.customTokens = []
    this.timers = {}

    this.currentSettings = {
      ...currencyInfo.defaultSettings,
      ...asMoneroUserSettings(userSettings)
    }
    if (
      this.currentSettings.enableCustomServers &&
      this.currentSettings.moneroLightwalletServer != null
    ) {
      this.myMoneroApi.changeServer(
        this.currentSettings.moneroLightwalletServer,
        ''
      )
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
        address: this.walletInfo.keys.moneroAddress,
        privateViewKey: this.walletInfo.keys.moneroViewKeyPrivate,
        privateSpendKey: privateKeys.moneroSpendKeyPrivate,
        publicSpendKey: privateKeys.moneroSpendKeyPublic
      })
      if ('new_address' in result && !this.loggedIn) {
        this.loggedIn = true
        this.walletLocalData.hasLoggedIn = true
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.addToLoop('saveWalletLoop', SAVE_DATASTORE_MILLISECONDS)
        this.edgeTxLibCallbacks.onAddressChanged()
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
        address: this.walletInfo.keys.moneroAddress,
        privateViewKey: this.walletInfo.keys.moneroViewKeyPrivate,
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

      if (
        this.walletLocalData.totalBalances.get(PRIMARY_CURRENCY_TOKEN_ID) !==
        nativeBalance
      ) {
        this.walletLocalData.totalBalances.set(
          PRIMARY_CURRENCY_TOKEN_ID,
          nativeBalance
        )
        this.edgeTxLibCallbacks.onTokenBalanceChanged(
          PRIMARY_CURRENCY_TOKEN_ID,
          nativeBalance
        )
      }
      this.walletLocalData.lockedXmrBalance = addrResult.lockedBalance
    } catch (e) {
      this.log.error(
        `Error fetching address info: ${
          this.walletInfo.keys.moneroAddress
        } ${String(e)}`
      )
    }
  }

  processMoneroTransaction(tx: ParsedTransaction): number {
    const ourReceiveAddresses: string[] = []

    const nativeNetworkFee: string = tx.fee != null ? tx.fee : '0'

    const netNativeAmount: string = sub(tx.total_received, tx.total_sent)

    if (netNativeAmount.slice(0, 1) !== '-') {
      ourReceiveAddresses.push(this.walletInfo.keys.moneroAddress.toLowerCase())
    }

    let blockHeight = tx.height
    if (tx.mempool) {
      blockHeight = 0
    }

    const date = Date.parse(tx.timestamp) / 1000

    // Expose legacy payment ID's to the GUI. This only applies
    // to really old transactions, before integrated addresses:
    const memos: EdgeMemo[] = []
    if (tx.payment_id != null) {
      memos.push({
        memoName: 'payment id',
        type: 'hex',
        value: tx.payment_id
      })
    }

    const edgeTransaction: EdgeTransaction = {
      blockHeight,
      currencyCode: 'XMR',
      date,
      isSend: lt(netNativeAmount, '0'),
      memos,
      nativeAmount: netNativeAmount,
      networkFee: nativeNetworkFee,
      networkFees: [{ tokenId: null, nativeAmount: nativeNetworkFee }],
      otherParams: {},
      ourReceiveAddresses,
      signedTx: '',
      tokenId: null,
      txid: tx.hash,
      walletId: this.walletId
    }

    this.saveTransactionState(PRIMARY_CURRENCY_TOKEN_ID, edgeTransaction)
    this.edgeTxLibCallbacks.onTransactions(this.transactionEventArray)
    this.transactionEventArray = []

    return blockHeight
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
      // Let the seenTxCheckpoint be defined before querying transactions.
      let seenTxCheckpoint = this.seenTxCheckpoint ?? 0
      const transactions = await this.myMoneroApi.getTransactions({
        address: this.walletInfo.keys.moneroAddress,
        privateViewKey: this.walletInfo.keys.moneroViewKeyPrivate,
        privateSpendKey: privateKeys.moneroSpendKeyPrivate,
        publicSpendKey: privateKeys.moneroSpendKeyPublic
      })

      this.log(`Fetched transactions count: ${transactions.length}`)

      // Get transactions
      // Iterate over transactions in address
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i]
        const blockHeight = this.processMoneroTransaction(tx)
        seenTxCheckpoint = Math.max(seenTxCheckpoint, blockHeight)
        if (i % 10 === 0) {
          this.updateOnAddressesChecked(i, transactions.length)
        }
      }

      this.updateOnAddressesChecked(transactions.length, transactions.length)
      // Update the seenTxCheckpoint state:
      this.seenTxCheckpoint = seenTxCheckpoint
      this.edgeTxLibCallbacks.onSeenTxCheckpoint(
        wasSeenTxCheckpoint(this.seenTxCheckpoint)
      )
    } catch (e) {
      this.log.error('checkTransactionsInnerLoop', e)
    }
  }

  findTransaction(tokenId: EdgeTokenId, txid: string): any {
    const txs = this.getTxs(tokenId)
    return txs.findIndex(element => {
      return normalizeAddress(element.txid) === normalizeAddress(txid)
    })
  }

  sortTxByDate(a: EdgeTransaction, b: EdgeTransaction): number {
    return b.date - a.date
  }

  getTxs(tokenId: EdgeTokenId): EdgeTransaction[] {
    const txs = this.walletLocalData.transactionsObj.get(tokenId)
    if (txs == null) {
      const txs: EdgeTransaction[] = []
      this.walletLocalData.transactionsObj.set(tokenId, txs)
      return txs
    }
    return txs as EdgeTransaction[]
  }

  saveTransactionState(
    tokenId: EdgeTokenId,
    edgeTransaction: EdgeTransaction
  ): void {
    // Add or update tx in transactionsObj
    const idx = this.findTransaction(tokenId, edgeTransaction.txid)

    if (idx === -1) {
      this.log(`New transaction: ${edgeTransaction.txid}`)
      this.log.warn(
        'addTransaction: adding and sorting:' +
          edgeTransaction.txid +
          edgeTransaction.nativeAmount
      )
      const txs = this.getTxs(tokenId)
      txs.push(edgeTransaction)

      // Sort
      txs.sort(this.sortTxByDate)
      this.walletLocalDataDirty = true
      const txCheckpoint = edgeTransaction.blockHeight
      const isNew =
        // New if unconfirmed
        txCheckpoint === 0 ||
        // No checkpoint means initial sync
        (this.seenTxCheckpoint != null &&
          // New if txCheckpoint exceeds the last seen checkpoint
          txCheckpoint >= this.seenTxCheckpoint)
      this.transactionEventArray.push({
        isNew,
        transaction: edgeTransaction
      })
    } else {
      const txs = this.getTxs(tokenId)
      const edgeTx = txs[idx]

      // Already have this tx in the database. Consider a change if blockHeight changed
      if (edgeTx.blockHeight === edgeTransaction.blockHeight) return
      this.log(
        `Update transaction: ${edgeTransaction.txid} height:${edgeTransaction.blockHeight}`
      )

      // The native amounts returned from the API take some time before they're
      // accurate. We can trust the amounts we saved instead.
      edgeTransaction = {
        ...edgeTransaction,
        nativeAmount: edgeTx.nativeAmount
      }

      // Update the transaction
      txs[idx] = edgeTransaction
      this.walletLocalDataDirty = true
      this.transactionEventArray.push({
        isNew: false,
        transaction: edgeTransaction
      })
      this.log.warn(
        'updateTransaction' +
          edgeTransaction.txid +
          edgeTransaction.nativeAmount
      )
    }
  }

  // *************************************
  // Save the wallet data store
  // *************************************
  async saveWalletLoop(): Promise<void> {
    if (this.walletLocalDataDirty) {
      try {
        this.log('walletLocalDataDirty. Saving...')
        const walletJson = wasMoneroLocalData(this.walletLocalData)
        await this.walletLocalDisklet.setText(DATA_STORE_FILE, walletJson)
        this.walletLocalDataDirty = false
      } catch (err) {
        this.log.error('saveWalletLoop', err)
      }
    }
  }

  doInitialCallbacks(): void {
    for (const tokenId of this.walletLocalData.enabledTokens) {
      try {
        this.edgeTxLibCallbacks.onTokenBalanceChanged(
          tokenId,
          this.walletLocalData.totalBalances.get(tokenId) ?? '0'
        )
      } catch (e) {
        this.log.error('Error for currencyCode', tokenId, e)
      }
    }
  }

  async addToLoop(func: string, timer: number): Promise<void> {
    try {
      // @ts-expect-error
      await this[func]()
    } catch (e) {
      this.log.error('Error in Loop:', func, e)
    }
    if (this.engineOn) {
      this.timers[func] = setTimeout(() => {
        if (this.engineOn) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.addToLoop(func, timer)
        }
      }, timer)
    }
  }

  // *************************************
  // Public methods
  // *************************************

  async changeUserSettings(userSettings: JsonObject): Promise<void> {
    this.currentSettings = {
      ...this.currencyInfo.defaultSettings,
      ...asMoneroUserSettings(userSettings)
    }
    if (
      this.currentSettings.enableCustomServers &&
      this.currentSettings.moneroLightwalletServer != null
    ) {
      this.myMoneroApi.changeServer(
        this.currentSettings.moneroLightwalletServer,
        ''
      )
    } else {
      this.myMoneroApi.changeServer(
        this.currencyTools.networkInfo.defaultServer,
        this.apiKey
      )
    }
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
    this.myMoneroApi.keyImageCache = {}
    this.walletLocalData = asMoneroLocalData(
      JSON.stringify({
        enabledTokens: this.walletLocalData.enabledTokens
      })
    )
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
    return this.walletLocalData.blockHeight
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

  getBalance(options: EdgeTokenIdOptions): string {
    const { tokenId = PRIMARY_CURRENCY_TOKEN_ID } = options

    return this.walletLocalData.totalBalances.get(tokenId) ?? '0'
  }

  getNumTransactions(options: EdgeTokenIdOptions): number {
    const { tokenId = PRIMARY_CURRENCY_TOKEN_ID } = options

    return this.walletLocalData.transactionsObj.get(tokenId)?.length ?? 0
  }

  async getTransactions(
    options: EdgeTokenIdOptions
  ): Promise<EdgeTransaction[]> {
    const { tokenId = PRIMARY_CURRENCY_TOKEN_ID } = options

    return (this.walletLocalData.transactionsObj.get(tokenId) ??
      []) as EdgeTransaction[]
  }

  async getFreshAddress(
    options: EdgeGetReceiveAddressOptions
  ): Promise<EdgeFreshAddress> {
    // Do not show the address before logging into my monero...
    if (!this.walletLocalData.hasLoggedIn) return { publicAddress: '' }
    return { publicAddress: this.walletInfo.keys.moneroAddress }
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

    const options: CreateTransactionOptions = {
      isSweepTx: true,
      priority: translateFee(edgeSpendInfo.networkFeeOption),
      targets: [
        {
          amount: '0',
          targetAddress: publicAddress
        }
      ]
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
          address: this.walletInfo.keys.moneroAddress,
          privateViewKey: this.walletInfo.keys.moneroViewKeyPrivate,
          privateSpendKey: privateKeys.moneroSpendKeyPrivate,
          publicSpendKey: privateKeys.moneroSpendKeyPublic
        },
        options
      )
    } catch (e: any) {
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
    const { memos = [] } = edgeSpendInfo
    const privateKeys = asPrivateKeys(opts?.privateKeys)

    const { spendTargets } = edgeSpendInfo

    let totalAmount = '0'
    const targets: CreateTransactionOptions['targets'] = []

    for (const spendTarget of spendTargets) {
      const { publicAddress, nativeAmount } = spendTarget
      if (publicAddress == null) {
        throw new TypeError('Missing destination address')
      }
      if (nativeAmount == null || eq(nativeAmount, '0')) {
        throw new NoAmountSpecifiedError()
      }
      totalAmount = add(totalAmount, nativeAmount)
      if (
        gte(
          totalAmount,
          this.walletLocalData.totalBalances.get(PRIMARY_CURRENCY_TOKEN_ID) ??
            '0'
        )
      ) {
        if (gte(this.walletLocalData.lockedXmrBalance, totalAmount)) {
          throw new PendingFundsError()
        } else {
          throw new InsufficientFundsError({
            tokenId: PRIMARY_CURRENCY_TOKEN_ID
          })
        }
      }
      targets.push({
        amount: div(nativeAmount, '1000000000000', 12),
        targetAddress: publicAddress
      })
    }

    const options: CreateTransactionOptions = {
      isSweepTx: false,
      priority: translateFee(edgeSpendInfo.networkFeeOption),
      targets
    }
    this.log(`Creating transaction: ${JSON.stringify(options, null, 1)}`)

    const result: CreatedTransaction = await this.createMyMoneroTransaction(
      options,
      privateKeys
    )

    const date = Date.now() / 1000

    this.log(`Total sent: ${result.total_sent}, Fee: ${result.used_fee}`)
    const edgeTransaction: EdgeTransaction = {
      blockHeight: 0, // blockHeight
      currencyCode: 'XMR', // currencyCode
      date,
      isSend: true,
      memos,
      nativeAmount: '-' + result.total_sent,
      networkFee: result.used_fee,
      networkFees: [{ tokenId: null, nativeAmount: result.used_fee }],
      ourReceiveAddresses: [], // ourReceiveAddresses
      signedTx: result.serialized_signed_tx,
      tokenId: null,
      txid: result.tx_hash,
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
    await this.saveTransactionState(edgeTransaction.tokenId, edgeTransaction)
  }

  getDisplayPrivateSeed(privateKeys: JsonObject): string {
    const xmrPrivateKeys = asPrivateKeys(privateKeys)
    return xmrPrivateKeys.moneroKey
  }

  getDisplayPublicSeed(): string {
    if (this.walletInfo.keys?.moneroViewKeyPrivate != null) {
      return this.walletInfo.keys.moneroViewKeyPrivate
    }
    return ''
  }

  async dumpData(): Promise<EdgeDataDump> {
    const dataDump: EdgeDataDump = {
      walletId: this.walletId,
      walletType: this.walletInfo.type,
      // @ts-expect-error
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

export async function makeCurrencyEngine(
  env: EdgeCorePluginOptions,
  tools: MoneroTools,
  walletInfo: EdgeWalletInfo,
  opts: EdgeCurrencyEngineOptions
): Promise<EdgeCurrencyEngine> {
  const safeWalletInfo = asSafeWalletInfo(walletInfo)

  const engine = new MoneroEngine(env, tools, safeWalletInfo, opts)
  await engine.init()
  try {
    const result = await engine.walletLocalDisklet.getText(DATA_STORE_FILE)
    engine.walletLocalData = asMoneroLocalData(result)
  } catch (err) {
    try {
      opts.log(err)
      opts.log('No walletLocalData setup yet: Failure is ok')
      engine.walletLocalData = asMoneroLocalData('{}')
      await engine.walletLocalDisklet.setText(
        DATA_STORE_FILE,
        wasMoneroLocalData(engine.walletLocalData)
      )
    } catch (e) {
      opts.log.error(
        `Error writing to localDataStore. Engine not started: ${String(e)}`
      )
    }
  }

  return engine
}
