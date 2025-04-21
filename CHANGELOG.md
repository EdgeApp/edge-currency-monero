# edge-currency-monero

## Unreleased

- added: Support for multiple spend targets.

## 1.4.2 (2025-04-01)

- fixed: Small internal implementation cleanup on how transactions are saved.

## 1.4.1 (2025-03-28)

- fixed: Fixed `saveTx` regression. Transaction sends are properly saved.

## 1.4.0 (2025-03-25)

- fixed: Remove race condition causing missing transaction between showing address and initial login.
- fixed: Upgrade edge-core-js to 2.26.0 to implemented new Seen Tx Checkpoint API

## 1.3.2 (2024-11-19)

- fixed: URI parsing and creation according to the correct format

## 1.3.1 (2024-03-21)

- fixed: Include missing files in the NPM package.

## 1.3.0 (2024-03-21)

- changed: Switch our codebase from Flow to TypeScript.

## 1.2.0 (2024-03-20)

- added: Report legacy payment ID's using the new core `memo` transaction property.
- removed: Only bundle the package in CJS-format, and drop the ESM output.
- removed: Stop supporting undocumented `getTransaction` options.

## 1.1.1 (2023-08-15)

- fixed: Fixed address transaction cleaner broken for wallets with no transaction history.

## 1.1.0 (2023-08-11)

- added: Support custom servers via `enableCustomServers` and `moneroLightwalletServer` user settings.

## 1.0.0 (2023-03-28)

- fixed: Return the correct `walletId` on `EdgeTransaction` instances.
- fixed: Add a missing `await` to `saveTx`, ensuring the transaction is on-disk.
- changed: Upgrade to react-native-mymonero-core v0.3.0.

## 0.6.0 (2023-03-28)

- changed: Allow engine to run without private keys. This requires edge-core-js v0.19.47 or greater.

## 0.5.5 (2023-01-10)

- Add `getMaxSpendable`
- Upgrade edge-core-js to v0.19.36
- Upgrade react-native-mymonero-core to v0.2.7

## 0.5.4 (2022-11-30)

- Reduce transaction changed callbacks on wallet initialization

## 0.5.3 (2022-08-26)

- changed: Update spending constants to match upstream MyMonero SDK.

## 0.5.2 (2022-08-13)

- fixed: Incorrect amounts after spend.

## 0.5.1 (2022-08-13)

- fixed: Stop randomly crashing while sending funds.

## 0.5.0 (2022-08-11)

- changed: Upgrade to react-native-mymonero-core v0.2.0, with its new API.

## 0.4.2 (2022-08-03)

- fixed: Set `addressesChecked` to `false` on resync

## 0.4.1 (2022-05-11)

- fixed: Fix syncing when the user settings are empty

## 0.4.0 (2022-01-11)

- added: Move the forked code out of mymonero-core-js directly into this repo.
- changed: Require react-native-mymonero-core ^0.1.2.

## 0.3.4 (2022-01-11)

- Fix git urls

## 0.3.3 (2021-09-28)

- Reformat spendable balance error into 3 lines

## 0.3.2 (2021-06-03)

- Remove icon URLs

## 0.3.1 (2021-05-25)

- Fix float amount precision
- Fix recorded native amount and fee

## 0.3.0 (2021-05-24)

- Import native code directly from react-native-mymonero-core. Before, this plugin relied on "magic" methods passed in via the global object.

## 0.2.10 (2021-04-12)

- Update image URL

## 0.2.9 (2021-01-17)

- Add additional logging and context for logs
- Upgrade to eslint-config-standard-kit v0.15.1

## 0.2.8 (2021-01-05)

- Update logging levels
- Add parseUri tests

## 0.2.7 (2020-12-08)

- Update Blockchair explorer URL to include partner ID

## 0.2.6 (2020-08-11)

- Export private view key via getDisplayPublicSeed()
- Update transaction explorer to Blockchair

## 0.2.5 (2020-06-03)

- Upgrade mymonero-core-js to export transaction private key
- Upgrade edge-core-js to v0.17.4
  - Add `EdgeTransaction.txSecret` to capture transaction private key
  - Improve logging
- Add makeMutex() to wrap makeSpend() to avoid entering it more than once at a time

## 0.2.4 (2019-08-08)

- Default `signedTx` property on EdgeTransaction to empty string

## 0.2.3 (2019-07-31)

- Pass an `apiKey` with every API request.
- Correctly handle the server-provided `fee_mask`.

## 0.2.2 (2019-03-27)

- Fix block explorer link.

## 0.2.1 (2019-03-07)

- Upgrade `mymonero-core-js` in preparation for the Monero v0.14.0 hard fork.
- Properly report failed broadcasts.

## 0.2.0 (2019-02-19)

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
