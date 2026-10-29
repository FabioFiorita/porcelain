---
route: /$projectId/$worktreeId
selectors:
  - 'Projects and worktrees'
  - 'Review content'
tests:
  - .agents/skills/web-verify/scripts/board-diff.spec.ts
  - .agents/skills/spec/integration/board-diff.integration.ts
api: []
---

# app.board-comparison

Compare approved HTML boards with the running app by element role. The command reports typography, colour, padding, radius, gap, height and visible icon presence in Markdown and JSON. Missing, hidden or ambiguous elements fail.

## How to get to it (user POV)

Run `$C board-diff --board sidebar --route /<project>/<worktree> --instance <id>`. Set `PORCELAIN_BOARD_DIRECTORY` to the approved standalone HTML board directory, or pass `--board-directory <folder>`. Boards remain outside the repository.

## Driving it with the surface harness

Start a clean instance. Sidebar review-row comparisons need a non-main worktree review; the main worktree intentionally shows a project row. Use `--review-sample` for review boards and `--desktop` for Settings. Pass the concrete route and query parameters that select the screen. Use `?surface=changes` for the Review panel, `?surface=history` for History and `?entry=commit:<full oid>` for a commit. PR states require a fixture exposing the corresponding state; the command never seeds or fabricates PR data. Use an active decision route for the Review panel so its steps are already expanded; selecting a decision through a phone sheet normally closes that sheet. Maps reveal the navigator, phone panel and selected tab before measuring their roles.

Defaults: `--width 1440,414 --theme light,dark`. Override with `--width 1440` or `--theme light`. The evidence directory holds board/app screenshots per width/theme, a pasteable `index.md` and numbered JSON. A nonzero exit retains the same evidence. Paste the table into the PR body and fix mismatches before handoff.

