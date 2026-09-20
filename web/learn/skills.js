/* THE SKILL LIST. Fixed, in order, the same for everybody.

   Eight parts from never having opened a terminal to reviewing and rejecting
   an AI's code, 113 milestones. Twelve in each part to begin with, and the
   milestones added later sit at the end of the part they belong to. Every project in
   the world uses the same things: values, decisions, loops, functions, data,
   errors. The list is those things in the order they can be learned. The
   practice comes from your own project and the OPE Course; only the list is
   fixed.

   A milestone id is what the AI coder writes into ope-learn/tags.json, so ids
   never change once published. Add at the end of a part, never rename. */
window.OPESkills = [
  {n: 0, name: 'Computer', can: 'use files, folders, the terminal and git', ai: true, skills: [
    {id: 'files-folders',     name: 'Files and folders'},
    {id: 'rename-move',       name: 'Renaming and moving'},
    {id: 'paths',             name: 'Where a file lives: its path'},
    {id: 'file-types',        name: 'What the end of a file name means'},
    {id: 'terminal',          name: 'Running a command in the terminal'},
    {id: 'terminal-navigate', name: 'Moving around in the terminal'},
    {id: 'terminal-files',    name: 'Making and moving files by command'},
    {id: 'run-a-program',     name: 'Running a program'},
    {id: 'git-save',          name: 'Saving a checkpoint with git'},
    {id: 'git-history',       name: 'Reading the history'},
    {id: 'git-diff',          name: 'Seeing what changed'},
    {id: 'git-undo',          name: 'Going back to the last checkpoint'},
    {id: 'git-branch',        name: 'Working on a branch'},
    {id: 'git-conflict',      name: 'Two changes to the same line'},
    {id: 'git-pr',            name: 'A pull request somebody reviews'}
  ]},
  {n: 1, name: 'Reader', can: 'read code and say what it does', ai: true, skills: [
    {id: 'read-values',   name: 'Values and variables'},
    {id: 'read-strings',  name: 'Text: joining, cutting, changing case'},
    {id: 'read-math',     name: 'Numbers and sums'},
    {id: 'read-if',       name: 'An if and an else'},
    {id: 'read-logic',    name: 'And, or, not'},
    {id: 'read-loop',     name: 'A loop'},
    {id: 'read-arrays',   name: 'Lists'},
    {id: 'read-objects',  name: 'Objects: things with named parts'},
    {id: 'read-function', name: 'A function: what goes in, what comes out'},
    {id: 'read-return',   name: 'Giving back versus printing'},
    {id: 'read-callbacks', name: 'A function handed to another function'},
    {id: 'read-flow',     name: 'Following a whole file from top to bottom'}
  ]},
  {n: 2, name: 'Tweaker', can: 'change values, conditions and text without breaking anything', ai: true, skills: [
    {id: 'tweak-value',     name: 'Changing a value'},
    {id: 'tweak-text',      name: 'Changing what the person sees'},
    {id: 'tweak-condition', name: 'Changing a condition'},
    {id: 'tweak-data',      name: 'Adding to a list or an object'},
    {id: 'tweak-loop',      name: 'Changing how many times a loop runs'},
    {id: 'tweak-style',     name: 'Changing how a page looks'},
    {id: 'tweak-html',      name: 'Changing a page'},
    {id: 'tweak-config',    name: 'Changing a settings file'},
    {id: 'tweak-field',     name: 'Renaming a field everywhere it is used'},
    {id: 'tweak-default',   name: 'Giving a function a default'},
    {id: 'tweak-order',     name: 'Changing the order things come in'},
    {id: 'tweak-remove',    name: 'Taking something out safely'}
  ]},
  {n: 3, name: 'Writer', can: 'write small pieces that pass a test', ai: true, skills: [
    {id: 'write-function',   name: 'Writing a function that gives something back'},
    {id: 'write-if',         name: 'Writing the decision'},
    {id: 'write-loop',       name: 'Writing the loop'},
    {id: 'write-strings',    name: 'Building text'},
    {id: 'write-math',       name: 'Money and rounding'},
    {id: 'write-data',       name: 'Working with lists and objects'},
    {id: 'write-objects',    name: 'Building an object'},
    {id: 'write-map-filter', name: 'Map and filter'},
    {id: 'write-find',       name: 'Finding one thing, or checking all of them'},
    {id: 'write-dates',      name: 'Dates and days'},
    {id: 'write-validation', name: 'Checking what a person typed'},
    {id: 'write-errors',     name: 'Handling what goes wrong'}
  ]},
  {n: 4, name: 'Builder', can: 'build a small program from a blank file', ai: false, skills: [
    {id: 'build-blank',     name: 'A program from a blank file'},
    {id: 'build-split',     name: 'Splitting it into functions'},
    {id: 'build-modules',   name: 'Splitting it into files'},
    {id: 'build-cli',       name: 'A program that takes what you type'},
    {id: 'build-files',     name: 'Reading and writing files'},
    {id: 'build-json',      name: 'Saving and loading data'},
    {id: 'build-classes',   name: 'A thing with its own data and actions'},
    {id: 'build-async',     name: 'Waiting for something: async and await'},
    {id: 'build-fetch',     name: 'Asking another computer for data'},
    {id: 'build-search',    name: 'Sorting and searching'},
    {id: 'build-own-tests', name: 'Writing your own tests'},
    {id: 'build-app',       name: 'A small app with its own tests'},
    {id: 'build-recursion',   name: 'A function that calls itself'},
    {id: 'build-linked',      name: 'A list you build yourself'},
    {id: 'build-hash',        name: 'Finding something instantly: a hash table'},
    {id: 'build-cost',        name: 'What it costs as the data grows'}
  ]},
  {n: 5, name: 'Debugger', can: 'find and fix bugs, planted and real', ai: false, skills: [
    {id: 'debug-error',      name: 'Reading an error message'},
    {id: 'debug-typo',       name: 'The name that is spelled wrong'},
    {id: 'debug-types',      name: 'Text that should have been a number'},
    {id: 'debug-off-by-one', name: 'The off by one'},
    {id: 'debug-condition',  name: 'The wrong condition'},
    {id: 'debug-equality',   name: 'Things that look equal and are not'},
    {id: 'debug-empty',      name: 'The empty list nobody expected'},
    {id: 'debug-float',      name: 'Money that does not add up'},
    {id: 'debug-scope',      name: 'The value that leaked'},
    {id: 'debug-async',      name: 'The missing await'},
    {id: 'debug-state',      name: 'Something changed that should not have'},
    {id: 'debug-regression', name: 'What changed and broke it'},
    {id: 'debug-breakpoint',  name: 'Stopping the program to look inside'},
    {id: 'debug-logs',        name: 'Finding the failure in the logs'}
  ]},
  {n: 6, name: 'Designer', can: 'plan data, functions and structure before any code', ai: false, skills: [
    {id: 'design-naming',     name: 'Good names'},
    {id: 'design-data',       name: 'The shape of the data'},
    {id: 'design-schema',     name: 'A database table'},
    {id: 'design-api',        name: 'What each function takes and gives back'},
    {id: 'design-interface',  name: 'Building to a promise'},
    {id: 'design-modules',    name: 'Which file does which job'},
    {id: 'design-duplication', name: 'One place instead of four'},
    {id: 'design-state',      name: 'Where the data lives'},
    {id: 'design-errors',     name: 'Deciding what can go wrong'},
    {id: 'design-plan',       name: 'A plan before the code'},
    {id: 'design-tradeoff',   name: 'Choosing between two ways, and saying why'},
    {id: 'design-review',     name: 'Judging your own design'},
    {id: 'design-http',       name: 'A request and what comes back'},
    {id: 'design-join',       name: 'Two tables that belong together'},
    {id: 'design-transaction', name: 'Both halves, or neither'},
    {id: 'design-auth',       name: 'Who someone is, and their password'}
  ]},
  {n: 7, name: 'Elite', can: 'review AI code, reject bad code and explain why', ai: false, skills: [
    {id: 'elite-review',      name: 'Reviewing code somebody else wrote'},
    {id: 'elite-reject',      name: 'Rejecting code, with the reason'},
    {id: 'elite-security',    name: 'Spotting the hole an attacker would use'},
    {id: 'elite-xss',         name: 'Text that turns into code on a page'},
    {id: 'elite-secrets',     name: 'A key that should never be in the code'},
    {id: 'elite-auth',        name: 'Who is allowed to do what'},
    {id: 'elite-speed',       name: 'Making slow code fast'},
    {id: 'elite-complexity',  name: 'How it grows as the data grows'},
    {id: 'elite-cache',       name: 'Not doing the same work twice'},
    {id: 'elite-race',        name: 'Two things at once'},
    {id: 'elite-architecture', name: 'How the whole thing should grow'},
    {id: 'elite-system',      name: 'Explaining the whole system'},
    {id: 'elite-strange',     name: 'Reading a codebase you have never seen'},
    {id: 'elite-deps',        name: 'The code you did not write: dependencies'},
    {id: 'elite-deploy',      name: 'Shipping it, and taking it back'},
    {id: 'elite-types',       name: 'Refusing the wrong input'}
  ]}
];

/* the list flattened, each milestone knowing its part and its place */
window.OPESkills.all = function(){
  var out = [];
  window.OPESkills.forEach(function(st){
    st.skills.forEach(function(sk, i){ out.push({id: sk.id, name: sk.name, stage: st.n, stageName: st.name, index: i}); });
  });
  return out;
};
