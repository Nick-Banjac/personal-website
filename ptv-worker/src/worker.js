/**
 * PTV Timetable proxy — Cloudflare Worker.
 *
 * Signs PTV requests server-side (HMAC-SHA1 via Web Crypto) so the API key never
 * reaches the browser. The static site (nickbanjac.com) calls:
 *
 *   GET /departures?board=alamein
 *   GET /departures?board=camberwell
 *   GET /departures?board=mc-to-alamein
 *   GET /departures?board=alamein-to-mc[&count=4]
 *
 * Secrets (set with `wrangler secret put`):  API_ID, API_KEY
 */

const PTV_BASE = 'https://timetableapi.ptv.vic.gov.au';
const ROUTE_TYPE_TRAIN = 0;

// ---- board definitions (stop/route/direction ids come from PTV /v3 endpoints) ----
const BOARDS = {
  alamein: { label: 'Alamein → City', stopId: 1002 },
  camberwell: {
    label: 'Camberwell → Alamein',
    stopId: 1032,
    routeId: 1,
    directionId: 0,
  },
  'mc-to-alamein': {
    label: 'Melbourne Central → Alamein',
    stopId: 1120,
    merged: true,
    sources: [
      { routeId: 1, directionId: 0 },
      { routeId: 2, directionId: 2, changeAt: 'Camberwell' },
      { routeId: 9, directionId: 8, changeAt: 'Camberwell' },
    ],
    connect: {
      stopId: 1032,
      routeId: 1,
      directionId: 0,
      name: 'Camberwell',
      bufferMins: 2,
      goalStopId: 1002,
      goalName: 'Alamein',
    },
  },
  'alamein-to-mc': {
    label: 'Alamein → Melb Central',
    stopId: 1002,
    merged: true,
    sources: [{ routeId: 1, directionId: 1, changeAt: 'Camberwell' }],
    connect: {
      stopId: 1032,
      directionId: 1,
      name: 'Camberwell',
      bufferMins: 2,
      goalStopId: 1120,
      goalName: 'Melb Central',
    },
  },
};

// ---- signing ----
async function signedUrl(uri, env) {
  const withDev = `${uri}${uri.includes('?') ? '&' : '?'}devid=${env.API_ID}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.API_KEY),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(withDev));
  const sig = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${PTV_BASE}${withDev}&signature=${sig}`;
}

// ---- data helpers ----
async function fetchDepartures(env, { stopId, routeId, directionId, count = 4 }) {
  let uri = `/v3/departures/route_type/${ROUTE_TYPE_TRAIN}/stop/${stopId}`;
  if (routeId != null) uri += `/route/${routeId}`;
  uri += `?max_results=${count}&expand=Direction&expand=Run`;
  if (directionId != null) uri += `&direction_id=${directionId}`;

  const res = await fetch(await signedUrl(uri, env));
  if (!res.ok) throw new Error(`PTV ${res.status}`);
  const data = await res.json();
  const directions = data.directions || {};
  const runs = data.runs || {};

  return (data.departures || []).map((d) => {
    const scheduled = d.scheduled_departure_utc;
    const estimated = d.estimated_departure_utc;
    const when = estimated || scheduled;
    const dir = directions[d.direction_id];
    const run = runs[d.run_ref] || {};
    return {
      runRef: d.run_ref,
      scheduled,
      estimated,
      departsAt: when,
      minutesAway: when ? Math.round((new Date(when) - Date.now()) / 60000) : null,
      isLive: Boolean(estimated),
      platform: d.platform_number || null,
      line: dir ? dir.direction_name : null,
      direction: dir ? dir.direction_name : null,
      destination: run.destination_name || (dir ? dir.direction_name : null),
    };
  });
}

async function runArrivalAtStop(env, runRef, stopId) {
  const uri = `/v3/pattern/run/${encodeURIComponent(runRef)}/route_type/${ROUTE_TYPE_TRAIN}`;
  const res = await fetch(await signedUrl(uri, env));
  if (!res.ok) return null;
  const data = await res.json();
  const stop = (data.departures || []).find((x) => x.stop_id === stopId);
  return stop ? stop.estimated_departure_utc || stop.scheduled_departure_utc || null : null;
}