Each role below names explicit board and app CSS selectors. `index` deliberately samples a repeated role; without it exactly one element must match. Select by semantic role, accessible name or structure, never fixture text. Extend maps when adding screens, including icons and controls. Every applicable role is required; hidden roles still fail. `minWidth` declares desktop-only content such as labels replaced by icons on a phone. `properties` names what a role actually renders: text roles compare typography, not a height determined by fixture wording; icon-only controls do not compare invisible inherited font styles. Omitted `properties` compares every property. `reveal` actions name a visible target and its trigger, so an already open panel is never toggled closed. Controls every pane bar draws live once in the `board-role-sets` block; a map lists the sets its board draws in `include`, and their roles are measured before its own. `pane bar Git` covers the Git split button (the primary's height and icon, its label and layout from 768px, and the Git actions chevron) on every map whose board draws a pane bar; `review view switch` covers the Walkthrough | Agent summary switch and `review progress` the files and decisions progress beside it. Role names stay unique within a map, because rows pair by name. `stock` names the pinned shadcn primitive that renders the app element (a file in `apps/web/src/components/ui` listed in `architecture/shadcn-pins.json`) and the classes its variant and size render there, as `cn` merges them; parsing refuses a class the pinned file does not contain, so a re-pin that drops one fails loudly. List only classes that set measured styles (display, size, spacing, radius, border, type, colour), not state or child selectors, and only those `cn` keeps on the element: a role measured across widths where the control changes size lists the classes both sizes share. When such a role's property differs, the command finds the element carrying every listed class (the element itself, or for typography the nearest ancestor up to it) and removes each of its classes in turn to find the classes that produce the measured value; a class whose removal hides the element is a responsive show/hide switch, not a style source. If every producing class is listed, the row reads `stock` with the classes and file in Why, and does not fail the run: stock Mira values win over board pixels. When no single class produces a box value (the listed classes leave it unset, or two of them set it alike), it is stock while removing every unlisted class leaves it unchanged. Inline styles and parent rules aimed at the element are not classes on it, so check those visually. A class the app adds, a missing or hidden element, and any role without `stock` still fail.

## Gotchas

- This compares mapped styles. Unmapped elements, icon identity and icon artwork still need visual review. Text may differ.
- Lengths tolerate 0.5 px, RGB/alpha channels one step; weight and icon presence are exact. Colours resolve to hex including alpha. Padding and radius report four sides/corners; radius values follow the CSS overlap reduction against the rendered box, so equivalent full-round declarations compare equally. Gap reports the axes that can separate children; a nowrap flex row has no used row gap, and a nowrap flex column has no used column gap.
- A dedicated dark HTML sibling wins. Otherwise the layout receives the approved `Narrative-desktop-dark.html` custom properties. A missing dark palette fails.
- Device rows compare padding, radius and icons; their height and wrapping gaps depend on device metadata and responsive reflow. Check wrapping visually in the sweep.
- Desktop reference boards are rendered at their native 1440px width for every app viewport. A 414px app capture compares the same visible roles without squeezing the fixed desktop reference until its content disappears. Responsive layout and wrapping still need visual review.
- Not-found/unavailable screens, redirects, failed documents and browser errors fail. Recovery uses a fresh context on rerun. All contexts close on failure as well as success.
- The board draws the Git split's outline on its group, while the app draws it on the joined buttons, so the split compares each half; check its corners visually. A label hidden in a narrow pane fails from 768px, because the board draws it.
- An app class identical to a listed stock class reads as stock; one that `cn` merges over a listed class removes it, so the role's stock check stops applying and its differences fail.
- `minWidth` counts the viewport while the app folds bar labels and progress by pane width, so a pane narrower than the board's fails those roles as hidden: at 1440 with the sidebar and a docked panel the progress is hidden, and the board shows it. The board's bold progress counts are a pixel detail and stay unmapped.
- The review view switch appears only for a review with an agent summary; the review sample has one.
- The closing page needs the review sample with Settings → Reviews & Git → Spec files on (choose Use these settings for this computer first), so both Not explained and Specs appear; the map opens Not explained from the briefing's walkthrough list at every width.
- Settings paths: `/settings/general`, `/settings/git`, `/settings/computers`, `/settings/computers/this-computer`.

## Board names

| Name                          | Approved HTML                    | App setup                                            |
| ----------------------------- | -------------------------------- | ---------------------------------------------------- |
| sidebar                       | Narrative-desktop                | Open the selected review; phone opens the navigator  |
| review-page                   | Narrative-desktop-briefing       | Review briefing                                      |
| review-decision               | Narrative-desktop                | Review with `?decision=<layerId>`                    |
| closing-page                  | Narrative-desktop-not-explained  | Review with `?entry=handoff`; opens Not explained    |
| review-panel                  | Narrative-desktop-review-panel   | Active decision route with the Review panel          |
| file-tab                      | Narrative-desktop-file-tab       | Retained file entry with its review context          |
| file-split                    | Narrative-desktop-split          | Review entry with the retained file in the side pane |
| changes                       | Narrative-desktop-no-review      | Worktree without a published review                  |
| settings-general              | Narrative-settings-general       | `/settings/general`                                  |
| settings-git                  | Narrative-settings-reviews-git   | `/settings/git`                                      |
| settings-computers            | Narrative-settings-computers     | `/settings/computers`                                |
| settings-this-computer        | Narrative-settings-this-computer | `/settings/computers/this-computer`                  |
| commit                        | Narrative-desktop-history        | Worktree with `?entry=commit:<oid>`                  |
| history                       | Narrative-desktop-history        | Worktree with `?surface=history`                     |
| graph                         | Narrative-desktop-graph          | Worktree with `?entry=graph`                         |
| pr-linked                     | Narrative-desktop-pr-linked      | Linked PR in the Review panel                        |
| pr-viewer                     | Narrative-desktop-pr-viewer      | PR document; absent roles fail until implemented     |
| pr-state-1 through pr-state-8 | Narrative-pr-states              | The numbered PR state in the Review panel            |

The opening-file flow is verified through its navigation sequence; its explanatory miniatures are not pixel targets. File maps compare the desktop boards at `--width 1440`; responsive widths are driven through the file-tab journey. Seed one line comment with an agent reply for the comment-marker role. Use `?entry=review-file:<reviewId>:<revision>:<path>&surface=files` for `file-tab`, and `?entry=handoff&side=review-file:<reviewId>:<revision>:<path>` for `file-split`.

Names without `.html` are also accepted for the first mapped screen using that HTML. Use the short name when the same board covers more than one screen (sidebar/decision, commit/history).

## Role maps

```json board-role-sets
{
  "pane bar Git": [
    {
      "role": "Git button",
      "properties": ["height", "icon"],
      "stock": {
        "primitive": "button",
        "classes": [
          "inline-flex",
          "rounded-md",
          "border",
          "font-medium",
          "border-border",
          "h-6",
          "gap-1",
          "px-2",
          "text-xs/relaxed"
        ]
      },
      "board": {
        "selector": "[role=\"group\"][aria-label=\"Git\"] > button:first-child"
      },
      "app": {
        "selector": "[aria-label=\"Git controls\"] > button:not([aria-label=\"Git actions\"])"
      }
    },
    {
      "role": "Git button label",
      "properties": [
        "fontSize",
        "lineHeight",
        "fontWeight",
        "letterSpacing",
        "colour"
      ],
      "minWidth": 768,
      "stock": {
        "primitive": "button",
        "classes": [
          "inline-flex",
          "rounded-md",
          "border",
          "font-medium",
          "border-border",
          "h-6",
          "gap-1",
          "px-2",
          "text-xs/relaxed"
        ]
      },
      "board": {
        "selector": "[role=\"group\"][aria-label=\"Git\"] > button:first-child"
      },
      "app": {
        "selector": "[aria-label=\"Git controls\"] > button:not([aria-label=\"Git actions\"]) > span"
      }
    },
    {
      "role": "Git button layout",
      "properties": ["padding", "gap"],
      "minWidth": 768,
      "stock": {
        "primitive": "button",
        "classes": [
          "inline-flex",
          "rounded-md",
          "border",
          "font-medium",
          "border-border",
          "h-6",
          "gap-1",
          "px-2",
          "text-xs/relaxed"
        ]
      },
      "board": {
        "selector": "[role=\"group\"][aria-label=\"Git\"] > button:first-child"
      },
      "app": {
        "selector": "[aria-label=\"Git controls\"] > button:not([aria-label=\"Git actions\"])"
      }
    },
    {
      "role": "Git actions chevron",
      "properties": ["padding", "height", "icon"],
      "stock": {
        "primitive": "button",
        "classes": [
          "inline-flex",
          "rounded-md",
          "border",
          "text-xs/relaxed",
          "font-medium",
          "border-border",
          "size-6"
        ]
      },
      "board": {
        "selector": "[role=\"group\"][aria-label=\"Git\"] > button[aria-label=\"Git actions\"]"
      },
      "app": {
        "selector": "[aria-label=\"Git controls\"] > button[aria-label=\"Git actions\"]"
      }
    }
  ],
  "review view switch": [
    {
      "role": "review view switch",
      "properties": ["padding", "radius", "gap", "height"],
      "stock": {
        "primitive": "tabs",
        "classes": [
          "inline-flex",
          "rounded-lg",
          "p-[3px]",
          "text-muted-foreground",
          "group-data-horizontal/tabs:h-8"
        ]
      },
      "board": {
        "selector": "[role=\"tablist\"][aria-label=\"Review view\"]"
      },
      "app": {
        "selector": "[aria-label=\"Review presentation\"]"
      }
    },
    {
      "role": "Walkthrough control",
      "properties": ["radius", "height"],
      "stock": {
        "primitive": "tabs",
        "classes": [
          "inline-flex",
          "h-[calc(100%-1px)]",
          "gap-1.5",
          "rounded-md",
          "border",
          "border-transparent",
          "px-1.5",
          "py-0.5",
          "text-xs",
          "font-medium",
          "text-foreground/60"
        ]
      },
      "board": {
        "selector": "[role=\"tablist\"][aria-label=\"Review view\"] > button:first-child"
      },
      "app": {
        "selector": "[aria-label=\"Review presentation\"] [aria-label=\"Walkthrough\"]"
      }
    },
    {
      "role": "Walkthrough label",
      "properties": ["fontSize", "fontWeight", "letterSpacing", "colour"],
      "minWidth": 768,
      "stock": {
        "primitive": "tabs",
        "classes": [
          "inline-flex",
          "h-[calc(100%-1px)]",
          "gap-1.5",
          "rounded-md",
          "border",
          "border-transparent",
          "px-1.5",
          "py-0.5",
          "text-xs",
          "font-medium",
          "text-foreground/60"
        ]
      },
      "board": {
        "selector": "[role=\"tablist\"][aria-label=\"Review view\"] > button:first-child"
      },
      "app": {
        "selector": "[aria-label=\"Review presentation\"] [aria-label=\"Walkthrough\"] > span"
      }
    },
    {
      "role": "Walkthrough layout",
      "properties": ["padding", "gap"],
      "minWidth": 768,
      "stock": {
        "primitive": "tabs",
        "classes": [
          "inline-flex",
          "h-[calc(100%-1px)]",
          "gap-1.5",
          "rounded-md",
          "border",
          "border-transparent",
          "px-1.5",
          "py-0.5",
          "text-xs",
          "font-medium",
          "text-foreground/60"
        ]
      },
      "board": {
        "selector": "[role=\"tablist\"][aria-label=\"Review view\"] > button:first-child"
      },
      "app": {
        "selector": "[aria-label=\"Review presentation\"] [aria-label=\"Walkthrough\"]"
      }
    },
    {
      "role": "Agent summary control",
      "properties": ["radius", "height"],
      "stock": {
        "primitive": "tabs",
        "classes": [
          "inline-flex",
          "h-[calc(100%-1px)]",
          "gap-1.5",
          "rounded-md",
          "border",
          "border-transparent",
          "px-1.5",
          "py-0.5",
          "text-xs",
          "font-medium",
          "text-foreground/60"
        ]
      },
      "board": {
        "selector": "[role=\"tablist\"][aria-label=\"Review view\"] > button:last-child"
      },
      "app": {
        "selector": "[aria-label=\"Review presentation\"] [aria-label=\"Agent summary\"]"
      }
    },
    {
      "role": "Agent summary label",
      "properties": ["fontSize", "fontWeight", "letterSpacing", "colour"],
      "minWidth": 768,
      "stock": {
        "primitive": "tabs",
        "classes": [
          "inline-flex",
          "h-[calc(100%-1px)]",
          "gap-1.5",
          "rounded-md",
          "border",
          "border-transparent",
          "px-1.5",
          "py-0.5",
          "text-xs",
          "font-medium",
          "text-foreground/60"
        ]
      },
      "board": {
        "selector": "[role=\"tablist\"][aria-label=\"Review view\"] > button:last-child"
      },
      "app": {
        "selector": "[aria-label=\"Review presentation\"] [aria-label=\"Agent summary\"] > span"
      }
    },
    {
      "role": "Agent summary layout",
      "properties": ["padding", "gap"],
      "minWidth": 768,
      "stock": {
        "primitive": "tabs",
        "classes": [
          "inline-flex",
          "h-[calc(100%-1px)]",
          "gap-1.5",
          "rounded-md",
          "border",
          "border-transparent",
          "px-1.5",
          "py-0.5",
          "text-xs",
          "font-medium",
          "text-foreground/60"
        ]
      },
      "board": {
        "selector": "[role=\"tablist\"][aria-label=\"Review view\"] > button:last-child"
      },
      "app": {
        "selector": "[aria-label=\"Review presentation\"] [aria-label=\"Agent summary\"]"
      }
    }
  ],
  "review progress": [
    {
      "role": "progress",
      "properties": ["padding", "gap"],
      "minWidth": 768,
      "board": {
        "selector": "header > div:has(> [role=\"progressbar\"])"
      },
      "app": {
        "selector": "[aria-label=\"Review progress\"]"
      }
    },
    {
      "role": "progress files",
      "properties": [
        "fontSize",
        "lineHeight",
        "fontWeight",
        "letterSpacing",
        "colour"
      ],
      "minWidth": 768,
      "board": {
        "selector": "header > div:has(> [role=\"progressbar\"]) > span:first-child"
      },
      "app": {
        "selector": "[aria-label=\"Review progress\"]"
      }
    },
    {
      "role": "progress meter",
      "properties": ["radius", "height"],
      "minWidth": 768,
      "board": {
        "selector": "header > div:has(> [role=\"progressbar\"]) > [role=\"progressbar\"]"
      },
      "app": {
        "selector": "[aria-label=\"Review progress\"] > [role=\"progressbar\"]"
      }
    },
    {
      "role": "progress decisions",
      "properties": [
        "fontSize",
        "lineHeight",
        "fontWeight",
        "letterSpacing",
        "colour"
      ],
      "minWidth": 768,
      "board": {
        "selector": "header > div:has(> [role=\"progressbar\"]) > span:last-child"
      },
      "app": {
        "selector": "[aria-label=\"Review progress\"] > span:last-child"
      }
    }
  ]
}
```

```json board-maps
{
  "sidebar": {
    "html": "Narrative-desktop.html",
    "dark": "Narrative-desktop-dark.html",
    "roles": [
      {
        "role": "brand title",
        "board": {
          "selector": "aside[aria-label=\"Worktrees\"] > div:first-child > span"
        },
        "app": {
          "selector": ".desktop-sidebar-header > div:first-of-type [data-truncated]"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "brand icon",
        "board": {
          "selector": "aside[aria-label=\"Worktrees\"] > div:first-child > svg"
        },
        "app": {
          "selector": ".desktop-sidebar-header > svg"
        },
        "properties": ["colour", "height", "icon"]
      },
      {
        "role": "project filter",
        "board": {
          "selector": "aside[aria-label=\"Worktrees\"] > button[aria-haspopup=\"menu\"]"
        },
        "app": {
          "selector": "[aria-label=\"Filter reviews\"]"
        },
        "properties": ["padding", "radius", "gap", "height", "icon"]
      },
      {
        "role": "group heading",
        "board": {
          "selector": "nav[aria-label=\"Worktrees by status\"] section > button",
          "index": 0
        },
        "app": {
          "selector": "[data-slot=\"sidebar-group-label\"]",
          "index": 0
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "review title",
        "board": {
          "selector": "nav[aria-label=\"Worktrees by status\"] a > span:nth-child(2)",
          "index": 0
        },
        "app": {
          "selector": "[data-slot=\"sidebar-menu-button\"][href*=\"/reviews/\"] .text-ui",
          "index": 0
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "review subtitle",
        "board": {
          "selector": "nav[aria-label=\"Worktrees by status\"] a > span:last-child",
          "index": 0
        },
        "app": {
          "selector": "[data-slot=\"sidebar-menu-button\"][href*=\"/reviews/\"] div.leading-4",
          "index": 0
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "review progress",
        "board": {
          "selector": "nav[aria-label=\"Worktrees by status\"] a > span:nth-child(3)",
          "index": 0
        },
        "app": {
          "selector": "[data-slot=\"sidebar-menu-button\"][href*=\"/reviews/\"] [aria-label$=\"decisions reviewed\"]",
          "index": 0
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "settings button",
        "board": {
          "selector": "aside[aria-label=\"Worktrees\"] > div:last-child > button:first-child"
        },
        "app": {
          "selector": ".navigator-footer > [data-slot=\"tooltip-trigger\"]"
        }
      },
      {
        "role": "shortcuts button",
        "board": {
          "selector": "aside[aria-label=\"Worktrees\"] [aria-label=\"Keyboard shortcuts\"]"
        },
        "app": {
          "selector": ".navigator-footer [aria-label=\"Keyboard shortcuts\"]"
        },
        "properties": ["padding", "radius", "gap", "height", "icon"]
      },
      {
        "role": "project filter label",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "aside[aria-label=\"Worktrees\"] > button[aria-haspopup=\"menu\"] > span:first-of-type"
        },
        "app": {
          "selector": "[aria-label=\"Filter reviews\"] > span:first-of-type"
        }
      },
      {
        "role": "shortcuts icon",
        "properties": ["colour", "height", "icon"],
        "board": {
          "selector": "aside[aria-label=\"Worktrees\"] [aria-label=\"Keyboard shortcuts\"] svg"
        },
        "app": {
          "selector": "[aria-label=\"Keyboard shortcuts\"] svg"
        }
      }
    ],
    "reveal": [
      {
        "target": ".review-navigator [data-slot=\"sidebar-menu-button\"]:visible",
        "trigger": "[aria-label=\"Toggle Sidebar\"]:visible"
      }
    ]
  },
  "review-page": {
    "html": "Narrative-desktop-briefing.html",
    "dark": "Narrative-desktop-briefing-D.html",
    "include": ["pane bar Git", "review view switch", "review progress"],
    "roles": [
      {
        "role": "review title",
        "board": {
          "selector": "main h1"
        },
        "app": {
          "selector": "[aria-label=\"Briefing\"] h2"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "section heading",
        "board": {
          "selector": "#b-adds"
        },
        "app": {
          "selector": "#briefing-system"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "eyebrow",
        "board": {
          "selector": "main article > div:first-child > span:first-child"
        },
        "app": {
          "selector": "[aria-label=\"Briefing\"] header > p:first-child"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "recommendation",
        "board": {
          "selector": "section[aria-label=\"Recommendation\"]"
        },
        "app": {
          "selector": "[aria-label=\"Briefing\"] section[aria-label=\"Recommendation\"]"
        },
        "properties": ["padding", "radius", "gap", "icon"]
      },
      {
        "role": "continue button",
        "board": {
          "selector": "main article > div > button[title^=\"Open decision\"]"
        },
        "app": {
          "selector": "[aria-label=\"Briefing\"] header button:has(svg.lucide-arrow-right)"
        }
      },
      {
        "role": "recommendation text",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "section[aria-label=\"Recommendation\"] > div:first-child > span:last-child"
        },
        "app": {
          "selector": "[aria-label=\"Briefing\"] section[aria-label=\"Recommendation\"] h3 > span:last-child"
        }
      }
    ]
  },
  "review-decision": {
    "html": "Narrative-desktop.html",
    "dark": "Narrative-desktop-dark.html",
    "include": ["pane bar Git", "review view switch", "review progress"],
    "roles": [
      {
        "role": "decision title",
        "board": {
          "selector": "main h1"
        },
        "app": {
          "selector": "[aria-label=\"Review walkthrough\"] header h2"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "route",
        "board": {
          "selector": "section[aria-label=\"Route and stops\"]"
        },
        "app": {
          "selector": "section[aria-label=\"Route through the system\"]"
        },
        "properties": ["padding", "radius", "gap", "icon"]
      },
      {
        "role": "route step",
        "board": {
          "selector": "section[aria-label=\"Route and stops\"] a",
          "index": 0
        },
        "app": {
          "selector": "[aria-label=\"Steps\"] button",
          "index": 0
        },
        "properties": ["padding", "radius", "gap", "icon"]
      },
      {
        "role": "previous decision",
        "board": {
          "selector": "[aria-label=\"Previous decision\"]"
        },
        "app": {
          "selector": "[aria-label=\"Previous stop\"]"
        },
        "properties": ["padding", "radius", "gap", "height", "icon"]
      },
      {
        "role": "next decision",
        "board": {
          "selector": "[aria-label=\"Next decision\"]"
        },
        "app": {
          "selector": "[aria-label=\"Next stop\"]"
        },
        "properties": ["padding", "radius", "gap", "height", "icon"]
      },
      {
        "role": "reviewed action",
        "board": {
          "selector": "[aria-label=\"Decision\"] button:last-child"
        },
        "app": {
          "selector": "[aria-label=\"Walkthrough dock\"] button[aria-pressed]"
        },
        "properties": ["padding", "radius", "gap", "height", "icon"]
      },
      {
        "role": "route step title",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "section[aria-label=\"Route and stops\"] a > span:nth-child(3)",
          "index": 0
        },
        "app": {
          "selector": "[aria-label=\"Steps\"] button > span:last-child > span:first-child",
          "index": 0
        }
      }
    ]
  },
  "closing-page": {
    "html": "Narrative-desktop-not-explained.html",
    "reveal": [
      {
        "target": "[aria-label=\"Review completion\"]",
        "trigger": "[aria-label=\"Briefing\"] button[aria-label=\"Not explained\"]"
      }
    ],
    "include": ["pane bar Git", "review view switch", "review progress"],
    "roles": [
      {
        "role": "completion card",
        "properties": ["padding", "radius", "gap", "icon"],
        "board": {
          "selector": "aside[aria-label=\"Margin notes\"] > section"
        },
        "app": {
          "selector": "section[aria-label=\"Review completion\"]"
        }
      },
      {
        "role": "completion title",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "aside[aria-label=\"Margin notes\"] > section h2"
        },
        "app": {
          "selector": "section[aria-label=\"Review completion\"] > header h3"
        }
      },
      {
        "role": "completion files",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "aside[aria-label=\"Margin notes\"] > section > div:first-child p"
        },
        "app": {
          "selector": "section[aria-label=\"Review completion\"] > header p"
        }
      },
      {
        "role": "merge needs heading",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "aside[aria-label=\"Margin notes\"] > section > div:nth-child(2) > div:first-child"
        },
        "app": {
          "selector": "section[aria-label=\"Review completion\"] > section[aria-label=\"Ready to merge needs\"] > h4"
        }
      },
      {
        "role": "merge need",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour",
          "gap",
          "icon"
        ],
        "board": {
          "selector": "aside[aria-label=\"Margin notes\"] > section > div:nth-child(2) li",
          "index": 0
        },
        "app": {
          "selector": "section[aria-label=\"Review completion\"] > section[aria-label=\"Ready to merge needs\"] > p:not([role])",
          "index": 0
        }
      },
      {
        "role": "still open heading",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "aside[aria-label=\"Margin notes\"] > section > div:nth-child(3) > div"
        },
        "app": {
          "selector": "section[aria-label=\"Review completion\"] > section[aria-label=\"Still open\"] > h4"
        }
      },
      {
        "role": "still open row",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour",
          "padding"
        ],
        "board": {
          "selector": "aside[aria-label=\"Margin notes\"] > section > div:nth-child(3) li",
          "index": 0
        },
        "app": {
          "selector": "section[aria-label=\"Review completion\"] > section[aria-label=\"Still open\"] > p",
          "index": 0
        }
      },
      {
        "role": "Ask the agent",
        "board": {
          "selector": "aside[aria-label=\"Margin notes\"] > section button[title^=\"Comment on the whole change\"]"
        },
        "app": {
          "selector": "section[aria-label=\"Review completion\"] button[aria-expanded]"
        }
      },
      {
        "role": "Not explained eyebrow",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "main article > div:first-child > span"
        },
        "app": {
          "selector": "section[aria-label=\"Not explained\"] > header > p:first-child"
        }
      },
      {
        "role": "Not explained title",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "main article > h1"
        },
        "app": {
          "selector": "section[aria-label=\"Not explained\"] > header > h2"
        }
      },
      {
        "role": "Not explained lead",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "main article > h1 + p"
        },
        "app": {
          "selector": "section[aria-label=\"Not explained\"] > header > p:last-child"
        }
      },
      {
        "role": "unexplained lines heading",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "section[aria-label=\"Unexplained lines in explained files\"] > div > span:first-child"
        },
        "app": {
          "selector": "section[aria-labelledby=\"closing-partial\"] > h3 > span:first-child"
        }
      },
      {
        "role": "unexplained line",
        "properties": ["padding", "gap", "icon"],
        "board": {
          "selector": "section[aria-label=\"Unexplained lines in explained files\"] li > a",
          "index": 0
        },
        "app": {
          "selector": "[aria-label=\"Unexplained lines in explained files\"] > li",
          "index": 0
        }
      },
      {
        "role": "Specs eyebrow",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "main article > div:has(+ h2) > span"
        },
        "app": {
          "selector": "section[aria-label=\"Specs\"] > header > p:first-child"
        }
      },
      {
        "role": "Specs title",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "main article > h2"
        },
        "app": {
          "selector": "section[aria-label=\"Specs\"] > header > h2"
        }
      },
      {
        "role": "Specs lead",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "main article > h2 + p"
        },
        "app": {
          "selector": "section[aria-label=\"Specs\"] > header > p:last-child"
        }
      }
    ]
  },
  "review-panel": {
    "html": "Narrative-desktop-review-panel.html",
    "include": ["pane bar Git", "review view switch", "review progress"],
    "roles": [
      {
        "role": "panel heading",
        "board": {
          "selector": "aside[aria-label=\"Side panel: Review\"] h2"
        },
        "app": {
          "selector": "aside[aria-label=\"Review sidebar\"] h2"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "minWidth": 1280
      },
      {
        "role": "comparison switch",
        "board": {
          "selector": "[aria-label=\"Compare\"] [role=\"tab\"]",
          "index": 0
        },
        "app": {
          "selector": "aside[aria-label=\"Review sidebar\"] [aria-label=\"Changes to review\"] [role=\"tab\"]",
          "index": 0
        }
      },
      {
        "role": "readiness heading",
        "board": {
          "selector": "section[aria-label=\"Readiness\"] h3"
        },
        "app": {
          "selector": "aside[aria-label=\"Review sidebar\"] section[aria-label=\"Readiness\"] h3"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "decision row",
        "board": {
          "selector": "ol[aria-label=\"Decisions\"] > li > a[aria-current=\"step\"]"
        },
        "app": {
          "selector": "aside[aria-label=\"Review sidebar\"] nav[aria-label=\"Walkthrough\"] button[aria-expanded=\"true\"]:not([aria-haspopup])"
        },
        "properties": ["padding", "radius", "gap", "icon"]
      },
      {
        "role": "step checkbox",
        "board": {
          "selector": "ol[aria-label^=\"Stops of decision\"] [role=\"checkbox\"]",
          "index": 0
        },
        "app": {
          "selector": "aside[aria-label=\"Review sidebar\"] [role=\"checkbox\"]",
          "index": 0
        },
        "properties": ["padding", "radius", "gap", "height", "icon"]
      },
      {
        "role": "decision title",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "board": {
          "selector": "ol[aria-label=\"Decisions\"] > li > a[aria-current=\"step\"] > span:nth-child(2)"
        },
        "app": {
          "selector": "aside[aria-label=\"Review sidebar\"] nav[aria-label=\"Walkthrough\"] button[aria-expanded=\"true\"] > span:nth-child(2) > :first-child"
        }
      }
    ],
    "reveal": [
      {
        "target": "aside[aria-label=\"Review sidebar\"]:visible",
        "trigger": "button[aria-label=\"Review\"]:visible"
      },
      {
        "target": "aside[aria-label=\"Review sidebar\"] nav[aria-label=\"Walkthrough\"]:visible",
        "trigger": "aside[aria-label=\"Review sidebar\"] [role=\"tab\"]:has-text(\"Review\")"
      }
    ]
  },
  "changes": {
    "html": "Narrative-desktop-no-review.html",
    "include": ["pane bar Git"],
    "roles": [
      {
        "role": "changes title",
        "board": {
          "selector": "main h1"
        },
        "app": {
          "selector": "[aria-label=\"Review content\"] h2"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "comparison switch",
        "board": {
          "selector": "[aria-label=\"Compare\"] [role=\"tab\"]",
          "index": 0
        },
        "app": {
          "selector": "[aria-label=\"Review content\"] [role=\"tablist\"] [role=\"tab\"]",
          "index": 0
        }
      },
      {
        "role": "changes tab",
        "board": {
          "selector": "[aria-label=\"Open documents\"] [role=\"tab\"][aria-selected=\"true\"]"
        },
        "app": {
          "selector": "[aria-label=\"Open documents\"] [role=\"tab\"][aria-selected=\"true\"]"
        }
      },
      {
        "role": "changed file row",
        "board": {
          "selector": "section[aria-label=\"Uncommitted changes\"] button[role=\"checkbox\"]",
          "index": 0
        },
        "app": {
          "selector": "[aria-label=\"Review content\"] [role=\"checkbox\"]",
          "index": 0
        }
      }
    ]
  },
  "settings-general": {
    "html": "Narrative-settings-general.html",
    "roles": [
      {
        "role": "page title",
        "board": {
          "selector": "main h1"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] .settings-content h1"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "breadcrumb",
        "board": {
          "selector": "nav[aria-label=\"Breadcrumb\"]"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] nav[aria-label=\"breadcrumb\"] [data-slot=\"breadcrumb-list\"]"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour",
          "gap"
        ]
      },
      {
        "role": "selected section",
        "board": {
          "selector": "nav[aria-label=\"Settings sections\"] [aria-current=\"page\"]"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] nav[aria-label=\"Settings sections\"] [aria-current=\"page\"]"
        }
      },
      {
        "role": "section heading",
        "board": {
          "selector": "main article h2",
          "index": 0
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] [data-slot=\"field-legend\"]",
          "index": 0
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "theme segment",
        "board": {
          "selector": "[aria-label=\"Theme\"] [role=\"tab\"]",
          "index": 0
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] [aria-label=\"Theme\"] [role=\"tab\"]",
          "index": 0
        }
      },
      {
        "role": "setting label",
        "board": {
          "selector": "article div:has(> [aria-label=\"Theme\"]) > div:first-child > div:first-child"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] [data-slot=\"item-title\"]",
          "index": 0
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      }
    ]
  },
  "settings-git": {
    "html": "Narrative-settings-reviews-git.html",
    "roles": [
      {
        "role": "page title",
        "board": {
          "selector": "main h1"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] .settings-content h1"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "breadcrumb",
        "board": {
          "selector": "nav[aria-label=\"Breadcrumb\"]"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] nav[aria-label=\"breadcrumb\"] [data-slot=\"breadcrumb-list\"]"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour",
          "gap"
        ]
      },
      {
        "role": "selected section",
        "board": {
          "selector": "nav[aria-label=\"Settings sections\"] [aria-current=\"page\"]"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] nav[aria-label=\"Settings sections\"] [aria-current=\"page\"]"
        }
      },
      {
        "role": "section heading",
        "board": {
          "selector": "main article h2",
          "index": 0
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] [data-slot=\"field-legend\"]",
          "index": 0
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      }
    ]
  },
  "settings-computers": {
    "html": "Narrative-settings-computers.html",
    "roles": [
      {
        "role": "page title",
        "board": {
          "selector": "main h1"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] .settings-content h1"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "breadcrumb",
        "board": {
          "selector": "nav[aria-label=\"Breadcrumb\"]"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] nav[aria-label=\"breadcrumb\"] [data-slot=\"breadcrumb-list\"]"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour",
          "gap"
        ]
      },
      {
        "role": "selected section",
        "board": {
          "selector": "nav[aria-label=\"Settings sections\"] [aria-current=\"page\"]"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] nav[aria-label=\"Settings sections\"] [aria-current=\"page\"]"
        }
      },
      {
        "role": "section heading",
        "board": {
          "selector": "main article h2",
          "index": 0
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] [data-slot=\"field-legend\"]",
          "index": 0
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      }
    ]
  },
  "settings-this-computer": {
    "html": "Narrative-settings-this-computer.html",
    "dark": "Narrative-settings-this-computer-D.html",
    "roles": [
      {
        "role": "page title",
        "board": {
          "selector": "main h1"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] .settings-content h1"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "breadcrumb",
        "board": {
          "selector": "nav[aria-label=\"Breadcrumb\"]"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] nav[aria-label=\"breadcrumb\"] [data-slot=\"breadcrumb-list\"]"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour",
          "gap"
        ]
      },
      {
        "role": "selected section",
        "board": {
          "selector": "nav[aria-label=\"Settings sections\"] [aria-current=\"page\"]"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] nav[aria-label=\"Settings sections\"] [aria-current=\"page\"]"
        }
      },
      {
        "role": "section heading",
        "board": {
          "selector": "#t-ways"
        },
        "app": {
          "selector": "#ways-in > [data-slot=\"field-legend\"]"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "device row",
        "board": {
          "selector": "[aria-label=\"Paired devices\"] > li:first-child"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] [aria-label=\"Paired devices and links\"] > [data-slot=\"item\"]",
          "index": 0
        },
        "properties": ["padding", "radius", "icon"]
      }
    ]
  },
  "commit": {
    "html": "Narrative-desktop-history.html",
    "include": ["pane bar Git"],
    "roles": [
      {
        "role": "commit title",
        "board": {
          "selector": "article h1"
        },
        "app": {
          "selector": "[aria-label=\"Review content\"] h1 > span"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      },
      {
        "role": "copy hash",
        "stock": {
          "primitive": "button",
          "classes": [
            "rounded-md",
            "border",
            "border-transparent",
            "font-medium",
            "text-xs/relaxed"
          ]
        },
        "board": {
          "selector": "main button[title=\"Copy the full commit hash\"]"
        },
        "app": {
          "selector": "[aria-label=\"Copy hash\"]"
        },
        "properties": ["radius", "height", "icon"]
      },
      {
        "role": "open in graph",
        "stock": {
          "primitive": "button",
          "classes": [
            "rounded-md",
            "border",
            "border-transparent",
            "font-medium",
            "text-xs/relaxed"
          ]
        },
        "board": {
          "selector": "main button[title=\"Open the history graph at this commit\"]"
        },
        "app": {
          "selector": "[aria-label=\"Open in graph\"]"
        },
        "properties": ["radius", "height", "icon"]
      },
      {
        "role": "changed file",
        "board": {
          "selector": "section[aria-label=\"Files changed\"] a",
          "index": 0
        },
        "app": {
          "selector": "[aria-label=\"Review content\"] [aria-label=\"Changed files\"] > li",
          "index": 0
        },
        "properties": ["padding", "radius", "gap", "height", "icon"]
      },
      {
        "role": "copy hash label",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "stock": {
          "primitive": "button",
          "classes": [
            "rounded-md",
            "border",
            "border-transparent",
            "font-medium",
            "h-7",
            "gap-1",
            "px-2",
            "text-xs/relaxed"
          ]
        },
        "board": {
          "selector": "main button[title=\"Copy the full commit hash\"]"
        },
        "app": {
          "selector": "[aria-label=\"Copy hash\"] > span"
        },
        "minWidth": 768
      },
      {
        "role": "copy hash layout",
        "properties": ["padding", "gap"],
        "stock": {
          "primitive": "button",
          "classes": [
            "rounded-md",
            "border",
            "border-transparent",
            "font-medium",
            "h-7",
            "gap-1",
            "px-2",
            "text-xs/relaxed"
          ]
        },
        "board": {
          "selector": "main button[title=\"Copy the full commit hash\"]"
        },
        "app": {
          "selector": "[aria-label=\"Copy hash\"]"
        },
        "minWidth": 768
      },
      {
        "role": "open in graph label",
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "stock": {
          "primitive": "button",
          "classes": [
            "rounded-md",
            "border",
            "border-transparent",
            "font-medium",
            "h-7",
            "gap-1",
            "px-2",
            "text-xs/relaxed"
          ]
        },
        "board": {
          "selector": "main button[title=\"Open the history graph at this commit\"]"
        },
        "app": {
          "selector": "[aria-label=\"Open in graph\"] > span"
        },
        "minWidth": 768
      },
      {
        "role": "open in graph layout",
        "properties": ["padding", "gap"],
        "stock": {
          "primitive": "button",
          "classes": [
            "rounded-md",
            "border",
            "border-transparent",
            "font-medium",
            "h-7",
            "gap-1",
            "px-2",
            "text-xs/relaxed"
          ]
        },
        "board": {
          "selector": "main button[title=\"Open the history graph at this commit\"]"
        },
        "app": {
          "selector": "[aria-label=\"Open in graph\"]"
        },
        "minWidth": 768
      }
    ]
  },
  "history": {
    "html": "Narrative-desktop-history.html",
    "include": ["pane bar Git"],
    "roles": [
      {
        "role": "history heading",
        "board": {
          "selector": "aside[aria-label=\"Side panel: History\"] h2"
        },
        "app": {
          "selector": "aside[aria-label=\"Review sidebar\"] h2"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ],
        "minWidth": 1280
      },
      {
        "role": "commit row",
        "board": {
          "selector": "ol[aria-label=\"Commits\"] > li",
          "index": 0
        },
        "app": {
          "selector": "[aria-label=\"Commits\"] > li",
          "index": 0
        },
        "properties": ["padding", "radius", "gap", "height", "icon"]
      },
      {
        "role": "commit subject",
        "board": {
          "selector": "ol[aria-label=\"Commits\"] li a > span:first-child",
          "index": 0
        },
        "app": {
          "selector": "[aria-label=\"Commits\"] [data-slot=\"tooltip-trigger\"]",
          "index": 0
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      }
    ],
    "reveal": [
      {
        "target": "aside[aria-label=\"Review sidebar\"]:visible",
        "trigger": "button[aria-label=\"Review\"]:visible"
      },
      {
        "target": "aside[aria-label=\"Review sidebar\"] [aria-label=\"Commits\"]:visible",
        "trigger": "aside[aria-label=\"Review sidebar\"] [role=\"tab\"]:has-text(\"History\")"
      }
    ]
  },
  "graph": {
    "html": "Narrative-desktop-graph.html",
    "include": ["pane bar Git"],
    "roles": [
      {
        "role": "graph row",
        "board": {
          "selector": "ol[aria-label=\"Commit graph\"] > li",
          "index": 0
        },
        "app": {
          "selector": "[aria-label=\"Commit graph\"] > li",
          "index": 0
        },
        "properties": ["padding", "radius", "gap", "height", "icon"]
      },
      {
        "role": "HEAD ref",
        "board": {
          "selector": "ol[aria-label=\"Commit graph\"] [title^=\"HEAD:\"]"
        },
        "app": {
          "selector": "[aria-label=\"Commit graph\"] li [data-slot=\"badge\"][data-variant=\"brand\"]"
        },
        "minWidth": 768
      }
    ]
  },
  "pr-linked": {
    "html": "Narrative-desktop-pr-linked.html",
    "include": ["pane bar Git", "review view switch", "review progress"],
    "roles": [
      {
        "role": "PR block",
        "board": {
          "selector": "section[aria-label=\"Pull request\"]"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"]"
        },
        "properties": ["padding", "radius", "gap", "icon"]
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      }
    ],
    "reveal": [
      {
        "target": "aside[aria-label=\"Review sidebar\"]:visible",
        "trigger": "button[aria-label=\"Review\"]:visible"
      },
      {
        "target": "section[aria-label=\"Pull request\"]:visible",
        "trigger": "aside[aria-label=\"Review sidebar\"] [role=\"tab\"]:has-text(\"Review\")"
      }
    ]
  },
  "pr-viewer": {
    "html": "Narrative-desktop-pr-viewer.html",
    "include": ["pane bar Git"],
    "roles": [
      {
        "role": "PR title",
        "board": {
          "selector": "article h1"
        },
        "app": {
          "selector": "[aria-label=\"Pull request\"] h2"
        }
      },
      {
        "role": "description",
        "board": {
          "selector": "section[aria-label=\"Description\"]"
        },
        "app": {
          "selector": "[aria-label=\"Pull request\"] [aria-label=\"Description\"]"
        }
      },
      {
        "role": "checks",
        "board": {
          "selector": "section[aria-label=\"Checks\"]"
        },
        "app": {
          "selector": "[aria-label=\"Pull request\"] [aria-label=\"Checks\"]"
        }
      },
      {
        "role": "conversation",
        "board": {
          "selector": "section[aria-label=\"Conversation on GitHub\"]"
        },
        "app": {
          "selector": "[aria-label=\"Pull request\"] [aria-label=\"Conversation on GitHub\"]"
        }
      }
    ]
  },
  "pr-state-1": {
    "html": "Narrative-pr-states.html",
    "dark": "Narrative-pr-states-D.html",
    "roles": [
      {
        "role": "PR block",
        "board": {
          "selector": "[aria-label^=\"State 1:\"] section[aria-label=\"Pull request\"]"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"]"
        },
        "properties": ["padding", "radius", "gap", "icon"]
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 1:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      }
    ],
    "reveal": [
      {
        "target": "aside[aria-label=\"Review sidebar\"]:visible",
        "trigger": "button[aria-label=\"Review\"]:visible"
      },
      {
        "target": "section[aria-label=\"Pull request\"]:visible",
        "trigger": "aside[aria-label=\"Review sidebar\"] [role=\"tab\"]:has-text(\"Review\")"
      }
    ]
  },
  "pr-state-2": {
    "html": "Narrative-pr-states.html",
    "dark": "Narrative-pr-states-D.html",
    "roles": [
      {
        "role": "PR block",
        "board": {
          "selector": "[aria-label^=\"State 2:\"] section[aria-label=\"Pull request\"]"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"]"
        },
        "properties": ["padding", "radius", "gap", "icon"]
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 2:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      }
    ],
    "reveal": [
      {
        "target": "aside[aria-label=\"Review sidebar\"]:visible",
        "trigger": "button[aria-label=\"Review\"]:visible"
      },
      {
        "target": "section[aria-label=\"Pull request\"]:visible",
        "trigger": "aside[aria-label=\"Review sidebar\"] [role=\"tab\"]:has-text(\"Review\")"
      }
    ]
  },
  "pr-state-3": {
    "html": "Narrative-pr-states.html",
    "dark": "Narrative-pr-states-D.html",
    "roles": [
      {
        "role": "PR block",
        "board": {
          "selector": "[aria-label^=\"State 3:\"] section[aria-label=\"Pull request\"]"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"]"
        },
        "properties": ["padding", "radius", "gap", "icon"]
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 3:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      }
    ],
    "reveal": [
      {
        "target": "aside[aria-label=\"Review sidebar\"]:visible",
        "trigger": "button[aria-label=\"Review\"]:visible"
      },
      {
        "target": "section[aria-label=\"Pull request\"]:visible",
        "trigger": "aside[aria-label=\"Review sidebar\"] [role=\"tab\"]:has-text(\"Review\")"
      }
    ]
  },
  "pr-state-4": {
    "html": "Narrative-pr-states.html",
    "dark": "Narrative-pr-states-D.html",
    "roles": [
      {
        "role": "PR block",
        "board": {
          "selector": "[aria-label^=\"State 4:\"] section[aria-label=\"Pull request\"]"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"]"
        },
        "properties": ["padding", "radius", "gap", "icon"]
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 4:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      }
    ],
    "reveal": [
      {
        "target": "aside[aria-label=\"Review sidebar\"]:visible",
        "trigger": "button[aria-label=\"Review\"]:visible"
      },
      {
        "target": "section[aria-label=\"Pull request\"]:visible",
        "trigger": "aside[aria-label=\"Review sidebar\"] [role=\"tab\"]:has-text(\"Review\")"
      }
    ]
  },
  "pr-state-5": {
    "html": "Narrative-pr-states.html",
    "dark": "Narrative-pr-states-D.html",
    "roles": [
      {
        "role": "PR block",
        "board": {
          "selector": "[aria-label^=\"State 5:\"] section[aria-label=\"Pull request\"]"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"]"
        },
        "properties": ["padding", "radius", "gap", "icon"]
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 5:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      }
    ],
    "reveal": [
      {
        "target": "aside[aria-label=\"Review sidebar\"]:visible",
        "trigger": "button[aria-label=\"Review\"]:visible"
      },
      {
        "target": "section[aria-label=\"Pull request\"]:visible",
        "trigger": "aside[aria-label=\"Review sidebar\"] [role=\"tab\"]:has-text(\"Review\")"
      }
    ]
  },
  "pr-state-6": {
    "html": "Narrative-pr-states.html",
    "dark": "Narrative-pr-states-D.html",
    "roles": [
      {
        "role": "PR block",
        "board": {
          "selector": "[aria-label^=\"State 6:\"] section[aria-label=\"Pull request\"]"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"]"
        },
        "properties": ["padding", "radius", "gap", "icon"]
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 6:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      }
    ],
    "reveal": [
      {
        "target": "aside[aria-label=\"Review sidebar\"]:visible",
        "trigger": "button[aria-label=\"Review\"]:visible"
      },
      {
        "target": "section[aria-label=\"Pull request\"]:visible",
        "trigger": "aside[aria-label=\"Review sidebar\"] [role=\"tab\"]:has-text(\"Review\")"
      }
    ]
  },
  "pr-state-7": {
    "html": "Narrative-pr-states.html",
    "dark": "Narrative-pr-states-D.html",
    "roles": [
      {
        "role": "PR block",
        "board": {
          "selector": "[aria-label^=\"State 7:\"] section[aria-label=\"Pull request\"]"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"]"
        },
        "properties": ["padding", "radius", "gap", "icon"]
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 7:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      }
    ],
    "reveal": [
      {
        "target": "aside[aria-label=\"Review sidebar\"]:visible",
        "trigger": "button[aria-label=\"Review\"]:visible"
      },
      {
        "target": "section[aria-label=\"Pull request\"]:visible",
        "trigger": "aside[aria-label=\"Review sidebar\"] [role=\"tab\"]:has-text(\"Review\")"
      }
    ]
  },
  "pr-state-8": {
    "html": "Narrative-pr-states.html",
    "dark": "Narrative-pr-states-D.html",
    "roles": [
      {
        "role": "PR block",
        "board": {
          "selector": "[aria-label^=\"State 8:\"] section[aria-label=\"Pull request\"]"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"]"
        },
        "properties": ["padding", "radius", "gap", "icon"]
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 8:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour"
        ]
      }
    ],
    "reveal": [
      {
        "target": "aside[aria-label=\"Review sidebar\"]:visible",
        "trigger": "button[aria-label=\"Review\"]:visible"
      },
      {
        "target": "section[aria-label=\"Pull request\"]:visible",
        "trigger": "aside[aria-label=\"Review sidebar\"] [role=\"tab\"]:has-text(\"Review\")"
      }
    ]
  },
  "file-tab": {
    "html": "Narrative-desktop-file-tab.html",
    "include": ["pane bar Git"],
    "roles": [
      {
        "role": "pane bar",
        "board": {
          "selector": ":is(header, div):has(> [role=\"tablist\"][aria-label=\"Open documents\"])"
        },
        "app": {
          "selector": "[data-pane-bar]"
        }
      },
      {
        "role": "Review tab",
        "board": {
          "selector": "[role=\"tablist\"][aria-label=\"Open documents\"] > [role=\"tab\"]:first-child"
        },
        "app": {
          "selector": "[data-entry=\"handoff\"]"
        }
      },
      {
        "role": "review progress",
        "board": {
          "selector": "[role=\"tablist\"][aria-label=\"Open documents\"] > [role=\"tab\"]:first-child > span:last-child"
        },
        "app": {
          "selector": "[data-entry=\"handoff\"] > span:last-child"
        }
      },
      {
        "role": "file tab",
        "board": {
          "selector": "[role=\"tablist\"][aria-label=\"Open documents\"] [role=\"tab\"][aria-selected=\"true\"]"
        },
        "app": {
          "selector": "[role=\"tab\"][data-entry^=\"review-file:\"][aria-selected=\"true\"]"
        }
      },
      {
        "role": "close file tab",
        "board": {
          "selector": "button[aria-label^=\"Close \"]"
        },
        "app": {
          "selector": "[role=\"tab\"][data-entry^=\"review-file:\"] button[aria-label^=\"Close \"]"
        }
      },
      {
        "role": "review context banner",
        "board": {
          "selector": "div:has(> a.nv-h.nv-f):has(> svg)"
        },
        "app": {
          "selector": "[data-review-file-banner]"
        }
      },
      {
        "role": "review context caption",
        "board": {
          "selector": "div:has(> a.nv-h.nv-f):has(> svg) > span"
        },
        "app": {
          "selector": "[data-review-file-banner] > [data-truncated]"
        }
      },
      {
        "role": "back to walkthrough",
        "board": {
          "selector": "div:has(> a.nv-h.nv-f):has(> svg) > a"
        },
        "app": {
          "selector": "[data-review-file-banner] > button"
        }
      },
      {
        "role": "file header",
        "board": {
          "selector": "div:has(> nav[aria-label=\"Path\"])"
        },
        "app": {
          "selector": "[data-file-heading]"
        }
      },
      {
        "role": "breadcrumb",
        "board": {
          "selector": "nav[aria-label=\"Path\"]"
        },
        "app": {
          "selector": "[data-file-heading] h1"
        }
      },
      {
        "role": "filename",
        "board": {
          "selector": "nav[aria-label=\"Path\"] > span:last-child"
        },
        "app": {
          "selector": "[data-file-heading] h1 > span:last-child"
        }
      },
      {
        "role": "file status",
        "board": {
          "selector": "nav[aria-label=\"Path\"] + span"
        },
        "app": {
          "selector": "[data-file-heading] > span"
        }
      },
      {
        "role": "deletions",
        "board": {
          "selector": "div:has(> nav[aria-label=\"Path\"]) > span:last-child > span:first-child"
        },
        "app": {
          "selector": "[data-file-heading] [aria-label$=\" additions\"] > span:first-child"
        }
      },
      {
        "role": "additions",
        "board": {
          "selector": "div:has(> nav[aria-label=\"Path\"]) > span:last-child > span:last-child"
        },
        "app": {
          "selector": "[data-file-heading] [aria-label$=\" additions\"] > span:last-child"
        }
      },
      {
        "role": "comment marker",
        "board": {
          "selector": "button[aria-label^=\"Comment thread on line\"]"
        },
        "app": {
          "selector": "[data-file-thread-marker]"
        }
      },
      {
        "role": "Reviewed control",
        "stock": {
          "primitive": "button",
          "classes": [
            "rounded-md",
            "border",
            "font-medium",
            "border-border",
            "h-7",
            "gap-1",
            "px-2",
            "text-xs/relaxed"
          ]
        },
        "board": {
          "selector": "button[role=\"checkbox\"]"
        },
        "app": {
          "selector": "[aria-label=\"Document controls\"] button[aria-label=\"Reviewed\"]"
        }
      },
      {
        "role": "Comment control",
        "stock": {
          "primitive": "button",
          "classes": [
            "rounded-md",
            "border",
            "border-transparent",
            "font-medium",
            "h-7",
            "gap-1",
            "px-2",
            "text-xs/relaxed"
          ]
        },
        "board": {
          "selector": "button[title^=\"Comment\" i]"
        },
        "app": {
          "selector": "[aria-label=\"Document controls\"] button[aria-label=\"Comment\"]"
        }
      },
      {
        "role": "Timeline control",
        "properties": ["padding", "radius", "gap", "height", "icon"],
        "stock": {
          "primitive": "button",
          "classes": [
            "rounded-md",
            "border",
            "border-transparent",
            "text-xs/relaxed",
            "font-medium",
            "size-7"
          ]
        },
        "board": {
          "selector": "button[title*=\"timeline\" i]"
        },
        "app": {
          "selector": "[aria-label=\"Document controls\"] button[aria-label=\"Timeline\"]"
        }
      },
      {
        "role": "review shortcut",
        "stock": {
          "primitive": "kbd",
          "classes": [
            "inline-flex",
            "h-5",
            "min-w-5",
            "gap-1",
            "rounded-xs",
            "px-1",
            "font-sans",
            "text-[0.625rem]",
            "font-medium",
            "text-muted-foreground"
          ]
        },
        "board": {
          "selector": "button[role=\"checkbox\"] > kbd"
        },
        "app": {
          "selector": "[aria-label=\"Document controls\"] button[aria-label=\"Reviewed\"] kbd"
        }
      }
    ]
  },
  "file-split": {
    "html": "Narrative-desktop-split.html",
    "include": ["pane bar Git", "review view switch"],
    "roles": [
      {
        "role": "pane bar",
        "board": {
          "selector": ":is(header, div):has(> [role=\"tablist\"][aria-label=\"Open documents, right pane\"])"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [data-pane-bar]"
        }
      },
      {
        "role": "Review tab",
        "board": {
          "selector": "[role=\"tablist\"][aria-label=\"Open documents, left pane\"] > [role=\"tab\"]:first-child"
        },
        "app": {
          "selector": "[aria-label=\"Left pane\"] [data-entry=\"handoff\"]"
        }
      },
      {
        "role": "review progress",
        "board": {
          "selector": "[role=\"tablist\"][aria-label=\"Open documents, left pane\"] > [role=\"tab\"]:first-child > span:last-child"
        },
        "app": {
          "selector": "[aria-label=\"Left pane\"] [data-entry=\"handoff\"] > span:last-child"
        }
      },
      {
        "role": "file tab",
        "board": {
          "selector": "[role=\"tablist\"][aria-label=\"Open documents, right pane\"] [role=\"tab\"][aria-selected=\"true\"]"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [role=\"tab\"][data-entry^=\"review-file:\"][aria-selected=\"true\"]"
        }
      },
      {
        "role": "close file tab",
        "board": {
          "selector": "section[aria-label^=\"Right pane:\"] button[aria-label^=\"Close \"]"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [role=\"tab\"][data-entry^=\"review-file:\"] button[aria-label^=\"Close \"]"
        }
      },
      {
        "role": "review context banner",
        "board": {
          "selector": "div:has(> a.nv-h.nv-f):has(> svg)"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [data-review-file-banner]"
        }
      },
      {
        "role": "review context caption",
        "board": {
          "selector": "div:has(> a.nv-h.nv-f):has(> svg) > span"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [data-review-file-banner] > [data-truncated]"
        }
      },
      {
        "role": "back to walkthrough",
        "board": {
          "selector": "div:has(> a.nv-h.nv-f):has(> svg) > a"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [data-review-file-banner] > button"
        }
      },
      {
        "role": "file header",
        "board": {
          "selector": "div:has(> nav[aria-label=\"Path\"])"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [data-file-heading]"
        }
      },
      {
        "role": "breadcrumb",
        "board": {
          "selector": "nav[aria-label=\"Path\"]"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [data-file-heading] h1"
        }
      },
      {
        "role": "filename",
        "board": {
          "selector": "nav[aria-label=\"Path\"] > span:last-child"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [data-file-heading] h1 > span:last-child"
        }
      },
      {
        "role": "file status",
        "board": {
          "selector": "nav[aria-label=\"Path\"] + span"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [data-file-heading] > span"
        }
      },
      {
        "role": "deletions",
        "board": {
          "selector": "div:has(> nav[aria-label=\"Path\"]) > span:last-child > span:first-child"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [data-file-heading] [aria-label$=\" additions\"] > span:first-child"
        }
      },
      {
        "role": "additions",
        "board": {
          "selector": "div:has(> nav[aria-label=\"Path\"]) > span:last-child > span:last-child"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [data-file-heading] [aria-label$=\" additions\"] > span:last-child"
        }
      },
      {
        "role": "comment marker",
        "board": {
          "selector": "section[aria-label^=\"Right pane:\"] button[aria-label^=\"Comment thread on line\"]"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [data-file-thread-marker]"
        }
      },
      {
        "role": "Reviewed control",
        "stock": {
          "primitive": "button",
          "classes": [
            "rounded-md",
            "border",
            "font-medium",
            "border-border",
            "h-7",
            "gap-1",
            "px-2",
            "text-xs/relaxed"
          ]
        },
        "board": {
          "selector": "section[aria-label^=\"Right pane:\"] button[role=\"checkbox\"]"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [aria-label=\"Document controls\"] button[aria-label=\"Reviewed\"]"
        }
      },
      {
        "role": "Comment control",
        "stock": {
          "primitive": "button",
          "classes": [
            "rounded-md",
            "border",
            "border-transparent",
            "font-medium",
            "h-7",
            "gap-1",
            "px-2",
            "text-xs/relaxed"
          ]
        },
        "board": {
          "selector": "section[aria-label^=\"Right pane:\"] button[title^=\"Comment\" i]"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [aria-label=\"Document controls\"] button[aria-label=\"Comment\"]"
        }
      },
      {
        "role": "Timeline control",
        "properties": ["padding", "radius", "gap", "height", "icon"],
        "stock": {
          "primitive": "button",
          "classes": [
            "rounded-md",
            "border",
            "border-transparent",
            "text-xs/relaxed",
            "font-medium",
            "size-7"
          ]
        },
        "board": {
          "selector": "button[title*=\"timeline\" i]"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [aria-label=\"Document controls\"] button[aria-label=\"Timeline\"]"
        }
      },
      {
        "role": "review shortcut",
        "stock": {
          "primitive": "kbd",
          "classes": [
            "inline-flex",
            "h-5",
            "min-w-5",
            "gap-1",
            "rounded-xs",
            "px-1",
            "font-sans",
            "text-[0.625rem]",
            "font-medium",
            "text-muted-foreground"
          ]
        },
        "board": {
          "selector": "section[aria-label^=\"Right pane:\"] button[role=\"checkbox\"] > kbd"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [aria-label=\"Document controls\"] button[aria-label=\"Reviewed\"] kbd"
        }
      }
    ]
  }
}
```
