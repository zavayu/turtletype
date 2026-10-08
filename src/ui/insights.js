import { formatPercent } from '../analytics/metrics.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const el = (tag, className = '', text = '') => {
  const item = document.createElement(tag);
  item.className = className;
  item.textContent = text;
  return item;
};
const svgEl = (tag, attributes = {}) => {
  const item = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) item.setAttribute(key, String(value));
  return item;
};
const percent = formatPercent;
const shortDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'earlier' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
let selectedComparison = null;

// Group speed charts by settings so unlike tests are not compared directly.
function comparison(session) {
  if (session.textStyle === 'passage') return { key: `passage:${session.passageLength || 'short'}`, label: `${session.passageLength || 'short'} passages` };
  const kind = session.testKind === 'words' ? 'words' : 'time';
  const amount = session.testLimit || (kind === 'time' ? 30 : 50);
  const style = session.textStyle || 'words';
  const tier = session.corpusTier || 'original';
  return { key: `${style}:${kind}:${amount}:${tier}`, label: `${style} · ${amount} ${kind === 'time' ? 'sec' : 'words'} · ${tier}` };
}

function addMetric(parent, value, label) {
  const metric = el('div', 'summary-metric');
  metric.append(el('strong', '', String(value)), el('span', '', label));
  parent.append(metric);
}

function trendChart(title, sessions, field, unit) {
  const figure = el('figure', 'trend-chart');
  const heading = el('div', 'chart-heading');
  heading.append(el('h2', '', title));
  // Limit the chart to recent tests so it stays readable as history grows.
  const values = sessions.slice(-20).map((session) => ({ value: Number(session[field]), date: session.date, mode: comparison(session).label, style: session.passageTitle || session.textStyle || 'words' })).filter((item) => Number.isFinite(item.value));
  heading.append(el('strong', '', values.length ? `${field === 'accuracy' ? percent(values.at(-1).value) : `${values.at(-1).value} ${unit}`}` : '—'));
  figure.append(heading);
  if (values.length < 2) {
    figure.append(el('p', 'chart-empty', 'Complete another test to see a trend.'));
    return figure;
  }

  const numbers = values.map((item) => item.value);
  const low = Math.min(...numbers), high = Math.max(...numbers);
  const padding = Math.max(field === 'accuracy' ? 1 : 3, (high - low) * 0.18);
  const min = Math.max(0, low - padding);
  const max = field === 'accuracy' ? Math.min(100, high + padding) : high + padding;
  const ceiling = max === min ? max + 1 : max;
  const x0 = 70, x1 = 624, y0 = 18, y1 = 158;
  const points = values.map((item, index) => ({
    x: x0 + index / (values.length - 1) * (x1 - x0),
    y: y1 - (item.value - min) / (ceiling - min) * (y1 - y0),
    ...item,
  }));
  const svg = svgEl('svg', { viewBox: '0 0 640 180', role: 'img', 'aria-label': `${title} across ${values.length} tests, oldest to newest: ${numbers.map((number) => field === 'accuracy' ? percent(number) : `${number} ${unit}`).join(', ')}` });
  svg.classList.add('chart-svg');
  for (const y of [y0, (y0 + y1) / 2, y1]) svg.append(svgEl('line', { x1: x0, x2: x1, y1: y, y2: y, class: 'chart-gridline' }));
  for (const [value, y] of [[ceiling, y0 + 5], [min, y1]]) {
    const label = svgEl('text', { x: 0, y, class: 'chart-y-label' });
    label.textContent = field === 'accuracy' ? percent(value) : String(Math.round(value));
    svg.append(label);
  }
  svg.append(svgEl('polyline', { points: points.map((point) => `${point.x},${point.y}`).join(' '), class: 'chart-line' }));
  for (const point of points) {
    const dot = svgEl('circle', { cx: point.x, cy: point.y, r: 4, class: 'chart-dot' });
    const tooltip = svgEl('title');
    tooltip.textContent = `${shortDate(point.date)} · ${point.mode} · ${point.style}: ${field === 'accuracy' ? percent(point.value) : `${point.value} ${unit}`}`;
    dot.append(tooltip);
    svg.append(dot);
  }
  figure.append(svg);
  const axis = el('div', 'chart-axis');
  axis.append(el('span', '', shortDate(values[0].date)), el('span', '', 'each dot = one test'), el('span', '', shortDate(values.at(-1).date)));
  figure.append(axis);
  return figure;
}

