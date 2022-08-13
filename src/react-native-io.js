import bridge from 'react-native-mymonero-core'

export default function makeCustomIo() {
  // Send across the raw C++ API,
  // since that does not need callbacks:
  return bridge.Module
}
