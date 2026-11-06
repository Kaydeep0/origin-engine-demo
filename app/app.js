import { supportedDates, wasReassessedAt, stateAt, matrixState, GATE_MEANING } from './lib/state.js';

const D = await fetch('./data/origin.json').then((r) => r.json());
const FLOOR = 0.6;
let asOf = supportedDates(D)[0];
let tab = 'funnel';

const TABS = [['funnel', 'Living Funnel'], ['history', 'Thought History'], ['brief', 'Investment Sourcing Brief']];

const el = (tag, p = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(p)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else n.setAttribute(k, v);
  }
  for (const c of [].concat(kids)) if (c) n.append(c);
  return n;
};
const link = (c) => el('a', { href: c.url, target: '_blank', rel: 'noopener noreferrer',
  text: `${c.source_id}${c.date ? ' · ' + c.date : ''}` });
const metric = (k, v, small) => el('div', { class: 'metric' },
  [el('div', { class: 'k', text: k }), el('div', { class: 'v' + (small ? ' small' : ''), text: v })]);

/* Gate cascade, drawn as a schematic. Only G1 was ever evaluated; the rest are
   shown as unlit nodes so "never evaluated" reads as a state, not an absence. */
const gateStrip = (evaluated, never) => {
  const row = el('div', { class: 'gates', role: 'img',
    'aria-label': `Gate ${evaluated} evaluated. Gates ${never.join(', ')} never evaluated.` });
  const all = [evaluated, ...never];
  all.forEach((g, i) => {
    const on = g === evaluated;
    row.append(el('span', { class: 'gate' + (on ? ' on' : '') }, [
      el('span', { class: 'node' }), el('span', { class: 'lbl', text: g }),
    ]));
    // The wire stays unlit throughout: nothing ever advanced past the evaluated gate,
    // and a lit wire would imply flow into a gate that was never run.
    if (i < all.length - 1) row.append(el('span', { class: 'gate' }, [el('span', { class: 'wire' })]));
  });
  return row;
};

/* Tables scroll rather than overflow the page on narrow viewports. */
const scroller = (t) => el('div', { class: 'table-scroll' }, [t]);

/* A section heading with an uppercase eyebrow above it. */
const sectionHead = (eyebrow, title) => el('div', { class: 'section-head' },
  [el('p', { class: 'eyebrow', text: eyebrow }), el('h3', { text: title })]);

/* ---------------------------------------------------------------- chrome */
function chrome() {
  document.getElementById('asof-seg').replaceChildren(...supportedDates(D).map((d) => {
    const b = el('button', { type: 'button', text: d });
    b.setAttribute('aria-pressed', String(d === asOf));
    b.onclick = () => { asOf = d; render(); };
    return b;
  }));
  document.getElementById('banner').innerHTML = `<strong>${D.meta.provisional_banner}</strong>`;
  document.getElementById('asof-note').textContent = D.meta.as_of_note;

  const nav = document.getElementById('tabs');
  nav.replaceChildren(...TABS.map(([id, label]) => {
    const b = el('button', { type: 'button', role: 'tab', text: label });
    b.setAttribute('aria-selected', String(id === tab));
    b.onclick = () => { tab = id; render(); };
    return b;
  }));
  for (const [id] of TABS) document.getElementById(`view-${id}`).classList.toggle('active', id === tab);

  document.getElementById('limitations').innerHTML =
    `<b>What this establishes:</b> ${D.meta.what_this_establishes}<br>` +
    D.meta.limitations.map((l) => `<b>${l.id}:</b> ${l.text}`).join('<br>') +
    `<br>Methodology ${D.meta.methodology_version}, protocol ${D.meta.protocol_version}. ` +
    `No composite score and no investment probability exist in this data.`;
}

