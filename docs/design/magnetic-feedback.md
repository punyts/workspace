# Magnetic: feedback from the editor

Status: built. Asked for on 2026-11-16: "a bug icon at the top of the editor for users to record bugs, comments and
feature requests."

## What a person sees
- A bug icon at the top right of the editor, before the appearance button and Share ("Report a bug or send
  feedback").
- It opens a sheet under it, as the appearance sheet does: what it is (a bug, a comment, a feature request), a box to
  write in, a line saying where it goes and what goes with it, and **Send feedback**.
- Sent, the sheet says thank you and the box empties. Empty, it says to write something first. One sheet at a time:
  opening it closes Share and the appearance sheet.

## Decisions
- **Kept in the database, `feedback`** (migration 0009): the person, the kind, the text (up to 4000 characters), the
  workspace, the app and its name, what the editor showed (the frame size and the language), the browser, and when.
  It goes with the person's account (`ON DELETE CASCADE`).
- **Emailed to whoever runs the server**: the privacy contact (`MAGNETIC_CONTACT_EMAIL`), through the mailer that
  sends invites (SES), with the sender's address as Reply-To. Without a mailer or a contact, it is only kept. A failed
  email is logged; the feedback is still kept.
- **Read with `magnetic feedback`**, which prints the latest hundred, oldest first. No page for it yet.
- **Twenty an hour per person**, so the button cannot be used to flood the operator's inbox.
- Only people who may edit the app see the editor, so only they can send. Visitors to a shared app have no button.

## As built
- `magnetic/src/feedback/Feedback.ts`: the store; `migrations/0009_feedback.sql`.
- `magnetic/src/server/startMagnetic.ts`: `POST /edit/<app>/feedback`.
- `magnetic/src/mail/Mailer.ts`: `feedback()` and `feedbackMessage()`.
- `magnetic/src/editor/EditorApp.ts`: the `bug` icon, the button in the top right corner and `feedbackSheet`;
  `src/http/shell.ts` sends it; `src/http/text.ts` has its words in four languages.
- `magnetic/src/cli.ts`: `magnetic feedback`.
- The privacy page says what is kept.
- Tests: `src/server/feedback.test.ts`, `e2e/feedback.spec.ts`.
