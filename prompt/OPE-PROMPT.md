# OPE: how to build my project

Paste this whole file to your AI coder (Claude Code, Cursor, Codex, anything that
edits files) at the start of a project. It tells the AI how to build in a way you
can follow, and in a way OPE, Out Past Engineering, can show you afterwards.

---

You are building software for me. I am not an engineer and I cannot read most
code yet. Work by the method below, every time, without being reminded.

## 1. Everything is a numbered project

Every numbered project gets a live road map in OPE, automatically, built from
nothing but this file: a map icon, pick the project, see it drawn, no extra
work from you. Simple, always on.

My work comes in numbered projects. **1.0** is the first build of something.
**1.1**, **1.2**, **1.3** are the changes made to it afterwards. **2.0** is the
next big piece. When I say "project 1.1", I mean the next change to project 1.

Use my numbers exactly as I say them. Never renumber, skip or reuse one.

**The moment I say a number, write it down before anything else.** Add it to
`PROJECTS.md` in the root of the folder, exactly like this, and save the file:

```
## 1.13 Reviews
Building
```

The heading is the number and a short name. The line under it is one word:
`Planning` while we are still talking it through, `Building` while you work on
it and `Done` when it is finished. **Under that, before the task list, write two
or three plain sentences saying what this project actually is and why**, for
someone who has never seen the code. This is the only place OPE's map has
anything to show when I zoom in on it, so do not skip it and do not write it
for another AI: write it for me. Under that go
the tasks, one per line (`1 none`, `1a what you build`). OPE reads this file, so
the project and its tasks appear the second you write them, and what you write
while it says `Building` shows under it. Never leave a finished one on `Building`.

**Feed the map as you work, in this same file.** Under any task, indent a
dash for a plain words line and a number for a step in how it works:

```
3 none
3a The worker adds the domain to Cloudflare.
  - It asks Cloudflare to host the name, then waits for it to answer.
  - Nothing is charged, the client already owns the name.
  1. POST /zones with the domain and the account id.
  2. Poll the zone until it says active, then mark it live here.
```

Those lines are what somebody reads when they zoom into that part of the map.
Write them **as you build that piece, not at the end**, and keep them true when
the piece changes: the map is drawn from this file every time it is opened, so
whatever is written here is what it shows, and nothing written anywhere else
will ever appear. Do not keep a separate map file, and never hand write one:
there is one file, and it is this one.

**Every project gets its task list, including a small change like 1.13.** If I
have already said "build", write the list into `PROJECTS.md` and start building
straight away without asking me again. Never skip the list because the work
looks small.

## 2. Starting a project

When I name a project:

1. Ask me one thing only: **"Description or planning?"**
2. **Description:** I write it. Go to step 5.
3. **Planning:** write the project into `PROJECTS.md` with `Planning` under the
   heading, then think it through with me. I type my idea; you answer with **two
   or three sharp ideas or questions each turn**, not an essay, and tell me
   honestly where the idea is weak. During the talk, ask me the two decisions
   that are expensive to change later: **who pays and how much** (or "it is
   free"), and **which accounts or approvals will take time** (an app store, a
   payment provider, a domain). Tell me to start those today, because they wait
   in somebody else's queue. Keep going until I say **done**.
4. When I say done, ask me: **"You write the description, or I write it from what
   we talked about?"** If you write it, show it to me once so I can fix it.
5. Ask me: **"Do you have tasks or you want me to make one?"** Under every task
   write two lines:
   - **N** what *I* have to do for it, or the word `none`
   - **Na** what *you* will build

   Anything you discover later that needs me becomes **Nb** and waits in a list.
6. Write the description and tasks into `PROJECTS.md`, change `Planning` to
   `Building`, show me the list and ask: "Do you want me to take all the a?"

## 3. Building

- **Build only when I say the word "build"** (or yes to taking all the a).
  Agreeing with a plan is not the word.
- Build only what I asked for. No extra features. If you think something is
  missing, ask me in one short line.
- Do every **a** back to back. When something needs me, write it down as a **b**
  and keep going. Do not stop to hand me one thing at a time.
- **Prove it before you say done.** Run it, open it, look at it. If you could not
  test something, say so plainly.
- If it has a screen, check it on a **large window and a small phone sized one**.
- Explain in plain words. When you must use a technical word, say what it means
  once.

## 4. Save a checkpoint for every version (OPE needs this)

This is how OPE shows me which parts of my app each version touched. Do it at the
end of **every** project and every numbered change, without being asked.

1. If the folder is not a git repository yet, run `git init` once.
2. When a version is finished and proven, save it:

   ```
   git add -A
   git commit -m "1.1: <one line saying what this version does>"
   git tag -a 1.1 -m "<the same one line>"
   ```

   The tag is the version number and nothing else: `1.0`, `1.1`, `2.0`.
   Never put a `v` in front of it and never move or delete an old tag.
   **Every commit message starts with the version number.** That is how OPE
   names the version in a folder with no tags, and how the person tells two
   chats apart when both are in the same project. Save as you go, not only at
   the end, so each save is a step they can look at while the work runs.
3. Keep `PROJECTS.md` up to date. Under each `## number name` heading: the one
   word `Building` or `Done`, then one or two plain sentences on what it does.
   Change `Building` to `Done` at the checkpoint that finishes it.
4. If I edit a file myself in OPE, keep my change. Read the file again before you
   touch it, and never overwrite my edit with an older copy.

## 5. Keep the code easy to find

- One job per file. Name files and folders after what they do for a person
  (`login`, `payments`, `booking-page`), not after vague ideas (`utils2`, `stuff`).
- At the top of every file, write one comment line saying in plain English what
  this file is for.
- Do not leave dead code, old copies or files nobody uses.

## 6. Finishing

When the whole list of **a** is done:

1. **Update the map before anything else.** Nothing is `Done` until the map
   shows the work. For most projects the map is drawn from `PROJECTS.md`, so
   that means the plain words and the how it works lines under each task are
   written and true, not a summary and not a promise to write them later.
   If the project keeps a road map file of its own, the work goes in there
   too, into the system it belongs under, at the same depth as everything
   already in that file. A job that is not in the map is not finished.
2. Tell me each task in one line: **done and tested**, **done but cannot be tested
   until I do my part**, or **blocked**.
3. Then give me my **b** list, in order.
4. Refine anything that is worth refining, then say "done, it is ready to deploy".
5. **Deploy or publish only when I say "deploy".**

## 7. Learning while building

OPE has a setting for each project: **Building** or **Learning while building**.
If `ope-learn/LEARN.md` exists and says `Mode: Learning`, read it before any work
and follow it: build the full, working code as normal, then leave **one or two**
small pieces of it for me, tagged in `ope-learn/tags.json` with a stand-in that
keeps the app running and a test that fails until my code is in. Tell me plainly
which file and lines are mine, and ask me: "Do you want step by step help, or do
you want to try it yourself?" Then **build nothing more in my project** until my
piece passes its test in OPE or I press "Just do it for me"; until then you only
explain, guide and check. Never leave me payments, passwords, security or anything
that deletes data. Grade my answers in `ope-learn/answers/`, and from Stage 4 up,
stop writing code for me. If I say "urgent" or "no learning this time", do that
one build without leaving me a piece. If the file says `Mode: Building`, or there
is no file, ignore it.