/* ------------------------------------------------------- 1. living funnel */
function funnel() {
  const v = document.getElementById('view-funnel');
  v.replaceChildren(
    el('p', { class: 'eyebrow accent', text: '13 thoughts · cohort at ' + asOf }),
    el('h2', { text: 'Living Funnel' }),
    el('p', { class: 'lede', text:
      'All 13 thoughts in the historical cohort. Only G1 has ever been evaluated; G2 to G5 were never run, ' +
      'so no decision is shown for them. MONITOR is a gate decision meaning a condition is unmet. ' +
      'NOT_COMPUTABLE is a matrix state meaning coverage fell below the floor, so no score exists at all.' }),
  );

  const reassessed = D.meta.reassessed_at_later_date;
  if (asOf !== supportedDates(D)[0]) {
    v.append(el('div', { class: 'note-box', html:
      `<b>Only ${reassessed.join(', ')} was reassessed at ${asOf}.</b> The other ` +
      `${D.living_funnel.length - reassessed.length} thoughts are shown in their ` +
      `${supportedDates(D)[0]} state and were not re-run. No other date has been evaluated.` }));
  }

  for (const f of D.living_funnel) {
    const re = wasReassessedAt(D, f.thought_id, asOf);
    const c = el('div', { class: `card ${f.g1_decision}` });
    c.append(el('div', { class: 'tid', text: `${f.thought_id} · as-of ${re ? asOf : f.as_of}${re ? '' : ' (not reassessed at ' + asOf + ')'}` }));
    c.append(el('h3', {}, [el('span', { class: `pill ${f.g1_decision}`, text: f.g1_decision }),
      el('span', { text: '  ' + f.proposition })]));

    const g = el('div', { class: 'grid' });
    g.append(metric('STM score', f.STM.score.toFixed(2)));
    g.append(metric('STM coverage', f.STM.coverage.toFixed(3)));
    g.append(metric('POM score', f.POM.score.toFixed(2)));
    g.append(metric('POM coverage', f.POM.coverage.toFixed(3)));
    c.append(g);
    c.append(gateStrip(f.current_evaluated_gate, f.gates_never_evaluated));

    const ns = f.next_gate_status;
    const ms = matrixState(ns.svm_coverage, FLOOR);
    c.append(el('div', { class: 'note-box', html:
      `<b>Blocked at ${ns.gate}.</b> SVM coverage ${ns.svm_coverage.toFixed(3)} against the ${FLOOR} floor, ` +
      `so SVM is <span class="pill NOT_COMPUTABLE">${ms}</span> &mdash; no score exists, which is different from a low score. ` +
      `Missing: ${ns.missing.join(', ')}. ` +
      `Gates never evaluated: ${f.gates_never_evaluated.join(', ')}.` }));

    if (f.unmet_conditions.length) {
      c.append(el('p', { class: 'lede', style: 'margin:4px 0',
        text: `Unmet G1 condition${f.unmet_conditions.length > 1 ? 's' : ''}: ${f.unmet_conditions.join(', ')} — ${GATE_MEANING.MONITOR}` }));
    }
    if (f.g1_superseded) {
      c.append(el('p', { class: 'lede', style: 'margin:4px 0',
        text: `First-pass G1 was ${f.g1_decision_first_pass}; changed by the WO-009-A STM-2 evidence-measurement correction.` }));
    }
    c.append(el('div', {}, [el('span', { class: 'tag', text: 'primary source' }), link(f.primary_source)]));
    v.append(c);
  }
}

