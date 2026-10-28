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

Start a clean instance. Use `--review-sample` for review boards and `--desktop` for Settings. Pass the concrete route and query parameters that select the screen. Use `?surface=changes` for the Review panel, `?surface=history` for History and `?entry=commit:<full oid>` for a commit. PR states require a fixture exposing the corresponding state; the command never seeds or fabricates PR data. The sidebar's phone capture opens the navigator.

Defaults: `--width 1440,414 --theme light,dark`. Override with `--width 1440` or `--theme light`. The evidence directory holds board/app screenshots per width/theme, a pasteable `index.md` and numbered JSON. A nonzero exit retains the same evidence. Paste the table into the PR body and fix mismatches before handoff.

Each role below names explicit board and app CSS selectors. `index` deliberately samples a repeated role; without it exactly one element must match. Select by semantic role, accessible name or structure, never fixture text. Extend maps when adding screens, including icons and controls. Every listed role is required at every requested width; hidden roles fail.

## Gotchas

- This compares mapped styles. Unmapped elements, icon identity and icon artwork still need visual review. Text may differ.
- Lengths tolerate 0.5 px, RGB/alpha channels one step; weight and icon presence are exact. Colours resolve to hex including alpha. Padding and radius report four sides/corners; gap reports row and column.
- A dedicated dark HTML sibling wins. Otherwise the layout receives the approved `Narrative-desktop-dark.html` custom properties. A missing dark palette fails.
- A desktop board remains a desktop layout at 414. Differences from responsive app layouts are reported. Add a phone map when its layout is approved.
- Not-found/unavailable screens, redirects, failed documents and browser errors fail. Recovery uses a fresh context on rerun. All contexts close on failure as well as success.
- Settings paths: `/settings/general`, `/settings/git`, `/settings/computers`, `/settings/computers/this-computer`.

## Board names

| Name                          | Approved HTML                    | App setup                                           |
| ----------------------------- | -------------------------------- | --------------------------------------------------- |
| sidebar                       | Narrative-desktop                | Open the selected review; phone opens the navigator |
| review-page                   | Narrative-desktop-briefing       | Review briefing                                     |
| review-decision               | Narrative-desktop                | Review with `?decision=<layerId>`                   |
| review-panel                  | Narrative-desktop-review-panel   | Worktree with `?surface=changes`                    |
| changes                       | Narrative-desktop-no-review      | Worktree without a published review                 |
| settings-general              | Narrative-settings-general       | `/settings/general`                                 |
| settings-git                  | Narrative-settings-reviews-git   | `/settings/git`                                     |
| settings-computers            | Narrative-settings-computers     | `/settings/computers`                               |
| settings-this-computer        | Narrative-settings-this-computer | `/settings/computers/this-computer`                 |
| commit                        | Narrative-desktop-history        | Worktree with `?entry=commit:<oid>`                 |
| history                       | Narrative-desktop-history        | Worktree with `?surface=history`                    |
| graph                         | Narrative-desktop-graph          | Worktree with `?entry=graph`                        |
| pr-linked                     | Narrative-desktop-pr-linked      | Linked PR in the Review panel                       |
| pr-viewer                     | Narrative-desktop-pr-viewer      | PR document; absent roles fail until implemented    |
| pr-state-1 through pr-state-8 | Narrative-pr-states              | The numbered PR state in the Review panel           |

Names without `.html` are also accepted for the first mapped screen using that HTML. Use the short name when the same board covers more than one screen (sidebar/decision, commit/history).

## Role maps

