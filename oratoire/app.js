/* Coin Prière — shared settings model + AELF liturgical calendar.
   Used by coin-priere.html (the antechamber) and oratoire.html (the oratory itself). */
(function (global) {
  'use strict';

  var SAINTS = ['jean', 'genevieve', 'beatrix', 'esther', 'anselme',
                'madeleine', 'basile', 'cassien', 'elisabeth', 'hugolin'];

  /* Feast days, [month, day]. Esther has no fixed date (Sunday of the Holy
     Forefathers), so she is absent here and simply never lights up. */
  var FEASTS = {
    pontmain: [1, 17],  jean: [12, 27], genevieve: [1, 3],  beatrix: [7, 29],
    anselme: [4, 21],   madeleine: [7, 22], basile: [1, 2], cassien: [7, 23],
    elisabeth: [11, 5], hugolin: [10, 10]
  };

  var DEFAULTS = {
    disposition: 'iconostase',   // iconostase | cercle
    lumiere: 'cierge',           // veilleuse | cierge | vigile
    legendes: 'complet',         // complet | latin | aucune
    fetes: 1,                    // show feast dates, highlight today's
    flamme: 'animee',            // animee | calme
    pleinecran: 0,               // enter fullscreen on arrival
    nd: 'statue',                // statue | cotellerie
    liturgie: 1,                 // show the AELF liturgical line
    evangile: 'jour',            // jour | demain | deux
    micro: 1,                    // offer the "blow the candle" microphone
    sensibilite: 'normale',      // faible | normale | elevee — how easily it blows out
    saints: SAINTS.slice()
  };

  var KEY = 'coin-priere.reglages';
  var SHORT = { disposition:'d', lumiere:'l', legendes:'g', fetes:'f', flamme:'m',
                pleinecran:'p', nd:'n', liturgie:'lt', evangile:'ev', micro:'mi',
                sensibilite:'sn', saints:'s' };
  var FLAGS = ['fetes', 'pleinecran', 'liturgie', 'micro'];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function fromQuery(qs) {
    var p = new URLSearchParams(qs || ''), out = {}, got = false;
    Object.keys(SHORT).forEach(function (k) {
      var v = p.get(SHORT[k]);
      if (v === null) return;
      got = true;
      if (k === 'saints') {
        out.saints = v === '' ? [] : v.split('.').filter(function (s) {
          return SAINTS.indexOf(s) !== -1;
        });
      } else if (FLAGS.indexOf(k) !== -1) {
        out[k] = v === '1' ? 1 : 0;
      } else {
        out[k] = v;
      }
    });
    return got ? out : null;
  }

  function toQuery(s) {
    var p = new URLSearchParams();
    Object.keys(SHORT).forEach(function (k) {
      p.set(SHORT[k], k === 'saints' ? s.saints.join('.') : String(s[k]));
    });
    return p.toString();
  }

  function load() {
    var s = clone(DEFAULTS), stored = null, q = fromQuery(global.location.search);
    try { stored = JSON.parse(global.localStorage.getItem(KEY) || 'null'); } catch (e) {}
    [stored, q].forEach(function (src) {
      if (!src) return;
      Object.keys(src).forEach(function (k) { if (k in DEFAULTS) s[k] = src[k]; });
    });
    if (!Array.isArray(s.saints)) s.saints = DEFAULTS.saints.slice();
    return s;
  }

  function save(s) {
    try { global.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  function feastToday(slug, now) {
    var f = FEASTS[slug];
    if (!f) return false;
    now = now || new Date();
    return now.getMonth() + 1 === f[0] && now.getDate() === f[1];
  }

  /* ── AELF ──────────────────────────────────────────────────────────
     api.aelf.org serves Access-Control-Allow-Origin: *, so the browser
     can read it directly — no proxy and no build step. One call per day
     covers both the calendar line and the readings. Answers are cached
     in localStorage so a day is fetched at most once per device.        */
  var AELF_CACHE = 'coin-priere.aelf.';

  function ymd(offsetDays) {
    var d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function pruneCache() {
    try {
      var keep = [ymd(0), ymd(1), ymd(-1)];
      for (var i = global.localStorage.length - 1; i >= 0; i--) {
        var k = global.localStorage.key(i);
        if (k && k.indexOf(AELF_CACHE) === 0 && keep.indexOf(k.slice(AELF_CACHE.length)) === -1) {
          global.localStorage.removeItem(k);
        }
      }
    } catch (e) {}
  }

  /* Strip AELF's year markers ("2026 - Année A", "Année B - et C") and tags. */
  function clean(t) {
    return String(t || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/^\s*(\d{4}\s*-\s*)?Ann[ée]e\s+[ABC](\s*-\s*et\s*[ABC])?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function digest(raw) {
    var info = (raw && raw.informations) || {};
    var messe = (raw && raw.messes && raw.messes[0]) || {};
    var ev = null;
    (messe.lectures || []).some(function (l) {
      if (l.type === 'evangile') { ev = l; return true; }
      return false;
    });
    var ligne = info.ligne1 || '';
    if (info.annee) ligne += ' — Année ' + info.annee;
    return {
      ligne: ligne,
      fete: clean(info.fete || info.ligne2 || ''),
      couleur: info.couleur || '',
      evangile: ev ? {
        titre: clean(ev.titre) || (clean(ev.contenu).match(/^.{0,180}?[.!?»]/) || [''])[0] || '',
        ref: (ev.ref || '').trim()
      } : null
    };
  }

  function liturgie(date) {
    var key = AELF_CACHE + date;
    try {
      var hit = global.localStorage.getItem(key);
      if (hit) return Promise.resolve(digest(JSON.parse(hit)));
    } catch (e) {}
    return fetch('https://api.aelf.org/v1/messes/' + date + '/france', { mode: 'cors' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (raw) {
        try { global.localStorage.setItem(key, JSON.stringify(raw)); pruneCache(); } catch (e) {}
        return digest(raw);
      });
  }

  global.CoinPriere = {
    SAINTS: SAINTS, FEASTS: FEASTS, DEFAULTS: DEFAULTS,
    load: load, save: save, toQuery: toQuery, fromQuery: fromQuery,
    feastToday: feastToday, clone: clone,
    ymd: ymd, liturgie: liturgie
  };
})(window);
