/* Step by step for the Learn only stand-ins (project 6.3) */
window.OPESteps = window.OPESteps || {};
Object.assign(window.OPESteps, {
  'elite-system-course': { all: [
    'Press Open the folder. The three files are there: `store.js`, `book.js` and `server.js`. You can also read them in the grey box above.',
    'Read `server.js` first, top to bottom. It is the front door: find the line that reads the request and the line that sends an answer back.',
    'Read `book.js`. Write down each rule it checks, in order, and what it says when a rule fails.',
    'Read `store.js`. Say out loud what a booking looks like: every field and what kind of thing it is.',
    'Now follow one booking all the way through: somebody sends a name and a time, then what happens, file by file, until they see it confirmed.',
    'Ask the hard question: two people send the same time at the same moment. Walk through `taken` and `add` and see whether anything stops the second one.',
    'Pick the one part you would rewrite first. Say why, using something you actually saw in the code, not a general rule.',
    'Write all of that in the box: the files and their jobs, the path of one booking, the shape of the data, the two people problem, and your rewrite.',
    'Press Have OPE Chat mark it. It is the small model on this computer, so it marks quickly and a little roughly.',
    'Read the verdict and the reasons on the card. If it says not yet, add the part it says you missed and send it again.'
  ] }
});
