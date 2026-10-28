import { Schema } from 'effect';
import type { Page } from 'playwright';
import type { BoardRole } from './board-maps.ts';
import type {
  BrowserComputedStyle,
  BrowserDocument,
  BrowserElement,
} from './browser-dom.ts';

declare const document: BrowserDocument;
declare const getComputedStyle: (
  element: BrowserElement,
) => BrowserComputedStyle;

const styleProperties = [
  'fontSize',
  'lineHeight',
  'fontWeight',
  'letterSpacing',
  'colour',
  'padding',
  'radius',
  'gap',
  'height',
  'icon',
] as const;
type StyleProperty = (typeof styleProperties)[number];
const stylesSchema = Schema.Record(Schema.String, Schema.String);
const sampleSchema = Schema.Struct({
  role: Schema.String,
  problem: Schema.optional(Schema.String),
  styles: stylesSchema,
});
type StyleSample = typeof sampleSchema.Type;
export type StyleRow = {
  role: string;
  property: StyleProperty | 'element';
  board: string;
  app: string;
  match: boolean;
};

export async function measureRoles(
  page: Page,
  roles: readonly BoardRole[],
  side: 'board' | 'app',
): Promise<readonly StyleSample[]> {
  const targets = roles.map((role) => ({ role: role.role, ...role[side] }));
  return Schema.decodeUnknownSync(Schema.Array(sampleSchema))(
    await page.evaluate(
      (targets) =>
        targets.map(({ role, selector, index }) => {
          const matches = [...document.querySelectorAll(selector)];
          const elements = matches.filter((node) =>
            node.checkVisibility({
              checkOpacity: true,
              checkVisibilityCSS: true,
            }),
          );
          if (matches.length > 0 && elements.length === 0)
            return {
              role,
              problem: 'element is hidden or has no size',
              styles: {},
            };
          const element = elements[index ?? 0];
          if (!element || (index === undefined && elements.length !== 1))
            return {
              role,
              problem:
                'selector matched ' +
                elements.length +
                ' elements' +
                (index === undefined
                  ? ' (expected one)'
                  : ' at index ' + index),
              styles: {},
            };
          const s = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          if (
            !element.checkVisibility({
              checkOpacity: true,
              checkVisibilityCSS: true,
            }) ||
            rect.width === 0 ||
            rect.height === 0
          )
            return {
              role,
              problem: 'element is hidden or has no size',
              styles: {},
            };
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (context === null)
            throw new Error('Canvas colour conversion is unavailable.');
          context.fillStyle = s.color;
          context.fillRect(0, 0, 1, 1);
          const rgba = [...context.getImageData(0, 0, 1, 1).data];
          const colour =
            '#' +
            rgba
              .slice(0, rgba[3] === 255 ? 3 : 4)
              .map((v) => v.toString(16).padStart(2, '0'))
              .join('');
          const icons = [...element.querySelectorAll('svg, img, [role="img"]')];
          const icon = (
            element.matches('svg, img, [role="img"]') ? [element] : icons
          ).some(
            (node) =>
              node.checkVisibility({
                checkOpacity: true,
                checkVisibilityCSS: true,
              }) &&
              node.getBoundingClientRect().width > 0 &&
              node.getBoundingClientRect().height > 0,
          );
          return {
            role,
            styles: {
              fontSize: s.fontSize,
              lineHeight: s.lineHeight,
              fontWeight: s.fontWeight,
              letterSpacing:
                s.letterSpacing === 'normal' ? '0px' : s.letterSpacing,
              colour,
              padding: [
                s.paddingTop,
                s.paddingRight,
                s.paddingBottom,
                s.paddingLeft,
              ].join(' '),
              radius: [
                s.borderTopLeftRadius,
                s.borderTopRightRadius,
                s.borderBottomRightRadius,
                s.borderBottomLeftRadius,
              ].join(' '),
              gap: [s.rowGap, s.columnGap]
                .map((v) => (v === 'normal' ? '0px' : v))
                .join(' '),
              height: rect.height.toFixed(3) + 'px',
              icon: icon ? 'present' : 'absent',
            },
          };
        }),
      targets,
    ),
  );
}

export function stylesMatch(
  property: string,
  board: string,
  app: string,
): boolean {
  if (board === app) return true;
  if (
    property === 'colour' &&
    /^#[\da-f]{6}([\da-f]{2})?$/.test(board) &&
    /^#[\da-f]{6}([\da-f]{2})?$/.test(app)
  ) {
    const channels = (value: string) =>
      (value.length === 7 ? `${value}ff` : value)
        .slice(1)
        .match(/../g)
        ?.map((hex) => parseInt(hex, 16)) ?? [];
    const expected = channels(board);
    const actual = channels(app);
    return expected.every(
      (value, index) => Math.abs(value - (actual[index] ?? -999)) <= 1,
    );
  }
  if (property === 'fontWeight' || property === 'icon') return false;
  const lengths = (value: string) =>
    value
      .split(' ')
      .map((part) =>
        /^-?\d+(\.\d+)?px$/.test(part) ? Number(part.slice(0, -2)) : NaN,
      );
  const expected = lengths(board);
  const actual = lengths(app);
  return (
    expected.length === actual.length &&
    expected.every(
      (value, index) => Math.abs(value - (actual[index] ?? NaN)) <= 0.5,
    )
  );
}

export function compareRoles(
  board: readonly StyleSample[],
  app: readonly StyleSample[],
): StyleRow[] {
  return board.flatMap<StyleRow>((expected) => {
    const actual = app.find((sample) => sample.role === expected.role);
    if (
      expected.problem !== undefined ||
      actual === undefined ||
      actual.problem !== undefined
    )
      return [
        {
          role: expected.role,
          property: 'element',
          board: expected.problem ?? 'present',
          app: actual?.problem ?? (actual ? 'present' : 'missing'),
          match: false,
        },
      ];
    return styleProperties.map((property) => {
      const left = expected.styles[property] ?? 'missing';
      const right = actual.styles[property] ?? 'missing';
      return {
        role: expected.role,
        property,
        board: left,
        app: right,
        match:
          left !== 'missing' &&
          right !== 'missing' &&
          stylesMatch(property, left, right),
      };
    });
  });
}

export function styleTable(rows: readonly StyleRow[]): string {
  const cell = (value: string) =>
    value
      .replaceAll('|', '\\|')
      .replaceAll('\n', ' ')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  return [
    '| Role | Property | Board | App | Match |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| ${cell(row.role)} | ${cell(row.property)} | ${cell(row.board)} | ${cell(row.app)} | ${row.match ? 'yes' : 'NO'} |`,
    ),
  ].join('\n');
}
