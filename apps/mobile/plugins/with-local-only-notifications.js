const { withEntitlementsPlist } = require('expo/config-plugins')

/**
 * Strip the `aps-environment` entitlement that `expo-notifications`' auto-applied plugin writes.
 *
 * Notifications here are LOCAL-only: scheduled on-device from the background poll. Remote push
 * needs an APNs relay that does not exist, and the entitlement claims a capability the app cannot
 * honour — it also forces the Push Notifications capability onto the App ID and the provisioning
 * profile. Auto-applied plugins (expo-notifications' writer) always run before the static plugins
 * array; a static plugin that writes entitlements must be registered after this one instead, since
 * mods are LIFO.
 */
module.exports = function withLocalOnlyNotifications(config) {
  return withEntitlementsPlist(config, (inner) => {
    delete inner.modResults['aps-environment']
    return inner
  })
}
