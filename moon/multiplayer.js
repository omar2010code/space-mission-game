// ---------- Multiplayer: Moon challenges ----------
// Loaded by moon/index.html when it is opened with ?mp=1. GitHub Pages cannot run a game server, so a "server" is
// a player's own browser: the player who creates it hosts it, and the others connect straight to that browser
// (peer to peer, WebRTC). Players find each other through free public relays (Nostr), using the Trystero library.
// Open with ?mp=local to test with several tabs on one computer, without the internet.
// Challenge 1, race: everyone starts at their own spacecraft. First to take a sample from the rover and bring it
//   back to their own spacecraft wins. You see how far each opponent is from the rover, then from their spacecraft.
// Challenge 2, materials: everyone drives on the same map for 2 minutes, picking up materials lying on the ground.
//   They are spread 100 to 500 m apart, and rarer materials are worth more. The highest score wins.

const APP = 'hazlaoum-space-mission-2026', MAX = 4, MATS_TIME = 120;
const COLORS = ['#7fd4ff', '#ffb347', '#6fe39a', '#ff8ad8'];
const RARITY = [                                       // [name, points, colour, chance]
  ['Moon rock', 10, '#c9cad0', 0.60],
  ['Water ice', 25, '#7fd4ff', 0.25],
  ['Helium-3 crystal', 50, '#6fe39a', 0.12],
  ['Meteorite gold', 100, '#ffcf5a', 0.03],
];
const params = new URLSearchParams(location.search);
const LOCAL = params.get('mp') === 'local';
const m = v => Math.round(v / PX_PER_M);              // pixels to metres
const fmtM = v => `${m(v).toLocaleString('en-US')} m`;

Object.assign(MP, {
  name: '', host: false, hostId: null, num: 0, id: null, roster: [], mode: 'race', state: 'lobby',
  lobby: null, room: null, ads: new Map(), remote: {}, items: [], taken: {}, scores: {}, status: {}, timer: 0,
  count: 0, playing: false, adTimer: null, posT: 0, result: null,
});

