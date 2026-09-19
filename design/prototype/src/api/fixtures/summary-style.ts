/**
 * The stylesheet the fixture summaries share. A real agent writes its own page; the
 * agent guide asks it to build on Porcelain's injected tokens (`--porcelain-*`) and
 * fonts, as these do, so a summary looks native in light and dark.
 */
export const SUMMARY_STYLE = `<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --fg: var(--porcelain-foreground, #18181b);
    --muted: var(--porcelain-muted-foreground, #71717a);
    --line: var(--porcelain-border, #e4e4e7);
    --card: var(--porcelain-card, #fafafa);
    --accent: var(--porcelain-accent, #4f46e5);
    --ok: var(--porcelain-ok, #15803d);
    --warn: var(--porcelain-warn, #b45309);
    --bad: var(--porcelain-danger, #dc2626);
    --mono: var(--porcelain-font-mono, ui-monospace, monospace);
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.6 var(--porcelain-font, ui-sans-serif, system-ui, sans-serif); color: var(--fg); }
  main { max-width: 820px; margin: 0 auto; padding: 40px 32px 88px; }
  .eyebrow { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
  .pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
  .pill.ok { color: var(--ok); border-color: color-mix(in oklch, var(--ok) 35%, transparent); background: color-mix(in oklch, var(--ok) 9%, transparent); }
  .pill.ok::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .pill code { font-size: 11.5px; background: none; padding: 0; }
  h1 { font-size: 34px; line-height: 1.12; letter-spacing: -0.03em; font-weight: 650; margin: 0 0 14px; text-wrap: balance; }
  .lede { font-size: 17px; line-height: 1.55; color: var(--muted); max-width: 62ch; margin: 0; text-wrap: pretty; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 28px 0 0; }
  .stat { border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; background: var(--card); }
  .stat b { display: block; font-size: 26px; line-height: 1.2; letter-spacing: -0.03em; font-weight: 650; }
  .stat span { font-size: 12.5px; color: var(--muted); }
  .stat.warn b { color: var(--warn); }
  h2 { font-size: 12px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); margin: 44px 0 12px; }
  .layers { display: grid; gap: 10px; }
  a.layer { display: grid; grid-template-columns: 30px 1fr 18px; gap: 14px; align-items: center; padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); color: inherit; text-decoration: none; transition: border-color .15s, transform .15s; }
  a.layer:hover { border-color: color-mix(in oklch, var(--accent) 60%, var(--line)); transform: translateY(-1px); }
  .num { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font: 600 13px/1 var(--mono); color: var(--accent); background: color-mix(in oklch, var(--accent) 13%, transparent); }
  .layer strong { display: block; font-weight: 600; letter-spacing: -0.01em; }
  .lanes { display: flex; flex-wrap: wrap; gap: 4px 6px; margin-top: 4px; font-size: 12px; color: var(--muted); }
  .lanes span + span::before { content: "→"; margin-right: 6px; opacity: .6; }
  .chev { color: var(--muted); }
  .change { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; margin-bottom: 12px; }
  .change h3 { margin: 0; padding: 13px 18px; font-size: 15px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 1px solid var(--line); }
  .sides { display: grid; grid-template-columns: 1fr 1fr; }
  .side { padding: 13px 18px; font-size: 14px; color: color-mix(in oklch, var(--fg) 85%, var(--muted)); }
  .side + .side { border-left: 1px solid var(--line); }
  .side .label { display: block; margin-bottom: 4px; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .before { background: color-mix(in oklch, var(--bad) 5%, transparent); }
  .after { background: color-mix(in oklch, var(--ok) 6%, transparent); }
  .tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
  .tag.fixed { color: var(--ok); background: color-mix(in oklch, var(--ok) 12%, transparent); }
  .tag.later { color: var(--warn); background: color-mix(in oklch, var(--warn) 14%, transparent); }
  .tag.open { color: var(--bad); background: color-mix(in oklch, var(--bad) 12%, transparent); }
  .plain { padding: 13px 18px; margin: 0; font-size: 14px; color: color-mix(in oklch, var(--fg) 85%, var(--muted)); }
  .checks { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  .check { display: grid; grid-template-columns: 20px 1fr auto; gap: 12px; align-items: center; padding: 11px 16px; font-size: 14px; }
  .check + .check { border-top: 1px solid var(--line); }
  .check svg { width: 18px; height: 18px; }
  .check .ok { color: var(--ok); } .check .bad { color: var(--bad); }
  .check small { color: var(--muted); font-size: 12.5px; }
  code { font: 12.5px var(--mono); padding: 1px 5px; border-radius: 5px; background: color-mix(in oklch, var(--fg) 7%, transparent); }
  details { margin-top: 14px; border: 1px dashed var(--line); border-radius: 12px; padding: 10px 14px; }
  summary { cursor: pointer; font-size: 13.5px; color: var(--muted); }
  pre { margin: 10px 0 0; font: 12.5px/1.6 var(--mono); white-space: pre-wrap; }
  a { color: var(--accent); }
  @media (max-width: 640px) {
    main { padding: 28px 18px 64px; }
    h1 { font-size: 27px; }
    .stats { grid-template-columns: 1fr; }
    .sides { grid-template-columns: 1fr; }
    .side + .side { border-left: 0; border-top: 1px solid var(--line); }
  }
</style>`;

const ICONS = {
  ok: '<svg class="ok" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="8"/><path d="m6.5 10.2 2.3 2.3 4.7-4.9"/></svg>',
  bad: '<svg class="bad" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="8"/><path d="m7.5 7.5 5 5m0-5-5 5"/></svg>',
};

/** One verification row: a check or a cross, the check, and what it showed. */
export const check = (passed: boolean, label: string, result: string) =>
  `<div class="check">${passed ? ICONS.ok : ICONS.bad}<span>${label}</span><small>${result}</small></div>`;

/** A layer link: Porcelain opens `#layer-N` in the review. */
export const layerLink = (index: number, title: string, lanes: string[]) =>
  `<a class="layer" href="#layer-${index}"><span class="num">${index}</span><span><strong>${title}</strong><span class="lanes">${lanes.map((lane) => `<span>${lane}</span>`).join('')}</span></span><span class="chev">›</span></a>`;
