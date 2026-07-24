/* Live PTV departure boards. Data comes from the Cloudflare Worker that signs
 * PTV requests server-side (see ptv-worker/). Set API_BASE to your Worker URL. */

// ▼▼▼ after `wrangler deploy`, paste your Worker URL here ▼▼▼
const API_BASE = 'https://ptv-proxy.nickbanjac.workers.dev';
// ▲▲▲ e.g. https://ptv-proxy.nickbanjac.workers.dev ▲▲▲

const REFRESH_MS = 30000;

// All Alamein-corridor lines share one navy officially; brightened here for a
// black background. City services stay neutral grey.
const LINE_ACCENT = '#5aa9ff';
const LINE_COLORS = {
  Alamein: LINE_ACCENT,
  Belgrave: LINE_ACCENT,
  Lilydale: LINE_ACCENT,
  City: 'rgba(255,255,255,0.35)',
};

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function minutesLabel(mins) {
  if (mins === null) return 'Scheduled';
  if (mins <= 0) return 'Now';
  return `${mins} min`;
}

function changeTag(changeAt) {
  if (changeAt === undefined) return '';
  if (changeAt === null) return '<span class="departure__tag is-direct">Direct</span>';
  return `<span class="departure__tag is-change">Change at ${changeAt}</span>`;
}

function totalText(mins) {
  return mins != null ? ` · ~${mins} min total` : '';
}

function subLine(d) {
  const c = d.connection;
  if (c) {
    const goal = c.goalName ?? 'destination';
    if (!c.departAt) {
      return `<span class="departure__connect">↳ Arrives ${c.station} ${formatTime(
        c.arriveAt
      )} — no onward service found</span>`;
    }
    const arr = c.arriveGoalAt ? ` · arr ${goal} ${formatTime(c.arriveGoalAt)}` : '';
    return `<span class="departure__connect">↳ ${c.station} ${formatTime(
      c.arriveAt
    )} → ${goal} ${formatTime(c.departAt)}${c.platform ? ` (Plat ${c.platform})` : ''} · ${
      c.waitMins
    } min wait${arr}${totalText(d.journeyMins)}</span>`;
  }
  if (d.arriveGoalAt) {
    return `<span class="departure__connect">↳ Direct · arrives ${
      d.goalName ?? 'destination'
    } ${formatTime(d.arriveGoalAt)}${totalText(d.journeyMins)}</span>`;
  }
  return '';
}

function renderDepartures(listEl, departures) {
  listEl.innerHTML = '';
  departures.forEach((d, i) => {
    const li = document.createElement('li');
    li.className = 'departure' + (i === 0 ? ' departure--next' : '');
    li.style.borderLeftColor = LINE_COLORS[d.line] || 'rgba(255,255,255,0.25)';
    const label = d.destination ?? d.direction ?? '';
    li.innerHTML = `
      <div class="departure__main">
        <span class="departure__time">${formatTime(d.departsAt)}</span>
        <span class="departure__meta">
          <span class="departure__dir">to ${label}${d.platform ? ` · Plat ${d.platform}` : ''}</span>
          <span class="departure__tags">
            <span class="departure__tag ${d.isLive ? 'is-live' : 'is-sched'}">${
              d.isLive ? 'Live' : 'Scheduled'
            }</span>
            ${changeTag(d.changeAt)}
          </span>
        </span>
        <span class="departure__away">${minutesLabel(d.minutesAway)}</span>
      </div>
      ${subLine(d)}
    `;
    listEl.appendChild(li);
  });
}

async function loadBoard(section) {
  const board = section.dataset.board;
  const listEl = section.querySelector('[data-list]');
  const statusEl = section.querySelector('[data-status]');

  statusEl.textContent = 'Loading…';
  statusEl.hidden = false;
  try {
    const res = await fetch(`${API_BASE}/departures?board=${board}&count=4`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    if (!data.departures || data.departures.length === 0) {
      statusEl.textContent = 'No upcoming departures.';
      listEl.innerHTML = '';
      return;
    }
    renderDepartures(listEl, data.departures);
    statusEl.hidden = true;
  } catch (err) {
    console.error(err);
    statusEl.hidden = false;
    statusEl.textContent = 'Could not load departures.';
  }
}

const sections = document.querySelectorAll('[data-board]');
sections.forEach((section) => {
  loadBoard(section);
  section.querySelector('[data-refresh]')?.addEventListener('click', () => loadBoard(section));
});
setInterval(() => sections.forEach(loadBoard), REFRESH_MS);
