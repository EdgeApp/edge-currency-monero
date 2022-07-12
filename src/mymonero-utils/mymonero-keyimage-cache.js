// This has been taken from @mymonero/mymonero-keyimage-cache v2.0.0
// We have made `Lazy_KeyImage` async and deleted the rest.
// We have also renamed generate_key_image to generateKeyImage.

'use strict'

const Lazy_KeyImage = async function (
  mutable_keyImagesByCacheKey, // pass a mutable JS dictionary
  tx_pub_key,
  out_index,
  public_address,
  view_key__private,
  spend_key__public,
  spend_key__private,
  coreBridge_instance // must pass this so this fn can remain synchronous
) {
  var cache_index = tx_pub_key + ':' + public_address + ':' + out_index
  const cached__key_image = mutable_keyImagesByCacheKey[cache_index]
  if (
    typeof cached__key_image !== 'undefined' &&
		cached__key_image !== null
  ) {
    return cached__key_image
  }
  var key_image = await coreBridge_instance.generateKeyImage(
    tx_pub_key,
    view_key__private,
    spend_key__public,
    spend_key__private,
    out_index
  )
  // cache:
  mutable_keyImagesByCacheKey[cache_index] = key_image
  //
  return key_image
}
exports.Lazy_KeyImage = Lazy_KeyImage
