// @flow

import { assert, expect } from 'chai'
import {
  type EdgeCorePluginOptions,
  type EdgeCurrencyPlugin,
  type EdgeCurrencyTools,
  type EdgeIo,
  type EdgeParsedUri,
  makeFakeIo
} from 'edge-core-js'
import { before, describe, it } from 'mocha'
import fetch from 'node-fetch'

import edgeCorePlugins from '../../src/index.js'
import { fakeLog } from '../fakeLog.js'
import { nativeIo } from '../nodeNativeIo.js'
import fixtures from './fixtures.json'

/**
 * Verifies that a promise rejects with a particular error.
 */
export async function expectRejection(
  promise: Promise<mixed>,
  message?: string
): Promise<void> {
  return await promise.then(
    ok => {
      throw new Error('Expecting this promise to reject')
    },
    error => {
      if (message != null) expect(String(error)).equals(message)
    }
  )
}

for (const fixture of fixtures) {
  let tools: EdgeCurrencyTools

  const WALLET_TYPE: string = fixture.WALLET_TYPE
  const keyName = WALLET_TYPE.split('wallet:')[1].split('-')[0] + 'Key'
  const address = WALLET_TYPE.split('wallet:')[1].split('-')[0] + 'Address'

  let randomIndex = 0
  const len = fixture.key
  const fakeIo: EdgeIo = {
    ...makeFakeIo(),
    random: size => {
      if (randomIndex + size > len) {
        randomIndex = 0
      }
      return fixture.key.slice(randomIndex, randomIndex + size)
    },
    fetch
  }
  const opts: EdgeCorePluginOptions = {
    initOptions: {},
    io: fakeIo,
    log: fakeLog,
    nativeIo,
    pluginDisklet: fakeIo.disklet
  }
  const factory = edgeCorePlugins[fixture.pluginName]
  const plugin: EdgeCurrencyPlugin = factory(opts)

  describe(`Info for Wallet type ${WALLET_TYPE}`, function () {
    it('Test Currency code', function () {
      assert.equal(
        plugin.currencyInfo.currencyCode,
        fixture['Test Currency code']
      )
    })
  })

  describe(`createPrivateKey for Wallet type ${WALLET_TYPE}`, function () {
    before('Tools', async function () {
      const currencyTools = await plugin.makeCurrencyTools()
      tools = currencyTools
    })

    it('Create valid key', async function () {
      const keys = await tools.createPrivateKey(WALLET_TYPE)
      assert.equal(!keys, false)
      assert.equal(typeof keys[keyName], 'string')
      const length1 = keys.moneroSpendKeyPrivate.length
      const length2 = keys.moneroSpendKeyPublic.length
      assert.equal(length1, 64)
      assert.equal(length2, 64)
    })
  })

  describe(`derivePublicKey for Wallet type ${WALLET_TYPE}`, function () {
    before('Plugin', function () {
      before('Tools', async function () {
        const currencyTools = await plugin.makeCurrencyTools()
        tools = currencyTools
        return await tools.createPrivateKey(WALLET_TYPE)
      })
    })

    it('Valid private key', async function () {
      const keys = await tools.derivePublicKey({
        id: 'id',
        keys: { [keyName]: fixture.mnemonic },
        type: WALLET_TYPE
      })
      assert.equal(keys[address], fixture.xpub)
    })

    it('Invalid key name', async function () {
      // assert.throws(async () => {
      try {
        await tools.derivePublicKey(fixture['Invalid key name'])
        assert(false)
      } catch (e) {
        assert(true)
      }
      // })
    })

    it('Invalid wallet type', async function () {
      try {
        await tools.derivePublicKey(fixture['Invalid wallet type'])
        assert(false)
      } catch (e) {
        assert(true)
      }
    })
  })

  describe(`parseUri for Wallet type ${WALLET_TYPE}`, function () {
    before('Tools', async function () {
      const currencyTools = await plugin.makeCurrencyTools()
      tools = currencyTools
    })

    it('address only', async function () {
      const parsedUri = await tools.parseUri(
        fixture.parseUri['address only'][0]
      )
      assert.equal(parsedUri.publicAddress, fixture.parseUri['address only'][1])
      assert.equal(parsedUri.nativeAmount, undefined)
      assert.equal(parsedUri.currencyCode, undefined)
    })
    it('invalid address 0', async function () {
      return await expectRejection(
        tools.parseUri(fixture.parseUri['invalid address'][0])
      )
    })
    it('invalid address 1', async function () {
      return await expectRejection(
        tools.parseUri(fixture.parseUri['invalid address'][1])
      )
    })
    it('invalid address 2', async function () {
      return await expectRejection(
        tools.parseUri(fixture.parseUri['invalid address'][2])
      )
    })
    it('uri address', async function () {
      const parsedUri = await tools.parseUri(fixture.parseUri['uri address'][0])
      assert.equal(parsedUri.publicAddress, fixture.parseUri['uri address'][1])
      assert.equal(parsedUri.nativeAmount, undefined)
      assert.equal(parsedUri.currencyCode, undefined)
    })
    it('uri address with amount', async function () {
      const parsedUri = await tools.parseUri(
        fixture.parseUri['uri address with amount'][0]
      )
      assert.equal(
        parsedUri.publicAddress,
        fixture.parseUri['uri address with amount'][1]
      )
      assert.equal(
        parsedUri.nativeAmount,
        fixture.parseUri['uri address with amount'][2]
      )
      assert.equal(
        parsedUri.currencyCode,
        fixture.parseUri['uri address with amount'][3]
      )
    })
    it('uri address with unique identifier', async function () {
      const parsedUri = await tools.parseUri(
        fixture.parseUri['uri address with unique identifier'][0]
      )
      assert.equal(
        parsedUri.publicAddress,
        fixture.parseUri['uri address with unique identifier'][1]
      )
      assert.equal(
        parsedUri.uniqueIdentifier,
        fixture.parseUri['uri address with unique identifier'][2]
      )
    })
    it('uri address with unique identifier and without network prefix', async function () {
      const parsedUri = await tools.parseUri(
        fixture.parseUri[
          'uri address with unique identifier and without network prefix'
        ][0]
      )
      assert.equal(
        parsedUri.publicAddress,
        fixture.parseUri[
          'uri address with unique identifier and without network prefix'
        ][1]
      )
      assert.equal(
        parsedUri.uniqueIdentifier,
        fixture.parseUri[
          'uri address with unique identifier and without network prefix'
        ][2]
      )
    })
    it('uri address with amount & label', async function () {
      const parsedUri = await tools.parseUri(
        fixture.parseUri['uri address with amount & label'][0]
      )
      assert.equal(
        parsedUri.publicAddress,
        fixture.parseUri['uri address with amount & label'][1]
      )
      assert.equal(
        parsedUri.nativeAmount,
        fixture.parseUri['uri address with amount & label'][2]
      )
      assert.equal(
        parsedUri.currencyCode,
        fixture.parseUri['uri address with amount & label'][3]
      )
      if (parsedUri.metadata == null) throw new Error('no metadata')
      assert.equal(
        parsedUri.metadata.name,
        fixture.parseUri['uri address with amount & label'][4]
      )
    })
    it('uri address with amount, label & message', async function () {
      const parsedUri: EdgeParsedUri = await tools.parseUri(
        fixture.parseUri['uri address with amount & label'][0]
      )
      assert.equal(
        parsedUri.publicAddress,
        fixture.parseUri['uri address with amount & label'][1]
      )
      assert.equal(
        parsedUri.nativeAmount,
        fixture.parseUri['uri address with amount & label'][2]
      )
      assert.equal(
        parsedUri.currencyCode,
        fixture.parseUri['uri address with amount & label'][3]
      )
      if (parsedUri.metadata == null) throw new Error('no metadata')
      assert.equal(
        parsedUri.metadata.name,
        fixture.parseUri['uri address with amount & label'][4]
      )
    })
    it('uri address with unsupported param', async function () {
      const parsedUri = await tools.parseUri(
        fixture.parseUri['uri address with amount & label'][0]
      )
      assert.equal(
        parsedUri.publicAddress,
        fixture.parseUri['uri address with amount & label'][1]
      )
      assert.equal(
        parsedUri.nativeAmount,
        fixture.parseUri['uri address with amount & label'][2]
      )
      assert.equal(
        parsedUri.currencyCode,
        fixture.parseUri['uri address with amount & label'][3]
      )
    })
  })

  describe(`encodeUri for Wallet type ${WALLET_TYPE}`, function () {
    before('Tools', async function () {
      const currencyTools = await plugin.makeCurrencyTools()
      tools = currencyTools
    })
    it('address only', async function () {
      const encodedUri = await tools.encodeUri(
        fixture.encodeUri['address only'][0]
      )
      assert.equal(encodedUri, fixture.encodeUri['address only'][1])
    })
    it('invalid address 0', async function () {
      return await expectRejection(
        tools.encodeUri(fixture.encodeUri['invalid address'][0])
      )
    })
    it('invalid address 1', async function () {
      return await expectRejection(
        tools.encodeUri(fixture.encodeUri['invalid address'][1])
      )
    })
    it('invalid address 2', async function () {
      return await expectRejection(
        tools.encodeUri(fixture.encodeUri['invalid address'][2])
      )
    })
    it('address & amount', async function () {
      const encodedUri = await tools.encodeUri(
        fixture.encodeUri['address & amount'][0]
      )
      assert.equal(encodedUri, fixture.encodeUri['address & amount'][1])
    })
    it('address, amount, and label', async function () {
      const encodedUri = await tools.encodeUri(
        fixture.encodeUri['address, amount, and label'][0]
      )
      assert.equal(
        encodedUri,
        fixture.encodeUri['address, amount, and label'][1]
      )
    })
    it('address, amount, label, & message', async function () {
      const encodedUri = await tools.encodeUri(
        fixture.encodeUri['address, amount, label, & message'][0]
      )
      assert.equal(
        encodedUri,
        fixture.encodeUri['address, amount, label, & message'][1]
      )
    })
    it('invalid currencyCode', async function () {
      return await expectRejection(
        tools.encodeUri(fixture.encodeUri['invalid currencyCode'][0])
      )
    })
  })
}
