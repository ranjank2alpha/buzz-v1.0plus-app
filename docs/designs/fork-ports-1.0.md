# Design: fork ports to Buzz 1.0

Approved 20 Nov 2026 (Ranjan Kant). Fork: `ranjank2alpha/buzz-v1.0plus-app`, first build `1.0.5-1` on upstream `v1.0.5` (`f315ef5`).

## Summary

The 1.0 fork carries two 0.X features: file versioning and `@channel`/`@here`. Everything else follows upstream. Dropped: Google Drive routing, Google sign-in and Meet (19 Nov 2026); pinned messages and Word, Excel and PowerPoint preview (20 Nov 2026), left to upstream and its plugins. Existing 0.X pins are not shown in 1.0 until upstream adds pins.

Compatibility rule: each port writes the tags 0.X writes and reads everything 0.X wrote, so version chains and `@channel` messages already on the relay keep working after the move.

Fork code lives in one bundled plugin, `src/bundled/files/`, and one core folder, `src/features/fork/`. Edits to upstream files are listed under Risks; each is a few lines that call a helper in the fork folder.

## 1. File versioning

- **Set at send, never edited.** For each attachment, the composer offers the likely earlier version, using fuzzy filename matching over the last 62 days, and pre-selects nothing when two candidates tie. A wrong link is undone by deleting the message.
- **Every file keeps its own link.** The tag is `["e", "<older message id>", "", "supersedes", "<new file url>", "<older file url>"]`. 0.X reads only the first four elements and applies the link to the message's first file; a tag without the URLs is read the same way here.
- **Derived, never stored.** Chains are recomputed from the channel's file list.
- **Label under the message.** The newest version shows "Supersedes N earlier versions". Older ones show "Outdated: view latest", which goes to the head of the chain. Deleting a middle version splits the chain in two.
- **Odd graphs are tolerated.** Cycles, forks, self-reference and missing parents raise no errors.
- **Links are file entries.** Any http(s) URL in a channel message appears in the Files panel and can join a chain, unless it is an attachment's own URL. A `supersedes` tag applies to a link only when its message has exactly one link and no attachment.
- **Files panel.** Channel menu → View files. One row per chain, newest first, older versions collapsed. Thread replies count; forwarded and sent-to-channel copies do not.
- **Old link messages.** Builds before `0.5.14-1` linked versions with an empty message. Their links are still read; the message shows as a one-line caption.

The loader (`src/features/fork/file-versions/store.ts`) pages the channel's history with `session.readPage` (500 events a page), only while a file, the picker or the panel is on screen, and caches per channel. Edits and deletions follow 1.0's `foldMessages`; the relay's kind 40099 tombstones cover older deletions.

## 2. @channel and @here

One marker tag, `["mention-scope", "channel" | "here"]`, resolved against the channel's current members. Unrelated to 1.0's `["broadcast", "1"]` tag.

- **Detected from the text at send**, after removing code spans, fenced code, quoted lines and URLs. The word must stand alone: `@channel-ops` pages nobody.
- **`@channel`** is a mention for every member but its author: high priority, in Activity → Mentions, and it passes a mute (1.0 already lets explicit mentions through).
- **`@here`** alerts members whose presence is online when it arrives (1.0 notifies only for messages under two minutes old). It never passes a mute, is not a mention and does not build up as unread.
- No permission gate and no autocomplete entries. Edits do not re-scope. Forwards never carry the tag.

## Risks and tests

| Upstream file | Edit |
| --- | --- |
| `src/features/relay/attachments.ts` | `supersedes` tag from the attachment |
| `src/features/messages/attachment-draft.ts`, `ComposerAttachments.tsx`, `MessageComposer.tsx` | Version choice and picker; `MessageComposer` only passes props |
| `src/bundled/index.ts` | Files plugin entry |
| `src/features/relay/messages.ts` | Scope tag in `send` and `reply`; forwards drop `supersedes` |
| `src/features/relay/unread.ts` | `@channel` in `mentionsViewer`; `here` flag on attention |
| `src/features/notifications/messages.ts` | `@here` rule |
| `src/features/relay/unread.test.ts` | Appended scope tests |
| `scripts/candidate-version.mjs`, `src-tauri/tauri.conf.json` | `-N` version suffix; `1.0.5-1` |

- Mutes set in 0.X don't carry over (browser storage vs 1.0's encrypted preference). Users re-mute after moving.
- The plugin APIs are a preview; plugin code stays thin.
- Paging a long channel is measured on the busiest channel before reconsidering 0.X's SQLite index.
- First build check: a v2 file keeps its label after reload, and an `@channel` reaches a colleague. Both prove the relay kept the tags.
