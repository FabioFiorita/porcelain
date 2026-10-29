import { Schema } from 'effect';
import type { Page } from 'playwright';
import { stockClasses, styleProperties, type BoardRole } from './board-maps.ts';
import type {
  BrowserComputedStyle,
  BrowserDocument,
  BrowserElement,
} from './browser-dom.ts';

declare const document: BrowserDocument;
declare const getComputedStyle: (
  element: BrowserElement,
) => BrowserComputedStyle;

type StyleProperty = (typeof styleProperties)[number];
const stylesSchema = Schema.Record(Schema.String, Schema.String);
const sampleSchema = Schema.Struct({
  role: Schema.String,
  properties: Schema.Array(Schema.Literals(styleProperties)),
  problem: Schema.optional(Schema.String),
  styles: stylesSchema,
  stock: Schema.optional(Schema.String),
  origins: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});
type StyleSample = typeof sampleSchema.Type;
export type StyleRow = {
  role: string;
  property: StyleProperty | 'element';
  board: string;
  app: string;
  match: boolean;
  accepted?: string;
};

export async function measureRoles(
  page: Page,
  roles: readonly BoardRole[],
  side: 'board' | 'app',
  width = 1440,
  classes: (primitive: string) => readonly string[] = stockClasses,
): Promise<readonly StyleSample[]> {
  const targets = roles
    .filter((role) => width >= (role.minWidth ?? 320))
    .map((role) => ({
      role: role.role,
      properties: role.properties ?? styleProperties,
      ...role[side],
      ...(side === 'app' && role.stock !== undefined
        ? { stock: role.stock, classes: classes(role.stock) }
        : {}),
    }));
  return Schema.decodeUnknownSync(Schema.Array(sampleSchema))(
    await page.evaluate((targets) => {
      const read = (element: BrowserElement): Record<string, string> => {
        const s = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
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
        const corners = [
          s.borderTopLeftRadius,
          s.borderTopRightRadius,
          s.borderBottomRightRadius,
          s.borderBottomLeftRadius,
        ];
        const radii = corners.map((value) =>
          value.endsWith('px') ? Number(value.slice(0, -2)) : NaN,
        );
        const [tl = 0, tr = 0, br = 0, bl = 0] = radii;
        const scale = Math.min(
          1,
          ...[
            [rect.width, tl + tr],
            [rect.width, bl + br],
            [rect.height, tl + bl],
            [rect.height, tr + br],
          ].map(([length = 0, sum = 0]) => (sum > 0 ? length / sum : 1)),
        );
        const radius = radii.every(
          (value) => Number.isFinite(value) && value >= 0,
        )
          ? radii
              .map((value) => `${Number((value * scale).toFixed(6))}px`)
              .join(' ')
          : corners.join(' ');
        return {
          fontSize: s.fontSize,
          lineHeight: s.lineHeight,
          fontWeight: s.fontWeight,
          letterSpacing: s.letterSpacing === 'normal' ? '0px' : s.letterSpacing,
          colour,
          padding: [
            s.paddingTop,
            s.paddingRight,
            s.paddingBottom,
            s.paddingLeft,
          ].join(' '),
          radius,
          gap: [
            s.display.includes('flex') &&
            s.flexWrap === 'nowrap' &&
            s.flexDirection.startsWith('row')
              ? '0px'
              : s.rowGap,
            s.display.includes('flex') &&
            s.flexWrap === 'nowrap' &&
            s.flexDirection.startsWith('column')
              ? '0px'
              : s.columnGap,
          ]
            .map((v) => (v === 'normal' ? '0px' : v))
            .join(' '),
          height: rect.height.toFixed(3) + 'px',
          icon: icon ? 'present' : 'absent',
        };
      };
      const inherited = new Set([
        'fontSize',
        'lineHeight',
        'fontWeight',
        'letterSpacing',
        'colour',
      ]);
      const stockOrigin = (
        element: BrowserElement,
        properties: readonly string[],
        primitive: string,
        stock: ReadonlySet<string>,
      ) => {
        const freeze = document.createElement('style');
        freeze.textContent =
          '*, *::before, *::after { transition: none !important; animation: none !important; }';
        document.head.append(freeze);
        const rendered = () =>
          element.checkVisibility({
            checkOpacity: true,
            checkVisibilityCSS: true,
          }) &&
          element.getBoundingClientRect().width > 0 &&
          element.getBoundingClientRect().height > 0;
        try {
          const measured = read(element);
          const toggles = new Set<string>();
          const origins: Record<string, string> = {};
          for (const property of properties) {
            if (property === 'icon') continue;
            let owner: BrowserElement | null = element;
            for (
              let depth = 0;
              owner !== null && depth < (inherited.has(property) ? 8 : 1);
              depth += 1, owner = owner.parentElement
            ) {
              const original = owner.getAttribute('class');
              const tokens = (original ?? '').split(/\s+/).filter(Boolean);
              const producing = tokens.filter((token) => {
                owner?.setAttribute(
                  'class',
                  tokens.filter((other) => other !== token).join(' '),
                );
                const shown = rendered();
                const value = read(element)[property];
                if (original === null) owner?.removeAttribute('class');
                else owner?.setAttribute('class', original);
                if (!shown && owner === element) toggles.add(token);
                return shown && value !== measured[property];
              });
              if (producing.length === 0) continue;
              if (producing.every((token) => stock.has(token)))
                origins[property] =
                  producing.map((token) => `\`${token}\``).join(' ') +
                  ` from the pinned ${primitive}.tsx`;
              owner = null;
              break;
            }
            if (owner === null || inherited.has(property)) continue;
            const original = element.getAttribute('class') ?? '';
            const tokens = original.split(/\s+/).filter(Boolean);
            if (!tokens.some((token) => stock.has(token))) continue;
            element.setAttribute(
              'class',
              tokens
                .filter((token) => stock.has(token) || toggles.has(token))
                .join(' '),
            );
            const value = read(element)[property];
            element.setAttribute('class', original);
            if (value === measured[property])
              origins[property] =
                `the pinned ${primitive}.tsx; no class the app adds changes it`;
          }
          return origins;
        } finally {
          freeze.remove();
        }
      };
      return targets.map(
        ({ role, selector, index, properties, stock, classes }) => {
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
              properties,
              problem: 'element is hidden or has no size',
              styles: {},
            };
          const element = elements[index ?? 0];
          if (!element || (index === undefined && elements.length !== 1))
            return {
              role,
              properties,
              problem:
                'selector matched ' +
                elements.length +
                ' elements' +
                (index === undefined
                  ? ' (expected one)'
                  : ' at index ' + index),
              styles: {},
            };
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
              properties,
              problem: 'element is hidden or has no size',
              styles: {},
            };
          return {
            role,
            properties,
            styles: read(element),
            ...(stock !== undefined && classes !== undefined
              ? {
                  stock,
                  origins: stockOrigin(
                    element,
                    properties,
                    stock,
                    new Set(classes),
                  ),
                }
              : {}),
          };
        },
      );
    }, targets),
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
    return expected.properties.map((property) => {
      const left = expected.styles[property] ?? 'missing';
      const right = actual.styles[property] ?? 'missing';
      const match =
        left !== 'missing' &&
        right !== 'missing' &&
        stylesMatch(property, left, right);
      const origin = actual.origins?.[property];
      return {
        role: expected.role,
        property,
        board: left,
        app: right,
        match,
        ...(!match && origin !== undefined
          ? { accepted: `stock (accepted): ${origin}` }
          : {}),
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
    '| Role | Property | Board | App | Match | Why |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| ${cell(row.role)} | ${cell(row.property)} | ${cell(row.board)} | ${cell(row.app)} | ${row.match ? 'yes' : row.accepted !== undefined ? 'stock' : 'NO'} | ${cell(row.accepted ?? '')} |`,
    ),
  ].join('\n');
}
