/**
 * Dual-face tabs: one bottom-tab slot, two product surfaces. Switch only via the tab bar
 * (re-tap while focused). No header icons, no stack push with a back chevron.
 *
 * | Tab slot  | Faces              |
 * |-----------|--------------------|
 * | Files     | Files · Search     |
 * | Changes   | Changes · History  |
 * | Review    | Review · Board     |
 *
 * Face state: `useTabFaces` in `tab-faces.ts` (survives chrome sheets).
 * Search face auto-focuses the keyboard when it appears.
 */
export type TabWithAlternate = 'files' | 'changes' | 'review'
