# Edge Monero Currency Plugin
[![Build Status][travis-image]][travis-url] [![NPM version][npm-image]][npm-url] [![Dependency Status][daviddm-image]][daviddm-url]

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

Implements Monero send/receive functionality per the spec for crypto currency plugins for [edge-core-js](https://github.com/EdgeApp/edge-core-js)

## Installing

    npm i edge-currency-monero -s

```
import { moneroCurrencyPluginFactory } from `edge-currency-monero`
```

Now you can pass `moneroCurrencyPluginFactory` to `edge-core-js`.

```
const context = makeEdgeContext({
  apiKey: YOUR_API_KEY,
  plugins: [ moneroCurrencyPluginFactory ]
})
```

## Contributing

You'll need to install Yarn 1.3.2 globally on your machine

To run a local version of this repo inside the full Edge Wallet app, clone this repo at the same level as `edge-react-gui`

    git clone git@github.com:EdgeApp/edge-currency-monero.git`
    cd edge-currency-monero
    yarn

Run `npm run test` to run the unit tests.

To use the local cloned version of this repo, `cd edge-react-gui` and run

    npm run updot edge-currency-monero
    npm run postinstall

This will copy the necessary files from `edge-currency-monero` into the `edge-react-gui/node_modules/edge-currency-monero` replacing the npm installed version. This needs to be done after any modifications to `edge-currency-monero`

## License
BSD 3

[npm-image]: https://badge.fury.io/js/edge-currency-ethereum.svg
[npm-url]: https://npmjs.org/package/edge-currency-ethereum
[travis-image]: https://travis-ci.org/Airbitz/edge-currency-ethereum.svg?branch=master
[travis-url]: https://travis-ci.org/Airbitz/edge-currency-ethereum
[daviddm-image]: https://david-dm.org/Airbitz/edge-currency-ethereum.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/Airbitz/edge-currency-ethereum
