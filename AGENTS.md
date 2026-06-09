<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

<!-- fallow:setup-hooks:start -->
## Fallow local gate

Before any `git commit` or `git push`, run `fallow audit --format json --quiet --explain`. If the verdict is `fail`, fix the reported findings before retrying. Treat JSON runtime errors like `{ "error": true, ... }` as non-blocking.

Audit defaults to `gate=new-only`: only findings introduced by the current changeset affect the verdict. Inherited findings on touched files are reported under `attribution` and annotated with `introduced: false`, but do not block the commit. Set `[audit] gate = "all"` in `fallow.toml` to gate every finding in changed files.
<!-- fallow:setup-hooks:end -->

---

## Issue tracking — Linear

We use **Linear** as our issue tracker. Use the Linear MCP server (`linear-server`) for all issue work — do not invent a different tracker or store issues in the repo.

- **Find the work**: look up issues by their identifier (e.g. `FAM-123`) when the user references one, or search/list issues to find what to do next.
- **Before starting**: read the full issue (description, comments, acceptance criteria) and move it to *In Progress*.
- **While working**: reference the issue identifier in branch names and commit messages (e.g. `FAM-123: ...`) so changes link back to Linear.
- **Opening a PR**: title it `<ISSUE_KEY> - <ISSUE_TITLE>` (e.g. `FAM-123 - Add Docker container`). This is what the release-notes → Linear automation reads to move issues to *Done* on release, so the key must be in the title.
- **When done**: leave a brief comment summarizing what changed and move the issue to the appropriate state (*In Review* on opening a PR, *Done* when merged).
- **New work surfaced mid-task** (a bug, follow-up, or scope you won't finish now): create a Linear issue for it rather than leaving it untracked.

If the Linear MCP isn't connected, ask the user to enable/authenticate it rather than falling back to another system.

---

## Component tagging convention

Every React component tags its **root rendered element** with a `data-component` attribute whose value is the component's **function name** (PascalCase). This makes components easy to locate in the DOM/devtools when applying design changes.

```tsx
function ChannelLink({ channel }: { channel: SidebarChannel }) {
    return <Link data-component="ChannelLink" href={`/channels/${channel.id}`}>…</Link>;
}
```

Rules:

- The value is the **component (function) name**, not the file name — e.g. the `ChannelLink` sub-component in `channel-list.tsx` uses `data-component="ChannelLink"`.
- This applies to **every component**, including sub-components defined within a file — not just the file's main export.
- Place it on the **outermost host element** the component renders (e.g. the root `<div>`, `<Link>`, `<form>`, `<button>`). Put it directly on a host element, not on a custom React component (whose own root element is tagged with its own name).
- If the component's root is a **Fragment** (`<>…</>`) or it only renders children / another component with no host element of its own, there's nothing to tag — skip it.
- **New components must include this from the start.**
