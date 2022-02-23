// @flow

import {
  type MyMoneroCoreBridge,
  monero_utils
} from 'react-native-mymonero-core'

export default function makeCustomIo(): MyMoneroCoreBridge {
  return monero_utils
}
