# Moving to Buzz Foundation (1.0.5-1)

We're upgrading from the old Buzz to **Buzz Foundation 1.0.5-1**. Your account is a
key, not a password — so the only thing that matters in this move is carrying that
key across. Pick the situation that's you.

> **In one line:** Upgrading on the **same computer**? The new app offers to keep
> your old identity in one click. On a **different computer**? Copy your key out of
> old Buzz first, then paste it into the new one.

Your identity is your `npub` (public name) backed by a secret key, your `nsec`.
Keep the same key and you keep the same account — same npub, same contacts, same
history. Make a new one and you're a stranger to everyone.

> Install **1.0.5-1 directly over old Buzz.** You do **not** need to install
> Block's upstream 1.0 first — our build already carries the "keep your identity"
> step, and routing through upstream exposes you to its auto-updater. One install.

## Route 1 — Same computer as before

*You already have the old Buzz installed on this machine.*

1. Install Buzz Foundation and open it. It installs **alongside** the old Buzz —
   the old one isn't removed.
2. On the first screen it asks: **"Continue with your Buzz identity?"** Choose
   **Continue**.
3. That's it — you're in with the **same npub** you've always had. Nothing to copy,
   nothing to paste.

> **Don't pick "Create account" or "Sign in with Builderlab" here.** Those start a
> brand-new identity with a different npub, and your contacts won't recognise you.

## Route 2 — New or different computer

*You're setting up Buzz on a machine that never had the old one.*

1. **On your old machine**, open the old Buzz and export your secret key (`nsec`)
   from its identity / settings screen. Copy it somewhere safe for a moment.
2. **On the new machine**, install Buzz Foundation and open it.
3. On the first screen choose **"Use an existing key"** and paste your `nsec`.
4. You're in with the **same npub**. Delete the pasted key from wherever you parked
   it.

> Your `nsec` is the whole account. Treat it like a password: send it to no one, and
> don't leave it sitting in a chat or a note.

## Good to know

| | |
|---|---|
| **Same npub** | Both routes keep your existing identity. People you talk to see no change. |
| **Installs beside the old app** | Buzz Foundation and the old Buzz are separate apps. The old one stays until you remove it yourself. |
| **Already on upstream 1.0.5?** | Our build shares the same app identifier, so it installs in place and your identity is already there — nothing to migrate. |
| **No key backup in this build** | This version does not back your key up to any server. If you lose your `nsec` and have no device still signed in, the account can't be recovered — keep a copy of your `nsec` somewhere safe. |
| **If something looks off** | If the first screen doesn't offer to continue your identity, stop before creating a new account and flag it — don't start fresh by accident. The manual `nsec` route (Route 2) always works as a fallback. |

## Before the wider rollout — 2 things to confirm in a pilot

- The exact wording of the **export key** step in the old Buzz (Route 2, step 1) —
  match the instructions to what users actually see.
- That the **"Continue with your Buzz identity?"** prompt reliably appears on
  Windows after a direct upgrade on a machine that has only old 0.5.x Buzz. If it
  doesn't fire, users fall back to the manual `nsec` route and still land on the
  same account.

---

A shareable, formatted version of this guide is published as an internal page for
org members.
