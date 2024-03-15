/* eslint-disable @typescript-eslint/naming-convention */
// Since the response parser is copy-pasted from another repo,
// manually define its types here rather than converting the code
// to TypeScript:

import type { ParsedTransaction } from '../MyMoneroApi'

export async function Parsed_AddressTransactions__async(
  keyImage_cache: { [keyId: string]: string },
  data: any,
  address: string,
  view_key__private: string,
  spend_key__public: string,
  spend_key__private: string,
  coreBridge_instance: any
): Promise<{
  account_scanned_height: any
  account_scanned_block_height: any
  account_scan_start_height: any
  transaction_height: any
  blockchain_height: any
  serialized_transactions: ParsedTransaction[]
}>

export async function Parsed_AddressInfo__async(
  keyImage_cache: { [keyId: string]: string },
  data: any,
  address: string,
  view_key__private: string,
  spend_key__public: string,
  spend_key__private: string,
  coreBridge_instance: any
): Promise<{
  total_received_String: sting // | null
  locked_balance_String: string // | null
  total_sent_String: string // | null // serialized JSBigInt
  spent_outputs: any
  account_scanned_tx_height: any
  account_scanned_block_height: any
  account_scan_start_height: any
  transaction_height: any
  blockchain_height: any
  ratesBySymbol: any
}>
