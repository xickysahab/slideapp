# SwipeHire — Documentation

Six documents describing the system **as built**. Written from the source in `swipehire-api/` and
`swipehire-mobile/`, not from the planning documents — where the two disagree, these follow the
code.

| Read this | For |
|---|---|
| [PRD.md](PRD.md) | What the product is, what it must prove, what is and isn't in scope |
| [Architecture.md](Architecture.md) | Stack, database, swipe→match pipeline, scoring, auth, realtime, deployment |
| [Backend.md](Backend.md) | The full API contract — every endpoint, payload and error shape |
| [Frontend.md](Frontend.md) | Design system, navigation, screens, the swipe gesture, accessibility |
| [Security.md](Security.md) | What is defended, what is not, and where the line is |
| [Ticket-List.md](Ticket-List.md) | Build plan with verified status, and what is left |

**Start with `PRD.md`** for the product, or `Architecture.md` if you are here to work on the code.

---

### Relationship to the other folders

- `../` — the demo planning documents these were built from, plus `DEPLOY.md`, which is the live
  deployment procedure and is **not** duplicated here.
- `../full-spec/` — the original production specification. Reference only; the demo build follows a
  deliberately trimmed version of it, and every trim is recorded in the documents above.

### Verifying any of this yourself

```bash
cd swipehire-api && npm run verify:loop
```

39 checks across swipe, match, chat, interview and outcome, including the live socket events. It
creates its own throwaway accounts and removes them afterwards. `verify:auth`, `verify:profile`,
`verify:jobs`, `verify:storage` and `verify:resume` cover their areas in more depth.
