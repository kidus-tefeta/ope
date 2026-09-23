# Projects

The method writes a project here the moment it is named, before any code, so
OPE shows it straight away. `Planning` while it is talked through, `Building`
while it is worked on, `Done` when it is finished.

## 6.11 The map feeds itself as we work
Done
The map already redraws from PROJECTS.md every time it opens, so it can never
be out of date. What it could not show was depth: BookHere's hand written map
has plain words and how it works under every part, and nothing in PROJECTS.md
carried that.

Now it does. Under any task, an indented dash is a plain words line and an
indented number is a step in how it works, and both are drawn on the map. So
the deeper half of the map is written in the one file the method already makes
everybody keep, while they build the piece, not in a second file somebody has
to remember. A second file is what drifts. This cannot.

1 none
1a PROJECTS.md reads indented dashes and numbers under a task as that task's own detail.
  - A dash is a plain words bullet, the thing somebody reads when they zoom in.
  - A number is a step in how it works, drawn deeper still.
  - Anything the person has to do themselves is already pulled up as its own bullet and tagged.
2 none
2a The prompt tells every AI coder to write those lines as it builds the piece, keep them true when the piece changes, and never keep a separate map file.
3 none
3a A "## 6.0 name" heading, when a project writes one, names its own phase and says what it is, instead of the bare number.
4 none
4a Proved on this file: these very lines were written into 6.10, and the map drew them, two bullets and three steps, on the card, in the app.

## 6.10 Every map is the same map
Done
BookHere's road map engine is now OPE's road map engine, for everybody. The
whole page lives in `web/roadmap.html`: the project at the top, phases
branching off it, a system card under each with its own icon and status, that
card's parts drawn beneath it, the milestone rail, the phase bar, the HUD,
drag to pan, zoom in for the detail. Same concept, same everything, on every
project.

Only the data differs. A project that keeps a road map page of its own runs
that exact file instead, so BookHere stays itself to the pixel. Everything
else gets the same page filled from what it already writes: a major number is
a phase and a milestone, a minor number is a system card, its tasks are that
card's parts, `Planning` / `Building` / `Done` is its status, and the
paragraph under the status word is the line on the card.

1 none
1a BookHere's page generalised into `web/roadmap.html`: door gone, name, tagline, phases, systems and milestones read from data.
2 none
2a PROJECTS.md turned into that data: phases, milestones, system cards, parts, statuses, an icon picked from the words.
3 none
3a A project's own page still wins when it has one, and OPE's own shell is never mistaken for one.
  - A page counts as the project's own only if it is not OPE's shell, which says so in its first comment.
  - Everything else falls through to the shell, filled from this file.
  1. Every *map*.html in the project is looked at, in order.
  2. The first one that is not the shell is read, its door undone and its scripts inlined.
  3. If none is left, roadmap.html is fetched and filled from PROJECTS.md.
4 none
4a Proved in the compiled app, not a browser: kd-tracker-app drew 12 systems, 65 parts, 2 milestones, real names and real statuses, with the rail, the bar and the HUD. OPE's own folder drew 9 systems and 68 parts. BookHere still runs its own file, 19 systems, 134 parts, 9 milestones, its own wordmark and tagline.

## 6.9 The map is the real page, not a lookalike
Done
A drawn copy was never going to be identical to BookHere's own road map, and
he asked for identical at all cost. So OPE stopped copying it: when a project
already has its own road map page, OPE runs THAT file, in the map view, as
itself. Same html, same css, same fonts, same milestone rail, same phase bar,
same HUD, same third tier drawn on the canvas, because it is the page.

Two things are undone on the way in, both of them only about the web: the
door, which asks for the code and fetches its data from a Worker that is not
in here, and the data file it would have fetched, which is read off the disk
and put inline instead. Nothing else is touched.

A project with no map page of its own still gets one, drawn from its own
PROJECTS.md in the card style of those maps: icon, status pill, title, kicker
line, footer count, a bulleted "in plain words" sheet on a click. Simple, no
setup, same as 6.8 promised.

