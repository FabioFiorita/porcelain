# Porcelain

Porcelain is where you read what your coding agents wrote.

A diff does not tell you what changed. The agent that wrote it can. In Porcelain, it walks you through each decision, and you comment back before you keep the change.

[Website](https://porcelain.fabiofiorita.com) · [Download](https://github.com/FabioFiorita/porcelain/releases) · [npm](https://www.npmjs.com/package/@fabiofiorita/porcelain)

## "Wait, isn't this just another editor?"

No. Agents write, run and test most of my code now, and my job became reading it. Editors are built for typing: autocomplete, extensions, plugins I no longer use. A diff sorted by file name buries the one change that matters under fifty that don't.

I started building my own agent harness and then watched T3 Code do it better than I could. So Porcelain does not run your agent. It sits beside the one you already use, in the terminal, the desktop app or the editor, and gives you a place to read its work in order and answer it.

It is free, open source and has no account, and Porcelain never sends your code anywhere.

## What it does

- **A walkthrough of every decision.** The agent publishes a briefing and one stop per decision, with numbered notes that lead you through the diff.
- **Nothing hides.** Changes the agent did not explain get their own stop, and reviewed marks keep count of what is left.
- **Comment back.** Ask on a file or a line. Porcelain answers questions on the Walkthrough.
- **Proof.** The checks it ran and the screenshots it took live in the review, and Porcelain says when the code changed after them.
- **Made for big repositories.** Pin the files you read, hide the ones you never open, and browse History as a commit graph, with commit, pull and push in the same place.
- **Every machine, one place.** Run a server where each repository lives and reach all of them from one Porcelain.

## Install

**Mac app.** Download it from [GitHub Releases](https://github.com/FabioFiorita/porcelain/releases). It runs on Apple silicon.

**Server and browser.** On the Linux or Mac machine that holds your repositories, with Git and Node 24 (24.20+) or Node 26 (26.13+). Official Node 26 binaries on Linux also need the distribution’s `libatomic` runtime:

```sh
npx @fabiofiorita/porcelain@latest serve
```

Open the address it prints. The page shows the command that pairs this browser; run it on the same machine and open the link it prints. Then choose **Open project** and pick a repository.

On Linux, keep it running as a user service:

```sh
npx @fabiofiorita/porcelain@latest service install
```

**iPhone and iPad.** Coming soon.

`npx @fabiofiorita/porcelain@latest --help` lists every command, and the [npm readme](https://www.npmjs.com/package/@fabiofiorita/porcelain?activeTab=readme) covers sharing on your network, updates and recovery.

## Walkthroughs

Choose **Write walkthrough** on a diff. Porcelain's own read-only agent explains the work and answers questions on the Walkthrough. The coding agent keeps working in its own app.

## Privacy

Porcelain has no account and no analytics, and it never sends your code anywhere. If you turn on phone notifications, your computer sends a short notice (the project name and a line from the review or the agent's reply) through Expo's push service to your phone. The [privacy page](https://porcelain.fabiofiorita.com/privacy) has the details, and the source is right here.

## Contributing

Bug reports and ideas are welcome in [issues](https://github.com/FabioFiorita/porcelain/issues). Before you open a pull request, read [CONTRIBUTING.md](CONTRIBUTING.md): it covers the architecture, developing from source, and how changes are verified.

## License and thanks

Porcelain is released under the [MIT license](LICENSE). Thank you to:

- [T3 Code](https://github.com/pingdotgg/t3code), the main reference. It is an agent harness rather than a companion, and it met many of the same problems on the same stack first, remote environments especially.
- [Pierre](https://pierre.computer), which renders the code, the diffs and the file tree.
- [shadcn/ui](https://ui.shadcn.com), which the web components come from.
