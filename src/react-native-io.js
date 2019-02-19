// TODO: import { moneroCore } from 'react-native-fast-crypto'
import 'react-native-fast-crypto'

export default function makeCustomIo () {
  if (global.moneroCore == null) {
    throw new Error(
      'Please install & link https://github.com/EdgeApp/mymonero-core-js'
    )
  }
  const { methodByString } = global.moneroCore
  return { methodByString }
}
