const ATTACHMENT =
  'https://github\\.com/user-attachments/assets/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';

export function githubDescription(
  body: string,
  html: string | undefined,
): string {
  if (!html) return body;
  const images = new Map<string, string>();
  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    const source = /\ssrc\s*=\s*(["'])(.*?)\1/i.exec(tag[0])?.[2];
    if (!source) continue;
    const url = source.replaceAll('&amp;', '&');
    const id =
      /^https:\/\/private-user-images\.githubusercontent\.com\/\d+\/\d+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.[a-z0-9]+(?:\?[^\s"'<>\\()]*)?$/i.exec(
        url,
      )?.[1];
    if (id) images.set(id.toLowerCase(), url);
  }
  if (!images.size) return body;
  const markdownImage = new RegExp(
    `(!\\[[^\\]\\n]*\\]\\(<?)${ATTACHMENT}(?=>?[\\s)])`,
    'gi',
  );
  const htmlImage = /<img\b[^>]*>/gi;
  const htmlSource = new RegExp(
    `(\\ssrc\\s*=\\s*["'])${ATTACHMENT}(?=["'])`,
    'gi',
  );
  const replace = (source: string) =>
    source
      .replace(markdownImage, (match, prefix: string, id: string) =>
        images.has(id.toLowerCase())
          ? `${prefix}${images.get(id.toLowerCase())}`
          : match,
      )
      .replace(htmlImage, (tag) =>
        tag.replace(htmlSource, (match, prefix: string, id: string) =>
          images.has(id.toLowerCase())
            ? `${prefix}${images.get(id.toLowerCase())}`
            : match,
        ),
      );
  let result = '';
  let offset = 0;
  for (const code of body.matchAll(/(`+|~{3,})[\s\S]*?\1/g)) {
    result += replace(body.slice(offset, code.index)) + code[0];
    offset = code.index + code[0].length;
  }
  return result + replace(body.slice(offset));
}
