declare module 'react-native' {
  import type { NativeMyMoneroCore } from 'react-native-mymonero-core'
  declare const NativeModules: {
    MyMoneroCore: NativeMyMoneroCore
  }
}
