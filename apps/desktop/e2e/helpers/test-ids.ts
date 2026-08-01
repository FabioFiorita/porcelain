// Re-export the product contract so e2e and renderer never drift on spellings.
// Relative import (e2e tsconfig has no path aliases).
export { TestIds } from '../../src/shared/test-ids'
