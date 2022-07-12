// @flow

import bridge, { type CppBridge } from 'react-native-mymonero-core'

export default function makeCustomIo(): CppBridge {
  return bridge
}
