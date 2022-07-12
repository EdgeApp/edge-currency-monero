// @flow

import type { EdgeFetchFunction } from 'edge-core-js'
import type {
	CppBridge,
	DecodedAddress,
	Nettype,
	Priority
} from 'react-native-mymonero-core'

const parserUtils = require('./hostAPI/response_parser_utils.js')

export type MyMoneroApiOptions = {
	apiKey: string,
	apiServer: string,
	fetch: EdgeFetchFunction,
	nettype?: Nettype
}

export type MyMoneroWallet = {
	mnemonic: string,
	moneroAddress: string,
	moneroSpendKeyPrivate: string,
	moneroSpendKeyPublic: string,
	moneroViewKeyPrivate: string,
	moneroViewKeyPublic: string
}

export type BalanceResults = {
	blockHeight: number,
	lockedBalance: string,
	totalReceived: string,
	totalSent: string
}

export type QueryParams = {
	moneroAddress: string,
	moneroSpendKeyPrivate: string,
	moneroSpendKeyPublic: string,
	moneroViewKeyPrivate: string
}

export type SendFundsParams = QueryParams & {
	moneroAddress: string,
	moneroSpendKeyPrivate: string,
	moneroViewKeyPrivate: string,
	moneroViewKeyPublic: string,
	floatAmount: number,
	isSweepTx?: boolean,
	priority?: Priority, // 1-4 (Default is 1. Higher # is higher priority and higher fee )
	targetAddress: string
}

class MyMoneroApi {
	// Network options:
	apiKey: string
	apiUrl: string
	nettype: Nettype

	// Dependency injection:
	cppBridge: CppBridge
	fetch: EdgeFetchFunction

	// Maps from key identifiers (a bunch of concatenated stuff) to key images:
	keyImageCache: { [keyId: string]: string }

	constructor(cppBridge: CppBridge, options: MyMoneroApiOptions) {
		this.apiKey = options.apiKey
		this.apiUrl = options.apiServer
		this.nettype = options.nettype ?? 'MAINNET'

		this.fetch = options.fetch
		this.cppBridge = cppBridge

		this.keyImageCache = {}
	}

	async decodeAddress(address: string): Promise<DecodedAddress> {
		return await this.cppBridge.decodeAddress(address, this.nettype)
	}

	async createWallet(language: string = 'english'): Promise<MyMoneroWallet> {
		const result = await this.cppBridge.generateWallet(language, this.nettype)
		const out = {
			mnemonic: result.mnemonic,
			moneroAddress: result.address,
			moneroSpendKeyPrivate: result.privateSpendKey,
			moneroSpendKeyPublic: result.publicSpendKey,
			moneroViewKeyPrivate: result.privateViewKey,
			moneroViewKeyPublic: result.publicViewKey
		}
		return out
	}

	async createWalletFromMnemonic(
		mnemonic: string,
		language: string = 'english'
	): Promise<MyMoneroWallet> {
		const result = await this.cppBridge.seedAndKeysFromMnemonic(
			mnemonic,
			this.nettype
		)
		const out = {
			mnemonic,
			moneroAddress: result.address,
			moneroSpendKeyPrivate: result.privateSpendKey,
			moneroSpendKeyPublic: result.publicSpendKey,
			moneroViewKeyPrivate: result.privateViewKey,
			moneroViewKeyPublic: result.publicViewKey
		}
		return out
	}

	async getTransactions(queryParams: QueryParams): Promise<Object[]> {
		const params = {
			address: queryParams.moneroAddress,
			api_key: this.apiKey,
			create_account: true,
			view_key: queryParams.moneroViewKeyPrivate
		}
		const result = await this.fetchPostMyMonero('get_address_txs', params)
		const parsedTxs = await parserUtils.Parsed_AddressTransactions__async(
			this.keyImageCache,
			result,
			queryParams.moneroAddress,
			queryParams.moneroViewKeyPrivate,
			queryParams.moneroSpendKeyPublic,
			queryParams.moneroSpendKeyPrivate,
			this.cppBridge
		)
		const transactions = parsedTxs.serialized_transactions
		return transactions
	}

