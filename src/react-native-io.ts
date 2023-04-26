// @flow

import { NativeModules } from 'react-native'
import type { NativeMyMoneroCore } from 'react-native-mymonero-core'

export default function makeCustomIo(): NativeMyMoneroCore {
  return NativeModules.MyMoneroCore
}