function cell(text, label) {
  const item = el('td', '', text);
  item.dataset.label = label;
  return item;
}

function paceLabel(pattern) {
  if (pattern.slowdown === null) return 'not enough timing';
  if (Math.abs(pattern.slowdown) < 5) return 'near baseline';
  return `${Math.abs(pattern.slowdown)}% ${pattern.slowdown > 0 ? 'slower' : 'faster'}`;
}

function patternSection(title, description, patterns, onPractice) {
  const section = el('section', 'insight-section');
  section.append(el('h2', '', title), el('p', 'section-description', description));
  if (!patterns.length) {
    section.append(el('p', 'section-empty', 'No repeat trouble has enough data to rank yet.'));
    return section;
  }
  const table = el('table', 'pattern-table');
  const head = el('thead');
  const headings = el('tr');
  for (const label of ['pattern', 'seen', 'errors', 'pace', 'examples', '']) headings.append(el('th', '', label));
  head.append(headings);
  const body = el('tbody');
  for (const pattern of patterns) {
    const row = el('tr');
    const name = cell('', 'pattern');
    name.append(el('strong', 'pattern-name', pattern.text));
    if (pattern.status === 'early') name.append(el('small', 'early-label', 'early signal'));
    row.append(name);
    row.append(cell(`${pattern.attempts} times`, 'seen'));
    row.append(cell(`${pattern.errors}/${pattern.attempts} · ${percent(pattern.errorRate * 100)}`, 'errors'));
    row.append(cell(paceLabel(pattern), 'pace'));
    row.append(cell(pattern.words.slice(0, 3).join(', '), 'examples'));
    const action = cell('', '');
    const button = el('button', 'practice-link', 'practice →');
    button.type = 'button';
    button.setAttribute('aria-label', `Practice ${pattern.text}`);
    button.addEventListener('click', () => onPractice(pattern));
    action.append(button);
    row.append(action);
    body.append(row);
  }
  table.append(head, body);
  section.append(table);
  return section;
}

function compactList(title, description, items, format) {
  const section = el('section', 'compact-insight');
  section.append(el('h2', '', title), el('p', 'section-description', description));
  if (!items.length) { section.append(el('p', 'section-empty', 'No results yet.')); return section; }
  const list = el('ol');
  for (const item of items.slice(0, 5)) {
    const row = el('li');
    row.append(el('strong', '', item.text), el('span', '', format(item)));
    list.append(row);
  }
  section.append(list);
  return section;
}

function trainingHistory(groups) {
  const section = el('section', 'training-history');
  section.append(el('h2', '', 'practice history'), el('p', 'section-description', 'Focus lines and word sprint attempts are saved here. The charts above use completed tests.'));
  if (!groups.length) {
    section.append(el('p', 'section-empty', 'Complete a practice attempt to see its history here.'));
    return section;
  }
  const list = el('ol');
  for (const group of groups.slice(0, 6)) {
    const first = group.sessions[0];
    const latest = group.sessions.at(-1);
    const row = el('li');
    row.append(el('strong', '', group.text), el('span', '', `${group.sessions.length} ${group.sessions.length === 1 ? 'attempt' : 'attempts'}`));
    if (latest.practiceKind === 'sprint') {
      const clears = group.sessions.filter((session) => session.sprint?.passed);
      const best = clears.length ? Math.min(...clears.map((session) => session.sprint.elapsedMs)) : null;
      row.append(el('span', '', `${clears.length} cleared${best === null ? '' : ` · best ${(best / 1000).toFixed(2)}s`}`));
    } else {
      row.append(el('span', '', `${percent(first.accuracy)} → ${percent(latest.accuracy)} key accuracy`));
    }
    list.append(row);
  }
  section.append(list);
  return section;
}