Map view also hides the Explorer and the versions column now, and the Mac View
menu grew "The Map" on shift-command-M.

1 none
1a Run a project's own map page in the map view, its door and its server undone, every script it names read off disk and put inline.
2 none
2a Fall back to the PROJECTS.md map, in the same card style, for a project with no page of its own.
3 none
3a Map view hides Explorer and the versions column; View menu gets The Map.
4 Open it on BookHere and say if anything reads wrong.
4a Proved through the dev server on the real files: the real page runs, 19 systems, 134 parts on the canvas, 9 milestones in the rail, 8 phases in the bar, its own fonts, its own HUD, and its own headline, "16 of 19 systems live · 1.5 sessions left to first money". The plain fallback proved too, on OPE's own folder. The compiled app was rebuilt and its new View menu item fired, but the window sat on another Space behind a full screen app, so the last look at it inside the app itself is yours.

## 6.8 The road map, in OPE itself
Done
A map icon in OPE. Click it, pick a project from the list already there, and
it draws as the same live pan and zoom map already built for BookHere and
KTeC: curved glowing lines, bright per phase colors, zoom out for the names,
zoom in for what a piece does.

No new AI call is needed to run it. OPE already reads every project's
PROJECTS.md and its git tags to build the flat Projects list, the same
numbers, names, summaries, tasks and Planning/Building/Done status. The map
just draws that already-real data as a map instead of a list, so it can never
show a status the files do not support.

1 none
1a A map icon in the rail, and a map panel filling the same space code, welcome and blank already share.
2 none
2a The map engine itself: pan, zoom, curved glowing lines, phase colors, sized to fit inside OPE's own panel.
3 none
3a Draw it from data OPE already computes: each major number a phase, each minor a part, colored, status straight from Planning, Building, Done.
4 none
4a Click a phase to zoom into its parts, click a part to read its summary and tasks.
5 Open your own map when you get a chance and say if anything reads wrong.
5a Built OPE.app for real (scripts/build.sh) and proved it in the actual app, not a browser: killed a stale OPE process left running from last night that was silently serving yesterday's build, launched the fresh one, clicked the map icon, opened BookHere's own real map. 1.0's 8 parts, their real names, and their real Done/Building/Planning status all matched PROJECTS.md exactly; opening 1.15 showed its real task list, word for word.
6 none
6a Fixed after Kidus flagged it looking at his own real map: a part's name was unreadable, and the map showed no real explanation of what a project is, only its bare task list. The number and status word are now drawn as SVG text so they never blur no matter how small the map is scaled; the plain paragraph already written under a project's status word in PROJECTS.md (the one this parser used to throw away) now shows in full on a click; the prompt now asks for that paragraph explicitly so every future project gets one, not only BookHere's. Proved against BookHere's real 1.10 entry through the dev server: the real paragraph, the real tasks, crisp numbers at every zoom tried down to 0.35x. Not yet re-checked inside the compiled app itself, the Mac locked mid-check.

## 6.7 A proper Mac app
Done
OPE is already native, signed and notarized, but it lacks Mac manners. It
updates itself and says when a new version is ready, has a File menu with Open
Project and Open Recent, opens a folder dropped on its Dock icon or chosen with
Open With in Finder, has Settings on ⌘, and a View menu with full screen, text
size and the side panel, stays in the Dock when
its window closes, has a Help menu, and opens more than one project at once.

1 none
1a Updates: Sparkle inside the app, a signed feed on the GitHub releases, and Check for Updates in the OPE menu.
2 none
2a A File menu: Open Project on ⌘O, Open Recent, and Close Window.
3 none
3a A folder dropped on the Dock icon, or opened with OPE from Finder, opens as a project.
4 none
4a Settings on ⌘, and a View menu: Enter Full Screen, bigger and smaller text, show and hide the side panel.
5 Decided: OPE stays black always, whatever the Mac is set to.
5a Nothing to build.
6 none
6a Closing the window keeps OPE in the Dock, and clicking the Dock icon brings it back.
7 none
7a A Help menu that opens the README and the course, with the Mac's menu search.
8 none
8a More than one project at once: ⌘N for a new window, and the Mac's own tabs.
9 none
9a ⌘1 to ⌘9 jump between projects the way Claude Code jumps between chats, in the order of the project list, and Ctrl 1 to 9 on Windows.
10 Update the OPE on your Mac from the new version, and say if anything feels off.
10a Release it as 1.6: notarized dmg, the feed updated, and an update proved from 1.5 to 1.6 on this Mac.

