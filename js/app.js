"use strict";

/*
 * love-bingo — a little bingo card built from moments we love.
 *
 * All of the thinking (lines, bingo detection, shuffling, dates, storage
 * shapes) lives in plain functions at the top and is published on
 * window.MenaBingo so it can be tested without a browser. Rendering only
 * happens in boot(), and every DOM lookup is guarded.
 */

(function () {
  var SIZE = 5;
  var CELLS = SIZE * SIZE;
  var FREE = 12; /* the centre square — always ours */
  var LS = "mena-bingo";

  /* ---------- the starter card ---------- */

  var DEFAULT_SQUARES = [
    "A meal we cooked together",
    "Sent a good-morning text",
    "Watched something at the same time",
    "A voice note longer than 2 minutes",
    "Fell asleep on call",
    "Said \"I miss you\" first",
    "Planned a future trip",
    "Shared a photo of food",
    "Laughed until we cried",
    "A surprise for no reason",
    "Talked about the day ahead",
    "A song that felt like us",
    "Free \u2014 this one is us \u2665",
    "A silly argument about nothing",
    "Stayed up too late talking",
    "Screenshotted a text to keep",
    "Drew or made something",
    "Told a story from Free Fire",
    "A compliment out of nowhere",
    "Sent a kiss emoji",
    "Rain outside while we talked",
    "Talked about our families",
    "A video call we did not want to end",
    "Said thank you for something small",
    "Promised tomorrow would be better"
  ];

  /* ---------- pure logic ---------- */

  function getLines() {
    var lines = [];
    var r;
    var c;
    for (r = 0; r < SIZE; r += 1) {
      var row = [];
      for (c = 0; c < SIZE; c += 1) row.push(r * SIZE + c);
      lines.push({ kind: "row", index: r, cells: row });
    }
    for (c = 0; c < SIZE; c += 1) {
      var col = [];
      for (r = 0; r < SIZE; r += 1) col.push(r * SIZE + c);
      lines.push({ kind: "column", index: c, cells: col });
    }
    var d1 = [];
    var d2 = [];
    for (r = 0; r < SIZE; r += 1) {
      d1.push(r * SIZE + r);
      d2.push(r * SIZE + (SIZE - 1 - r));
    }
    lines.push({ kind: "diagonal", index: 0, cells: d1 });
    lines.push({ kind: "diagonal", index: 1, cells: d2 });
    return lines;
  }

  var LINES = getLines();

  /* Is square i ticked? The centre counts as ticked even when unset. */
  function isMarked(marked, i) {
    if (i === FREE) return true;
    return !!(marked && marked[i]);
  }

  /* Which of the 12 lines are complete, as line indices. */
  function bingoLines(marked) {
    var done = [];
    var l;
    var j;
    for (l = 0; l < LINES.length; l += 1) {
      var cells = LINES[l].cells;
      var ok = true;
      for (j = 0; j < cells.length; j += 1) {
        if (!isMarked(marked, cells[j])) {
          ok = false;
          break;
        }
      }
      if (ok) done.push(l);
    }
    return done;
  }

  function hasBingo(marked) {
    return bingoLines(marked).length > 0;
  }

  var ORDINAL = ["top", "second", "middle", "fourth", "bottom"];

  /* Human label for a finished line, e.g. "the bottom row". */
  function lineName(line) {
    if (!line) return "a line";
    if (line.kind === "row") return "the " + (ORDINAL[line.index] || "a") + " row";
    if (line.kind === "column") return "the " + (ORDINAL[line.index] || "a") + " column";
    if (line.index === 0) return "the corner-to-corner diagonal";
    return "the other diagonal";
  }

  function countMarked(marked) {
    var n = 0;
    var i;
    for (i = 0; i < CELLS; i += 1) {
      if (i !== FREE && marked && marked[i]) n += 1;
    }
    return n;
  }

  /* Indices that belong to at least one completed line (for highlighting). */
  function markedLineIndex(marked) {
    var set = {};
    var lines = bingoLines(marked);
    var l;
    var j;
    for (l = 0; l < lines.length; l += 1) {
      var cells = LINES[lines[l]].cells;
      for (j = 0; j < cells.length; j += 1) set[cells[j]] = true;
    }
    return set;
  }

  /* Next mark pattern after tapping square i (the centre never toggles). */
  function toggle(marked, i) {
    var next = normalizeMarked(marked);
    if (i === FREE) return next;
    next[i] = !next[i];
    return next;
  }

  /* Fisher–Yates. Pass a rand() for deterministic tests. */
  function shuffle(list, rand) {
    var rnd = typeof rand === "function" ? rand : Math.random;
    var a = (list || []).slice();
    var i;
    for (i = a.length - 1; i > 0; i -= 1) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function todayStr(date) {
    var d = date instanceof Date ? date : new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  /* Always 25 strings, falling back to the starter card for blanks. */
  function normalizeSquares(list) {
    var out = [];
    var i;
    for (i = 0; i < CELLS; i += 1) {
      var v = list && list[i];
      out.push(typeof v === "string" && v.trim() ? v : DEFAULT_SQUARES[i]);
    }
    return out;
  }

  /* Always 25 booleans; the centre is forced off (it is free anyway). */
  function normalizeMarked(marked) {
    var out = [];
    var i;
    for (i = 0; i < CELLS; i += 1) {
      out.push(i === FREE ? false : !!(marked && marked[i]));
    }
    return out;
  }

  function emptyState(date) {
    var today = todayStr(date);
    return {
      squares: normalizeSquares(null),
      marked: normalizeMarked(null),
      lastReset: today,
      autoReset: false
    };
  }

  /* Repair anything a saved blob might be missing. */
  function normalizeState(raw, date) {
    var base = emptyState(date);
    if (!raw || typeof raw !== "object") return base;
    return {
      squares: normalizeSquares(raw.squares),
      marked: normalizeMarked(raw.marked),
      lastReset: typeof raw.lastReset === "string" ? raw.lastReset : base.lastReset,
      autoReset: !!raw.autoReset
    };
  }

  /* Should the ticks be wiped because a new day began? */
  function needsReset(state, date) {
    if (!state || !state.autoReset) return false;
    return state.lastReset !== todayStr(date);
  }

  function resetIfNeeded(state, date) {
    if (!needsReset(state, date)) return state;
    var next = normalizeState(state, date);
    next.marked = normalizeMarked(null);
    next.lastReset = todayStr(date);
    return next;
  }

  /* Move the non-free squares around; the centre stays put. */
  function shuffleSquares(squares, rand) {
    var src = normalizeSquares(squares);
    var idx = [];
    var i;
    for (i = 0; i < CELLS; i += 1) {
      if (i !== FREE) idx.push(i);
    }
    var vals = idx.map(function (k) {
      return src[k];
    });
    var mixed = shuffle(vals, rand);
    var out = src.slice();
    for (i = 0; i < idx.length; i += 1) out[idx[i]] = mixed[i];
    return out;
  }

  function escapeHtml(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  /* ---------- storage ---------- */

  function load(date) {
    var raw = null;
    try {
      raw = window.localStorage.getItem(LS);
    } catch (e) {
      raw = null;
    }
    var parsed = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        parsed = null;
      }
    }
    return resetIfNeeded(normalizeState(parsed, date), date);
  }

  function save(state) {
    try {
      window.localStorage.setItem(LS, JSON.stringify(state));
    } catch (e) {
      /* storage full or blocked — the card still works this session */
    }
  }

  /* ---------- the live page ---------- */

  var API = {
    SIZE: SIZE,
    CELLS: CELLS,
    FREE: FREE,
    STORAGE_KEY: LS,
    DEFAULT_SQUARES: DEFAULT_SQUARES,
    getLines: getLines,
    isMarked: isMarked,
    hasBingo: hasBingo,
    bingoLines: bingoLines,
    lineName: lineName,
    countMarked: countMarked,
    markedLineIndex: markedLineIndex,
    toggle: toggle,
    shuffle: shuffle,
    todayStr: todayStr,
    normalizeSquares: normalizeSquares,
    normalizeMarked: normalizeMarked,
    normalizeState: normalizeState,
    emptyState: emptyState,
    needsReset: needsReset,
    resetIfNeeded: resetIfNeeded,
    shuffleSquares: shuffleSquares,
    escapeHtml: escapeHtml,
    load: load,
    save: save
  };

  if (typeof window !== "undefined") window.MenaBingo = API;

  function boot() {
    var grid = document.getElementById("bingo-grid");
    if (!grid) return;

    var state = load();
    var editing = false;
    var lastBingoCount = bingoLines(state.marked).length;

    var banner = document.getElementById("bingo-banner");
    var note = document.getElementById("board-note");
    var resetInfo = document.getElementById("reset-info");
    var autoReset = document.getElementById("auto-reset");

    function setNote(text) {
      if (note) note.textContent = text || "\u00a0";
    }

    function persist() {
      save(state);
    }

    function announce() {
      var lines = bingoLines(state.marked);
      if (banner) {
        if (lines.length > 0) {
          banner.hidden = false;
          var names = lines.slice(0, 2).map(function (l) {
            return lineName(LINES[l]);
          });
          banner.textContent =
            lines.length > 1
              ? "Bingo \u2665 " + lines.length + " lines! (" + names.join(" + ") + ")"
              : "Bingo \u2665 " + names[0] + "!";
        } else {
          banner.hidden = true;
          banner.textContent = "";
        }
      }
      if (lines.length > lastBingoCount) {
        if (typeof window.heartBurst === "function") {
          window.heartBurst(window.innerWidth / 2, window.innerHeight / 2, 22);
        }
        if (typeof window.fxToast === "function") {
          window.fxToast("Bingo \u2665 five in a row!");
        }
      }
      lastBingoCount = lines.length;
    }

    function renderStats() {
      var lines = bingoLines(state.marked).length;
      var bingos = document.getElementById("stat-bingos");
      var marked = document.getElementById("stat-marked");
      var left = document.getElementById("stat-lines");
      if (bingos) bingos.textContent = String(lines);
      if (marked) marked.textContent = String(countMarked(state.marked));
      if (left) left.textContent = String(LINES.length - lines);
    }

    function renderResetInfo() {
      if (resetInfo) {
        resetInfo.textContent = "Ticks were last cleared on " + state.lastReset + ".";
      }
      if (autoReset) autoReset.checked = !!state.autoReset;
    }

    function renderGrid() {
      var highlights = markedLineIndex(state.marked);
      grid.textContent = "";
      var i;
      for (i = 0; i < CELLS; i += 1) {
        var cell = document.createElement(editing ? "div" : "button");
        cell.className = "bingo-cell";
        cell.dataset.index = String(i);

        if (i === FREE) cell.classList.add("is-free");
        if (i !== FREE && state.marked[i]) cell.classList.add("is-marked");
        if (highlights[i]) cell.classList.add("is-bingo");

        if (editing) {
          cell.classList.add("is-editing");
          var box = document.createElement("textarea");
          box.className = "cell-edit";
          box.rows = 3;
          box.setAttribute("aria-label", "Bingo square " + (i + 1));
          box.value = state.squares[i];
          box.addEventListener("input", (function (idx) {
            return function (ev) {
              state.squares[idx] = ev.target.value;
              persist();
            };
          })(i));
          cell.appendChild(box);
        } else {
          cell.type = "button";
          cell.textContent = state.squares[i];
          cell.setAttribute("aria-label", state.squares[i] + (state.marked[i] ? " (ticked)" : ""));
          cell.addEventListener("click", (function (idx) {
            return function () {
              if (idx === FREE) {
                setNote("The middle square is free \u2014 that one is us \u2665");
                return;
              }
              state.marked = toggle(state.marked, idx);
              persist();
              renderGrid();
              renderStats();
              announce();
            };
          })(i));
        }
        grid.appendChild(cell);
      }
    }

    function renderAll() {
      renderGrid();
      renderStats();
      renderResetInfo();
      announce();
    }

    /* ---------- controls ---------- */

    function on(id, handler) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("click", handler);
    }

    on("btn-new", function () {
      state.squares = shuffleSquares(state.squares);
      state.marked = normalizeMarked(null);
      persist();
      renderAll();
      setNote("A fresh card \u2014 same moments, new places.");
    });

    on("btn-clear", function () {
      state.marked = normalizeMarked(null);
      persist();
      renderAll();
      setNote("Ticks cleared. The squares are still yours.");
    });

    on("btn-edit", function () {
      editing = !editing;
      var btn = document.getElementById("btn-edit");
      if (btn) {
        btn.textContent = editing ? "Done editing" : "Edit squares";
        btn.classList.toggle("button-primary", editing);
        btn.classList.toggle("button-ghost", !editing);
      }
      renderGrid();
      setNote(editing ? "Write your own moments \u2014 they save as you type." : "Changes saved \u2665");
    });

    on("btn-defaults", function () {
      state.squares = normalizeSquares(null);
      state.marked = normalizeMarked(null);
      persist();
      renderAll();
      setNote("Back to the starter card.");
    });

    on("btn-save", function () {
      downloadCard(state);
    });

    if (autoReset) {
      autoReset.addEventListener("change", function () {
        state.autoReset = !!autoReset.checked;
        if (state.autoReset) {
          state.marked = normalizeMarked(null);
          state.lastReset = todayStr();
        }
        persist();
        renderResetInfo();
      });
    }

    renderAll();
  }

  /* ---------- share card (canvas PNG) ---------- */

  function downloadCard(state) {
    var canvas = document.getElementById("share-canvas");
    var note = document.getElementById("board-note");
    if (!canvas || typeof canvas.getContext !== "function") {
      if (note) note.textContent = "Picture export needs a browser with canvas.";
      return;
    }
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var W = canvas.width;
    var H = canvas.height;
    var pad = 64;
    var titleH = 150;
    var gridSize = W - pad * 2;
    var gap = 10;
    var cellSize = (gridSize - gap * 4) / 5;

    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#12173a");
    bg.addColorStop(1, "#2a1740");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#f5f2ff";
    ctx.textAlign = "center";
    ctx.font = "700 58px Georgia, serif";
    ctx.fillText("Our bingo card", W / 2, 92);
    ctx.fillStyle = "#ff9fcf";
    ctx.font = "400 28px Georgia, serif";
    ctx.fillText(todayStr() + "  \u2665  Ammar & Mena", W / 2, 132);

    var highlights = markedLineIndex(state.marked);
    var i;
    for (i = 0; i < CELLS; i += 1) {
      var col = i % 5;
      var row = Math.floor(i / 5);
      var x = pad + col * (cellSize + gap);
      var y = titleH + row * (cellSize + gap);

      var marked = i === FREE || state.marked[i];
      ctx.fillStyle = marked ? (i === FREE ? "#bba6ff" : "#ff9fcf") : "rgba(255,255,255,0.94)";
      roundRect(ctx, x, y, cellSize, cellSize, 16);
      ctx.fill();

      if (highlights[i]) {
        ctx.strokeStyle = "#bba6ff";
        ctx.lineWidth = 4;
        roundRect(ctx, x, y, cellSize, cellSize, 16);
        ctx.stroke();
      }

      ctx.fillStyle = marked ? "#3a1230" : "#3a1b33";
      ctx.font = "600 20px Georgia, serif";
      wrapText(ctx, state.squares[i], x + cellSize / 2, y + cellSize / 2, cellSize - 22, 24);
    }

    var labelY = titleH + gridSize + 58;
    ctx.fillStyle = "#b9bbd5";
    ctx.font = "400 24px Georgia, serif";
    ctx.fillText(bingoLines(state.marked).length + " / 12 lines  \u2665  made just for us", W / 2, labelY);

    var url = canvas.toDataURL("image/png");
    var link = document.createElement("a");
    link.href = url;
    link.download = "love-bingo-" + todayStr() + ".png";
    document.body.appendChild(link);
    link.click();
    if (link.remove) link.remove();
    if (note) note.textContent = "Saved your card as a picture \u2665";
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, cx, cy, maxWidth, lineHeight) {
    var words = String(text || "").split(/\s+/);
    var lines = [];
    var current = "";
    var i;
    for (i = 0; i < words.length; i += 1) {
      var candidate = current ? current + " " + words[i] : words[i];
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = words[i];
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    var startY = cy - ((lines.length - 1) * lineHeight) / 2;
    for (i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i], cx, startY + i * lineHeight);
    }
  }

  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("DOMContentLoaded", function () {
      try {
        boot();
      } catch (e) {
        /* a missing element must never break the page */
      }
    });
  }
})();