async function getNextDepartures(env, board, count) {
  const departures = (
    await fetchDepartures(env, {
      stopId: board.stopId,
      routeId: board.routeId,
      directionId: board.directionId,
      count,
    })
  ).slice(0, count);
  departures.forEach((d) => delete d.runRef);
  return { stopId: board.stopId, departures };
}

async function getMergedDepartures(env, board, count) {
  const { sources, connect, stopId } = board;
  const groups = await Promise.all(
    sources.map(async (src) => {
      const list = await fetchDepartures(env, {
        stopId,
        routeId: src.routeId,
        directionId: src.directionId,
        count,
      });
      return list.map((d) => ({ ...d, changeAt: src.changeAt || null }));
    })
  );

  const departures = groups
    .flat()
    .filter((d) => d.departsAt)
    .sort((a, b) => new Date(a.departsAt) - new Date(b.departsAt))
    .slice(0, count);

  if (connect) await addConnections(env, departures, connect);
  departures.forEach((d) => delete d.runRef);
  return { stopId, departures };
}

async function addConnections(env, departures, connect) {
  const bufferMs = (connect.bufferMins ?? 2) * 60000;
  const goalStopId = connect.goalStopId;
  const goalName = connect.goalName;
  const cache = new Map();
  const arrivalAt = (runRef, stop) => {
    const k = `${runRef}|${stop}`;
    if (!cache.has(k)) cache.set(k, runArrivalAtStop(env, runRef, stop));
    return cache.get(k);
  };
  const mins = (a, b) => Math.round((new Date(b) - new Date(a)) / 60000);

  const onward = await fetchDepartures(env, {
    stopId: connect.stopId,
    routeId: connect.routeId,
    directionId: connect.directionId,
    count: 25,
  });

  await Promise.all(
    departures.map(async (d) => {
      if (!d.runRef || !goalStopId) return;

      const ownGoal = await arrivalAt(d.runRef, goalStopId);
      if (ownGoal) {
        d.changeAt = null;
        d.goalName = goalName;
        d.arriveGoalAt = ownGoal;
        d.journeyMins = mins(d.departsAt, ownGoal);
        return;
      }

      d.changeAt = connect.name;
      const arriveInterchange = await arrivalAt(d.runRef, connect.stopId);
      if (!arriveInterchange) return;

      const readyBy = new Date(arriveInterchange).getTime() + bufferMs;
      let chosen = null;
      let arriveGoal = null;
      for (const o of onward) {
        if (!o.runRef || new Date(o.departsAt).getTime() < readyBy) continue;
        const at = await arrivalAt(o.runRef, goalStopId);
        if (at) {
          chosen = o;
          arriveGoal = at;
          break;
        }
      }

      d.connection = {
        station: connect.name,
        goalName,
        arriveAt: arriveInterchange,
        departAt: chosen ? chosen.departsAt : null,
        platform: chosen ? chosen.platform : null,
        waitMins: chosen ? mins(arriveInterchange, chosen.departsAt) : null,
        arriveGoalAt: arriveGoal,
      };
      if (arriveGoal) d.journeyMins = mins(d.departsAt, arriveGoal);
    })
  );
}

// ---- HTTP ----
const CORS = {
  'Access-Control-Allow-Origin': '*', // public train data
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/departures') {
      if (!env.API_ID || !env.API_KEY) return json({ error: 'server not configured' }, 500);

      const boardKey = url.searchParams.get('board') || 'alamein';
      const board = BOARDS[boardKey];
      if (!board) return json({ error: `unknown board "${boardKey}"`, boards: Object.keys(BOARDS) }, 400);

      const count = Math.min(Math.max(Number(url.searchParams.get('count')) || 4, 1), 10);
      try {
        const data = board.merged
          ? await getMergedDepartures(env, board, count)
          : await getNextDepartures(env, board, count);
        return json({ board: boardKey, label: board.label, ...data });
      } catch (err) {
        return json({ error: 'Failed to fetch departures from PTV.' }, 502);
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};
