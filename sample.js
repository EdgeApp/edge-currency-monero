import { network_type } from 'mymonero-core-js/cryptonote_utils/nettype.js'
import monero_config from 'mymonero-core-js/monero_utils/monero_config.js'
import monero_sendingFunds_utils from 'mymonero-core-js/monero_utils/monero_sendingFunds_utils.js'
import monero_wallet_utils from 'mymonero-core-js/monero_utils/monero_wallet_utils.js'
import monero_response_parser_utils from 'mymonero-core-js/monero_utils/mymonero_response_parser_utils.js'
import fetch from 'node-fetch'

import { HostedMoneroAPIClient } from './src/HostedMoneroAPIClient/HostedMoneroAPIClient.Lite.js'
// const OpenAliasResolver = require('src/OpenAlias/OpenAliasResolver.js')
import { MoneroOpenAliasUtils } from './src/OpenAlias/monero_openalias_utils.js'

const keyImageCache = {}
const { MAINNET } = network_type

async function main () {
  // const wallet = monero_wallet_utils.NewlyCreatedWallet('english', MAINNET)
  // console.log(wallet)

  const opts = {
    appUserAgent_product: 'Edge_Wallet',
    appUserAgent_version: '1.1.2',
    fetch
    // request_conformant_module: xhr
  }
  const context = {
    HostedMoneroAPIClient_DEBUGONLY_mockSendTransactionSuccess: false,
    isDebug: false
  }
  const hostedMoneroAPIClient = new HostedMoneroAPIClient(opts, context)

  const mnemonicString = 'dreams cell muddy geek toyed dazed gnaw dove jailed flippant dove dime humid anchor candy money empty pinched nifty pimple across also randomly regular empty'

  const wallet2 = monero_wallet_utils.SeedAndKeysFromMnemonic_sync(mnemonicString, 'english', MAINNET)
  console.log(wallet2)

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      address: wallet2.keys.public_addr,
      view_key: wallet2.keys.view.sec,
      create_account: true
    })
  }
  console.log(options)
  let result = await fetch('https://api.mymonero.com:8443/login', options)
  let json = await result.json()
  console.log('### login', json)
  console.log('---')

  let options2 = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      address: wallet2.keys.public_addr,
      view_key: wallet2.keys.view.sec
    })
  }

  result = await fetch('https://api.mymonero.com:8443/get_address_info', options2)
  json = await result.json()
  console.log('### get_address_info', json)
  console.log('---')

  const parsedAddrInfo = monero_response_parser_utils.Parsed_AddressInfo__sync(
    keyImageCache,
    json,
    wallet2.keys.public_addr,
    wallet2.keys.view.sec,
    wallet2.keys.spend.pub,
    wallet2.keys.spend.sec
  )
  console.log('### parse AddrInfo:', parsedAddrInfo)

  result = await fetch('https://api.mymonero.com:8443/get_address_txs', options2)
  json = await result.json()
  console.log('### get_address_txs', json)
  console.log('---')

  const parsedTxs = monero_response_parser_utils.Parsed_AddressTransactions__sync(
    keyImageCache,
    json,
    wallet2.keys.public_addr,
    wallet2.keys.view.sec,
    wallet2.keys.spend.pub,
    wallet2.keys.spend.sec
  )

  console.log('### parsed Txs:', parsedTxs)

  const mixin = 6
  options2 = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      address: wallet2.keys.public_addr,
      view_key: wallet2.keys.view.sec,
      amount: '0',
      // 6
      mixin,
      use_dust: mixin === 0, // Use dust outputs only when we are using no mixins
      dust_threshold: monero_config.dustThreshold.toString()
    })
  }
  console.log(options2)
  result = await fetch('https://api.mymonero.com:8443/get_unspent_outs', options2)
  json = await result.json()
  console.log('get_unspent_outs', json)

  // hostedMoneroAPIClient.LogIn(
  //   '492V29xq4uvazXuWPQTg65QZZDrCHFWapiAqq8nvXAbQdWwgXHBJdK9DPrh11UvvJzSFzwtVEi5uM6kj4czmMYGZLx52ZLU',
  //   wallet2.keys.view.sec,
  //   (err, result) => {
  //     if (err) {
  //       console.log(err)
  //       return
  //     }

  const options3 = {
    isRingCT: true,
    target_address: '467qu7tVpAKCDfUpiABGgH5TCBK1dxJqQAuoeJgjgZWYXrrfPLC9ydh1WidJEuuXXhVDiK7pPQTDfhvPMthMNQyNJkqoj4i',
    nettype: MAINNET,
    amount: 0.0012345,
    wallet__keyImage_cache: keyImageCache,
    wallet__public_address: wallet2.keys.public_addr,
    wallet__private_keys: { view: wallet2.keys.view.sec, spend: wallet2.keys.spend.sec },
    wallet__public_keys: { view: wallet2.keys.view.pub, spend: wallet2.keys.spend.pub },
    hostedMoneroAPIClient,
    monero_openalias_utils: MoneroOpenAliasUtils,
    payment_id: null,
    mixin: 6,
    simple_priority: 1,
    doNotBroadcast: true
  }

  monero_sendingFunds_utils.SendFundsWithOptions(
    options3,
    (code) => {
      console.log(code)
    },
    (result) => {
      console.log(result)
      console.log(result.tx_fee.toString())
      // Broadcast the transaction
      options3.doNotBroadcast = false
      monero_sendingFunds_utils.SendFundsWithOptions(
        options3,
        (code) => {
          console.log(code)
        },
        (code) => {
          console.log(code)
        },
        (code) => {
          console.log(code)
        }
      )
      // hostedMoneroAPIClient.SubmitSerializedSignedTransaction(
      //   '467qu7tVpAKCDfUpiABGgH5TCBK1dxJqQAuoeJgjgZWYXrrfPLC9ydh1WidJEuuXXhVDiK7pPQTDfhvPMthMNQyNJkqoj4i',
      //   wallet2.keys.view.sec,
      //   result.signedTx,
      //   (err) => {
      //     if (err) {
      //       console.log('Something unexpected occurred when submitting your transaction:', err)
      //       return
      //     }
      //     console.log('Success')
      //   }
      // )

    },
    (code) => {
      console.log(code)
    }
  )
  //   }
  // )
}

main()
