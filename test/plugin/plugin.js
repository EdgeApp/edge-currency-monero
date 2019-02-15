// @flow

import { assert, expect } from 'chai'
import { type EdgeCurrencyPlugin, type EdgeParsedUri } from 'edge-core-js'
import { before, describe, it } from 'mocha'
import fetch from 'node-fetch'

import * as Factories from '../../src/xmrIndex.js'
import fixtures from './fixtures.json'

/**
 * Verifies that a promise rejects with a particular error.
 */
export function expectRejection (
  promise: Promise<mixed>,
  message?: string
): Promise<mixed> {
  return promise.then(
    ok => {
      throw new Error('Expecting this promise to reject')
    },
    error => {
      if (message != null) expect(String(error)).equals(message)
    }
  )
}

for (const fixture of fixtures) {
  let plugin: EdgeCurrencyPlugin

  const CurrencyPluginFactory = Factories[fixture['factory']]
  const WALLET_TYPE = fixture['WALLET_TYPE']
  const keyName = WALLET_TYPE.split('wallet:')[1].split('-')[0] + 'Key'
  const address = WALLET_TYPE.split('wallet:')[1].split('-')[0] + 'Address'

  let randomIndex = 0
  const len = fixture['key']
  const opts = {
    io: {
      random: size => {
        if (randomIndex + size > len) {
          randomIndex = 0
        }
        return fixture['key'].slice(randomIndex, randomIndex + size)
      },
      fetch,
      console: {
        info: console.log,
        warn: console.log,
        error: console.log
      }
    }
  }

  describe(`Info for Wallet type ${WALLET_TYPE}`, function () {
    before('Plugin', function (done) {
      CurrencyPluginFactory.makePlugin(opts).then(currencyPlugin => {
        plugin = currencyPlugin
        done()
      })
    })

    it('Test Currency code', function () {
      assert.equal(
        plugin.currencyInfo.currencyCode,
        fixture['Test Currency code']
      )
    })
  })

  describe(`createPrivateKey for Wallet type ${WALLET_TYPE}`, function () {
    before('Plugin', function (done) {
      CurrencyPluginFactory.makePlugin(opts).then(currencyPlugin => {
        plugin = currencyPlugin
        done()
      })
    })

    it('Test Currency code', function () {
      assert.equal(
        plugin.currencyInfo.currencyCode,
        fixture['Test Currency code']
      )
    })

    it('Create valid key', async function () {
      const keys = await plugin.createPrivateKey(WALLET_TYPE)
      assert.equal(!keys, false)
      assert.equal(typeof keys[keyName], 'string')
      const length1 = keys.moneroSpendKeyPrivate.length
      const length2 = keys.moneroSpendKeyPublic.length
      assert.equal(length1, 64)
      assert.equal(length2, 64)
    })
  })

  describe(`derivePublicKey for Wallet type ${WALLET_TYPE}`, function () {
    before('Plugin', async function () {
      const currencyPlugin = await CurrencyPluginFactory.makePlugin(opts)
      assert.equal(
        currencyPlugin.currencyInfo.currencyCode,
        fixture['Test Currency code']
      )
      plugin = currencyPlugin
      await plugin.createPrivateKey(WALLET_TYPE)
    })

    it('Valid private key', async function () {
      const keys = await plugin.derivePublicKey({
        id: 'id',
        keys: { [keyName]: fixture['mnemonic'] },
        type: WALLET_TYPE
      })
      assert.equal(keys[address], fixture['xpub'])
    })

    it('Invalid key name', async function () {
      // assert.throws(async () => {
      try {
        await plugin.derivePublicKey(fixture['Invalid key name'])
        assert(false)
      } catch (e) {
        assert(true)
      }
      // })
    })

    it('Invalid wallet type', async function () {
      try {
        await plugin.derivePublicKey(fixture['Invalid wallet type'])
        assert(false)
      } catch (e) {
        assert(true)
      }
    })
  })

  describe(`parseUri for Wallet type ${WALLET_TYPE}`, function () {
    before('Plugin', function (done) {
      CurrencyPluginFactory.makePlugin(opts).then(currencyPlugin => {
        assert.equal(
          currencyPlugin.currencyInfo.currencyCode,
          fixture['Test Currency code']
        )
        plugin = currencyPlugin
        done()
      })
    })
    it('address only', async function () {
      const parsedUri = await plugin.parseUri(
        fixture['parseUri']['address only'][0]
      )
      assert.equal(
        parsedUri.publicAddress,
        fixture['parseUri']['address only'][1]
      )
      assert.equal(parsedUri.nativeAmount, undefined)
      assert.equal(parsedUri.currencyCode, undefined)
    })
    it('invalid address 0', function () {
      return expectRejection(
        Promise.resolve(
          plugin.parseUri(fixture['parseUri']['invalid address'][0])
        )
      )
    })
    it('invalid address 1', function () {
      return expectRejection(
        Promise.resolve(
          plugin.parseUri(fixture['parseUri']['invalid address'][1])
        )
      )
    })
    it('invalid address 2', function () {
      return expectRejection(
        Promise.resolve(
          plugin.parseUri(fixture['parseUri']['invalid address'][2])
        )
      )
    })
    it('uri address', async function () {
      const parsedUri = await plugin.parseUri(
        fixture['parseUri']['uri address'][0]
      )
      assert.equal(
        parsedUri.publicAddress,
        fixture['parseUri']['uri address'][1]
      )
      assert.equal(parsedUri.nativeAmount, undefined)
      assert.equal(parsedUri.currencyCode, undefined)
    })
    it('uri address with amount', async function () {
      const parsedUri = await plugin.parseUri(
        fixture['parseUri']['uri address with amount'][0]
      )
      assert.equal(
        parsedUri.publicAddress,
        fixture['parseUri']['uri address with amount'][1]
      )
      assert.equal(
        parsedUri.nativeAmount,
        fixture['parseUri']['uri address with amount'][2]
      )
      assert.equal(
        parsedUri.currencyCode,
        fixture['parseUri']['uri address with amount'][3]
      )
    })
    it('uri address with unique identifier', async function () {
      const parsedUri = await plugin.parseUri(
        fixture['parseUri']['uri address with unique identifier'][0]
      )
      assert.equal(
        parsedUri.publicAddress,
        fixture['parseUri']['uri address with unique identifier'][1]
      )
      assert.equal(
        parsedUri.uniqueIdentifier,
        fixture['parseUri']['uri address with unique identifier'][2]
      )
    })
    it('uri address with amount & label', async function () {
      const parsedUri = await plugin.parseUri(
        fixture['parseUri']['uri address with amount & label'][0]
      )
      assert.equal(
        parsedUri.publicAddress,
        fixture['parseUri']['uri address with amount & label'][1]
      )
      assert.equal(
        parsedUri.nativeAmount,
        fixture['parseUri']['uri address with amount & label'][2]
      )
      assert.equal(
        parsedUri.currencyCode,
        fixture['parseUri']['uri address with amount & label'][3]
      )
      if (parsedUri.metadata == null) throw new Error('no metadata')
      assert.equal(
        parsedUri.metadata.name,
        fixture['parseUri']['uri address with amount & label'][4]
      )
    })
    it('uri address with amount, label & message', async function () {
      const parsedUri: EdgeParsedUri = await plugin.parseUri(
        fixture['parseUri']['uri address with amount & label'][0]
      )
      assert.equal(
        parsedUri.publicAddress,
        fixture['parseUri']['uri address with amount & label'][1]
      )
      assert.equal(
        parsedUri.nativeAmount,
        fixture['parseUri']['uri address with amount & label'][2]
      )
      assert.equal(
        parsedUri.currencyCode,
        fixture['parseUri']['uri address with amount & label'][3]
      )
      if (parsedUri.metadata == null) throw new Error('no metadata')
      assert.equal(
        parsedUri.metadata.name,
        fixture['parseUri']['uri address with amount & label'][4]
      )
    })
    it('uri address with unsupported param', async function () {
      const parsedUri = await plugin.parseUri(
        fixture['parseUri']['uri address with amount & label'][0]
      )
      assert.equal(
        parsedUri.publicAddress,
        fixture['parseUri']['uri address with amount & label'][1]
      )
      assert.equal(
        parsedUri.nativeAmount,
        fixture['parseUri']['uri address with amount & label'][2]
      )
      assert.equal(
        parsedUri.currencyCode,
        fixture['parseUri']['uri address with amount & label'][3]
      )
    })
  })

  describe(`encodeUri for Wallet type ${WALLET_TYPE}`, async function () {
    before('Plugin', function (done) {
      CurrencyPluginFactory.makePlugin(opts).then(currencyPlugin => {
        plugin = currencyPlugin
        done()
      })
    })
    it('address only', async function () {
      const encodedUri = await plugin.encodeUri(
        fixture['encodeUri']['address only'][0]
      )
      assert.equal(encodedUri, fixture['encodeUri']['address only'][1])
    })
    it('invalid address 0', function () {
      return expectRejection(
        Promise.resolve(
          plugin.encodeUri(fixture['encodeUri']['invalid address'][0])
        )
      )
    })
    it('invalid address 1', function () {
      return expectRejection(
        Promise.resolve(
          plugin.encodeUri(fixture['encodeUri']['invalid address'][1])
        )
      )
    })
    it('invalid address 2', function () {
      return expectRejection(
        Promise.resolve(
          plugin.encodeUri(fixture['encodeUri']['invalid address'][2])
        )
      )
    })
    it('address & amount', async function () {
      const encodedUri = await plugin.encodeUri(
        fixture['encodeUri']['address & amount'][0]
      )
      assert.equal(encodedUri, fixture['encodeUri']['address & amount'][1])
    })
    it('address, amount, and label', async function () {
      const encodedUri = await plugin.encodeUri(
        fixture['encodeUri']['address, amount, and label'][0]
      )
      assert.equal(
        encodedUri,
        fixture['encodeUri']['address, amount, and label'][1]
      )
    })
    it('address, amount, label, & message', async function () {
      const encodedUri = await plugin.encodeUri(
        fixture['encodeUri']['address, amount, label, & message'][0]
      )
      assert.equal(
        encodedUri,
        fixture['encodeUri']['address, amount, label, & message'][1]
      )
    })
    it('invalid currencyCode', function () {
      return expectRejection(
        Promise.resolve(
          plugin.encodeUri(fixture['encodeUri']['invalid currencyCode'][0])
        )
      )
    })
  })
}
