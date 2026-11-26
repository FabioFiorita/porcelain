import { describe, expect, it } from 'vite-plus/test';
import { markdownElement } from './markdown-element.ts';

const element = (
  tag: string,
  attributes: Record<string, string> = {},
  document = 'docs/guide.md',
) => markdownElement(tag, attributes, document);

describe('markdownElement', () => {
  it.each([
    'script',
    'SCRIPT',
    'style',
    'iframe',
    'object',
    'embed',
    'svg',
    'math',
    'template',
    'form',
    'button',
    'textarea',
    'link',
    'meta',
    'base',
    'noscript',
  ])('drops <%s> with its content', (tag) => {
    expect(element(tag)).toEqual({ kind: 'drop' });
  });

  it('keeps only the text of tags it does not know', () => {
    expect(element('marquee')).toEqual({ kind: 'unwrap' });
    expect(element('font', { color: 'red' })).toEqual({ kind: 'unwrap' });
  });

  it('keeps no event handler, style, class or unknown attribute', () => {
    const image = element('img', {
      src: 'x.png',
      alt: 'Logo',
      onerror: 'alert(1)',
      onload: 'alert(1)',
      style: 'position:fixed',
      class: 'evil',
      srcdoc: '<script>alert(1)</script>',
      width: '96',
    });
    expect(image.kind === 'element' && image.props).toEqual({
      alt: 'Logo',
      width: 96,
    });
    const paragraph = element('p', {
      onclick: 'alert(1)',
      style: 'color:red; background:url(javascript:alert(1))',
    });
    expect(paragraph.kind === 'element' && paragraph.props).toEqual({});
  });

  it.each([
    'javascript:alert(1)',
    ' JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ])('never turns %s into a link or a source', (value) => {
    const link = element('a', { href: value });
    expect(link.kind === 'element' && link.link).toEqual({ kind: 'refused' });
    expect(link.kind === 'element' && 'href' in link.props).toBe(false);
    const image = element('img', { src: value });
    expect(image.kind === 'element' && image.source).toEqual({
      kind: 'refused',
    });
    expect(image.kind === 'element' && 'src' in image.props).toBe(false);
  });

  it('resolves links and media against the document and refuses ones outside the repository', () => {
    const guide = element('a', { href: '../README.md#install' });
    expect(guide.kind === 'element' && guide.link).toEqual({
      kind: 'repository',
      path: 'README.md',
      hash: '#install',
    });
    const escape = element('img', { src: '../../../etc/passwd' });
    expect(escape.kind === 'element' && escape.source).toEqual({
      kind: 'refused',
    });
    const picture = element('source', {
      srcset: '../assets/dark.png 2x, ../assets/light.png 1x',
      media: '(prefers-color-scheme: dark)',
    });
    expect(picture.kind === 'element' && picture.source).toEqual({
      kind: 'repository',
      path: 'assets/dark.png',
      hash: '',
    });
    const remote = element('img', { src: 'https://example.com/badge.svg' });
    expect(remote.kind === 'element' && remote.source).toEqual({
      kind: 'external',
      url: 'https://example.com/badge.svg',
    });
  });

  it('reads only text alignment from alignment attributes and styles', () => {
    const cell = element('td', {
      style: 'color: red; text-align: center; position: fixed',
    });
    expect(cell.kind === 'element' && cell.props).toEqual({
      style: { textAlign: 'center' },
    });
    const paragraph = element('p', { align: 'CENTER' });
    expect(paragraph.kind === 'element' && paragraph.props).toEqual({
      style: { textAlign: 'center' },
    });
    const span = element('span', { style: 'text-align: center' });
    expect(span.kind === 'element' && span.props).toEqual({});
  });

  it('shows video and audio with controls and never plays them by itself', () => {
    const video = element('video', {
      src: '../assets/demo.mp4',
      poster: '../assets/poster.png',
      autoplay: '',
      width: '480',
      onplay: 'alert(1)',
    });
    expect(video.kind === 'element' && video.props).toEqual({
      controls: true,
      preload: 'metadata',
      playsInline: true,
      width: 480,
    });
    expect(video.kind === 'element' && video.poster).toEqual({
      kind: 'repository',
      path: 'assets/poster.png',
      hash: '',
    });
  });

  it('keeps task checkboxes read-only and drops every other input', () => {
    const task = element('input', { type: 'checkbox', checked: '' });
    expect(task.kind === 'element' && task.props).toEqual({
      type: 'checkbox',
      disabled: true,
      checked: true,
    });
    expect(element('input', { type: 'text' })).toEqual({ kind: 'drop' });
    expect(element('input', { type: 'password' })).toEqual({ kind: 'drop' });
  });

  it('keeps identifiers safe to use as anchors and drops the rest', () => {
    const heading = element('h2', { id: 'installation' });
    expect(heading.kind === 'element' && heading.props).toEqual({
      id: 'installation',
    });
    const odd = element('h2', { id: '"><img src=x>' });
    expect(odd.kind === 'element' && odd.props).toEqual({});
  });

  it('recognises alerts and footnotes by their exact markup', () => {
    const alert = element('div', {
      class: 'markdown-alert markdown-alert-warning',
    });
    expect(alert.kind === 'element' && alert.role).toBe('alert-warning');
    const spoof = element('div', {
      class: 'markdown-alert markdown-alert-warning extra',
    });
    expect(spoof.kind === 'element' && spoof.role).toBeUndefined();
  });
});
