declare module '@mymonero/mymonero-monero-client' {
  declare function makeBridge(): Promise<any>
  export default makeBridge
}

// We are reaching inside the module to grab stuff,
// so hack in some type definitions:
declare module 'react-native-mymonero-core/src/CppBridge' {
  import type {
    NativeMyMoneroCore,
    CppBridge
  } from 'react-native-mymonero-core'

  type CppBridgeConstructor = new (
    nativeModule: NativeMyMoneroCore
  ) => CppBridge

  declare const Constructor: CppBridgeConstructor
  export default Constructor
}
