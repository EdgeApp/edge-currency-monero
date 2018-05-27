/**
 * Created by paul on 7/7/17.
 */
// @flow

import { currencyInfo } from './currencyInfoXMR.js'
import type {
  // EdgeCurrencyEngine,
  EdgeTransaction,
  EdgeCurrencyEngineCallbacks,
  EdgeCurrencyEngineOptions,
  EdgeSpendInfo,
  EdgeWalletInfo,
  EdgeMetaToken,
  EdgeCurrencyInfo,
  EdgeFreshAddress,
  EdgeDataDump,
  EdgeIo
} from 'edge-core-js'
// import { sprintf } from 'sprintf-js'
import { bns } from 'biggystring'
import {
  DATA_STORE_FILE,
  DATA_STORE_FOLDER,
  WalletLocalData
} from './xmrTypes.js'
import { normalizeAddress, validateObject, toHex } from './utils.js'
import moneroResponseParserUtils from 'mymonero-core-js/monero_utils/mymonero_response_parser_utils.js'

// const Buffer = require('buffer/').Buffer

const ADDRESS_POLL_MILLISECONDS = 3000
// const BLOCKHEIGHT_POLL_MILLISECONDS = 5000
// const NETWORKFEES_POLL_MILLISECONDS = (60 * 10 * 1000) // 10 minutes
const SAVE_DATASTORE_MILLISECONDS = 10000
// const ADDRESS_QUERY_LOOKBACK_BLOCKS = '8' // ~ 2 minutes
// const ADDRESS_QUERY_LOOKBACK_BLOCKS = (4 * 60 * 24 * 7) // ~ one week

const PRIMARY_CURRENCY = currencyInfo.currencyCode
// const CHECK_UNCONFIRMED = true
// const INFO_SERVERS = ['https://info1.edgesecure.co:8444']

// function unpadAddress (address: string): string {
//   const unpadded = bns.add('0', address, 16)
//   return unpadded
// }
//
// function padAddress (address: string): string {
//   const normalizedAddress = normalizeAddress(address)
//   const padding = 64 - normalizedAddress.length
//   const zeroString = '0000000000000000000000000000000000000000000000000000000000000000'
//   const out = '0x' + zeroString.slice(0, padding) + normalizedAddress
//   return out
// }

// class EthereumParams {
//   from: Array<string>
//   to: Array<string>
//   gas: string
//   gasPrice: string
//   gasUsed: string
//   cumulativeGasUsed: string
//   errorVal: number
//   tokenRecipientAddress: string | null
//
//   constructor (from: Array<string>,
//     to: Array<string>,
//     gas: string,
//     gasPrice: string,
//     gasUsed: string,
//     cumulativeGasUsed: string,
//     errorVal: number,
//     tokenRecipientAddress: string | null) {
//     this.from = from
//     this.to = to
//     this.gas = gas
//     this.gasPrice = gasPrice
//     this.gasUsed = gasUsed
//     this.errorVal = errorVal
//     this.cumulativeGasUsed = cumulativeGasUsed
//     if (typeof tokenRecipientAddress === 'string') {
//       this.tokenRecipientAddress = tokenRecipientAddress
//     } else {
//       this.tokenRecipientAddress = null
//     }
//   }
// }

class MoneroEngine {
  walletInfo: EdgeWalletInfo
  edgeTxLibCallbacks: EdgeCurrencyEngineCallbacks
  walletLocalFolder: any
  engineOn: boolean
  addressesChecked: boolean
  tokenCheckStatus: { [currencyCode: string]: number } // Each currency code can be a 0-1 value
  walletLocalData: WalletLocalData
  walletLocalDataDirty: boolean
  transactionsChangedArray: Array<EdgeTransaction>
  currencyInfo: EdgeCurrencyInfo
  allTokens: Array<EdgeMetaToken>
  keyImageCache: Object
  // customTokens: Array<EdgeMetaToken>
  currentSettings: any
  timers: any
  walletId: string
  io: EdgeIo

