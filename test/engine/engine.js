// @flow

import { assert } from 'chai'
import {
  type EdgeCorePluginOptions,
  type EdgeCurrencyEngine,
  type EdgeCurrencyEngineCallbacks,
  type EdgeCurrencyEngineOptions,
  type EdgeCurrencyPlugin,
  type EdgeCurrencyTools,
  type EdgeWalletInfo,
  closeEdge,
  makeFakeIo
} from 'edge-core-js'
import EventEmitter from 'events'
import { describe, it } from 'mocha'
import fetch from 'node-fetch'

import edgeCorePlugins from '../../src/xmrIndex.js'
import { fakeLog } from '../fakeLog.js'
import { nativeIo } from '../nodeNativeIo.js'
import fixtures from './fixtures.json'

// const DATA_STORE_FOLDER = 'txEngineFolderBTC'

for (const fixture of fixtures) {
  let safeInfo: EdgeWalletInfo
  let unsafeInfo: EdgeWalletInfo
  let engine: EdgeCurrencyEngine
  let tools: EdgeCurrencyTools

  const WALLET_TYPE = fixture.WALLET_TYPE
  // const TX_AMOUNT = fixture['TX_AMOUNT']

  const fakeIo = { ...makeFakeIo(), fetch, random: size => fixture.key }
  const opts: EdgeCorePluginOptions = {
    initOptions: {},
    io: fakeIo,
    log: fakeLog,
    nativeIo,
    pluginDisklet: fakeIo.disklet
  }
  const factory = edgeCorePlugins[fixture.pluginName]
  const plugin: EdgeCurrencyPlugin = factory(opts)

  const emitter = new EventEmitter()
  const callbacks: EdgeCurrencyEngineCallbacks = {
    onAddressChanged() {},
    onAddressesChecked(progressRatio) {
      // console.log('onAddressesCheck', progressRatio)
      emitter.emit('onAddressesCheck', progressRatio)
    },
    onTxidsChanged(txid) {
      // console.log('onTxidsChanged', txid)
      emitter.emit('onTxidsChanged', txid)
    },
    onBalanceChanged(currencyCode, balance) {
      // console.log('onBalanceChange:', currencyCode, balance)
      emitter.emit('onBalanceChange', currencyCode, balance)
    },
    onBlockHeightChanged(height) {
      // console.log('onBlockHeightChange:', height)
      emitter.emit('onBlockHeightChange', height)
    },
    onTransactionsChanged(transactionList) {
      // console.log('onTransactionsChanged:', transactionList)
      emitter.emit('onTransactionsChanged', transactionList)
    },
    onUnactivatedTokenIdsChanged() {},
    onStakingStatusChanged() {},
    onWcNewContractCall(payload) {
      emitter.emit('wcNewContractCall', payload)
    }
  }

  const walletLocalDisklet = fakeIo.disklet
  const currencyEngineOptions: EdgeCurrencyEngineOptions = {
    callbacks,
    customTokens: {},
    enabledTokenIds: [],
    log: fakeLog,
    walletLocalDisklet,
    walletLocalEncryptedDisklet: walletLocalDisklet,
    userSettings: undefined
  }

  describe(`Create Plugin for Wallet type ${WALLET_TYPE}`, function () {
    it('Plugin', async function () {
      assert.equal(
        plugin.currencyInfo.currencyCode,
        fixture['Test Currency code']
      )
      tools = await plugin.makeCurrencyTools()

      const unsafeKeys = await tools.createPrivateKey(WALLET_TYPE)
      unsafeInfo = {
        id: '1',
        type: WALLET_TYPE,
        keys: unsafeKeys
      }

      const safeKeys = await tools.derivePublicKey(unsafeInfo)
      safeInfo = {
        id: '1',
        type: WALLET_TYPE,
        keys: safeKeys
      }

      Object.assign(unsafeKeys, { ...unsafeKeys, ...safeKeys })
    })
  })

  describe(`Make Engine for Wallet type ${WALLET_TYPE}`, function () {
    // before('Create local cache file', function (done) {
    //   walletLocalFolder
    //     .folder(DATA_STORE_FOLDER)
    //     .file('addresses.json')
    //     .setText(JSON.stringify(dummyAddressData))
    //     .then(() =>
    //       walletLocalFolder
    //         .folder(DATA_STORE_FOLDER)
    //         .file('txs.json')
    //         .setText(JSON.stringify(dummyTransactionsData))
    //     )
    //     .then(() =>
    //       walletLocalFolder
    //         .folder(DATA_STORE_FOLDER)
    //         .file('headers.json')
    //         .setText(JSON.stringify(dummyHeadersData))
    //     )
    //     .then(done)
    // })

    it('Make Engine', function () {
      return plugin
        .makeCurrencyEngine(safeInfo, currencyEngineOptions)
        .then(e => {
          engine = e
          assert.equal(typeof engine.startEngine, 'function', 'startEngine')
          assert.equal(typeof engine.killEngine, 'function', 'killEngine')
          // assert.equal(typeof engine.enableTokens, 'function', 'enableTokens')
          assert.equal(
            typeof engine.getBlockHeight,
            'function',
            'getBlockHeight'
          )
          assert.equal(typeof engine.getBalance, 'function', 'getBalance')
          assert.equal(
            typeof engine.getNumTransactions,
            'function',
            'getNumTransactions'
          )
          assert.equal(
            typeof engine.getTransactions,
            'function',
            'getTransactions'
          )
          assert.equal(
            typeof engine.getFreshAddress,
            'function',
            'getFreshAddress'
          )
          assert.equal(
            typeof engine.addGapLimitAddresses,
            'function',
            'addGapLimitAddresses'
          )
          assert.equal(typeof engine.isAddressUsed, 'function', 'isAddressUsed')
          assert.equal(typeof engine.makeSpend, 'function', 'makeSpend')
          assert.equal(typeof engine.signTx, 'function', 'signTx')
          assert.equal(typeof engine.broadcastTx, 'function', 'broadcastTx')
          assert.equal(typeof engine.saveTx, 'function', 'saveTx')
          return true
        })
    })
  })

  // describe(`Is Address Used for Wallet type ${
  //   WALLET_TYPE
  // } from cache`, function () {
  //   it('Checking a wrong formated address', function (done) {
  //     try {
  //       engine.isAddressUsed('TestErrorWithWrongAddress')
  //     } catch (e) {
  //       assert(e, 'Should throw')
  //       assert.equal(e.message, 'Wrong formatted address')
  //       done()
  //     }
  //   })

  //   it("Checking an address we don't own", function () {
  //     try {
  //       assert.equal(
  //         engine.isAddressUsed('mnSmvy2q4dFNKQF18EBsrZrS7WEy6CieEE'),
  //         false
  //       )
  //     } catch (e) {
  //       assert(e, 'Should throw')
  //       assert.equal(e.message, 'Address not found in wallet')
  //     }
  //   })

  //   it('Checking an empty P2SH address', function (done) {
  //     assert.equal(
  //       engine.isAddressUsed('2N9DbpGaQEeLLZgPQP4gc9oKkrFHdsj5Eew'),
  //       false
  //     )
  //     done()
  //   })

  //   it('Checking a non empty P2SH address 1', function (done) {
  //     assert.equal(
  //       engine.isAddressUsed('2MwLo2ghJeXTgpDccHGcsTbdS9YVfM3K5GG'),
  //       true
  //     )
  //     done()
  //   })

  //   it('Checking a non empty P2SH address 2', function (done) {
  //     assert.equal(
  //       engine.isAddressUsed('2MxRjw65NxR4DsRj2z1f5xFnKkU5uMRCsoT'),
  //       true
  //     )
  //     done()
  //   })

  //   it('Checking a non empty P2SH address 3', function (done) {
  //     assert.equal(
  //       engine.isAddressUsed('2MxvxJh44wq17vhzGqFcAsuYsVmdEJKWuFV'),
  //       true
  //     )
  //     done()
  //   })
  // })

  // describe(`Get Transactions from Wallet type ${WALLET_TYPE}`, function () {
  //   it('Should get number of transactions from cache', function (done) {
  //     assert.equal(
  //       engine.getNumTransactions(),
  //       TX_AMOUNT,
  //       `should have ${TX_AMOUNT} tx from cache`
  //     )
  //     done()
  //   })

  //   it('Should get transactions from cache', function (done) {
  //     engine.getTransactions().then(txs => {
  //       assert.equal(
  //         txs.length,
  //         TX_AMOUNT,
  //         `should have ${TX_AMOUNT} tx from cache`
  //       )
  //       done()
  //     })
  //   })

  //   it('Should get transactions from cache with options', function (done) {
  //     engine.getTransactions({ startIndex: 1, numEntries: 2 }).then(txs => {
  //       assert.equal(txs.length, 2, 'should have 2 tx from cache')
  //       done()
  //     })
  //   })
  // })

  describe('Start engine', function () {
    it('Get BlockHeight', function (done) {
      let finished = false
      this.timeout(10000)
      // request.get(
      //   'https://api.etherscan.io/api?module=proxy&action=eth_blockNumber',
      //   (err, res, body) => {
      // assert(!err, 'getting block height from a second source')
      emitter.once('onBlockHeightChange', height => {
        const thirdPartyHeight = 1578127
        assert(height >= thirdPartyHeight, 'Block height')
        assert(engine.getBlockHeight() >= thirdPartyHeight, 'Block height')
        finished = true
        done() // Can be "done" since the promise resolves before the event fires but just be on the safe side
      })
      engine.startEngine().catch(e => {
        console.log('startEngine error', e, e.message)
      })
      const sync = async () => {
        if (engine.syncNetwork != null) {
          const delay = await engine.syncNetwork({
            privateKeys: unsafeInfo.keys
          })
          if (!finished) setTimeout(() => sync(), delay)
        }
      }
      sync().catch(console.error)
      //   }
      // )
    })
  })

  // describe(`Get Fresh Address for Wallet type ${WALLET_TYPE}`, function () {
  //   it('Should provide a non used BTC address when no options are provided', function (
  //     done
  //   ) {
  //     setTimeout(() => {
  //       const address = engine.getFreshAddress()
  //       request.get(
  //         `https://api.blocktrail.com/v1/tBTC/address/${
  //           address.publicAddress
  //         }?api_key=MY_APIKEY`,
  //         (err, res, body) => {
  //           const thirdPartyBalance = parseInt(JSON.parse(body).received)
  //           assert(!err, 'getting address incoming txs from a second source')
  //           assert(thirdPartyBalance === 0, 'Should have never received coins')
  //           done()
  //         }
  //       )
  //     }, 1000)
  //   })
  // })

  // describe(`Make Spend and Sign for Wallet type ${WALLET_TYPE}`, function () {
  //   it('Should build transaction with low fee', function () {
  //     // $FlowFixMe
  //     const templateSpend: EdgeSpendInfo = {
  //       networkFeeOption: 'low',
  //       metadata: {
  //         name: 'Transfer to College Fund',
  //         category: 'Transfer:Wallet:College Fund'
  //       },
  //       spendTargets: [
  //         {
  //           currencyCode: 'BTC',
  //           publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
  //           nativeAmount: '210000' // 0.021 BTC
  //         },
  //         {
  //           currencyCode: 'BTC',
  //           publicAddress: 'tb1qzu5e2xhmh7lyfs38yq0u7xmem37ufp6tp6uh6q',
  //           nativeAmount: '420000' // 0.042 BTC
  //         }
  //       ]
  //     }
  //     // $FlowFixMe
  //     return engine
  //       .makeSpend(templateSpend)
  //       .then(a => {
  //         return engine.signTx(a)
  //       })
  //       .then(a => {
  //         // console.log('sign', a)
  //       })
  //   })

  //   it('Should build transaction with low standard fee', function () {
  //     // $FlowFixMe
  //     const templateSpend: EdgeSpendInfo = {
  //       networkFeeOption: 'standard',
  //       metadata: {
  //         name: 'Transfer to College Fund',
  //         category: 'Transfer:Wallet:College Fund'
  //       },
  //       spendTargets: [
  //         {
  //           currencyCode: 'BTC',
  //           publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
  //           nativeAmount: '17320'
  //         }
  //       ]
  //     }
  //     return engine
  //       .makeSpend(templateSpend)
  //       .then(a => {
  //         return engine.signTx(a)
  //       })
  //       .then(a => {
  //         // console.log('sign', a)
  //       })
  //   })

  //   it('Should build transaction with middle standard fee', function () {
  //     // $FlowFixMe
  //     const templateSpend: EdgeSpendInfo = {
  //       networkFeeOption: 'standard',
  //       metadata: {
  //         name: 'Transfer to College Fund',
  //         category: 'Transfer:Wallet:College Fund'
  //       },
  //       spendTargets: [
  //         {
  //           currencyCode: 'BTC',
  //           publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
  //           nativeAmount: '43350000'
  //         }
  //       ]
  //     }
  //     return engine
  //       .makeSpend(templateSpend)
  //       .then(a => {
  //         return engine.signTx(a)
  //       })
  //       .then(a => {
  //         // console.log('sign', a)
  //       })
  //   })

  //   it('Should build transaction with high standard fee', function () {
  //     // $FlowFixMe
  //     const templateSpend: EdgeSpendInfo = {
  //       networkFeeOption: 'standard',
  //       metadata: {
  //         name: 'Transfer to College Fund',
  //         category: 'Transfer:Wallet:College Fund'
  //       },
  //       spendTargets: [
  //         {
  //           currencyCode: 'BTC',
  //           publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
  //           nativeAmount: '86700000'
  //         },
  //         {
  //           currencyCode: 'BTC',
  //           publicAddress: 'tb1qzu5e2xhmh7lyfs38yq0u7xmem37ufp6tp6uh6q',
  //           nativeAmount: '420000' // 0.042 BTC
  //         }
  //       ]
  //     }
  //     return engine
  //       .makeSpend(templateSpend)
  //       .then(a => {
  //         return engine.signTx(a)
  //       })
  //       .then(a => {
  //         // console.log('sign', a)
  //       })
  //   })

  //   it('Should build transaction with high fee', function () {
  //     // $FlowFixMe
  //     const templateSpend: EdgeSpendInfo = {
  //       networkFeeOption: 'high',
  //       metadata: {
  //         name: 'Transfer to College Fund',
  //         category: 'Transfer:Wallet:College Fund'
  //       },
  //       spendTargets: [
  //         {
  //           currencyCode: 'BTC',
  //           publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
  //           nativeAmount: '210000' // 0.021 BTC
  //         },
  //         {
  //           currencyCode: 'BTC',
  //           publicAddress: 'tb1qzu5e2xhmh7lyfs38yq0u7xmem37ufp6tp6uh6q',
  //           nativeAmount: '420000' // 0.042 BTC
  //         }
  //       ]
  //     }
  //     return engine
  //       .makeSpend(templateSpend)
  //       .then(a => {
  //         return engine.signTx(a)
  //       })
  //       .then(a => {
  //         // console.log('sign', a)
  //       })
  //   })

  //   it('Should build transaction with custom fee', function () {
  //     const templateSpend: EdgeSpendInfo = {
  //       networkFeeOption: 'custom',
  //       customNetworkFee: '1000',
  //       metadata: {
  //         name: 'Transfer to College Fund',
  //         category: 'Transfer:Wallet:College Fund'
  //       },
  //       spendTargets: [
  //         {
  //           currencyCode: 'BTC',
  //           publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
  //           nativeAmount: '210000' // 0.021 BTC
  //         },
  //         {
  //           currencyCode: 'BTC',
  //           publicAddress: 'tb1qzu5e2xhmh7lyfs38yq0u7xmem37ufp6tp6uh6q',
  //           nativeAmount: '420000' // 0.042 BTC
  //         }
  //       ]
  //     }
  //     // $FlowFixMe
  //     return engine
  //       .makeSpend(templateSpend)
  //       .then(function (a) {
  //         // console.log('makeSpend', a)
  //         return engine.signTx(a)
  //       })
  //       .then(function (a) {
  //         // console.log('signTx', a)
  //         // console.log('signTx', a.otherParams.bcoinTx.inputs)
  //       })
  //   })

  //   it('Should throw InsufficientFundsError', function () {
  //     // $FlowFixMe
  //     const templateSpend: EdgeSpendInfo = {
  //       networkFeeOption: 'high',
  //       metadata: {
  //         name: 'Transfer to College Fund',
  //         category: 'Transfer:Wallet:College Fund'
  //       },
  //       spendTargets: [
  //         {
  //           currencyCode: 'BTC',
  //           publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
  //           nativeAmount: '2100000000' // 0.021 BTC
  //         },
  //         {
  //           currencyCode: 'BTC',
  //           publicAddress: 'tb1qzu5e2xhmh7lyfs38yq0u7xmem37ufp6tp6uh6q',
  //           nativeAmount: '420000' // 0.042 BTC
  //         }
  //       ]
  //     }
  //     // $FlowFixMe
  //     return engine
  //       .makeSpend(templateSpend)
  //       .catch(e => assert.equal(e.message, 'InsufficientFundsError'))
  //   })

  //   after('Stop the engine', function (done) {
  //     console.log('kill engine')
  //     engine.killEngine().then(done)
  //   })
  // })
  describe('Stop the engine', function () {
    it('Should stop the engine', function (done) {
      engine.killEngine().then(() => {
        closeEdge()
        done()
      })
    })
  })
}
