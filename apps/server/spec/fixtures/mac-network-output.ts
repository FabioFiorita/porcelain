export const macNetworkOutput = {
  global:
    '<dictionary> {\n  PrimaryInterface : en0\n  PrimaryService : 284F6FA8-57FC-4F51-A638-5DBFB0A66DE6\n  Router : 192.168.1.1\n}\n',
  service:
    '<dictionary> {\n  ARPResolvedHardwareAddress : 02:00:5e:10:00:01\n  ARPResolvedIPAddress : 192.168.1.1\n  Addresses : <array> {\n    0 : 192.168.1.20\n  }\n  ConfirmedInterfaceName : en0\n  InterfaceName : en0\n  NetworkSignature : IPv4.Router=192.168.1.1;IPv4.RouterHardwareAddress=02:00:5e:10:00:01\n  Router : 192.168.1.1\n}\n',
  route:
    '   route to: default\ndestination: default\n       mask: default\n    gateway: 192.168.1.1\n  interface: en0\n      flags: <UP,GATEWAY,DONE,STATIC,PRCLONING,GLOBAL>\n recvpipe  sendpipe  ssthresh  rtt,msec    rttvar  hopcount      mtu     expire\n       0         0         0         0         0         0      1500         0 \n',
};