  constructor (io_: any, walletInfo: EdgeWalletInfo, opts: EdgeCurrencyEngineOptions) {
    // Validate that we are a valid EdgeCurrencyEngine:
    // eslint-disable-next-line no-unused-vars
    // const test: EdgeCurrencyEngine = this

    const { walletLocalFolder, callbacks } = opts

    this.io = io_
    this.engineOn = false
    this.addressesChecked = false
    this.tokenCheckStatus = {}
    this.walletLocalDataDirty = false
    this.transactionsChangedArray = []
    this.keyImageCache = {}
    this.walletInfo = walletInfo
    this.walletId = walletInfo.id ? `${walletInfo.id} - ` : ''
    this.currencyInfo = currencyInfo
    this.allTokens = currencyInfo.metaTokens.slice(0)
    // this.customTokens = []
    this.timers = {}

    if (typeof opts.optionalSettings !== 'undefined') {
      this.currentSettings = opts.optionalSettings
    } else {
      this.currentSettings = this.currencyInfo.defaultSettings
    }

    // Hard coded for testing
    // this.walletInfo.keys.moneroKey = '389b07b3466eed587d6bdae09a3613611de9add2635432d6cd1521af7bbc3757'
    // this.walletInfo.keys.moneroAddress = '0x9fa817e5A48DD1adcA7BEc59aa6E3B1F5C4BeA9a'
    this.edgeTxLibCallbacks = callbacks
    this.walletLocalFolder = walletLocalFolder

    this.log(`Created Wallet Type ${this.walletInfo.type} for Currency Plugin ${this.currencyInfo.pluginName} `)
  }

  async fetchPost (url: string, options: Object) {
    const opts = Object.assign({}, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }, options)