	async getAddressInfo(queryParams: QueryParams): Promise<BalanceResults> {
		const params = {
			address: queryParams.moneroAddress,
			api_key: this.apiKey,
			create_account: true,
			view_key: queryParams.moneroViewKeyPrivate
		}
		const result = await this.fetchPostMyMonero('get_address_info', params)
		const parsedAddrInfo = await parserUtils.Parsed_AddressInfo__async(
			this.keyImageCache,
			result,
			queryParams.moneroAddress,
			queryParams.moneroViewKeyPrivate,
			queryParams.moneroSpendKeyPublic,
			queryParams.moneroSpendKeyPrivate,
			this.cppBridge
		)
		const out: BalanceResults = {
			blockHeight: parsedAddrInfo.blockchain_height,
			totalReceived: parsedAddrInfo.total_received_String,
			lockedBalance: parsedAddrInfo.locked_balance_String,
			totalSent: parsedAddrInfo.total_sent_String
		}
		return out
	}

	async sendFunds(params: SendFundsParams) {
		const {
			moneroAddress,
			moneroSpendKeyPrivate,
			moneroViewKeyPrivate,
			moneroViewKeyPublic,
			targetAddress,
			floatAmount,
			isSweepTx = false,
			priority = 1
		} = params

		// Step 1: Grab the UTXO set:
		// const params = {
		// 	address: queryParams.moneroAddress,
		// 	api_key: this.apiKey,
		// 	create_account: true,
		// 	view_key: queryParams.moneroViewKeyPrivate
		// }
		// const result = await this.fetchPostMyMonero('get_address_info', params)
		const unspentOuts = {} // await parserUtils.Parsed_UnspentOuts__async(
		// 	this.keyImageCache,
		// 	result,
		// 	queryParams.moneroAddress,
		// 	queryParams.moneroViewKeyPrivate,
		// 	queryParams.moneroSpendKeyPublic,
		// 	queryParams.moneroSpendKeyPrivate,
		// 	this.cppBridge
		// )

		// Step 2: Grab some random outputs to mix in:
		async function randomOutsCb(count: number): Promise<any> {
			// const params = {
			// 	address: queryParams.moneroAddress,
			// 	api_key: this.apiKey,
			// 	create_account: true,
			// 	view_key: queryParams.moneroViewKeyPrivate
			// }
			// const result = await this.fetchPostMyMonero('get_address_info', params)
			// return await parserUtils.Parsed_UnspentOuts__async(
			// 	this.keyImageCache,
			// 	result,
			// 	queryParams.moneroAddress,
			// 	queryParams.moneroViewKeyPrivate,
			// 	queryParams.moneroSpendKeyPublic,
			// 	queryParams.moneroSpendKeyPrivate,
			// 	this.cppBridge
			// )
		}

		// Step 3: Make the transaction:
		return await this.cppBridge.createTransaction({
			amount: floatAmount,
			recipientAddress: targetAddress,
			priority,
			address: moneroAddress,
			privateViewKey: moneroViewKeyPrivate,
			publicSpendKey: moneroViewKeyPublic,
			privateSpendKey: moneroSpendKeyPrivate,
			shouldSweep: isSweepTx,
			nettype: this.nettype,
			unspentOuts,
			randomOutsCb
		})
	}

	async broadcastTransaction(tx: any): Promise<void> {
		// const params = {
		// 	address: queryParams.moneroAddress,
		// 	api_key: this.options.apiKey,
		// 	create_account: true,
		// 	view_key: queryParams.moneroViewKeyPrivate
		// }
		// const result = await this.fetchPostMyMonero('get_address_info', params)
		// const unspentOuts = {}
		// const parsedAddrInfo = await parserUtils.Parsed_AddressInfo__async(
		// 	this.keyImageCache,
		// 	result,
		// 	queryParams.moneroAddress,
		// 	queryParams.moneroViewKeyPrivate,
		// 	queryParams.moneroSpendKeyPublic,
		// 	queryParams.moneroSpendKeyPrivate,
		// 	this.cppBridge
		// )
	}

	// Private routines
	// ----------------

	async fetchPostMyMonero(cmd: string, params: any): any {
		const url = `${this.apiUrl}/${cmd}`
		const response = await this.fetch(url, {
			body: JSON.stringify(params),
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			method: 'POST'
		})
		if (!response.ok) {
			throw new Error(
				`The server returned error code ${response.status} for ${url}`
			)
		}
		return response.json()
	}
}

module.exports = MyMoneroApi