## 6.4 The gaps the other courses teach
Done
Seventeen milestones added to the course, from reading CS50, The Odin Project,
freeCodeCamp, Full Stack Open and Boot.dev against OPE's own list: git with
other people (branch, conflict, pull request), the CS50 weeks (recursion, a
linked list and a hash table built by hand, what code costs as the data grows),
the tools for finding a bug (a debugger, logs), how the machine really works
(a request and its statuses, joins and indexes, transactions, passwords and
identity), and the parts of a job nobody teaches (reading a strange codebase,
dependencies, shipping and rolling back, refusing bad input). 113 milestones,
114 practice tasks.

1 none
1a Compare OPE's 96 milestones against CS50, Odin, freeCodeCamp, Full Stack Open and Boot.dev, and name the real gaps.
2 none
2a Add the 17 milestones to the end of the parts they belong to.
3 none
3a Write a practice task and a test for each of the 14 that can be tested, and an explain task for the 3 that cannot.
4 none
4a Prove every new test: it fails on the starter files and passes on a correct answer.
5 none
5a The README and the course header say what the course now covers.

## 6.2 Your part
Building
In Learning mode the AI coder leaves one or two small pieces of each build for
the person, at their level, with a stand-in so the app still runs and a test
that fails until the real code is in. It says plainly which file and lines are
theirs, asks whether they want step by step help, and then builds nothing more
in the project until their piece passes its test and OPE marks it verified, or
they press "Just do it for me". Payments, passwords, security and deleting data
are never left to them. "Urgent" or "no learning this time" lets one build go
ahead without a piece.

1 none
1a LEARN.md tells the AI coder to leave one or two pieces with a stand-in and a failing test, never anything dangerous.
2 none
2a LEARN.md gives the exact words to tell the person which lines are theirs, and to offer step by step help.
3 none
3a LEARN.md lists the pieces OPE is waiting on, and tells the AI coder to build nothing more until the list is empty.
4 none
4a OPE puts the stand-in in the hole, marks a piece passed or skipped in tags.json, and refreshes the waiting list.
5 none
5a AGENTS.md, the prompt and the README say the same.
6 Try it on a real project in Learning mode.
6a Test it start to finish on a demo project. (Done 18 Sep: stand-in runs, test fails on it, pass and skip both clear the waiting list.)

## 6.1 Learn while building
Done
A setting with two modes, Building and Learning while building. Learning teaches you to code on your own project, from barely touching a laptop to elite: a fixed skill list in eight stages, pieces of your own code cut out for you with a test, a practice bank when your project has nothing at your level, no jumping but a test at each stage door, the AI coder switched off from Stage 4 up, and a "just do it for me" button that records the skip.

1 none
1a The setting, Building or Learning while building, remembered for each project.
2 none
2a The skill list: every skill in eight stages, Computer, Reader, Tweaker, Writer, Builder, Debugger, Designer, Elite, in one fixed file.
3 none
3a The practice bank: one or two tasks for every skill, each with its own test.
4 none
4a The method tells the AI coder to tag every piece it writes with its skill and level, in a file OPE reads.
5 none
5a OPE checks each tag with simple rules and keeps the lower level when they disagree.
6 none
6a OPE cuts a piece at your level out of your code, puts a test beside it, and puts the code back when your test passes.
7 none
7a The Learn panel: your level, the piece to do, the test result, and "just do it for me".
8 none
8a The stage door test: pass it and the whole stage counts.
9 none
9a Explain it: your written answer goes in a file your AI coder grades on its next run.
10 none
10a From Stage 4 up the method switches the AI coder off.
11 none
11a OPE remembers your level, your skips and the mistakes you repeat, and brings the weak spots back.
12 none
12a The same on Windows, through the Node twin.
13 Take the Stage 1 door test yourself, for real.
13a Test it start to finish on a real project.
14 none
14a The README and the mac-app-github map.