// ---------- the network ----------
// Players find each other through three kinds of free public relays at once (Nostr, BitTorrent trackers, MQTT),
// so it still works when a network blocks one of them. Every player has their own id (PID) that travels inside
// each message, so it does not matter which relay a message came through. Duplicates are dropped.
const PID = Math.random().toString(36).slice(2, 10);
const STRATS = LOCAL ? ['local'] : ['nostr', 'torrent', 'mqtt'];
// TURN relay: when two players' networks cannot connect directly (different Wi-Fi, mobile data), the game data goes
// through this relay instead (a free ExpressTURN account).
const TURN = [{
  urls: ['turn:free.expressturn.com:3478', 'turn:free.expressturn.com:3478?transport=tcp'],
  username: '000000002110049658',
  credential: '1V/JY/m+rHfxxcxuf9nwEKdhf/A=',
}];
const mods = {};                                       // the loaded relay libraries, by name
async function loadStrats() {
  if (LOCAL) return ['local'];
  const ok = [];
  await Promise.all(STRATS.map(async st => {
    try { mods[st] = mods[st] || await import(`https://cdn.jsdelivr.net/npm/trystero@0.21.4/${st}/+esm`); ok.push(st); } catch (e) { console.warn('relay type unavailable', st, e); }
  }));
  return ok;
}
function subRoom(st, id) {                             // one room on one kind of relay: send(type, msg), on(type, f(msg, peer))
  if (st === 'local') return localRoom(id);
  const r = mods[st].joinRoom(TURN.length ? { appId: APP, turnConfig: TURN } : { appId: APP }, id), acts = {}, handlers = {}, joinF = [], leaveF = [];
  const act = type => acts[type] || (acts[type] = (() => { const [send, get] = r.makeAction(type); get((d, p) => (handlers[type] || []).forEach(f => f(d, p))); return send; })());
  r.onPeerJoin(p => joinF.forEach(f => f(p))); r.onPeerLeave(p => leaveF.forEach(f => f(p)));
  return { send: (type, msg) => { try { act(type)(msg); } catch (e) {} }, on: (type, f) => { act(type); (handlers[type] = handlers[type] || []).push(f); },
           onJoin: f => joinF.push(f), onLeave: f => leaveF.push(f), leave: () => { try { r.leave(); } catch (e) {} } };
}
let seq = 0;
async function openRoom(id) {
  const strats = await loadStrats();
  if (!strats.length) throw new Error('no relays');
  const subs = strats.map(st => [st, subRoom(st, id)]), handlers = {}, joinF = [], leaveF = [], seen = new Set();
  const peersOf = new Map();                           // player id -> the relay peers it is reachable through
  const room = {
    self: PID,
    send: (type, v, to) => { const msg = { from: PID, to, n: ++seq, v }; for (const [, sub] of subs) sub.send(type, msg); },
    on: (type, f) => { if (!handlers[type]) { handlers[type] = []; for (const [st, sub] of subs) sub.on(type, (msg, peer) => {
        if (!msg || msg.from === PID || (msg.to && msg.to !== PID)) return;
        const key = msg.from + ':' + msg.n; if (seen.has(key)) return; seen.add(key); if (seen.size > 4000) seen.clear();
        const set = peersOf.get(msg.from) || new Set(); if (!peersOf.has(msg.from)) { peersOf.set(msg.from, set); joinF.forEach(g => g(msg.from)); } set.add(st + ':' + peer);
        handlers[type].forEach(g => g(msg.v, msg.from));
      }); }
      handlers[type].push(f); },
    onJoin: f => { joinF.push(f); for (const [, sub] of subs) sub.onJoin(() => f(null)); },   // null: someone new arrived, not yet known who
    onLeave: f => leaveF.push(f),
    leave: () => subs.forEach(([, sub]) => sub.leave()),
    strats,
  };
  for (const [st, sub] of subs) sub.onLeave(peer => {   // a player has left once no relay can reach them any more
    for (const [pid, set] of peersOf) if (set.delete(st + ':' + peer) && !set.size) { peersOf.delete(pid); leaveF.forEach(f => f(pid)); }
  });
  return room;
}
// A stand-in for testing: tabs of one browser talk through a BroadcastChannel.
function localRoom(id) {
  const ch = new BroadcastChannel('hz-' + id), handlers = {}, joinF = [], leaveF = [], peers = new Map(), TAB = Math.random().toString(36).slice(2, 10);
  const post = (type, data) => ch.postMessage({ tab: TAB, type, data });
  ch.onmessage = ({ data: m2 }) => {
    if (m2.tab === TAB) return;
    const fresh = !peers.has(m2.tab); peers.set(m2.tab, Date.now());
    if (m2.type === '__bye') { peers.delete(m2.tab); leaveF.forEach(f => f(m2.tab)); return; }
    if (fresh) joinF.forEach(f => f(m2.tab));
    if (m2.type === '__hi') post('__hey');
    if (m2.type.startsWith('__')) return;
    (handlers[m2.type] || []).forEach(f => f(m2.data, m2.tab));
  };
  post('__hi');
  const iv = setInterval(() => { post('__hey'); for (const [p, t] of peers) if (Date.now() - t > 5000) { peers.delete(p); leaveF.forEach(f => f(p)); } }, 1500);
  addEventListener('pagehide', () => post('__bye'));
  return { send: (type, d) => post(type, d), on: (type, f) => (handlers[type] = handlers[type] || []).push(f),
           onJoin: f => joinF.push(f), onLeave: f => leaveF.push(f), leave: () => { post('__bye'); clearInterval(iv); ch.close(); } };
}
const me = () => PID;                                  // safe to call any time, even before the network is up

