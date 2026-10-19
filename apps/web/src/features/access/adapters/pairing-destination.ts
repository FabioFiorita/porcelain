const key = 'porcelain.pairing.destination';
export function rememberPairingDestination(value: string | undefined) {
  if (
    value?.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/pair')
  )
    sessionStorage.setItem(key, value);
}
export function pairingDestination() {
  return sessionStorage.getItem(key) ?? '/';
}
export function clearPairingDestination() {
  sessionStorage.removeItem(key);
}
