# Example: maintaining project documentation with Harness Wiki

This walks through a realistic flow: tracking features, keeping a pending list,
moving items pending → done, reopening them, and asking about a feature and the
options behind it. Everything below is plain conversation — you talk to the
agent in natural language, and it maintains the markdown for you.

## The convention (read this once)

Harness Wiki has no built-in "task" type. Feature tracking is a thin convention
on top of the normal pages:

- **One page per feature** in `wiki/concepts/`, with a `status:` field in the
  frontmatter: `pending` → `building` → `done` (and back to `pending` when
  reopened).
- **One roadmap board** at `wiki/syntheses/roadmap.md` that lists every feature
  grouped by status. This *is* your pending list — it's regenerated from the
  feature pages whenever a status changes.
- **The log** (`wiki/log.md`) records each transition, so you get an audit trail
  of when a feature moved and why.

Where the line sits: the wiki holds the durable *why* (the decision, the options
considered, the rationale). The actual in-flight coding task lives in the project
repo, tracked with [`harness-bridge`](https://github.com/codemeall/harness-bridge).
The wiki answers "what did we decide about feature X and why"; the bridge answers
"what am I in the middle of right now."

Assume a vault already exists, initialized and linked to the project:

```text
You: Use the Harness Wiki skill here. It's linked to ../orbit-app (the product repo).
```

---

## 1. Add a feature to the pending list

```text
You: Add a feature — "passwordless login". Goal: let users sign in with a
     magic link instead of a password. Status: pending. We haven't picked an
     approach yet.
```

The agent creates the feature page, adds it to the roadmap board, and logs it:

`wiki/concepts/passwordless-login.md`

```markdown
---
type: concept
status: pending
created: 2026-06-09
updated: 2026-06-09
tags: [feature, auth]
---

# Feature: Passwordless login

Let users sign in with a magic link instead of a password.

## Scope
- Email a one-time sign-in link; clicking it creates a session.

## Options considered
_(none yet — decision open)_

## Status
**pending** — approach not yet chosen.
```

`wiki/syntheses/roadmap.md` (the pending list)

```markdown
---
type: synthesis
updated: 2026-06-09
tags: [roadmap]
---

# Roadmap

## Pending
- [[concepts/passwordless-login]] — magic-link sign-in. Approach open.

## Building
_(none)_

## Done
_(none)_
```

`wiki/log.md` gains:

```text
## [2026-06-09] feature | passwordless-login → pending
- Created feature page; added to roadmap Pending.
```

> The agent updates the roadmap and log without asking — that's routine
> bookkeeping. It only pauses for confirmation on substantive content.

---

## 2. Flesh out a feature's options

```text
You: For passwordless login, we're weighing two approaches: a magic link in
     email vs. a 6-digit OTP code. Capture both with the tradeoffs.
```

The agent updates the feature page's **Options considered** section and bumps
`updated:`. Because this is a real comparison worth keeping, it offers to file a
dedicated synthesis:

```text
Agent: Updated concepts/passwordless-login with both options and tradeoffs.
       This is a reusable comparison — want me to file it as
       syntheses/passwordless-login-options.md so it doesn't get buried?
You: Yes.
```

`wiki/syntheses/passwordless-login-options.md`

```markdown
---
type: synthesis
created: 2026-06-09
updated: 2026-06-09
tags: [feature, auth, comparison]
---

# Passwordless login — options

For [[concepts/passwordless-login]].

| | Magic link (email) | OTP code (email/SMS) |
|---|---|---|
| Friction | One click | Type 6 digits |
| Works cross-device | Awkward (link opens on phone) | Yes |
| Phishing surface | Higher (clickable link) | Lower |
| Build cost | Low | Low–medium (SMS adds a vendor) |

## Leaning
Magic link for v1 (lowest friction); revisit OTP if cross-device complaints rise.
```

---

## 3. Check the pending list

```text
You: What's on the pending list?
```

This is a **query**. The agent reads `wiki/index.md`, then the roadmap, and
answers — it doesn't rewrite anything:

```text
Agent: Pending (1):
       • Passwordless login — magic-link sign-in. Leaning magic link for v1;
         OTP still on the table. See concepts/passwordless-login and
         syntheses/passwordless-login-options.
       Building: none. Done: none.
```

---

## 4. Move an item pending → done

```text
You: We shipped passwordless login with the magic-link approach. Mark it done.
```

The agent flips the status, records when, moves it on the board, and logs the
transition:

`wiki/concepts/passwordless-login.md` (frontmatter + status)

```markdown
---
type: concept
status: done
created: 2026-06-09
updated: 2026-06-12
tags: [feature, auth]
---
...
## Status
**done** (2026-06-12) — shipped with the magic-link approach
([[syntheses/passwordless-login-options]]). OTP deferred.
```

`wiki/syntheses/roadmap.md`

```markdown
## Pending
_(none)_

## Building
_(none)_

## Done
- [[concepts/passwordless-login]] — shipped 2026-06-12 (magic link).
```

`wiki/log.md`

```text
## [2026-06-12] feature | passwordless-login → done
- Shipped magic-link approach in ../orbit-app. OTP deferred.
```

> Because the vault is linked to `../orbit-app`, you can also say *"reflect this
> in the project repo"* and the agent updates the paired repo's notes, keeping
> the wiki (why) and the repo (what) in sync.

---

## 5. Reopen an item

```text
You: Reopen passwordless login — magic links can be reused within the expiry
     window, which is a security bug. Needs rework.
```

The agent moves it back, records *why* it reopened (so the history is intact),
and logs it. It does not erase the "done" history — it appends:

`wiki/concepts/passwordless-login.md`

```markdown
---
status: building
updated: 2026-06-14
---
...
## Status
**building** (reopened 2026-06-14) — magic links are reusable within the expiry
window (security bug). Reworking to single-use tokens.

## Contradictions
- Marked done 2026-06-12, reopened 2026-06-14 — the "shipped" state did not
  account for single-use enforcement.
```

`wiki/syntheses/roadmap.md`

```markdown
## Building
- [[concepts/passwordless-login]] — reopened 2026-06-14: single-use token fix.

## Done
_(none)_
```

`wiki/log.md`

```text
## [2026-06-14] feature | passwordless-login → building (reopened)
- Reopened: magic links reusable within expiry window. Reworking to single-use.
```

---

## 6. Ask about a feature and its options

```text
You: Remind me about passwordless login — what options did we consider and
     where did we land?
```

A **query**. The agent reads the feature page, follows its `[[wikilinks]]` into
the options synthesis, and answers with citations — no file changes:

```text
Agent: Passwordless login (currently *building*, reopened 2026-06-14).

       Options we weighed (syntheses/passwordless-login-options):
       • Magic link (email) — one-click, low build cost, but awkward
         cross-device and a higher phishing surface.
       • OTP code (email/SMS) — works cross-device and lower phishing risk,
         but more friction and an SMS vendor dependency.

       Where we landed: shipped magic link for v1 (2026-06-12), then reopened
       on 2026-06-14 because links were reusable within the expiry window —
       now reworking to single-use tokens. OTP remains the fallback if
       cross-device complaints rise.

       Sources: concepts/passwordless-login, syntheses/passwordless-login-options,
       and the 2026-06-12 / 2026-06-14 log entries.
```

---

## Keeping it healthy

Periodically:

```text
You: lint
```

The agent runs `vault_doctor` first (dead links, orphan pages, **stale** feature
pages whose source changed, broken project links) and then flags judgment calls
— e.g. a feature stuck in `building` for weeks, or a `done` feature whose
synthesis was never updated. That keeps the roadmap trustworthy as the project
grows.