## 6.3 Learn without building
Building
A third mode next to Building and Learning while building: Learn only. You do not need a project. OPE opens the OPE Course folder as the project, every milestone comes from the practice bank, and OPE Chat grades the written answers instead of your AI coder.

1 none
1a A third mode in the Learn view: Building, Learning while building, Learn only.
2 none
2a Learn only needs no project: picking it makes the OPE Course folder and opens it as the project, so the files and the history are there to look at.
3 none
3a Every piece comes from the practice bank, in order, and the door tests still work.
4 none
4a OPE Chat grades the written answers, with its reasons, and says plainly it is the small local model.
5 none
5a Nothing asks for an AI coder in this mode: no LEARN.md, no tags, no AGENTS.md, and the two parts that lean on your own project get their own bank task.
6 Pick Learn only and pass one milestone.
6a Test it start to finish on a clean machine state, then build and install.
7 none
7a The README and the OPE case study words.

## 6.5 The brain ships with OPE
Done
OPE Chat used to need Ollama and a 1.9 GB download before it would answer, and
on Windows that is where people stopped. Now the Windows installer carries its
own brain: Qwen2.5 Coder 1.5B, four bit, 1.1 GB, run by llama.cpp inside the
app. Nothing to install, no tray app, no service. Ollama stays optional and
wins when it is there, because its model is bigger, and OPE says which brain
answered.

1 none
1a A script that fetches the model into build/model, resumes a half done download and refuses a short file.
2 none
2a A brain the Node twin can call: llama.cpp loads the model once, answers, and lets it go after ten quiet minutes.
3 none
3a OPE Chat picks in order: Ollama, then the brain inside OPE, then it says plainly that it has neither.
4 none
4a The window hands llama.cpp to the bridge, the way it hands over the terminal, so it works inside the packaged app.
5 none
5a The Windows build fetches the model and ships it in the installer.
6 Run the Windows installer on your laptop and ask OPE Chat something with Ollama closed.
6a Prove it on this Mac with Ollama switched off: the engine says "inside OPE" and a real question about a real file is answered.

## 6.6 A terminal inside OPE
Building
A real terminal inside OPE, the same idea as the one in Claude Code: you type, it runs, you watch. It is there for the jobs that happen once, like installing Ollama, pulling the model, installing Git, and for anything else you want to run without leaving the app. The `>_` icon in the rail becomes the terminal and it opens full screen; the welcome moves to the OPE mark. On the Mac the engine is a pty in Swift, so nothing is added to the app; on Windows it is node-pty inside the Node twin, OPE's first native dependency. One shell for each project, it keeps running while you look at something else, and it comes back where you left it. It ships on GitHub for Mac and Windows in the same release.

1 none
1a The rail: the `>_` icon becomes the terminal, and the welcome takes the OPE mark.
2 none
2a The screen: a full screen terminal with the project path across the top, and Escape or a close button to leave it.
3 none
3a The Mac engine: a pty in Swift, no dependency, that follows the window when it is resized.
4 none
4a The Windows engine: node-pty in the Node twin, rebuilt for Electron in the build, so the Windows app has the same terminal.
5 none
5a One shell for each project. It keeps running while you look away and comes back where you left it, so a 1.9 GB pull is never lost.
6 none
6a It starts in the project folder, with your own shell and your own PATH, so ollama and git behave the way they do in Terminal.
7 none
7a A mark on the rail icon while something is still running, and the folder the shell is in written where you can see it.
8 Install Ollama and pull the model from inside OPE, to prove it.
8a Test it on the Mac and on the Windows build, then cut the release.
9 none
9a The README, the OPE case study words and the mac-app-github map.