    const response = await this.io.fetch(url, opts)
    if (!response.ok) {
      const cleanUrl = url.replace(global.moneroApiKey, 'private')
      throw new Error(
        `The server returned error code ${response.status} for ${cleanUrl}`
      )
    }
    return response.json()
  }

  async fetchPostMyMonero (cmd: string, params: Object = {}) {
    const body = Object.assign({}, {
      address: this.walletLocalData.moneroAddress,
      view_key: this.walletLocalData.moneroViewKeyPrivate,
      create_account: true
    }, params)

    const options = {
      body: JSON.stringify(body)
    }
    const url = `${this.currentSettings.otherSettings.mymoneroApiServers[0]}/${cmd}`
    return this.fetchPost(url, options)
  }

  // updateOnAddressesChecked () {
  //   if (this.addressesChecked) {
  //     return
  //   }
  //   const activeTokens: Array<string> = []
  //
  //   for (const tokenCode of this.walletLocalData.enabledTokens) {
  //     const ti = this.getTokenInfo(tokenCode)
  //     if (ti) {
  //       activeTokens.push(tokenCode)
  //     }
  //   }
  //
  //   const perTokenSlice = 1 / activeTokens.length
  //   let numCompleteStatus = 0
  //   let totalStatus = 0
  //   for (const token of activeTokens) {
  //     const status = this.tokenCheckStatus[token]
  //     totalStatus += status * perTokenSlice
  //     if (status === 1) {
  //       numCompleteStatus++
  //     }
  //   }
  //   if (numCompleteStatus === activeTokens.length) {
  //     this.addressesChecked = true
  //     this.edgeTxLibCallbacks.onAddressesChecked(1)
  //     this.walletLocalData.lastAddressQueryHeight = this.walletLocalData.blockHeight
  //   } else {
  //     this.edgeTxLibCallbacks.onAddressesChecked(totalStatus)
  //   }
  // }

  // **********************************************
  // Login to mymonero.com server
  // **********************************************
  async loginInnerLoop () {
    try {
      const result = await this.fetchPostMyMonero('login')
      if (result.hasOwnProperty('new_address')) {
        clearTimeout(this.timers.loginInnerLoop)
        delete this.timers.loginInnerLoop
        // this.addToLoop('blockHeightInnerLoop', BLOCKHEIGHT_POLL_MILLISECONDS)
        this.addToLoop('checkAddressInnerLoop', ADDRESS_POLL_MILLISECONDS)
        this.addToLoop('saveWalletLoop', SAVE_DATASTORE_MILLISECONDS)
        // this.addToLoop('checkUpdateNetworkFees', NETWORKFEES_POLL_MILLISECONDS)
      }
    } catch (e) {
      console.log('Error logging into mymonero', e)
    }
  }

  // **********************************************
  // Check all addresses for new transactions
  // **********************************************
  async checkAddressInnerLoop () {
    try {
      const result = await this.fetchPostMyMonero('get_address_info')

      const parsedAddrInfo = moneroResponseParserUtils.Parsed_AddressInfo__sync(
        this.keyImageCache,
        result,
        this.walletLocalData.moneroAddress,
        this.walletLocalData.moneroViewKeyPrivate,
        '',
        ''
      )
      if (this.walletLocalData.blockHeight !== parsedAddrInfo.blockchain_height) {
        this.walletLocalData.blockHeight = parsedAddrInfo.blockchain_height // Convert to decimal
        this.walletLocalDataDirty = true
        this.edgeTxLibCallbacks.onBlockHeightChanged(this.walletLocalData.blockHeight)
      }

      const nativeBalance = bns.sub(parsedAddrInfo.total_received_String, parsedAddrInfo.total_sent_String)

      if (this.walletLocalData.totalBalances.XMR !== nativeBalance) {
        this.walletLocalData.totalBalances.XMR = nativeBalance
        this.edgeTxLibCallbacks.onBalanceChanged('XMR', nativeBalance)
      }
    } catch (e) {
      this.log('Error fetching address info: ' + this.walletLocalData.moneroAddress)
    }
  }

  findTransaction (currencyCode: string, txid: string) {
    if (typeof this.walletLocalData.transactionsObj[currencyCode] === 'undefined') {
      return -1
    }

    const currency = this.walletLocalData.transactionsObj[currencyCode]
    return currency.findIndex(element => {
      return normalizeAddress(element.txid) === normalizeAddress(txid)
    })
  }

  sortTxByDate (a: EdgeTransaction, b: EdgeTransaction) {
    return b.date - a.date
  }

  addTransaction (currencyCode: string, edgeTransaction: EdgeTransaction) {
    // Add or update tx in transactionsObj
    const idx = this.findTransaction(currencyCode, edgeTransaction.txid)

    if (idx === -1) {
      this.log('addTransaction: adding and sorting:' + edgeTransaction.txid)
      if (typeof this.walletLocalData.transactionsObj[currencyCode] === 'undefined') {
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

  updateTransaction (currencyCode: string, edgeTransaction: EdgeTransaction, idx: number) {
    // Update the transaction
    this.walletLocalData.transactionsObj[currencyCode][idx] = edgeTransaction
    this.walletLocalDataDirty = true
    this.transactionsChangedArray.push(edgeTransaction)
    this.log('updateTransaction:' + edgeTransaction.txid)
  }

  // *************************************
  // Save the wallet data store
  // *************************************
  async saveWalletLoop () {
    if (this.walletLocalDataDirty) {
      try {
        this.log('walletLocalDataDirty. Saving...')
        const walletJson = JSON.stringify(this.walletLocalData)
        await this.walletLocalFolder
          .folder(DATA_STORE_FOLDER)
          .file(DATA_STORE_FILE)
          .setText(walletJson)
        this.walletLocalDataDirty = false
      } catch (err) {
        this.log(err)
      }
    }
  }

  doInitialCallbacks () {
    for (const currencyCode of this.walletLocalData.enabledTokens) {
      try {
        this.edgeTxLibCallbacks.onTransactionsChanged(
          this.walletLocalData.transactionsObj[currencyCode]
        )
        this.edgeTxLibCallbacks.onBalanceChanged(currencyCode, this.walletLocalData.totalBalances[currencyCode])
      } catch (e) {
        this.log('Error for currencyCode', currencyCode, e)
      }
    }
  }

  // getTokenInfo (token: string) {
  //   return this.allTokens.find(element => {
  //     return element.currencyCode === token
  //   })
  // }

  async addToLoop (func: string, timer: number) {
    try {
      // $FlowFixMe
      await this[func]()
    } catch (e) {
      this.log('Error in Loop:', func, e)
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

  log (...text: Array<any>) {
    text[0] = `${this.walletId}${text[0]}`
    console.log(...text)
  }

  // *************************************
  // Public methods
  // *************************************

  updateSettings (settings: any) {
    this.currentSettings = settings
  }

  async startEngine () {
    this.engineOn = true
    this.doInitialCallbacks()
    this.addToLoop('loginInnerLoop', ADDRESS_POLL_MILLISECONDS)
  }

  async killEngine () {
    // Set status flag to false
    this.engineOn = false
    // Clear Inner loops timers
    for (const timer in this.timers) {
      clearTimeout(this.timers[timer])
    }
    this.timers = {}
  }

  async resyncBlockchain (): Promise<void> {
    await this.killEngine()
    const temp = JSON.stringify({
      enabledTokens: this.walletLocalData.enabledTokens,
      // networkFees: this.walletLocalData.networkFees,
      moneroAddress: this.walletLocalData.moneroAddress,
      moneroViewKeyPrivate: this.walletLocalData.moneroViewKeyPrivate
    })
    this.walletLocalData = new WalletLocalData(temp)
    this.walletLocalDataDirty = true
    await this.saveWalletLoop()
    await this.startEngine()
  }

  // synchronous
  getBlockHeight (): number {
    return parseInt(this.walletLocalData.blockHeight)
  }

  enableTokensSync (tokens: Array<string>) {
    for (const token of tokens) {
      if (this.walletLocalData.enabledTokens.indexOf(token) === -1) {
        this.walletLocalData.enabledTokens.push(token)
      }
    }
  }

  // asynchronous
  async enableTokens (tokens: Array<string>) {}

  // asynchronous
  async disableTokens (tokens: Array<string>) {}

  async getEnabledTokens (): Promise<Array<string>> {
    return []
  }

  async addCustomToken (tokenObj: any) {}

  // synchronous
  getTokenStatus (token: string) {
    return false
  }

  // synchronous
  getBalance (options: any): string {
    let currencyCode = PRIMARY_CURRENCY

    if (typeof options !== 'undefined') {
      const valid = validateObject(options, {
        'type': 'object',
        'properties': {
          'currencyCode': {'type': 'string'}
        }
      })

      if (valid) {
        currencyCode = options.currencyCode
      }
    }

    if (typeof this.walletLocalData.totalBalances[currencyCode] === 'undefined') {
      return '0'
    } else {
      const nativeBalance = this.walletLocalData.totalBalances[currencyCode]
      return nativeBalance
    }
  }

  // synchronous
  getNumTransactions (options: any): number {
    let currencyCode = PRIMARY_CURRENCY

    const valid = validateObject(options, {
      'type': 'object',
      'properties': {
        'currencyCode': {'type': 'string'}
      }
    })

    if (valid) {
      currencyCode = options.currencyCode
    }

    if (typeof this.walletLocalData.transactionsObj[currencyCode] === 'undefined') {
      return 0
    } else {
      return this.walletLocalData.transactionsObj[currencyCode].length
    }
  }

  // asynchronous
  async getTransactions (options: any) {
    let currencyCode:string = PRIMARY_CURRENCY

    const valid:boolean = validateObject(options, {
      'type': 'object',
      'properties': {
        'currencyCode': {'type': 'string'}
      }
    })

    if (valid) {
      currencyCode = options.currencyCode
    }

    if (typeof this.walletLocalData.transactionsObj[currencyCode] === 'undefined') {
      return []
    }

    let startIndex:number = 0
    let numEntries:number = 0
    if (options === null) {
      return this.walletLocalData.transactionsObj[currencyCode].slice(0)
    }
    if (options.startIndex !== null && options.startIndex > 0) {
      startIndex = options.startIndex
      if (
        startIndex >=
        this.walletLocalData.transactionsObj[currencyCode].length
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
          this.walletLocalData.transactionsObj[currencyCode].length -
          startIndex
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
      returnArray = this.walletLocalData.transactionsObj[currencyCode].slice(
        startIndex
      )
    }
    return returnArray
  }

  // synchronous
  getFreshAddress (options: any): EdgeFreshAddress {
    return { publicAddress: this.walletLocalData.moneroAddress }
  }

  // synchronous
  addGapLimitAddresses (addresses: Array<string>, options: any) {
  }

  // synchronous
  isAddressUsed (address: string, options: any) {
    return false
  }

  // synchronous
  async makeSpend (edgeSpendInfo: EdgeSpendInfo) {
    // Validate the spendInfo
    const valid = validateObject(edgeSpendInfo, {
      'type': 'object',
      'properties': {
        'currencyCode': { 'type': 'string' },
        'networkFeeOption': { 'type': 'string' },
        'spendTargets': {
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'currencyCode': { 'type': 'string' },
              'publicAddress': { 'type': 'string' },
              'nativeAmount': { 'type': 'string' },
              'destMetadata': { 'type': 'object' },
              'destWallet': { 'type': 'object' }
            },
            'required': [
              'publicAddress'
            ]
          }
        }
      },
      'required': [ 'spendTargets' ]
    })

    if (!valid) {
      throw (new Error('Error: invalid ABCSpendInfo'))
    }

    // Monero can only have one output
    if (edgeSpendInfo.spendTargets.length !== 1) {
      throw (new Error('Error: only one output allowed'))
    }

    // let tokenInfo = {}
    // tokenInfo.contractAddress = ''

    let currencyCode: string = ''
    // if (typeof edgeSpendInfo.currencyCode === 'string') {
    //   currencyCode = edgeSpendInfo.currencyCode
    //   if (!this.getTokenStatus(currencyCode)) {
    //     throw (new Error('Error: Token not supported or enabled'))
    //   } else if (currencyCode !== 'ETH') {
    //     tokenInfo = this.getTokenInfo(currencyCode)
    //     if (!tokenInfo || typeof tokenInfo.contractAddress !== 'string') {
    //       throw (new Error('Error: Token not supported or invalid contract address'))
    //     }
    //   }
    // } else {
    currencyCode = 'ETH'
    // }
    edgeSpendInfo.currencyCode = currencyCode

    // ******************************
    // Get the fee amount

    // let ethParams = {}
    // const { gasLimit, gasPrice } = calcMiningFee(edgeSpendInfo, this.walletLocalData.networkFees)

    // let publicAddress = ''
    if (typeof edgeSpendInfo.spendTargets[0].publicAddress === 'string') {
      // publicAddress = edgeSpendInfo.spendTargets[0].publicAddress
    } else {
      throw new Error('No valid spendTarget')
    }

    if (currencyCode === PRIMARY_CURRENCY) {
      // ethParams = new EthereumParams(
      //   [this.walletLocalData.moneroAddress],
      //   [publicAddress],
      //   gasLimit,
      //   gasPrice,
      //   '0',
      //   '0',
      //   0,
      //   null
      // )
    } else {
      // let contractAddress = ''
      // if (typeof tokenInfo.contractAddress === 'string') {
      //   contractAddress = tokenInfo.contractAddress
      // } else {
      //   throw new Error('makeSpend: Invalid contract address')
      // }
      // ethParams = new EthereumParams(
      //   [this.walletLocalData.moneroAddress],
      //   [contractAddress],
      //   gasLimit,
      //   gasPrice,
      //   '0',
      //   '0',
      //   0,
      //   publicAddress
      // )
    }

    let nativeAmount = '0'
    if (typeof edgeSpendInfo.spendTargets[0].nativeAmount === 'string') {
      nativeAmount = edgeSpendInfo.spendTargets[0].nativeAmount
    } else {
      throw (new Error('Error: no amount specified'))
    }

    const InsufficientFundsError = new Error('Insufficient funds')
    InsufficientFundsError.name = 'ErrorInsufficientFunds'
    const InsufficientFundsEthError = new Error('Insufficient ETH for transaction fee')
    InsufficientFundsEthError.name = 'ErrorInsufficientFundsMoreEth'

    // Check for insufficient funds
    // let nativeAmountBN = new BN(nativeAmount, 10)
    // const gasPriceBN = new BN(gasPrice, 10)
    // const gasLimitBN = new BN(gasLimit, 10)
    // const nativeNetworkFeeBN = gasPriceBN.mul(gasLimitBN)
    // const balanceEthBN = new BN(this.walletLocalData.totalBalances.ETH, 10)

    // const balanceEth = this.walletLocalData.totalBalances.ETH
    // let nativeNetworkFee = bns.mul(gasPrice, gasLimit)
    // let totalTxAmount = '0'
    // let parentNetworkFee = null
    //
    // if (currencyCode === PRIMARY_CURRENCY) {
    //   totalTxAmount = bns.add(nativeNetworkFee, nativeAmount)
    //   if (bns.gt(totalTxAmount, balanceEth)) {
    //     throw (InsufficientFundsError)
    //   }
    //   nativeAmount = bns.mul(totalTxAmount, '-1')
    // } else {
    //   parentNetworkFee = nativeNetworkFee
    //
    //   if (bns.gt(nativeNetworkFee, balanceEth)) {
    //     throw (InsufficientFundsEthError)
    //   }
    //
    //   nativeNetworkFee = '0' // Do not show a fee for token transations.
    //   const balanceToken = this.walletLocalData.totalBalances[currencyCode]
    //   if (bns.gt(nativeAmount, balanceToken)) {
    //     throw (InsufficientFundsError)
    //   }
    //   nativeAmount = bns.mul(nativeAmount, '-1')
    // }

    // const negativeOneBN = new BN('-1', 10)
    // nativeAmountBN.imul(negativeOneBN)
    // nativeAmount = nativeAmountBN.toString(10)

    // **********************************
    // Create the unsigned EdgeTransaction

    const edgeTransaction: EdgeTransaction = {
      txid: '', // txid
      date: 0, // date
      currencyCode, // currencyCode
      blockHeight: 0, // blockHeight
      nativeAmount, // nativeAmount
      // networkFee: nativeNetworkFee, // networkFee
      networkFee: '',
      ourReceiveAddresses: [], // ourReceiveAddresses
      signedTx: '0', // signedTx
      // otherParams: ethParams // otherParams
      otherParams: {}
    }

    // if (parentNetworkFee) {
    //   edgeTransaction.parentNetworkFee = parentNetworkFee
    // }

    return edgeTransaction
  }

  // asynchronous
  async signTx (edgeTransaction: EdgeTransaction): Promise<EdgeTransaction> {
    // Do signing

    // const gasLimitHex = toHex(edgeTransaction.otherParams.gas)
    // const gasPriceHex = toHex(edgeTransaction.otherParams.gasPrice)
    let nativeAmountHex

    // let nativeAmountHex = bns.mul('-1', edgeTransaction.nativeAmount, 16)
    if (edgeTransaction.currencyCode === PRIMARY_CURRENCY) {
      // Remove the networkFee from the nativeAmount
      const nativeAmount = bns.add(edgeTransaction.nativeAmount, edgeTransaction.networkFee)
      nativeAmountHex = bns.mul('-1', nativeAmount, 16)
    } else {
      nativeAmountHex = bns.mul('-1', edgeTransaction.nativeAmount, 16)
    }

    // const nonceBN = new BN(this.walletLocalData.nextNonce.toString(10), 10)
    // const nonceHex = '0x' + nonceBN.toString(16)
    //
    const nonceHex = toHex(this.walletLocalData.nextNonce)
    let data
    if (edgeTransaction.currencyCode === PRIMARY_CURRENCY) {
      data = ''
    } else {
      // const dataArray = abi.simpleEncode(
      //   'transfer(address,uint256):(uint256)',
      //   edgeTransaction.otherParams.tokenRecipientAddress,
      //   nativeAmountHex
      // )
      // data = '0x' + Buffer.from(dataArray).toString('hex')
      // nativeAmountHex = '0x00'
    }

    const txParams = {
      nonce: nonceHex,
      // gasPrice: gasPriceHex,
      // gasLimit: gasLimitHex,
      to: edgeTransaction.otherParams.to[0],
      value: nativeAmountHex,
      data: data,
      // EIP 155 chainId - mainnet: 1, ropsten: 3
      chainId: 1
    }
    console.log(txParams)

    // const privKey = Buffer.from(this.walletInfo.keys.moneroKey, 'hex')
    // const wallet = ethWallet.fromPrivateKey(privKey)
    //
    // this.log(wallet.getAddressString())
    //
    // const tx = new EthereumTx(txParams)
    // tx.sign(privKey)
    //
    // edgeTransaction.signedTx = bufToHex(tx.serialize())
    // edgeTransaction.txid = bufToHex(tx.hash())
    // edgeTransaction.date = Date.now() / 1000
    //
    return edgeTransaction
  }

  // async broadcastEtherscan (edgeTransaction: EdgeTransaction): Promise<BroadcastResults> {
  //   const result: BroadcastResults = {
  //     incrementNonce: false,
  //     decrementNonce: false
  //   }
  //   const transactionParsed = JSON.stringify(edgeTransaction, null, 2)
  //
  //   this.log(`Etherscan: sent transaction to network:\n${transactionParsed}\n`)
  //   const url = sprintf('?module=proxy&action=eth_sendRawTransaction&hex=%s', edgeTransaction.signedTx)
  //   const jsonObj = await this.fetchGetEtherscan(url)
  //
  //   this.log('broadcastEtherscan jsonObj:', jsonObj)
  //
  //   if (typeof jsonObj.error !== 'undefined') {
  //     this.log('Error sending transaction')
  //     if (
  //       jsonObj.error.code === -32000 ||
  //       jsonObj.error.message.includes('nonce is too low') ||
  //       jsonObj.error.message.includes('nonce too low') ||
  //       jsonObj.error.message.includes('incrementing the nonce') ||
  //       jsonObj.error.message.includes('replacement transaction underpriced')
  //     ) {
  //       result.incrementNonce = true
  //     } else {
  //       throw (jsonObj.error)
  //     }
  //     return result
  //   } else if (typeof jsonObj.result === 'string') {
  //     // Success!!
  //     return result
  //   } else {
  //     throw new Error('Invalid return value on transaction send')
  //   }
  // }
  //
  // async broadcastBlockCypher (edgeTransaction: EdgeTransaction): Promise<BroadcastResults> {
  //   const result: BroadcastResults = {
  //     incrementNonce: false,
  //     decrementNonce: false
  //   }
  //
  //   const transactionParsed = JSON.stringify(edgeTransaction, null, 2)
  //   this.log(`Blockcypher: sent transaction to network:\n${transactionParsed}\n`)
  //
  //   const url = sprintf('v1/eth/main/txs/push')
  //   const hexTx = edgeTransaction.signedTx.replace('0x', '')
  //   const jsonObj = await this.fetchPostBlockcypher(url, {tx: hexTx})
  //
  //   this.log('broadcastBlockCypher jsonObj:', jsonObj)
  //   if (typeof jsonObj.error !== 'undefined') {
  //     this.log('Error sending transaction')
  //     if (
  //       typeof jsonObj.error === 'string' &&
  //       jsonObj.error.includes('Account nonce ') &&
  //       jsonObj.error.includes('higher than transaction')
  //     ) {
  //       result.incrementNonce = true
  //     } else if (
  //       typeof jsonObj.error === 'string' &&
  //       jsonObj.error.includes('Error validating transaction') &&
  //       jsonObj.error.includes('orphaned, missing reference')
  //     ) {
  //       result.decrementNonce = true
  //     } else {
  //       throw (jsonObj.error)
  //     }
  //     return result
  //   } else if (jsonObj.tx && typeof jsonObj.tx.hash === 'string') {
  //     // Success!!
  //     return result
  //   } else {
  //     throw new Error('Invalid return value on transaction send')
  //   }
  //   return result
  // }

  // asynchronous
  async broadcastTx (edgeTransaction: EdgeTransaction): Promise<EdgeTransaction> {
    // const results: Array<BroadcastResults | null> = [null, null]
    // const errors: Array<Error | null> = [null, null]
    //
    // // Because etherscan will allow use of a nonce that's too high, only use it if Blockcypher fails
    // // If we can fix this or replace etherscan, then we can use an array of promises instead of await
    // // on each broadcast type
    // try {
    //   results[0] = await this.broadcastBlockCypher(edgeTransaction)
    // } catch (e) {
    //   errors[0] = e
    // }
    //
    // if (errors[0]) {
    //   try {
    //     results[1] = await this.broadcastEtherscan(edgeTransaction)
    //   } catch (e) {
    //     errors[1] = e
    //   }
    // }
    //
    // // Use code below once we actually use a Promise array and simultaneously broadcast with a Promise.all()
    // //
    // // for (let i = 0; i < results.length; i++) {
    // //   results[i] = null
    // //   errors[i] = null
    // //   try {
    // //     results[i] = await results[i]
    // //   } catch (e) {
    // //     errors[i] = e
    // //   }
    // // }
    //
    // let allErrored = true
    //
    // for (const e of errors) {
    //   if (!e) {
    //     allErrored = false
    //     break
    //   }
    // }
    //
    // let anyResultIncNonce = false
    // let anyResultDecrementNonce = false
    //
    // for (const r: BroadcastResults | null of results) {
    //   if (r && r.incrementNonce) {
    //     anyResultIncNonce = true
    //   }
    //   if (r && r.decrementNonce) {
    //     anyResultDecrementNonce = true
    //   }
    // }
    //
    // if (allErrored) {
    //   throw errors[0] // Can only throw one error so throw the first one
    // }
    //
    // this.log('broadcastTx errors:', errors)
    // this.log('broadcastTx results:', results)
    //
    // if (anyResultDecrementNonce) {
    //   this.walletLocalData.nextNonce = bns.add(this.walletLocalData.nextNonce, '-1')
    //   this.log('Nonce too high. Decrementing to ' + this.walletLocalData.nextNonce.toString())
    //   // Nonce error. Increment nonce and try again
    //   const edgeTx = await this.signTx(edgeTransaction)
    //   const out = await this.broadcastTx(edgeTx)
    //   return out
    // }
    //
    // if (anyResultIncNonce) {
    //   // All servers returned a nonce-too-low. Increment and retry sign and broadcast
    //   this.walletLocalData.nextNonce = bns.add(this.walletLocalData.nextNonce, '1')
    //   this.log('Nonce too low. Incrementing to ' + this.walletLocalData.nextNonce.toString())
    //   // Nonce error. Increment nonce and try again
    //   const edgeTx = await this.signTx(edgeTransaction)
    //   const out = await this.broadcastTx(edgeTx)
    //   return out
    // }
    // // Success
    // this.walletLocalData.nextNonce = bns.add(this.walletLocalData.nextNonce, '1')
    //
    return edgeTransaction
  }

  // asynchronous
  async saveTx (edgeTransaction: EdgeTransaction) {
    this.addTransaction(edgeTransaction.currencyCode, edgeTransaction)

    this.edgeTxLibCallbacks.onTransactionsChanged([edgeTransaction])
  }

  getDisplayPrivateSeed () {
    if (this.walletInfo.keys && this.walletInfo.keys.moneroKey) {
      return this.walletInfo.keys.moneroKey
    }
    return ''
  }

  getDisplayPublicSeed () {
    if (this.walletInfo.keys && this.walletInfo.keys.moneroAddress) {
      return this.walletInfo.keys.moneroAddress
    }
    return ''
  }

  dumpData (): EdgeDataDump {
    const dataDump: EdgeDataDump = {
      walletId: this.walletId.split(' - ')[0],
      walletType: this.walletInfo.type,
      pluginType: this.currencyInfo.pluginName,
      data: {
        walletLocalData: this.walletLocalData
      }
    }
    return dataDump
  }
}

export { MoneroEngine }
