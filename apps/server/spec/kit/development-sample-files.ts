export const developmentFiles = {
  'package.json':
    '{\n  "name": "dispatch-desk-walkthrough",\n  "private": true,\n  "description": "Synthetic source and Git fixture for the Porcelain iPad walkthrough; not a deployed service",\n  "version": "0.1.0"\n}\n',
  'tsconfig.json':
    '{\n  "compilerOptions": {\n    "strict": true,\n    "target": "ES2022",\n    "module": "ESNext",\n    "jsx": "react-jsx"\n  },\n  "include": [\n    "src"\n  ]\n}\n',
  'docs/overview.md':
    '# Dispatch Desk\n\n> Synthetic walkthrough data. Names, shipments and numbers are invented.\n\nA small operations dashboard for warehouse dispatchers. The queue groups shipments by route, shows the next action, and keeps delayed items visible until a dispatcher resolves them.\n\n## Reading the workspace\n\n- `src/domain`: shipment, route and warehouse models.\n- `src/data`: invented inventory with three routes and two warehouses.\n- `src/ui`: queue cards, route totals and an empty state.\n- `docs/operations`: handoff instructions and release checks.\n- `assets`: a truck icon.\n\n## Acceptance conversation\n\nA dispatcher should be able to scan a route, see the late shipment, and find its owner without opening every card. This repository is a source-reading fixture; it does not install dependencies or launch a service.\n',
  'docs/operations/dispatch.md':
    '# Morning dispatch\n\n1. Read the North and Central route queues.\n2. Check warehouse capacity before assigning a truck.\n3. Call the listed dispatcher when an ETA has expired.\n4. Record a handoff note before changing the shipment status.\n\n## Late shipments\n\nKeep delayed shipments in the queue. The delivery team owns the ETA; the dispatcher owns the escalation. Do not silently move a late shipment back to Ready.\n\n## End-of-day handoff\n\nLeave an owner, the last known location and the next check time on every unresolved shipment.\n',
  'docs/operations/checklist.md':
    '# Release checklist\n\n- Status text stays visible when the badge uses color.\n- The list has an explicit empty state.\n- Long destination names wrap.\n- Route totals match the filtered shipments.\n- Offline notes remain labeled as queued.\n\nThis checklist is synthetic walkthrough material, not verification evidence.\n',
  'docs/legacy/deployment.txt':
    'Legacy dispatch notes\nThe old queue refreshed once a minute.\nThe walkthrough removes this obsolete reference in a later commit.\n',
  'src/domain/shipment.ts':
    "export type ShipmentStatus = 'ready' | 'in-transit' | 'delayed' | 'delivered';\n\nexport type Shipment = {\n  readonly id: string;\n  readonly destination: string;\n  readonly routeId: string;\n  readonly warehouseId: string;\n  readonly status: ShipmentStatus;\n  readonly packages: number;\n  readonly eta: string;\n  readonly owner: string;\n};\n\nexport function isPending(shipment: Shipment) {\n  return shipment.status !== 'delivered';\n}\n",
  'src/domain/events.ts':
    "export type DeliveryEvent =\n  | { readonly kind: 'assigned'; readonly shipmentId: string; readonly owner: string }\n  | { readonly kind: 'departed'; readonly shipmentId: string; readonly at: string }\n  | { readonly kind: 'delivered'; readonly shipmentId: string; readonly at: string };\n\nexport function eventLabel(event: DeliveryEvent) {\n  switch (event.kind) {\n    case 'assigned': return `Assigned to ${event.owner}`;\n    case 'departed': return 'Truck departed';\n    case 'delivered': return 'Delivery confirmed';\n  }\n}\n",
  'src/domain/route.ts':
    'export type Route = {\n  readonly id: string;\n  readonly name: string;\n  readonly distanceKm: number;\n  readonly capacity: number;\n};\n\nexport function remainingCapacity(route: Route, packages: number) {\n  return Math.max(0, route.capacity - packages);\n}\n',
  'src/domain/warehouse.ts':
    'export type Warehouse = {\n  readonly id: string;\n  readonly name: string;\n  readonly city: string;\n  readonly opensAt: string;\n};\n\nexport function warehouseLabel(warehouse: Warehouse) {\n  return `${warehouse.name} · ${warehouse.city}`;\n}\n',
  'src/data/shipments.json':
    '[\n  {\n    "id": "DSP-1042",\n    "destination": "North Harbor Books",\n    "routeId": "north",\n    "warehouseId": "harbor",\n    "status": "ready",\n    "packages": 12,\n    "eta": "2026-10-14T09:30:00Z",\n    "owner": "Maya Costa"\n  },\n  {\n    "id": "DSP-1043",\n    "destination": "Central Market Supply",\n    "routeId": "central",\n    "warehouseId": "riverside",\n    "status": "delayed",\n    "packages": 5,\n    "eta": "2026-10-14T10:00:00Z",\n    "owner": "Leo Santos"\n  },\n  {\n    "id": "DSP-1044",\n    "destination": "Westside Community Workshop",\n    "routeId": "west",\n    "warehouseId": "harbor",\n    "status": "in-transit",\n    "packages": 8,\n    "eta": "2026-10-14T11:45:00Z",\n    "owner": "Nora Lima"\n  }\n]\n',
  'src/data/routes.json':
    '[\n  {\n    "id": "north",\n    "name": "North loop",\n    "distanceKm": 34.2,\n    "capacity": 40\n  },\n  {\n    "id": "central",\n    "name": "Central express",\n    "distanceKm": 18.6,\n    "capacity": 24\n  },\n  {\n    "id": "west",\n    "name": "West connector",\n    "distanceKm": 42.1,\n    "capacity": 32\n  }\n]\n',
  'src/data/warehouses.json':
    '[\n  {\n    "id": "harbor",\n    "name": "Harbor depot",\n    "city": "Porto Azul",\n    "opensAt": "07:00"\n  },\n  {\n    "id": "riverside",\n    "name": "Riverside hub",\n    "city": "Vila Clara",\n    "opensAt": "06:30"\n  }\n]\n',
  'src/lib/format-distance.ts':
    'export function formatDistance(kilometers: number) {\n  return `${kilometers.toFixed(1)} km`;\n}\n',
  'src/lib/status-tone.ts':
    "import type { ShipmentStatus } from '../domain/shipment';\n\nexport function statusTone(status: ShipmentStatus) {\n  switch (status) {\n    case 'ready': return 'neutral';\n    case 'in-transit': return 'info';\n    case 'delayed': return 'warning';\n    case 'delivered': return 'success';\n  }\n}\n",
  'src/ui/shipment-card.tsx':
    "import type { Shipment } from '../domain/shipment';\nimport { statusTone } from '../lib/status-tone';\n\nexport function ShipmentCard({ shipment }: { shipment: Shipment }) {\n  return (\n    <article className=\"shipment-card\">\n      <h2>{shipment.destination}</h2>\n      <p>{shipment.id} · {shipment.packages} packages</p>\n      <span data-tone={statusTone(shipment.status)}>{shipment.status}</span>\n      <p>Dispatcher: {shipment.owner}</p>\n    </article>\n  );\n}\n",
  'src/ui/route-summary.tsx':
    "import type { Route } from '../domain/route';\nimport { formatDistance } from '../lib/format-distance';\n\nexport function RouteSummary({ route, count }: { route: Route; count: number }) {\n  return (\n    <section className=\"route-summary\">\n      <h2>{route.name}</h2>\n      <p>{count} shipments · {formatDistance(route.distanceKm)}</p>\n    </section>\n  );\n}\n",
  'src/ui/empty-state.tsx':
    'export function EmptyQueue() {\n  return (\n    <section role="status" className="empty-queue">\n      <h2>No shipments on this route</h2>\n      <p>Choose another route or return when the next dispatch arrives.</p>\n    </section>\n  );\n}\n',
  'styles/dashboard.css':
    ':root { color-scheme: light dark; }\nbody { margin: 0; font-family: system-ui, sans-serif; }\n.shipment-card { padding: 1rem; border: 1px solid #8091a3; border-radius: 1rem; }\n.route-summary { display: grid; gap: 0.5rem; }\n[data-tone="warning"] { color: #a35c00; font-weight: 600; }\n.empty-queue { padding: 2rem; text-align: center; }\n',
  'assets/icons/truck.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">\n  <rect x="8" y="12" width="48" height="32" rx="4" fill="#2563eb"/>\n  <path d="M56 24h16l12 12v8H56z" fill="#60a5fa"/>\n  <circle cx="26" cy="48" r="8" fill="#172554"/>\n  <circle cx="72" cy="48" r="8" fill="#172554"/>\n</svg>\n',
  'src/api/read-shipments.ts':
    "import type { Shipment } from '../domain/shipment';\n\nexport type ShipmentQuery = { readonly routeId?: string };\n\nexport function readShipments(rows: readonly Shipment[], query: ShipmentQuery) {\n  return rows.filter((row) =>\n    query.routeId === undefined || row.routeId === query.routeId,\n  );\n}\n",
  'docs/architecture/events.md':
    '# Delivery events\n\nThe queue reads shipment snapshots. Dispatch actions produce delivery events, which carry the shipment ID and the action time.\n\n## Why separate the event from the card\n\nCards should render the state they receive. Event handling belongs at the write boundary so a refresh or reopened tab cannot repeat the action.\n\n## Scope\n\nThis decision note describes the synthetic example only. No delivery integration exists in this fixture.\n',
  'docs/offline-sync.md':
    '# Offline dispatch notes\n\nQueue operator notes while the connection is unavailable. Show the queued count next to the shipment. A note keeps its local ID until the server acknowledges it.\n\n## Recovery\n\nRead the server snapshot before replaying the queue. A failed acknowledgement keeps the note visible and offers a retry. Never interpret connectivity as acknowledgement.\n\nThis is synthetic branch material for worktree selection and merge comparisons.\n',
  'src/lib/offline-cache.ts':
    'export type QueuedNote = {\n  readonly id: string;\n  readonly shipmentId: string;\n  readonly body: string;\n};\n\nexport function acknowledge(queue: readonly QueuedNote[], acknowledgedId: string) {\n  return queue.filter((note) => note.id !== acknowledgedId);\n}\n',
  'src/data/dispatch-note.ts':
    "export const dispatchNote = 'The north warehouse dispatch desk keeps awaiting-document shipments visible beside delayed arrivals, carries the dispatcher name into every handoff, and records the next action before an acknowledgement leaves the queue; this deliberately long source line lets a mobile reader compare wrapping and horizontal scrolling without relying on a contrived README.';\n",
  'docs/previews/dispatch.html':
    '<!doctype html>\n<html lang="en"><meta charset="utf-8"><title>Dispatch Desk</title><style>body{font:16px/1.6 system-ui;margin:2rem;max-width:48rem}article{border:1px solid #888;padding:1rem;border-radius:1rem}</style><h1>Dispatch Desk</h1><article><h2>Awaiting documents</h2><p>Keep the owner and next action visible until the loading permit arrives.</p></article></html>\n',
} as const;

export const developmentCommits: readonly {
  title: string;
  paths: readonly (keyof typeof developmentFiles)[];
}[] = [
  {
    title: 'Add synthetic dispatch documentation',
    paths: [
      'package.json',
      'tsconfig.json',
      'docs/overview.md',
      'docs/operations/dispatch.md',
      'docs/operations/checklist.md',
      'docs/legacy/deployment.txt',
    ],
  },
  {
    title: 'Model dispatch routes and shipments',
    paths: [
      'src/domain/shipment.ts',
      'src/domain/events.ts',
      'src/domain/route.ts',
      'src/domain/warehouse.ts',
      'src/data/shipments.json',
      'src/data/routes.json',
      'src/data/warehouses.json',
    ],
  },
  {
    title: 'Present dispatch queue cards and assets',
    paths: [
      'src/lib/format-distance.ts',
      'src/lib/status-tone.ts',
      'src/ui/shipment-card.tsx',
      'src/ui/route-summary.tsx',
      'src/ui/empty-state.tsx',
      'styles/dashboard.css',
      'assets/icons/truck.svg',
    ],
  },
  {
    title: 'Add dispatch reading previews',
    paths: ['src/data/dispatch-note.ts', 'docs/previews/dispatch.html'],
  },
];
