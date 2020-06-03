# edge-currency-monero

# 0.2.5 (2020-06-03)

- Upgrade mymonero-core-js to export transaction private key
- Upgrade edge-core-js to v0.17.4
  - Add `EdgeTransaction.txSecret` to capture transaction private key
  - Improve logging
- Add makeMutex() to wrap makeSpend() to avoid entering it more than once at a time

# 0.2.4 (2019-08-08)

- Default `signedTx` property on EdgeTransaction to empty string

# 0.2.3 (2019-07-31)

- Pass an `apiKey` with every API request.
- Correctly handle the server-provided `fee_mask`.

# 0.2.2 (2019-03-27)

- Fix block explorer link.

# 0.2.1 (2019-03-07)

- Upgrade `mymonero-core-js` in preparation for the Monero v0.14.0 hard fork.
- Properly report failed broadcasts.

# 0.2.0 (2019-02-19)

- Upgrade to the edge-core-js v0.15.0 and adapt to breaking changes.

## 0.1.4 (2019-02-15)

- Update the readme file
- Upgrade to the edge-core-js v0.14.0 types
- Modernize the build system

## 0.1.3

- Fix notes and category metadata tagging

## 0.1.2

- Sanitize edgeTransaction returned from makeSpend to make it bridge compatible

## 0.1.1

- Use different blockexplorer
- Use new colored icon

## 0.1.0

- Implement new mymonero-core-js library with bulletproofs support

## 0.0.10

- No code changes. Only use renamed `EdgeApp/mymonero-core-js` repo

## 0.0.9

- Fix issue with `NoAmountSpecifiedError` error not being included in NPM version

## 0.0.8

- Add `NoAmountSpecifiedError`

## 0.0.5

- Specify requiredConfirmations = 10
- Use PendingFundsError when funds are unconfirmed
