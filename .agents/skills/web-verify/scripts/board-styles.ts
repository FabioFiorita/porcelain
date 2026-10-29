import { Schema } from 'effect';
import type { Page } from 'playwright';
import { styleProperties, type BoardRole } from './board-maps.ts';
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
): Promise<readonly StyleSample[]> {
  const targets = roles
    .filter((role) => width >= (role.minWidth ?? 320))
    .map((role) => ({
      role: role.role,
      properties: role.properties ?? styleProperties,
      ...role[side],
      ...(side === 'app' && role.stock !== undefined
        ? { stock: role.stock }
        : {}),
    }));
  return Schema.decodeUnknownSync(Schema.Array(sampleSchema))(
    await page.evaluate((targets) => {
      const shown = (node: BrowserElement) =>
        node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
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
            shown(node) &&
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
        listed: ReadonlySet<string>,
      ) => {
        const classesOf = (node: BrowserElement) =>
          (node.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
        const chain: BrowserElement[] = [];
        let root: BrowserElement | null = element;
        for (
          let depth = 0;
          root !== null && depth < 8;
          depth += 1, root = root.parentElement
        ) {
          chain.push(root);
          const present = new Set(classesOf(root));
          if ([...listed].every((token) => present.has(token))) break;
        }
        if (root === null) return {};
        const measured = read(element);
        const valueWithout = (
          owner: BrowserElement,
          kept: readonly string[],
        ) => {
          const original = owner.getAttribute('class') ?? '';
          owner.setAttribute('class', kept.join(' '));
          try {
            return { visible: shown(element), value: read(element) };
          } finally {
            owner.setAttribute('class', original);
          }
        };
        const origins: Record<string, string> = {};
        for (const property of properties) {
          if (property === 'icon') continue;
          const owners = inherited.has(property)
            ? chain
            : chain.length === 1
              ? chain
              : [];
          let decided = false;
          for (const owner of owners) {
            const tokens = classesOf(owner);
            const producing = tokens.filter((token) => {
              const probe = valueWithout(
                owner,
                tokens.filter((other) => other !== token),
              );
              return (
                probe.visible && probe.value[property] !== measured[property]
              );
            });
            if (producing.length === 0) continue;
            decided = true;
            if (owner === root && producing.every((token) => listed.has(token)))
              origins[property] =
                producing.map((token) => `\`${token}\``).join(' ') +
                ` from the pinned ${primitive}.tsx`;
            break;
          }
          if (decided || inherited.has(property) || chain.length !== 1)
            continue;
          const tokens = classesOf(element);
          const toggles = tokens.filter(
            (token) =>
              !listed.has(token) &&
              !valueWithout(
                element,
                tokens.filter((other) => other !== token),
              ).visible,
          );
          const stripped = valueWithout(
            element,
            tokens.filter(
              (token) => listed.has(token) || toggles.includes(token),
            ),
          );
          if (
            stripped.visible &&
            stripped.value[property] === measured[property]
          )
            origins[property] =
              `the pinned ${primitive}.tsx classes listed for this role; no class the app adds changes it`;
        }
        return origins;
      };
      const freeze = document.createElement('style');
      freeze.textContent =
        '*, *::before, *::after { transition: none !important; }';
      document.head.append(freeze);
      try {
        return targets.map(({ role, selector, index, properties, stock }) => {
          const matches = [...document.querySelectorAll(selector)];
          const elements = matches.filter(shown);
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
          if (!shown(element) || rect.width === 0 || rect.height === 0)
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
            ...(stock !== undefined
              ? {
                  origins: stockOrigin(
                    element,
                    properties,
                    stock.primitive,
                    new Set(stock.classes),
                  ),
                }
              : {}),
          };
        });
      } finally {
        freeze.remove();
      }
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
