export type BrowserComputedStyle = Readonly<
  Record<
    | 'fontSize'
    | 'lineHeight'
    | 'fontWeight'
    | 'letterSpacing'
    | 'color'
    | 'paddingTop'
    | 'paddingRight'
    | 'paddingBottom'
    | 'paddingLeft'
    | 'borderTopLeftRadius'
    | 'borderTopRightRadius'
    | 'borderBottomRightRadius'
    | 'borderBottomLeftRadius'
    | 'rowGap'
    | 'columnGap',
    string
  >
>;

export type BrowserElement = {
  readonly checkVisibility: (options: {
    checkOpacity: boolean;
    checkVisibilityCSS: boolean;
  }) => boolean;
  readonly getBoundingClientRect: () => {
    readonly width: number;
    readonly height: number;
  };
  readonly matches: (selector: string) => boolean;
  readonly querySelectorAll: (selector: string) => Iterable<BrowserElement>;
};

export type BrowserHtmlElement = BrowserElement & {
  readonly style: Iterable<string> & {
    readonly getPropertyValue: (name: string) => string;
    readonly setProperty: (name: string, value: string) => void;
    colorScheme: string;
  };
};

export type BrowserDocument = {
  readonly body: {
    readonly innerText: string;
    readonly firstElementChild: BrowserElement | null;
  };
  readonly fonts: { readonly ready: Promise<unknown> };
  readonly querySelectorAll: (selector: string) => Iterable<BrowserElement>;
  readonly createElement: (tag: 'canvas') => {
    width: number;
    height: number;
    readonly getContext: (
      kind: '2d',
      options: { willReadFrequently: boolean },
    ) => {
      fillStyle: string;
      readonly fillRect: (
        x: number,
        y: number,
        width: number,
        height: number,
      ) => void;
      readonly getImageData: (
        x: number,
        y: number,
        width: number,
        height: number,
      ) => { readonly data: Uint8ClampedArray };
    } | null;
  };
};
