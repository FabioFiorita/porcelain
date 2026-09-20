/** A pairing invitation that has not been redeemed yet. */
export type PairingGrant = {
  id: string;
  label: string;
  addresses: string[];
  createdAt: string;
  expiresAt: string;
};

/** A device that redeemed a grant and now holds a credential. */
export type Device = {
  id: string;
  label: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
  lastSeenAddress: string | null;
};

/** What the owner sees: outstanding invitations and the devices that took one. */
export type AccessListing = {
  grants: PairingGrant[];
  devices: Device[];
};

/** A grant and the one-time link that carries it, returned only at issue. */
export type IssuedGrant = {
  grant: PairingGrant;
  /** The plaintext code. It exists here and nowhere else on the server. */
  code: string;
  link: string;
};

/** A redeemed grant and the credential the device keeps. */
export type RedeemedPairing = {
  device: Device;
  /** The plaintext credential. Never stored, never logged. */
  credential: string;
};

export type DeviceRegistration = {
  label?: string | undefined;
  platform: string;
};
