# Files

Lists every file and link shared in a channel, with each file's newer versions grouped over the older ones.

## Getting started

1. When you attach a file, Buzz suggests the earlier file it replaces, picked by its name. Choose **Not a new version** to send it on its own.
2. Under a message, a newer file shows **Supersedes N earlier versions**; an older one shows **Outdated: view latest**, which goes to the newest version.
3. Open a channel's menu and choose **View files** to see one row per file, newest first. Choose a row to go to its message.

---

A version link is part of the message and can't be edited: delete the message to remove it. Links are versioned too: a message with exactly one link and no file can replace an earlier file or link. Files in thread replies are listed. Forwarded copies are not.

The link is the `supersedes` tag 0.X builds write, `["e", "<older message id>", "", "supersedes"]`, extended with the new and the older file's URLs so a message with several files keeps a link for each. Messages from 0.X read the same way.
