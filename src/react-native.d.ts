// @flow

import type { NativeMyMoneroCore } from 'react-native-mymonero-core'

declare module 'react-native' {
  declare export var NativeModules: {
    MyMoneroCore: NativeMyMoneroCore
  }
}
