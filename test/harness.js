/*
 * love-bingo — dependency-free test harness.
 *
 * Loads js/app.js inside a fake-DOM sandbox and checks the pure logic
 * published on window.MenaBingo.  Run:  node test/harness.js
 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const store = {};
const el = () => ({
  style: {}, classList: { add() {}, remove() {}, toggle() {} }, dataset: {},
  appendChild() {}, addEventListener() {}, setAttribute() {}, removeAttribute() {},
  querySelector: () => null, querySelectorAll: () => [], focus() {}, remove() {},
  innerHTML: '', textContent: '', value: ''
});

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Intl,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  },
  document: {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, createElement: () => el(),
    body: { appendChild() {}, classList: { add() {}, remove() {} } },
    documentElement: { classList: { add() {}, remove() {}, toggle() {} } }
  },
  navigator: { language: 'en', clipboard: { writeText: async () => {} } },
  requestAnimationFrame: (fn) => setTimeout(fn, 0)
};

sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of ['js/app.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f });
}

/* ---------------- assertions ---------------- */

const NS = sandbox.window.MenaBingo;
let failures = 0;

function assert(cond, msg) {
  if (!cond) { console.error('FAIL: ' + msg); failures += 1; }
  else console.log('ok - ' + msg);
}

function eq(a, b, msg) {
  const same = JSON.stringify(a) === JSON.stringify(b);
  assert(same, msg + (same ? '' : ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'));
}

assert(!!NS, 'namespace window.MenaBingo exposed');

/* ---- shape ---- */
eq(NS.SIZE, 5, 'SIZE is 5');
eq(NS.CELLS, 25, 'CELLS is 25');
eq(NS.FREE, 12, 'FREE centre is index 12');
eq(NS.STORAGE_KEY, 'mena-bingo', 'storage key is mena-bingo');
eq(NS.DEFAULT_SQUARES.length, 25, 'starter card has 25 squares');
assert(/free/i.test(NS.DEFAULT_SQUARES[12]), 'centre starter square is a free square');

/* ---- lines ---- */
const lines = NS.getLines();
eq(lines.length, 12, 'there are 12 bingo lines');
assert(lines.every((l) => l.cells.length === 5), 'every line has 5 cells');
eq(lines[0].cells, [0, 1, 2, 3, 4], 'first line is the top row');
eq(lines[5].cells, [0, 5, 10, 15, 20], 'line 6 is the first column');
eq(lines[10].cells, [0, 6, 12, 18, 24], 'line 11 is the main diagonal');
eq(lines[11].cells, [4, 8, 12, 16, 20], 'line 12 is the anti-diagonal');

/* ---- marked helpers ---- */
const blank = NS.normalizeMarked(null);
eq(blank.length, 25, 'normalizeMarked yields 25 flags');
assert(blank.every((v) => v === false), 'a fresh card has no ticks');
assert(NS.isMarked(blank, 12) === true, 'the free centre counts as ticked');
assert(NS.isMarked(blank, 0) === false, 'an untouched square is not ticked');

/* ---- bingo detection ---- */
assert(NS.hasBingo(blank) === false, 'a blank card has no bingo');
assert(NS.bingoLines(blank).length === 0, 'a blank card completes no line');

const row0 = NS.normalizeMarked(null);
row0[0] = row0[1] = row0[2] = row0[3] = row0[4] = true;
assert(NS.hasBingo(row0) === true, 'a full top row is a bingo');
assert(NS.bingoLines(row0).indexOf(0) !== -1, 'the top row line is reported');

const col0 = NS.normalizeMarked(null);
[0, 5, 10, 15, 20].forEach((i) => { col0[i] = true; });
assert(NS.hasBingo(col0) === true, 'a full first column is a bingo');

const diag = NS.normalizeMarked(null);
[0, 6, 18, 24].forEach((i) => { diag[i] = true; });
eq(NS.bingoLines(diag), [10], 'only 4 ticks are needed for the main diagonal (free centre)');

const row2 = NS.normalizeMarked(null);
[10, 11, 13, 14].forEach((i) => { row2[i] = true; });
assert(NS.bingoLines(row2).indexOf(2) !== -1, 'the middle row is a bingo via the free centre');

const near = NS.normalizeMarked(null);
[0, 1, 2, 3].forEach((i) => { near[i] = true; });
assert(NS.hasBingo(near) === false, 'four in a row is not yet a bingo');

const full = NS.normalizeMarked(null);
for (let i = 0; i < 25; i += 1) full[i] = true;
eq(NS.bingoLines(full).length, 12, 'a full card completes all 12 lines');

/* ---- counting + highlight ---- */
eq(NS.countMarked(blank), 0, 'countMarked ignores the free centre');
eq(NS.countMarked(full), 24, 'a full card has 24 ticks (the centre is free)');
const hi = NS.markedLineIndex(row0);
assert([0, 1, 2, 3, 4].every((i) => hi[i]), 'highlighted squares cover the finished row');
assert(hi[5] !== true, 'a square outside the row is not highlighted');
assert(NS.markedLineIndex(row2)[12] === true, 'the centre is highlighted for a centre line');

/* ---- toggle ---- */
const before = NS.normalizeMarked(null);
const after = NS.toggle(before, 3);
assert(after[3] === true && before[3] === false, 'toggle returns a new array and flips one square');
assert(NS.toggle(after, 3)[3] === false, 'toggling twice returns to the start');
assert(NS.toggle(before, 12)[12] === false, 'the free centre cannot be toggled off');

/* ---- shuffle ---- */
const seed = () => { let s = 42; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; };
const src = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const sh1 = NS.shuffle(src, seed());
const sh2 = NS.shuffle(src, seed());
eq(sh1, sh2, 'shuffle is deterministic for the same rand()');
eq(sh1.slice().sort((a, b) => a - b), src, 'shuffle keeps every item');
eq(src, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'shuffle does not mutate its input');
assert(NS.shuffle([], seed()).length === 0, 'shuffling nothing is safe');

const mixed = NS.shuffleSquares(NS.DEFAULT_SQUARES, seed());
eq(mixed[12], NS.DEFAULT_SQUARES[12], 'shuffleSquares leaves the free centre in place');
assert(mixed.slice().sort().join('|') === NS.DEFAULT_SQUARES.slice().sort().join('|'), 'shuffleSquares keeps all 25 squares');

/* ---- dates ---- */
eq(NS.todayStr(new Date(2026, 0, 5)), '2026-01-05', 'todayStr pads month and day');
eq(NS.todayStr(new Date(2030, 11, 31)), '2030-12-31', 'todayStr handles December');

/* ---- state shapes ---- */
const es = NS.emptyState(new Date(2026, 0, 2));
eq(es.lastReset, '2026-01-02', 'emptyState records the day');
eq(es.squares.length, 25, 'emptyState has 25 squares');
eq(es.marked.length, 25, 'emptyState has 25 flags');
assert(es.autoReset === false, 'daily reset is off by default');

const fix = NS.normalizeSquares(['only one']);
eq(fix.length, 25, 'normalizeSquares pads to 25');
eq(fix[0], 'only one', 'normalizeSquares keeps supplied text');
eq(fix[1], NS.DEFAULT_SQUARES[1], 'normalizeSquares fills blanks from the starter card');

const repaired = NS.normalizeState({ squares: 'x', marked: 'y', lastReset: 7, autoReset: 'yes' }, new Date(2026, 0, 2));
eq(repaired.squares.length, 25, 'normalizeState repairs squares');
eq(repaired.marked.length, 25, 'normalizeState repairs flags');
eq(repaired.lastReset, '2026-01-02', 'normalizeState repairs the reset date');
assert(repaired.autoReset === true, 'normalizeState keeps a truthy autoReset');
eq(NS.normalizeState(null, new Date(2026, 0, 2)).lastReset, '2026-01-02', 'normalizeState copes with nothing saved');

/* ---- daily reset ---- */
const st = NS.emptyState(new Date(2026, 0, 1));
st.marked[0] = true;
assert(NS.needsReset(st, new Date(2026, 0, 2)) === false, 'no reset while the switch is off');
st.autoReset = true;
assert(NS.needsReset(st, new Date(2026, 0, 2)) === true, 'reset when a new day begins');
assert(NS.needsReset(st, new Date(2026, 0, 1)) === false, 'no reset on the same day');
const cleared = NS.resetIfNeeded(st, new Date(2026, 0, 2));
assert(cleared.marked.every((v) => v === false), 'resetIfNeeded clears the ticks');
eq(cleared.lastReset, '2026-01-02', 'resetIfNeeded moves the day stamp');
assert(cleared.squares.length === 25, 'resetIfNeeded keeps the squares');

/* ---- line names ---- */
eq(NS.lineName(lines[0]), 'the top row', 'row 1 is named');
eq(NS.lineName(lines[4]), 'the bottom row', 'the last row is named');
eq(NS.lineName(lines[5]), 'the top column', 'columns are named');
eq(NS.lineName(lines[10]), 'the corner-to-corner diagonal', 'the main diagonal is named');
eq(NS.lineName(lines[11]), 'the other diagonal', 'the anti-diagonal is named');

/* ---- escaping ---- */
eq(NS.escapeHtml('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;', 'escapeHtml neutralises markup');
eq(NS.escapeHtml(null), '', 'escapeHtml copes with null');

/* ---- storage round-trip ---- */
const day = new Date(2026, 0, 3);
const saved = NS.emptyState(day);
saved.marked[2] = true;
saved.squares[0] = 'our very own square';
NS.save(saved);
const reloaded = NS.load(day);
assert(reloaded.marked[2] === true, 'save/load round-trips the ticks');
eq(reloaded.squares[0], 'our very own square', 'save/load round-trips edited squares');
eq(reloaded.lastReset, '2026-01-03', 'save/load round-trips the day');

/* auto reset fires across a saved day boundary */
NS.save(Object.assign({}, saved, { autoReset: true }));
const nextDay = NS.load(new Date(2026, 0, 4));
assert(nextDay.marked.every((v) => v === false), 'load() clears ticks when a day has passed');
eq(nextDay.lastReset, '2026-01-04', 'load() stamps the new day');

/* a corrupt blob must not throw */
sandbox.localStorage.setItem('mena-bingo', '{not json');
const recovered = NS.load(day);
eq(recovered.squares.length, 25, 'a corrupt saved card falls back to a fresh one');

console.log('');
if (failures) {
  console.error(failures + ' assertion(s) failed');
  process.exitCode = 1;
} else {
  console.log('all love-bingo assertions passed');
}