// ---------- the lobby: numbered servers ----------
const $$ = id => document.getElementById(id);
function showMp(s) { show(s); for (const id of ['mpLobby', 'mpRoom', 'mpResult']) $$(id).classList.toggle('on', id === s); }
function lobbyStatus(t, bad) { $$('mpStatus').textContent = t; $$('mpStatus').style.color = bad ? '#ff9aa2' : '#8f93b8'; }
async function enterLobby() {
  showMp('mpLobby'); renderAds();
  if (MP.lobby) return;
  lobbyStatus(LOCAL ? 'Test mode: tabs on this computer only.' : 'Connecting to the multiplayer network...');
  try { MP.lobby = await openRoom('lobby'); } catch (e) { lobbyStatus('Could not load the multiplayer system. Check your internet connection.', true); return; }
  MP.lobby.on('ad', (ad, p) => { MP.ads.set(ad.id, { ...ad, host: p, seen: Date.now() }); renderAds(); });   // p: the host's player id
  MP.lobby.on('adgone', (ad) => { MP.ads.delete(ad.id); renderAds(); });
  if (!LOCAL) setTimeout(checkRelays, 5000);
  if (!LOCAL) setInterval(checkRelays, 15000);
  setInterval(() => { let gone = false; for (const [k, a] of MP.ads) if (Date.now() - a.seen > 7000) { MP.ads.delete(k); gone = true; } if (gone) renderAds(); }, 2000);
}
// Can this browser make direct player-to-player connections (WebRTC)? Some browsers and settings block them, for
// example Brave with strict privacy settings. A browser that allows them gets a public address from a STUN server
// (a "srflx" candidate); one that blocks them gets none. Connecting two tabs on the same computer is not a fair test:
// many home routers cannot connect a computer back to itself, even though players on other networks connect fine.
let rtcOk = null;
(async () => {
  if (LOCAL) { rtcOk = true; return; }
  try {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] });
    let pub = false; pc.onicecandidate = e => { if (e.candidate && / typ srflx /.test(e.candidate.candidate)) pub = true; };
    pc.createDataChannel('test'); await pc.setLocalDescription(await pc.createOffer());
    for (let i = 0; i < 50 && !pub && pc.iceGatheringState !== 'complete'; i++) await new Promise(r => setTimeout(r, 100));
    rtcOk = pub; pc.close();
  } catch (e) { rtcOk = false; }
})();
function checkRelays() {                              // say which kinds of relay this network can reach
  const up = Object.entries(mods).filter(([, md]) => { try { return Object.values(md.getRelaySockets ? md.getRelaySockets() : {}).some(ws => ws && ws.readyState === 1); } catch (e) { return false; } }).map(([k]) => k);
  if (rtcOk === false) lobbyStatus('This browser is blocking direct connections between players (WebRTC), so multiplayer cannot work here. In Brave: turn Shields off for this site and set Settings → Privacy → WebRTC IP handling policy to "Default". Or play in Chrome or Edge.', true);
  else if (!up.length) lobbyStatus("Can't reach any multiplayer relay from this network. Try another network (a phone hotspot often works), or turn off blockers such as Brave Shields for this site.", true);
  else lobbyStatus(`Connected through ${up.length} of 3 relay networks. Servers appear here as players create them. To test, use two different devices: two tabs on one computer often cannot connect to each other.`);
}
function renderAds() {
  const list = [...MP.ads.values()].sort((a, b) => a.num - b.num);
  $$('mpServers').innerHTML = list.length ? list.map(a => `<div class="srv"><b>Server ${a.num}</b><span>${esc(a.name)}'s server</span>
    <span>${a.players}/${MAX} players</span><span>${a.mode === 'mats' ? 'Materials hunt' : 'Race to the rover'}</span>
    ${a.state === 'waiting' && a.players < MAX ? `<span class="btn" data-join="${a.id}">Join</span>` : `<span class="dim">${a.state === 'waiting' ? 'full' : 'playing'}</span>`}</div>`).join('')
    : '<div class="dim" style="padding:1.2cqw">No servers yet. Create one, and your friends will see it here.</div>';
  $$('mpServers').querySelectorAll('[data-join]').forEach(el => el.onclick = () => join(MP.ads.get(el.dataset.join)));
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function myName() { const v = $$('mpName').value.trim().slice(0, 16) || 'Astronaut'; try { localStorage.setItem('hazlaoum.mpname', v); } catch (e) {} return v; }

// ---------- a server: the host's side ----------
async function createServer() {
  if (!MP.lobby) { lobbyStatus('Still connecting to the multiplayer network... try again in a moment.', true); return; }
  const used = new Set([...MP.ads.values()].map(a => a.num));
  let num = 1; while (used.has(num)) num++;
  Object.assign(MP, { host: true, num, id: Math.random().toString(36).slice(2, 10), name: myName(), state: 'waiting', mode: 'race' });
  try { MP.room = await openRoom('srv-' + MP.id); } catch (e) { lobbyStatus('Could not create a server: the multiplayer network is not reachable.', true); return; }
  MP.hostId = PID;
  MP.roster = [{ id: PID, name: MP.name, slot: 0 }];
  wireRoom();
  MP.room.on('hi', (d, p) => {                          // a player asks to join
    if (MP.roster.some(r => r.id === p)) return;
    if (MP.state !== 'waiting' || MP.roster.length >= MAX) { MP.room.send('nope', { why: MP.state !== 'waiting' ? 'The game has already started.' : 'The server is full.' }, p); return; }
    const taken = new Set(MP.roster.map(r => r.slot)); let slot = 0; while (taken.has(slot)) slot++;
    MP.roster.push({ id: p, name: String(d.name || 'Astronaut').slice(0, 16), slot }); sendRoster();
  });
  MP.room.on('pick', (d, p) => hostPick(d.i, p));
  MP.room.on('home', (d, p) => hostHome(p, d.t));
  MP.room.on('out', (d, p) => { MP.status[p] = 'out'; MP.room.send('stat', { id: p, s: 'out' }); checkRaceOver(); });
  MP.room.onLeave(p => { MP.roster = MP.roster.filter(r => r.id !== p); delete MP.remote[p]; sendRoster(); if (MP.playing && MP.mode === 'race') { MP.status[p] = 'left'; checkRaceOver(); } });
  advertise(); MP.adTimer = setInterval(advertise, 2000);
  showRoom();
}
function advertise() { if (MP.lobby) MP.lobby.send('ad', { id: MP.id, num: MP.num, name: MP.name, players: MP.roster.length, mode: MP.mode, state: MP.state }); }
function sendRoster() { MP.room.send('roster', { roster: MP.roster, mode: MP.mode, num: MP.num, state: MP.state }); advertise(); renderRoom(); }

// ---------- a server: a player's side ----------
async function join(ad) {
  if (!ad) return;
  Object.assign(MP, { host: false, num: ad.num, id: ad.id, hostId: ad.host, name: myName(), state: 'joining', roster: [] });
  lobbyStatus(`Joining server ${ad.num}...`);
  try { MP.room = await openRoom('srv-' + ad.id); } catch (e) { lobbyStatus('Could not join: the multiplayer network is not reachable.', true); return; }
  wireRoom();
  const hello = () => { if (MP.state === 'joining' && MP.room) MP.room.send('hi', { name: MP.name }, MP.hostId); };
  MP.room.onJoin(hello);                                // say hello whenever a new connection opens, and keep asking until the host answers
  hello(); const helloT = setInterval(() => { if (MP.state !== 'joining') clearInterval(helloT); else hello(); }, 1500);
  MP.room.on('nope', d => { leaveRoom(); lobbyStatus(d.why, true); });
  MP.room.on('roster', d => { const first = MP.state === 'joining'; Object.assign(MP, { roster: d.roster, mode: d.mode, state: d.state === 'playing' && !MP.playing ? MP.state : d.state }); if (first) { MP.state = 'waiting'; showRoom(); } else renderRoom(); });
  MP.room.on('start', d => begin(d.mode, d.seed));
  MP.room.on('taken', d => { MP.taken = d.taken; MP.scores = d.scores; });
  MP.room.on('stat', d => { MP.status[d.id] = d.s; });
  MP.room.on('result', d => showResult(d));
  MP.room.onLeave(p => { delete MP.remote[p]; if (p === MP.hostId) { leaveRoom(); enterLobby(); lobbyStatus('The host closed the server.', true); } });
  setTimeout(() => { if (MP.state === 'joining') { leaveRoom(); lobbyStatus(`Could not connect to server ${ad.num}. It may have closed.`, true); } }, 15000);
}
function wireRoom() {                                   // messages everyone handles
  MP.room.on('pos', (d, p) => { const r = MP.remote[p] || (MP.remote[p] = { ...d, dx: d.x, dy: d.y, da: d.ang }); Object.assign(r, d); });
}
function leaveRoom() {
  if (MP.room) { if (MP.host && MP.lobby) MP.lobby.send('adgone', { id: MP.id }); MP.room.leave(); }
  clearInterval(MP.adTimer);
  Object.assign(MP, { room: null, host: false, roster: [], remote: {}, state: 'lobby', playing: false });
}

// ---------- the waiting room ----------
function showRoom() { showMp('mpRoom'); renderRoom(); }
function renderRoom() {
  if (screen !== 'mpRoom') return;
  $$('mpRoomTitle').textContent = `Server ${MP.num}`;
  $$('mpPlayers').innerHTML = [...MP.roster].sort((a, b) => a.slot - b.slot).map(r => `<div class="srv"><i style="background:${COLORS[r.slot]}"></i>
    <b>${esc(r.name)}</b><span>${r.id === MP.hostId ? 'host' : ''}${r.id === me() ? ' (you)' : ''}</span></div>`).join('');
  for (const k of ['race', 'mats']) { const el = $$('mpMode-' + k); el.classList.toggle('on', MP.mode === k); el.style.pointerEvents = MP.host ? '' : 'none'; }
  $$('mpStart').style.display = MP.host ? '' : 'none';
  $$('mpWait').textContent = MP.host ? (MP.roster.length < 2 ? 'Waiting for players to join. You can also start alone to practise.' : 'Everyone is here? Press Start.') : 'Waiting for the host to start...';
}
function pickMode(k) { if (!MP.host) return; MP.mode = k; sendRoster(); }
function hostStart() {
  if (!MP.host) return;
  MP.state = 'playing'; const seed = Math.floor(Math.random() * 1e9);
  sendRoster(); MP.room.send('start', { mode: MP.mode, seed }); begin(MP.mode, seed);
}

// ---------- playing ----------
// Each player has their own spacecraft at the landing site, one per slot.
const PADS = [[-240, -170], [240, -170], [-240, 230], [240, 230]].map(([dx, dy]) => ({ x: LANDER.x + dx, y: LANDER.y + dy }));
const mySlot = () => (MP.roster.find(r => r.id === me()) || { slot: 0 }).slot;
const slotOf = id => (MP.roster.find(r => r.id === id) || { slot: 0 }).slot;
const nameOf = id => (MP.roster.find(r => r.id === id) || { name: '?' }).name;
MP.obstacles = () => [...(MP.mode === 'race' ? PADS.slice(0, Math.max(1, MP.roster.length)).map(p => [p, 85]) : []), [ROVER, 70]];

function begin(mode, seed) {
  Object.assign(MP, { mode, state: 'playing', playing: true, count: 3.5, taken: {}, scores: {}, status: {}, timer: MATS_TIME, result: null, posT: 0, homeSent: false });
  reset(); const pad = PADS[mySlot()];
  if (mode === 'race') { b.x = pad.x + 150; b.y = pad.y - 20; b.ang = 1.15; }
  else { b.x = pad.x + 150; b.y = pad.y - 20; b.ang = 0.6 + mySlot() * 0.3; }
  cam.x = b.x; cam.y = b.y;
  if (mode === 'mats') MP.items = genItems(seed);
  for (const r of MP.roster) { MP.status[r.id] = 'go'; MP.scores[r.id] = 0; }
  $$('keys').textContent = mode === 'race' ? 'W A S D or arrow keys to drive · E to take the sample / to deliver it · Esc to leave' : 'W A S D or arrow keys to drive · drive over materials to collect them · Esc to leave';
  $$('o2').firstChild.textContent = mode === 'mats' ? 'Time left ' : 'Oxygen ';   // the materials hunt has a clock instead of oxygen
  $$('sample').style.display = 'none';                 // the scoreboard takes its place
  show('play'); $$('mpBoard').style.display = 'block';
}
// Materials: a chain of points, each 100 to 500 m from one already placed and never closer than 100 m to any.
function genItems(seed) {
  let s = seed | 0;
  const r = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const MIN = 100 * PX_PER_M, MAXD = 500 * PX_PER_M, out = [{ x: LANDER.x + 900, y: LANDER.y - 500 }];
  for (let tries = 0; tries < 6000 && out.length < 70; tries++) {
    const from = out[Math.floor(r() * out.length)], a = r() * Math.PI * 2, d = MIN + r() * (MAXD - MIN);
    const x = from.x + Math.cos(a) * d, y = from.y + Math.sin(a) * d;
    if (x < 200 || y < 200 || x > WW - 200 || y > WH - 200) continue;
    if (out.some(o => Math.hypot(o.x - x, o.y - y) < MIN)) continue;
    if (ROCKS.some(k => Math.hypot(k.x - x, k.y - y) < k.r + 45)) continue;
    out.push({ x, y });
  }
  return out.map(p => { let roll = r(), k = 0; while (k < RARITY.length - 1 && roll > RARITY[k][3]) { roll -= RARITY[k][3]; k++; } return { ...p, k }; });
}
function hostPick(i, by) {                              // the host decides who got each material first
  if (!MP.playing || MP.mode !== 'mats' || MP.taken[i] !== undefined || !MP.items[i]) return;
  MP.taken[i] = by; MP.scores[by] = (MP.scores[by] || 0) + RARITY[MP.items[i].k][1];
  MP.room.send('taken', { taken: MP.taken, scores: MP.scores });
}
function hostHome(by, t) {                              // first one home wins the race
  if (!MP.playing || MP.mode !== 'race' || MP.status[by] === 'home') return;
  MP.status[by] = 'home'; MP.room.send('stat', { id: by, s: 'home' });
  finishGame({ mode: 'race', winner: by, time: t });
}
function checkRaceOver() {                              // everyone ran out of air or left
  if (MP.playing && MP.mode === 'race' && MP.roster.every(r => ['out', 'left'].includes(MP.status[r.id]))) finishGame({ mode: 'race', winner: null });
}
function finishGame(res) {
  res.roster = MP.roster; res.scores = MP.scores; res.status = MP.status;
  MP.room.send('result', res); showResult(res);
  MP.state = 'waiting'; sendRoster();
}

// Called every frame by the Moon page. Returns false while the car must not move (count-down, game over).
MP.tick = dt => {
  if (!MP.playing) return false;
  if (MP.count > 0) { MP.count -= dt; return false; }
  MP.posT -= dt;
  if (MP.posT <= 0 && MP.room) { MP.posT = 0.1; MP.room.send('pos', { x: Math.round(b.x), y: Math.round(b.y), ang: +b.ang.toFixed(2), has: hasSample }); }
  for (const r of Object.values(MP.remote)) { r.dx += (r.x - r.dx) * Math.min(1, dt * 10); r.dy += (r.y - r.dy) * Math.min(1, dt * 10); r.da = r.ang; }
  if (MP.mode === 'mats') {
    MP.timer = Math.max(0, MP.timer - dt);
    MP.items.forEach((it, i) => {                      // drive over a material to pick it up
      if (MP.taken[i] === undefined && Math.hypot(b.x - it.x, b.y - it.y) < 60 && !it.asked) {
        it.asked = true; setTimeout(() => { it.asked = false; }, 1500);
        if (MP.host) hostPick(i, me()); else MP.room.send('pick', { i }, MP.hostId);
      }
    });
    if (MP.host && MP.timer <= 0) finishGame({ mode: 'mats' });
  }
  return MP.status[me()] !== 'out';
};
MP.act = () => {                                        // E: take the sample, or deliver it to your own spacecraft
  if (MP.mode !== 'race' || MP.count > 0) return;
  const pad = PADS[mySlot()];
  if (!hasSample && Math.hypot(b.x - ROVER.x, b.y - ROVER.y) < 190) { hasSample = true; b.v = 0; MP.status[me()] = 'back'; }
  else if (hasSample && Math.hypot(b.x - pad.x, b.y - pad.y) < 230 && !MP.homeSent) {
    MP.homeSent = true; const t = Math.round((performance.now() - t0) / 1000);
    if (MP.host) hostHome(me(), t); else MP.room.send('home', { t }, MP.hostId);
  }
};
MP.out = () => {                                        // out of oxygen in the race
  if (MP.status[me()] === 'out') return; MP.status[me()] = 'out';
  if (MP.host) { MP.room.send('stat', { id: me(), s: 'out' }); checkRaceOver(); } else MP.room.send('out', {}, MP.hostId);
};
MP.hud = () => {
  const myId = me(), pad = PADS[mySlot()];
  if (MP.mode === 'mats') {
    $$('o2t').textContent = `${Math.floor(MP.timer / 60)}:${String(Math.floor(MP.timer % 60)).padStart(2, '0')}`; $$('o2bar').style.width = `${MP.timer / MATS_TIME * 100}%`;
    $$('goal').innerHTML = 'Collect the most materials<small>rarer materials are worth more · highest score wins</small>';
  } else {
    $$('goal').innerHTML = MP.status[myId] === 'out' ? 'Out of oxygen<small>you are out of this race</small>'
      : hasSample ? 'Race back to your spacecraft<small>the one with your colour</small>' : 'Race to the rover<small>take a sample, bring it back to your spacecraft</small>';
    const pr = !hasSample && Math.hypot(b.x - ROVER.x, b.y - ROVER.y) < 190 ? 'Press E to take a sample' : hasSample && Math.hypot(b.x - pad.x, b.y - pad.y) < 230 ? 'Press E to deliver the sample' : '';
    $$('prompt').style.display = pr ? 'block' : 'none'; $$('prompt').textContent = pr;
  }
  if (MP.mode === 'mats') $$('prompt').style.display = 'none';
  // the board: every player's progress
  const rows = [...MP.roster].sort((a, b) => a.slot - b.slot).map(r => {
    const mine = r.id === myId, p = mine ? { dx: b.x, dy: b.y, has: hasSample } : MP.remote[r.id], st = MP.status[r.id], c = COLORS[r.slot];
    let info;
    if (MP.mode === 'mats') info = `${MP.scores[r.id] || 0} pts`;
    else if (st === 'out') info = 'out of oxygen'; else if (st === 'left') info = 'left';
    else if (!p) info = '...';
    else if (!p.has) info = `rover ${fmtM(Math.hypot(p.dx - ROVER.x, p.dy - ROVER.y))}`;
    else { const pd = PADS[r.slot]; info = `spacecraft ${fmtM(Math.hypot(p.dx - pd.x, p.dy - pd.y))}`; }
    return `<div><i style="background:${c}"></i>${esc(r.name)}${mine ? ' (you)' : ''}<span>${info}</span></div>`;
  });
  $$('mpBoard').innerHTML = `<b>${MP.mode === 'mats' ? 'Scores' : 'Race'}</b>${rows.join('')}`;
};

// ---------- drawing on the map ----------
MP.world = (vis, now) => {
  ctx.imageSmoothingEnabled = true;
  if (MP.mode === 'race') PADS.slice(0, Math.max(1, MP.roster.length)).forEach((p, i) => {   // each player's spacecraft, with a ring of their colour
    if (!vis(p.x, p.y, 500)) return;
    shadow(p.x, p.y, 90, 300); ctx.strokeStyle = COLORS[i]; ctx.lineWidth = 6; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(p.x, p.y, 140, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    sprite(art.lander, p.x, p.y, 240, 0);
  });
  if (MP.mode === 'mats') MP.items.forEach((it, i) => {   // the materials lying on the ground
    if (MP.taken[i] !== undefined || !vis(it.x, it.y, 40)) return;
    const [, , col] = RARITY[it.k], s = 9 + it.k * 3;
    ctx.fillStyle = 'rgba(10,10,18,.5)'; ctx.beginPath(); ctx.ellipse(it.x + 6, it.y + 6, s, s * 0.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(it.x, it.y - s); ctx.lineTo(it.x + s * 0.8, it.y); ctx.lineTo(it.x, it.y + s * 0.7); ctx.lineTo(it.x - s * 0.8, it.y); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(it.x - 2, it.y - s * 0.6, 3, 3);
  });
  for (const [id, r] of Object.entries(MP.remote)) {     // the other players' buggies
    if (!MP.roster.some(x => x.id === id) || !vis(r.dx, r.dy, 80)) continue;
    ctx.strokeStyle = COLORS[slotOf(id)]; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(r.dx, r.dy, 50, 0, 7); ctx.stroke();
    ctx.imageSmoothingEnabled = false; sprite(art.buggy, r.dx, r.dy, 76, r.da); ctx.imageSmoothingEnabled = true;
  }
  ctx.strokeStyle = COLORS[mySlot()]; ctx.lineWidth = 3; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(b.x, b.y, 50, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
};
MP.overlay = (ox, oy, now) => {                         // drawn above the night: names, glints of materials, the count-down
  ctx.textAlign = 'center'; ctx.font = '13px ui-monospace, Consolas, monospace';
  for (const [id, r] of Object.entries(MP.remote)) {
    if (!MP.roster.some(x => x.id === id)) continue;
    const x = r.dx - ox, y = r.dy - oy;
    if (x > -100 && x < W + 100 && y > -100 && y < H + 100) { ctx.fillStyle = '#0b0c16cc'; const t = nameOf(id), w = ctx.measureText(t).width + 12; ctx.fillRect(x - w / 2, y - 84, w, 20); ctx.fillStyle = COLORS[slotOf(id)]; ctx.fillText(t, x, y - 69); }
  }
  if (MP.mode === 'mats') MP.items.forEach((it, i) => {   // materials twinkle so they can be found in the dark
    if (MP.taken[i] !== undefined) return; const x = it.x - ox, y = it.y - oy;
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return;
    const k = Math.sin(now / 300 + i * 1.7); if (k > 0.6) { ctx.globalAlpha = (k - 0.6) * 2.5; ctx.fillStyle = RARITY[it.k][2]; ctx.fillRect(x - 1, y - 6, 2, 12); ctx.fillRect(x - 6, y - 1, 12, 2); ctx.globalAlpha = 1; }
  });
  if (MP.count > 0) { ctx.fillStyle = '#f3efe6'; ctx.font = '120px Georgia, serif'; ctx.fillText(MP.count > 0.5 ? String(Math.ceil(MP.count - 0.5)) : 'GO!', W / 2, H / 2 + 40); }
};

// ---------- the result ----------
function showResult(res) {
  MP.playing = false; MP.result = res; $$('mpBoard').style.display = 'none';
  const roster = res.roster || MP.roster, myId = me();
  if (res.mode === 'mats') {
    const order = [...roster].sort((a, b) => (res.scores[b.id] || 0) - (res.scores[a.id] || 0)), best = order[0];
    $$('mpResTitle').textContent = best ? (best.id === myId ? 'You win!' : `${best.name} wins!`) : 'Time is up';
    $$('mpResText').innerHTML = order.map((r, i) => `<div class="srv"><b>${i + 1}.</b><i style="background:${COLORS[r.slot]}"></i><span>${esc(r.name)}${r.id === myId ? ' (you)' : ''}</span><b>${res.scores[r.id] || 0} pts</b></div>`).join('');
  } else {
    const w = roster.find(r => r.id === res.winner);
    $$('mpResTitle').textContent = !w ? 'Nobody made it back' : w.id === myId ? 'You win the race!' : `${w.name} wins the race!`;
    $$('mpResText').innerHTML = w ? `<div class="dim" style="font-size:1.3cqw">Back at the spacecraft with the sample in ${Math.floor(res.time / 60)}:${String(res.time % 60).padStart(2, '0')}.</div>` : '';
  }
  showMp('mpResult');
}

// ---------- buttons ----------
$$('mpName').value = (() => { try { return localStorage.getItem('hazlaoum.mpname') || ''; } catch (e) { return ''; } })() || `Astronaut ${100 + Math.floor(Math.random() * 900)}`;
$$('mpCreate').onclick = createServer;
$$('mpBack').onclick = () => { location.href = '../index.html'; };
$$('mpLeave').onclick = () => { leaveRoom(); enterLobby(); };
$$('mpStart').onclick = hostStart;
$$('mpMode-race').onclick = () => pickMode('race');
$$('mpMode-mats').onclick = () => pickMode('mats');
$$('mpAgain').onclick = () => { if (MP.playing) { showMp('play'); $$('mpBoard').style.display = 'block'; } else showRoom(); };   // a new round may already be running
$$('mpQuit').onclick = () => { leaveRoom(); enterLobby(); };
MP.leave = () => { leaveRoom(); $$('mpBoard').style.display = 'none'; enterLobby(); };
if (MP.on) enterLobby();                                // only with ?mp: the single-player Moon mission keeps its own screens
