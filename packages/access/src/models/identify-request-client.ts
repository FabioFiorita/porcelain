export type IdentifyRequestClientInput = {
  host: string | undefined;
  scheme: string;
  peerAddress: string;
  connectingAddress: string | undefined;
};

export type RequestClient = {
  address: string;
  secure: boolean;
  tunnelHostname?: string | undefined;
};
