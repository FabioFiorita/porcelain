import { projectsProcedures } from '@porcelain/contracts/projects'

import { namedContractProcedure } from '@/lib/daemon/procedure'

/**
 * The three Canvas bindings mobile uses. Read-only by design: a Canvas is agent-authored
 * and promoting one is a write into a checkout that belongs to the desktop clients.
 */

export const listCanvasesProcedure = namedContractProcedure(
  'listCanvases',
  projectsProcedures.listCanvases,
)

export const readCanvasProcedure = namedContractProcedure(
  'readCanvas',
  projectsProcedures.readCanvas,
)

export const mintCanvasAccessTokenProcedure = namedContractProcedure(
  'mintCanvasAccessToken',
  projectsProcedures.mintCanvasAccessToken,
)