/* ------------------------------------------------------ 2. thought history */
function history() {
  const v = document.getElementById('view-history');
  const h = D.thought_history;
  v.replaceChildren(
    el('p', { class: 'eyebrow accent', text: 'Longitudinal comparison · 1 of 13 reassessed' }),
    el('h2', { text: `Thought History — ${h.thought_id}` }),
    el('p', { class: 'lede', text: h.proposition }));

  const cur = stateAt(h, asOf);
  const other = h.states.find((s) => s.as_of !== asOf);

  const cols = el('div', { class: 'cols' });
  for (const s of h.states) {
    const sel = s.as_of === asOf;
    const c = el('div', { class: 'card' + (sel ? ' ADVANCE' : '') });
    c.append(el('div', { class: 'tid', text: `${s.as_of} · ${s.label}${sel ? ' · showing' : ''}` }));
    const g = el('div', { class: 'grid' });
    g.append(metric('G1', s.g1_decision));
    g.append(metric('STM', s.STM.score.toFixed(2)));
    g.append(metric('POM', s.POM.score.toFixed(2)));
    g.append(metric('SVM', s.SVM.score, true));
    g.append(metric('SVM coverage', s.SVM.coverage.toFixed(3)));
    c.append(g);
    const t = el('table');
    t.append(el('thead', {}, [el('tr', {}, ['Dimension', 'Weight', 'State', 'Anchor', 'Search status']
      .map((x) => el('th', { text: x })))]));
    const tb = el('tbody');
    for (const d of s.svm_dimensions) {
      tb.append(el('tr', {}, [
        el('td', { text: d.dimension_id }),
        el('td', { class: 'num', text: d.weight.toFixed(3) }),
        el('td', {}, [el('span', { class: d.state === 'SCORED' ? 'tag' : 'tag miss', text: d.state })]),
        el('td', { class: 'num', text: d.anchor === null ? '—' : String(d.anchor) }),
        el('td', { text: d.search_status || '—' }),
      ]));
    }
    t.append(tb); c.append(scroller(t));
    c.append(el('div', { class: 'note-box', html: `<b>${s.SVM.blocks}.</b> Coverage ${s.SVM.coverage.toFixed(3)} is below ${s.SVM.floor}, so SVM is NOT_COMPUTABLE.` }));
    cols.append(c);
  }
  v.append(cols);

  const ch = h.changes;
  v.append(sectionHead('State difference', 'What changed between the two states'));
  v.append(el('div', { class: 'note-box ok', html:
    `<b>No anchor moved, coverage is unchanged, and the gate outcome is unchanged.</b> ` +
    `What changed is the precision of the barrier:` }));
  const t2 = el('table');
  t2.append(el('thead', {}, [el('tr', {}, ['Dimension', 'From', 'To', 'Meaning'].map((x) => el('th', { text: x })))]));
  const tb2 = el('tbody');
  for (const c of ch.search_status_changed) {
    tb2.append(el('tr', {}, [el('td', { text: c.dimension_id }), el('td', { text: c.from }),
      el('td', { text: c.to }), el('td', { text: c.meaning })]));
  }
  t2.append(tb2); v.append(scroller(t2));

  v.append(sectionHead('In-window, excluded', 'Evidence found in the window and excluded'));
  v.append(el('p', { class: 'lede', text:
    'Candidates returned by the bounded search that did not change any anchor, with the reason each was excluded.' }));
  const t3 = el('table');
  t3.append(el('thead', {}, [el('tr', {}, ['Source', 'Date', 'Title', 'Attributable', 'Reason excluded'].map((x) => el('th', { text: x })))]));
  const tb3 = el('tbody');
  for (const r of h.rejected_evidence) {
    tb3.append(el('tr', {}, [
      el('td', {}, [link({ source_id: r.source_id, url: r.url })]),
      el('td', { text: r.date }), el('td', { text: r.title }),
      el('td', {}, [el('span', { class: r.attributable ? 'tag' : 'tag miss', text: r.attributable ? 'YES' : 'NO' })]),
      el('td', { text: r.reason }),
    ]));
  }
  t3.append(tb3); v.append(scroller(t3));

  for (const s of h.subsequently_published) {
    v.append(sectionHead('Outside both states', 'Subsequently published evidence'));
    v.append(el('div', { class: 'note-box', html:
      `<b>${s.source_id} · ${s.date}</b> — ${s.title}<br>` +
      `Directly corroborates this proposition, and is <b>excluded from both ${h.states.map((x) => x.as_of).join(' and ')}</b> ` +
      `because it was published after each. It is shown here as subsequently published evidence only, and ` +
      `contributed to no score.` }));
    v.append(el('div', {}, [link({ source_id: s.source_id, date: s.date, url: s.url })]));
  }

  v.append(el('div', { class: 'note-box', style: 'margin-top:16px',
    html: `<b>Why it cannot advance.</b> ${h.why_cannot_advance}` }));
}

