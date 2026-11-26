import { createCn } from 'cn/config';

export const cn = createCn({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            '3xs',
            '2xs',
            'caption',
            'ui',
            'prose',
            'reading',
            'lead',
            'section',
            'card-title',
            'subpage-title',
            'page-title',
            'briefing-title',
          ],
        },
      ],
      tracking: [{ tracking: ['title', 'lead', 'pr-title', 'pr-subheading'] }],
      rounded: [{ rounded: ['paper', 'check'] }],
      shadow: [{ shadow: ['paper', 'row', 'pop'] }],
      'max-w': [{ 'max-w': ['code-wide', 'reading', 'commit'] }],
    },
  },
});
