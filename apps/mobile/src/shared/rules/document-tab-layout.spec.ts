import { expect, it } from 'vitest';
import { documentTabLayout } from './document-tab-layout';

it('keeps an unmeasured, empty or fitting strip still, allowing a point of native rounding', () => {
  expect(documentTabLayout(0, 500, 0)).toEqual({ overflow: false, offset: 0 });
  expect(documentTabLayout(900, 0, 0)).toEqual({ overflow: false, offset: 0 });
  expect(documentTabLayout(900, 240, 80)).toEqual({
    overflow: false,
    offset: 0,
  });
  expect(documentTabLayout(900, 900, 0).overflow).toBe(false);
  expect(documentTabLayout(900, 900.5, 0).overflow).toBe(false);
});

it('reveals the selected tab at either edge and leaves an already visible tab in place', () => {
  expect(documentTabLayout(400, 1000, 0, { x: 700, width: 200 })).toEqual({
    overflow: true,
    offset: 500,
  });
  expect(documentTabLayout(400, 1000, 500, { x: 100, width: 200 }).offset).toBe(
    100,
  );
  expect(documentTabLayout(400, 1000, 100, { x: 200, width: 200 }).offset).toBe(
    100,
  );
});

it('recomputes overflow and clamps the offset after closing tabs, sidebar changes and rotation', () => {
  expect(documentTabLayout(400, 1000, 600).offset).toBe(600);
  expect(documentTabLayout(400, 650, 600)).toEqual({
    overflow: true,
    offset: 250,
  });
  expect(documentTabLayout(700, 650, 250)).toEqual({
    overflow: false,
    offset: 0,
  });
  expect(documentTabLayout(500, 650, 0, { x: 450, width: 200 })).toEqual({
    overflow: true,
    offset: 150,
  });
});

it('keeps the start of a tab wider than the viewport reachable without scrolling beyond the content', () => {
  expect(documentTabLayout(200, 1000, 0, { x: 400, width: 300 }).offset).toBe(
    400,
  );
  expect(documentTabLayout(400, 1000, 0, { x: 900, width: 200 }).offset).toBe(
    600,
  );
});
