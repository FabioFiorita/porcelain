# Excalidraw — Intent freeform only

Use Excalidraw when the **idea** needs a spatial board: architecture map, box-and-arrow data flow, system shape at a glance.

## Where it belongs

| Surface | Excalidraw? |
|---------|-------------|
| **Intent** freeform (`review set-canvas`) | Yes |
| **Evidence** | **No** — HTML only |

## How to publish

Agents should **not** hand-author Excalidraw JSON. Export a `.excalidraw` file from the Excalidraw app (or generate with a tool), then:

```bash
~/.porcelain/porcelain review set-canvas --medium excalidraw --file ./board.excalidraw
```

HTML freeform Intent:

```bash
~/.porcelain/porcelain review set-canvas --medium html --html-file ./intent.html
```

Clear freeform (back to structured Intent document):

```bash
~/.porcelain/porcelain review clear-canvas
```

The outline still uses thesis / sections / files for Execution and chapter jumps. Canvas replaces only the Intent body when set.

## When not to use it

- Pass/fail reports, screenshots, metrics → **Evidence** HTML
- Multi-step code walkthrough → **Intent** structured sections + **Execution** files
- Anything the human will treat as "proof it works" → Evidence HTML, not a board
