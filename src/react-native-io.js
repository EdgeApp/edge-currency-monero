import { NativeModules } from 'react-native'

export default function makeCustomIo() {
  return NativeModules.MyMoneroCore
}
