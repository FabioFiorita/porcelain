import { expect, it } from 'vitest';
import { githubDescription } from './github-description.ts';

const id = '78eec28e-0341-411a-b9b2-7ce767b53f3f';
const original = `https://github.com/user-attachments/assets/${id}`;
const signed = `https://private-user-images.githubusercontent.com/1/2-${id}.png?jwt=signed`;
const html = `<p><a href="${signed}"><img alt="Receipt" src="${signed}"></a></p>`;

it('uses GitHub rendered attachment URLs for Markdown and HTML image destinations', () => {
  expect(
    githubDescription(
      `<details>\n<summary>Evidence</summary>\n![Receipt](${original})\n<img alt='Receipt' src='${original}' width='800'>\n</details>`,
      html,
    ),
  ).toBe(
    `<details>\n<summary>Evidence</summary>\n![Receipt](${signed})\n<img alt='Receipt' src='${signed}' width='800'>\n</details>`,
  );
});

it('keeps ordinary links, code examples and unrelated image URLs intact', () => {
  const body = `[Receipt](${original})\n\`![Receipt](${original})\`\n\`\`\`md\n![Receipt](${original})\n\`\`\`\n![Other](https://example.com/image.png)`;
  expect(githubDescription(body, html)).toBe(body);
});

it.each([
  undefined,
  '<p>No images</p>',
  `<img src="${signed.replace(id, '00000000-0000-0000-0000-000000000000')}">`,
  `<img src="${signed.replace('private-user-images.githubusercontent.com', 'evil.example')}">`,
  `<img src="${signed.replace('https:', 'http:')}">`,
  `<img src="${signed.replace('https://', 'https://secret@')}">`,
  `<img src="javascript:alert(1)">`,
])(
  'keeps the original image when rendered HTML has no matching safe image: %s',
  (rendered) => {
    const body = `![Receipt](${original})`;
    expect(githubDescription(body, rendered)).toBe(body);
  },
);

it('decodes query separators from rendered HTML and supports bracketed Markdown destinations', () => {
  expect(
    githubDescription(
      `![Receipt](<${original}> "Caption")`,
      `<img src="${signed}&amp;download=1">`,
    ),
  ).toBe(`![Receipt](<${signed}&download=1> "Caption")`);
});
