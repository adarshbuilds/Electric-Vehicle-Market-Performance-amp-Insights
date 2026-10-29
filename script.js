(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var COLS = [
    { k: 'id', l: 'ID' }, { k: 'manufacturer', l: 'Manufacturer' }, { k: 'model', l: 'Model' },
    { k: 'year', l: 'Year', n: 1 }, { k: 'category', l: 'Category' }, { k: 'battery_tech', l: 'Battery' },
    { k: 'battery_kwh', l: 'kWh', n: 1 }, { k: 'range_km', l: 'Range (km)', n: 1 }
  ];
  var COLORS = ['#0b7285', '#f08c00', '#5c7cfa', '#2f9e44', '#e64980', '#868e96'];
  var state = { all: [], f: { manufacturer: '', year: '', category: '' }, q: '', sort: { k: 'id', dir: 1 } };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function parseCSV(text) {
    var lines = text.trim().split(/\r?\n/);
    var head = lines[0].split(',');
    return lines.slice(1).filter(Boolean).map(function (line) {
      var cells = line.split(','), o = {};
      head.forEach(function (h, i) {
        var v = (cells[i] || '').trim();
        o[h.trim()] = /^(year|battery_kwh|range_km)$/.test(h.trim()) ? Number(v) : v;
      });
      return o;
    });
  }

  function count(rows, key) {
    var m = {};
    rows.forEach(function (r) { m[r[key]] = (m[r[key]] || 0) + 1; });
    return Object.keys(m).map(function (k) { return [k, m[k]]; });
  }

  function filtered() {
    var q = state.q.toLowerCase();
    return state.all.filter(function (r) {
      if (state.f.manufacturer && r.manufacturer !== state.f.manufacturer) return false;
      if (state.f.year && String(r.year) !== state.f.year) return false;
      if (state.f.category && r.category !== state.f.category) return false;
      if (q && !COLS.some(function (c) { return String(r[c.k]).toLowerCase().indexOf(q) > -1; })) return false;
      return true;
    });
  }

  function bars(el, entries) {
    if (!entries.length) { el.innerHTML = '<p class="empty">No records match the current filters.</p>'; return; }
    entries.sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); });
    var max = entries[0][1];
    el.innerHTML = entries.map(function (e) {
      return '<div class="row"><span>' + esc(e[0]) + '</span><div class="track"><div class="fill" style="width:' +
        (e[1] / max * 100) + '%"></div></div><span class="val">' + e[1] + '</span></div>';
    }).join('');
  }

  function cols(el, entries) {
    var max = Math.max.apply(null, entries.map(function (e) { return e[1]; }));
    if (!max) { el.innerHTML = '<p class="empty">No records match the current filters.</p>'; return; }
    el.innerHTML = entries.map(function (e) {
      return '<div class="col" title="' + esc(e[0]) + ': ' + e[1] + '">' + e[1] + '<i style="height:' +
        (e[1] / max * 80) + '%"></i><span>' + esc(e[0]) + '</span></div>';
    }).join('');
  }

  function donut(el, entries) {
    var total = entries.reduce(function (s, e) { return s + e[1]; }, 0);
    if (!total) { el.innerHTML = '<p class="empty">No records match the current filters.</p>'; return; }
    entries.sort(function (a, b) { return b[1] - a[1]; });
    var acc = 0, stops = [];
    entries.forEach(function (e, i) {
      var from = acc / total * 100; acc += e[1];
      stops.push(COLORS[i % COLORS.length] + ' ' + from + '% ' + (acc / total * 100) + '%');
    });
    el.innerHTML = '<div class="donut" role="img" aria-label="Category share" style="background:conic-gradient(' + stops.join(',') + ')"></div><ul class="legend">' +
      entries.map(function (e, i) {
        return '<li><s style="background:' + COLORS[i % COLORS.length] + '"></s>' + esc(e[0]) + ': ' + e[1] +
          ' (' + Math.round(e[1] / total * 100) + '%)</li>';
      }).join('') + '</ul>';
  }

  function rangeBins(rows) {
    var bins = [['<300', 0], ['300–399', 0], ['400–499', 0], ['500–599', 0], ['600+', 0]];
    rows.forEach(function (r) { bins[Math.min(4, Math.max(0, Math.floor(r.range_km / 100) - 2))][1]++; });
    return bins;
  }

  function renderTable(rows) {
    var s = state.sort, col = COLS.filter(function (c) { return c.k === s.k; })[0];
    rows = rows.slice().sort(function (a, b) {
      var x = a[s.k], y = b[s.k];
      return (col.n ? x - y : String(x).localeCompare(String(y))) * s.dir;
    });
    $('#tbody').innerHTML = rows.length ? rows.map(function (r) {
      return '<tr>' + COLS.map(function (c) { return '<td>' + esc(r[c.k]) + '</td>'; }).join('') + '</tr>';
    }).join('') : '<tr><td colspan="' + COLS.length + '" class="empty">No records match. Clear the search or reset the filters.</td></tr>';
    $('#thead').querySelectorAll('th').forEach(function (th, i) {
      var on = COLS[i].k === s.k;
      th.setAttribute('aria-sort', on ? (s.dir > 0 ? 'ascending' : 'descending') : 'none');
      th.querySelector('em').textContent = on ? (s.dir > 0 ? '▲' : '▼') : '';
    });
  }

  function render() {
    var all = state.all.filter(function (r) {   // filters only (not search) drive KPIs and charts
      return (!state.f.manufacturer || r.manufacturer === state.f.manufacturer) &&
        (!state.f.year || String(r.year) === state.f.year) &&
        (!state.f.category || r.category === state.f.category);
    });
    var tbl = filtered();
    $('#k-total').textContent = all.length;
    $('#k-range').textContent = all.length ? Math.round(all.reduce(function (s, r) { return s + r.range_km; }, 0) / all.length) : '–';
    $('#k-mfr').textContent = count(all, 'manufacturer').length;
    $('#k-batt').textContent = count(all, 'battery_tech').length;
    bars($('#c-manufacturer'), count(all, 'manufacturer'));
    bars($('#c-battery'), count(all, 'battery_tech'));
    donut($('#c-category'), count(all, 'category'));
    var years = count(all, 'year').sort(function (a, b) { return a[0] - b[0]; });
    cols($('#c-year'), years);
    cols($('#c-range'), rangeBins(all));
    $('#count').textContent = '(' + tbl.length + ' shown)';
    renderTable(tbl);
  }

  function fill(id, values) {
    var sel = $(id);
    values.forEach(function (v) { var o = document.createElement('option'); o.value = o.textContent = v; sel.appendChild(o); });
  }

  function init(rows) {
    state.all = rows;
    var uniq = function (k, num) {
      var u = Array.from(new Set(rows.map(function (r) { return r[k]; })));
      return num ? u.sort(function (a, b) { return a - b; }) : u.sort();
    };
    fill('#f-manufacturer', uniq('manufacturer'));
    fill('#f-year', uniq('year', true));
    fill('#f-category', uniq('category'));
    $('#thead').innerHTML = COLS.map(function (c) {
      return '<th scope="col" aria-sort="none"><button type="button" data-k="' + c.k + '">' + c.l + ' <em></em></button></th>';
    }).join('');
    $('#thead').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.sort = { k: b.dataset.k, dir: state.sort.k === b.dataset.k ? -state.sort.dir : 1 };
      render();
    });
    [['manufacturer', '#f-manufacturer'], ['year', '#f-year'], ['category', '#f-category']].forEach(function (p) {
      $(p[1]).addEventListener('change', function (e) { state.f[p[0]] = e.target.value; render(); });
    });
    $('#search').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });
    $('#reset').addEventListener('click', function () {
      state.f = { manufacturer: '', year: '', category: '' }; state.q = '';
      ['#f-manufacturer', '#f-year', '#f-category', '#search'].forEach(function (s) { $(s).value = ''; });
      render();
    });
    render();
  }

  fetch('data.csv')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(function (t) { init(parseCSV(t)); })
    .catch(function (err) {
      var e = $('#error'); e.hidden = false;
      e.textContent = 'Could not load data.csv (' + err.message + '). Serve the folder over HTTP (for example, run "python3 -m http.server") instead of opening index.html directly.';
    });
})();