export function renderInsights(root, data, onPractice) {
  root.replaceChildren();
  if (!data.tests.length) {
    root.append(el('p', 'empty-message', 'Complete a typing test to start building your baseline.'), trainingHistory(data.practiceGroups));
    return;
  }
  const intro = el('p', 'insight-intro', 'Speed trends compare tests with the same settings. Key and pattern insights use every completed test.');
  // The selector controls which comparable test group feeds the speed chart
  // and summary, while accuracy and pattern data still use all tests.
  const groups = new Map();
  for (const session of data.tests) {
    const mode = comparison(session);
    if (!groups.has(mode.key)) groups.set(mode.key, { label: mode.label, sessions: [] });
    groups.get(mode.key).sessions.push(session);
  }
  const latestKey = comparison(data.tests.at(-1)).key;
  if (!groups.has(selectedComparison)) selectedComparison = latestKey;
  const selector = el('select', 'comparison-select');
  selector.setAttribute('aria-label', 'Speed comparison mode');
  for (const [key, group] of groups) {
    const option = el('option', '', `${group.label} (${group.sessions.length})`);
    option.value = key;
    selector.append(option);
  }
  selector.value = selectedComparison;
  selector.addEventListener('change', () => { selectedComparison = selector.value; renderInsights(root, data, onPractice); });
  const selected = groups.get(selectedComparison).sessions;
  const speeds = selected.filter(session => Number.isFinite(session.wpm));
  const averageWpm = speeds.length ? Math.round(speeds.reduce((sum, session) => sum + session.wpm, 0) / speeds.length) : '—';
  const summary = el('div', 'summary-row');
  addMetric(summary, selected.length, 'matching tests');
  addMetric(summary, averageWpm, 'average wpm');
  addMetric(summary, data.accuracy === null ? '—' : percent(data.accuracy), 'all-test key accuracy');
  addMetric(summary, data.practice.length, 'practice attempts');
  const charts = el('div', 'chart-grid');
  charts.append(trendChart('speed', selected, 'wpm', 'wpm'), trendChart('accuracy', selected, 'accuracy', '%'));
  const note = el('p', 'data-note', `${data.tests.length} completed tests feed key and pattern insights. ${data.detailedTests} have detailed timing. “Early signal” means fewer than 8 attempts or fewer than 2 distinct words.`);
  root.append(intro, selector, summary, charts, note);
  root.append(patternSection('word patterns', 'Three to five letters within a word. An error means at least one wrong key in that occurrence. Pace compares time per transition with your clean-key baseline.', data.longPatterns, onPractice));
  root.append(patternSection('key transitions', 'Two-letter sequences within a word. Counts are across completed tests.', data.pairs, onPractice));
  const details = el('div', 'detail-grid');
  details.append(
    compactList('keys', 'Wrong keypresses out of all attempts at that key.', data.keys, (item) => `${item.errors}/${item.attempts} errors`),
    compactList('words', 'Ranked by mistakes per attempt, then average time per character.', data.words, (item) => `${item.errors} errors in ${item.attempts} ${item.attempts === 1 ? 'try' : 'tries'} · ${Math.round(item.msPerCharacter)} ms/key`),
    compactList('punctuation', 'Mistakes on punctuation marks in completed tests.', data.punctuation, (item) => `${item.errors}/${item.attempts} errors`),
    compactList('capital letters', 'Uppercase letter attempts in completed tests.', data.capitals.attempts ? [{ text: 'A–Z', ...data.capitals }] : [], (item) => `${item.errors}/${item.attempts} errors`),
  );
  root.append(details, trainingHistory(data.practiceGroups));
}