/* --------------------------------------------------------- 3. brief */
function brief() {
  const v = document.getElementById('view-brief');
  const b = D.sourcing_brief;
  v.replaceChildren(
    el('p', { class: 'eyebrow accent', text: 'Research briefing · not an investment assessment' }),
    el('h2', { text: `Investment Sourcing Brief — ${b.thought_id}` }));
  v.append(el('div', { class: 'note-box', html:
    `<b>Not an investment assessment.</b> ${b.explicitly_not_claimed.join(' ')}` }));

  let secN = 0;
  const sec = (title, node) => {
    secN += 1;
    v.append(sectionHead(String(secN).padStart(2, '0'), title));
    v.append(node);
  };
  sec('Scientific proposition', el('p', { class: 'lede', text: b.proposition }));
  sec('Why it matters', el('p', { class: 'lede', text: b.why_it_matters }));

  const ev = el('div');
  for (const s of b.supporting_evidence) {
    ev.append(el('div', { class: 'card' }, [
      el('div', { class: 'tid', text: `${s.date} · ${s.type} · ${s.role}` }),
      el('h3', { text: s.title }),
      el('p', { class: 'lede', text: s.role_detail + ' Supports ' + s.anchor_supported + '.' }),
      el('div', {}, [link(s)]),
    ]));
  }
  sec('Available supporting evidence', ev);

  const gs = b.historical_gate_status;
  const gt = el('table');
  gt.append(el('thead', {}, [el('tr', {}, ['Gate', 'Status', 'Detail'].map((x) => el('th', { text: x })))]));
  gt.append(el('tbody', {}, [
    el('tr', {}, [el('td', { text: 'G1' }), el('td', {}, [el('span', { class: 'pill ADVANCE', text: gs.G1.decision })]),
      el('td', { text: 'At ' + gs.G1.at.join(' and ') })]),
    el('tr', {}, [el('td', { text: 'G2' }), el('td', { text: gs.G2.decision }), el('td', { text: gs.G2.reason })]),
    el('tr', {}, [el('td', { text: 'G3–G5' }), el('td', { text: gs.G3_G5.decision }), el('td', { text: '—' })]),
  ]));
  sec('Historical gate status', scroller(gt));

  const bb = b.binding_validation_barrier;
  sec('Binding scientific validation barrier', el('div', { class: 'note-box', html:
    `<b>${bb.dimension}</b> (weight ${bb.weight.toFixed(3)}, search status ${bb.search_status_at_asof}). ${bb.statement}` }));

  const ri = b.researchers_and_institutions;
  const rd = el('div');
  rd.append(el('p', { class: 'lede', text: `${ri.originating_authors} — ${ri.institution}` }));
  const ft = el('table');
  ft.append(el('thead', {}, [el('tr', {}, ['Record', 'Date', 'Detail'].map((x) => el('th', { text: x })))]));
  const ftb = el('tbody');
  for (const f of ri.documented_funding) {
    ftb.append(el('tr', {}, [el('td', {}, [link(f)]), el('td', { text: f.date }), el('td', { text: f.detail })]));
  }
  ft.append(ftb); rd.append(scroller(ft));
  rd.append(el('p', { class: 'lede', text: ri.note }));
  sec('Researchers and institutions', rd);

  sec('Evidence that would justify reassessment',
    el('ul', { class: 'plain' }, b.evidence_that_would_justify_reassessment.map((x) => el('li', { text: x }))));
  sec('Remaining uncertainties',
    el('ul', { class: 'plain' }, b.remaining_uncertainties.map((x) => el('li', { text: x }))));
}

function render() { chrome(); funnel(); history(); brief(); }
render();