```json board-maps
{
  "sidebar": {
    "html": "Narrative-desktop.html",
    "dark": "Narrative-desktop-dark.html",
    "phoneOpen": "[aria-label=\"Toggle Sidebar\"]:visible",
    "roles": [
      {
        "role": "brand title",
        "board": {
          "selector": "aside[aria-label=\"Worktrees\"] > div:first-child > span"
        },
        "app": {
          "selector": ".desktop-sidebar-header > div:first-of-type [data-truncated]"
        }
      },
      {
        "role": "brand icon",
        "board": {
          "selector": "aside[aria-label=\"Worktrees\"] > div:first-child > svg"
        },
        "app": {
          "selector": ".desktop-sidebar-header > svg"
        }
      },
      {
        "role": "project filter",
        "board": {
          "selector": "aside[aria-label=\"Worktrees\"] > button[aria-haspopup=\"menu\"]"
        },
        "app": {
          "selector": "[aria-label=\"Filter reviews\"]"
        }
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
        }
      },
      {
        "role": "review title",
        "board": {
          "selector": "nav[aria-label=\"Worktrees by status\"] a > span:nth-child(2)",
          "index": 0
        },
        "app": {
          "selector": "[data-slot=\"sidebar-menu-button\"] .text-ui",
          "index": 0
        }
      },
      {
        "role": "review subtitle",
        "board": {
          "selector": "nav[aria-label=\"Worktrees by status\"] a > span:last-child",
          "index": 0
        },
        "app": {
          "selector": "[data-slot=\"sidebar-menu-button\"] .leading-4",
          "index": 0
        }
      },
      {
        "role": "review progress",
        "board": {
          "selector": "nav[aria-label=\"Worktrees by status\"] a > span:nth-child(3)",
          "index": 0
        },
        "app": {
          "selector": "[data-slot=\"sidebar-menu-button\"] [aria-label$=\"decisions reviewed\"]",
          "index": 0
        }
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
        }
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
        }
      },
      {
        "role": "section heading",
        "board": {
          "selector": "main h2",
          "index": 0
        },
        "app": {
          "selector": "[aria-label=\"Briefing\"] h3",
          "index": 0
        }
      },
      {
        "role": "eyebrow",
        "board": {
          "selector": "main article > div:first-child"
        },
        "app": {
          "selector": "[aria-label=\"Briefing\"] header > p:first-child"
        }
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
        }
      },
      {
        "role": "continue button",
        "board": {
          "selector": "main article > div > button[title^=\"Open decision\"]"
        },
        "app": {
          "selector": "[aria-label=\"Briefing\"] header button:has(svg.lucide-arrow-right)"
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
        }
      },
      {
        "role": "route",
        "board": {
          "selector": "section[aria-label=\"Route and stops\"]"
        },
        "app": {
          "selector": "section[aria-label=\"Route through the system\"]"
        }
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
        }
      },
      {
        "role": "previous decision",
        "board": {
          "selector": "[aria-label=\"Previous decision\"]"
        },
        "app": {
          "selector": "[aria-label=\"Previous decision\"]"
        }
      },
      {
        "role": "next decision",
        "board": {
          "selector": "[aria-label=\"Next decision\"]"
        },
        "app": {
          "selector": "[aria-label=\"Next decision\"]"
        }
      },
      {
        "role": "reviewed checkbox",
        "board": {
          "selector": "[aria-label=\"File reviewed\"]"
        },
        "app": {
          "selector": "[aria-label=\"Mark file reviewed\"]"
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
        }
      },
      {
        "role": "comparison switch",
        "board": {
          "selector": "[aria-label=\"Compare\"] [role=\"tab\"]",
          "index": 0
        },
        "app": {
          "selector": "aside[aria-label=\"Review sidebar\"] [role=\"tablist\"] [role=\"tab\"]",
          "index": 0
        }
      },
      {
        "role": "readiness heading",
        "board": {
          "selector": "section[aria-label=\"Readiness\"] h3"
        },
        "app": {
          "selector": "aside[aria-label=\"Review sidebar\"] [aria-label=\"Readiness\"] [data-slot=\"collapsible-trigger\"] > span:first-child"
        }
      },
      {
        "role": "decision row",
        "board": {
          "selector": "ol[aria-label=\"Decisions\"] > li",
          "index": 0
        },
        "app": {
          "selector": "aside[aria-label=\"Review sidebar\"] [aria-label=\"Decisions\"] > li",
          "index": 0
        }
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
        }
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
        }
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
        }
      },
      {
        "role": "breadcrumb",
        "board": {
          "selector": "nav[aria-label=\"Breadcrumb\"]"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] nav[aria-label=\"breadcrumb\"]"
        }
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
        }
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
        }
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
        }
      },
      {
        "role": "breadcrumb",
        "board": {
          "selector": "nav[aria-label=\"Breadcrumb\"]"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] nav[aria-label=\"breadcrumb\"]"
        }
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
        }
      },
      {
        "role": "breadcrumb",
        "board": {
          "selector": "nav[aria-label=\"Breadcrumb\"]"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] nav[aria-label=\"breadcrumb\"]"
        }
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
        }
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
        }
      },
      {
        "role": "breadcrumb",
        "board": {
          "selector": "nav[aria-label=\"Breadcrumb\"]"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] nav[aria-label=\"breadcrumb\"]"
        }
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
        }
      },
      {
        "role": "device row",
        "board": {
          "selector": "[aria-label=\"Paired devices\"] > li:first-child"
        },
        "app": {
          "selector": "main[aria-label=\"Settings\"] [aria-label=\"Paired devices\"] [data-slot=\"item\"]",
          "index": 0
        }
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
        }
      },
      {
        "role": "copy hash",
        "board": {
          "selector": "main button[title=\"Copy the full commit hash\"]"
        },
        "app": {
          "selector": "[aria-label=\"Copy hash\"]"
        }
      },
      {
        "role": "open in graph",
        "board": {
          "selector": "main button[title=\"Open the history graph at this commit\"]"
        },
        "app": {
          "selector": "[aria-label=\"Open in graph\"]"
        }
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
        }
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
        }
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
        }
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
        }
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
        }
      },
      {
        "role": "HEAD ref",
        "board": {
          "selector": "ol[aria-label=\"Commit graph\"] [title^=\"HEAD:\"]"
        },
        "app": {
          "selector": "[aria-label=\"Commit graph\"] li:first-child [data-slot=\"badge\"]",
          "index": 0
        }
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
        }
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        }
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
        }
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 1:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        }
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
        }
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 2:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        }
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
        }
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 3:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        }
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
        }
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 4:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        }
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
        }
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 5:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        }
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
        }
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 6:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        }
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
        }
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 7:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        }
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
        }
      },
      {
        "role": "PR block heading",
        "board": {
          "selector": "[aria-label^=\"State 8:\"] section[aria-label=\"Pull request\"] h3"
        },
        "app": {
          "selector": "section[aria-label=\"Pull request\"] > div:first-child > span"
        }
      }
    ]
  }
}
```
