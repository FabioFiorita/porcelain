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

Each role below names explicit board and app CSS selectors. `index` deliberately samples a repeated role; without it exactly one element must match. Select by semantic role, accessible name or structure, never fixture text. Extend maps when adding screens, including icons and controls. Every applicable role is required; hidden roles still fail. `minWidth` declares desktop-only content such as labels replaced by icons on a phone. `properties` names what a role actually renders: text roles compare typography, not a height determined by fixture wording; icon-only controls do not compare invisible inherited font styles. Omitted `properties` compares every property. `reveal` actions name a visible target and its trigger, so an already open panel is never toggled closed.

## Gotchas

- This compares mapped styles. Unmapped elements, icon identity and icon artwork still need visual review. Text may differ.
- Lengths tolerate 0.5 px, RGB/alpha channels one step; weight and icon presence are exact. Colours resolve to hex including alpha. Padding and radius report four sides/corners; radius values follow the CSS overlap reduction against the rendered box, so equivalent full-round declarations compare equally. Gap reports the axes that can separate children; a nowrap flex row has no used row gap, and a nowrap flex column has no used column gap.
- A dedicated dark HTML sibling wins. Otherwise the layout receives the approved `Narrative-desktop-dark.html` custom properties. A missing dark palette fails.
- Device rows compare padding, radius and icons; their height and wrapping gaps depend on device metadata and responsive reflow. Check wrapping visually in the sweep.
- Desktop reference boards are rendered at their native 1440px width for every app viewport. A 414px app capture compares the same visible roles without squeezing the fixed desktop reference until its content disappears. Responsive layout and wrapping still need visual review.
- Not-found/unavailable screens, redirects, failed documents and browser errors fail. Recovery uses a fresh context on rerun. All contexts close on failure as well as success.
- Settings paths: `/settings/general`, `/settings/git`, `/settings/computers`, `/settings/computers/this-computer`.

## Board names

| Name                          | Approved HTML                    | App setup                                            |
| ----------------------------- | -------------------------------- | ---------------------------------------------------- |
| sidebar                       | Narrative-desktop                | Open the selected review; phone opens the navigator  |
| review-page                   | Narrative-desktop-briefing       | Review briefing                                      |
| review-decision               | Narrative-desktop                | Review with `?decision=<layerId>`                    |
| review-panel                  | Narrative-desktop-review-panel   | Active decision route with the Review panel                     |
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
        "role": "walkthrough control",
        "board": {
          "selector": "[aria-label=\"Review view\"] [aria-selected=\"true\"]"
        },
        "app": {
          "selector": "[aria-label=\"Review presentation\"] [aria-label=\"Walkthrough\"]"
        }
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
  "review-panel": {
    "html": "Narrative-desktop-review-panel.html",
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
      },
      {
        "role": "GitHub account heading",
        "board": {
          "selector": "section[aria-labelledby=\"r-gh\"] h2"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] [data-slot=\"field-legend\"]",
          "index": 2
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
        "role": "GitHub account source",
        "board": {
          "selector": "section[aria-labelledby=\"r-gh\"] span:has(+ button[aria-haspopup=\"listbox\"])",
          "index": 0
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] [data-slot=\"item-actions\"] [data-slot=\"badge\"]",
          "index": 0
        }
      },
      {
        "role": "GitHub account picker",
        "board": {
          "selector": "section[aria-labelledby=\"r-gh\"] button[aria-haspopup=\"listbox\"]",
          "index": 0
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] [data-slot=\"select-trigger\"]",
          "index": 0
        }
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
          "selector": "section[aria-label=\"Pull request\"] h3"
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
        "role": "PR title",
        "board": {
          "selector": "section[aria-label=\"Pull request\"] > div:nth-child(2) > span:last-child"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:nth-child(2) > span:last-child"
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
        "role": "PR state",
        "board": {
          "selector": "section[aria-label=\"Pull request\"] > div:nth-child(3) > span:first-child"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:nth-child(3) > span:first-child"
        }
      },
      {
        "role": "GitHub checks",
        "board": {
          "selector": "section[aria-label=\"Pull request\"] > div:nth-child(3) > span:nth-child(2)"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:nth-child(3) > span:nth-child(2)"
        },
        "properties": [
          "fontSize",
          "lineHeight",
          "fontWeight",
          "letterSpacing",
          "colour",
          "gap",
          "icon"
        ]
      },
      {
        "role": "Open pull request",
        "board": {
          "selector": "section[aria-label=\"Pull request\"] > button"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > button"
        }
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
    "roles": [
      {
        "role": "PR title",
        "board": {
          "selector": "article h1"
        },
        "app": {
          "selector": "article[aria-label^=\"Pull request #\"] h1"
        }
      },
      {
        "role": "description",
        "board": {
          "selector": "section[aria-label=\"Description\"]"
        },
        "app": {
          "selector": "article[aria-label^=\"Pull request #\"] section[aria-label=\"Description\"]"
        }
      },
      {
        "role": "checks",
        "board": {
          "selector": "section[aria-label=\"Checks\"]"
        },
        "app": {
          "selector": "article[aria-label^=\"Pull request #\"] section[aria-label=\"GitHub checks\"]"
        }
      },
      {
        "role": "conversation",
        "board": {
          "selector": "section[aria-label=\"Conversation on GitHub\"]"
        },
        "app": {
          "selector": "article[aria-label^=\"Pull request #\"] section[aria-label=\"Conversation on GitHub\"]"
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
          "selector": "section[aria-label=\"Pull request\"] h3"
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
          "selector": "section[aria-label=\"Pull request\"] h3"
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
          "selector": "section[aria-label=\"Pull request\"] h3"
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
          "selector": "section[aria-label=\"Pull request\"] h3"
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
          "selector": "section[aria-label=\"Pull request\"] h3"
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
          "selector": "section[aria-label=\"Pull request\"] h3"
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
          "selector": "section[aria-label=\"Pull request\"] h3"
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
          "selector": "section[aria-label=\"Pull request\"] h3"
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
        "board": {
          "selector": "button[role=\"checkbox\"]"
        },
        "app": {
          "selector": "[aria-label=\"Document controls\"] button[aria-label=\"Reviewed\"]"
        }
      },
      {
        "role": "Comment control",
        "board": {
          "selector": "button[title^=\"Comment\" i]"
        },
        "app": {
          "selector": "[aria-label=\"Document controls\"] button[aria-label=\"Comment\"]"
        }
      },
      {
        "role": "Timeline control",
        "board": {
          "selector": "button[title*=\"timeline\" i]"
        },
        "app": {
          "selector": "[aria-label=\"Document controls\"] button[aria-label=\"Timeline\"]"
        }
      },
      {
        "role": "review shortcut",
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
        "board": {
          "selector": "section[aria-label^=\"Right pane:\"] button[role=\"checkbox\"]"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [aria-label=\"Document controls\"] button[aria-label=\"Reviewed\"]"
        }
      },
      {
        "role": "Comment control",
        "board": {
          "selector": "section[aria-label^=\"Right pane:\"] button[title^=\"Comment\" i]"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [aria-label=\"Document controls\"] button[aria-label=\"Comment\"]"
        }
      },
      {
        "role": "Timeline control",
        "board": {
          "selector": "button[title*=\"timeline\" i]"
        },
        "app": {
          "selector": "[aria-label=\"Right pane\"] [aria-label=\"Document controls\"] button[aria-label=\"Timeline\"]"
        }
      },
      {
        "role": "review shortcut",
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
