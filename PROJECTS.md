# Projects

The method writes a project here the moment it is named, before any code, so
OPE shows it straight away. `Planning` while it is talked through, `Building`
while it is worked on, `Done` when it is finished.

## 6.7 A proper Mac app
Building
OPE is already native, signed and notarized, but it lacks Mac manners. It
updates itself and says when a new version is ready, has a File menu with Open
Project and Open Recent, opens a folder dropped on its Dock icon or chosen with
Open With in Finder, has Settings on ⌘, and a View menu with full screen, text
size and the side panel, follows the Mac into dark mode, stays in the Dock when
its window closes, has a Help menu, and opens more than one project at once.

1 none
1a Updates: Sparkle inside the app, a signed feed on the GitHub releases, and Check for Updates in the OPE menu.
2 none
2a A File menu: Open Project on ⌘O, Open Recent, and Close Window.
3 none
3a A folder dropped on the Dock icon, or opened with OPE from Finder, opens as a project.
4 none
4a Settings on ⌘, and a View menu: Enter Full Screen, bigger and smaller text, show and hide the side panel.
5 none
5a Dark mode that follows the Mac.
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

