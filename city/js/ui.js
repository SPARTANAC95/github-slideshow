// DOM panels: feed, people, groups, city, chronicle, and the detail sheet.
(function () {
  const D = window.DATA;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  class UI {
    constructor(app) {
      this.app = app; this.world = app.world;
      this.tab = 'feed'; this.minLevel = 1; this.follow = null; this.search = '';
      this.feedEl = $('#feed'); this.sheet = $('#sheet'); this.sheetBody = $('#sheet-body');
      this.lastRenderedLog = 0; this.dirty = true;
      document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
      document.querySelectorAll('.lvl').forEach(b => b.addEventListener('click', () => { this.minLevel = +b.dataset.lvl; document.querySelectorAll('.lvl').forEach(x => x.classList.toggle('on', x === b)); this.rebuildFeed(); }));
      $('#sheet-close').addEventListener('click', () => this.closeSheet());
      $('#sheet-back').addEventListener('click', () => this.back());
      this.sheetBody.addEventListener('click', e => this.handleLink(e));
      this.feedEl.addEventListener('click', e => this.handleLink(e));
      $('#panel').addEventListener('click', e => this.handleLink(e));
      $('#headline').addEventListener('click', e => this.handleLink(e));
      $('#people-search').addEventListener('input', e => { this.search = e.target.value.toLowerCase(); this.renderPeople(); });
      this.stack = [];
    }
    setWorld(w) { this.world = w; this.follow = null; this.lastRenderedLog = 0; this.feedEl.innerHTML = ''; this.closeSheet(); this.dirty = true; }
    handleLink(e) {
      const a = e.target.closest('[data-cit],[data-grp],[data-loc],[data-act]');
      if (!a) return;
      e.preventDefault();
      if (a.dataset.cit) this.openCitizen(+a.dataset.cit);
      else if (a.dataset.grp) this.openGroup(+a.dataset.grp);
      else if (a.dataset.loc) this.openLocation(a.dataset.loc);
      else if (a.dataset.act) this.action(a.dataset.act, a);
    }
    action(act, el) {
      const w = this.world;
      if (act === 'follow') { const id = +el.dataset.id; this.follow = this.follow === id ? null : id; this.rebuildFeed(); this.setTab('feed'); this.closeSheet(); }
      if (act === 'locate') { const c = w.citizen(+el.dataset.id); if (c) { this.app.renderer.selected = c.id; this.app.renderer.focusOn(c); this.closeSheet(); } }
      if (act === 'locate-group') { this.app.renderer.selectedGroup = +el.dataset.id; this.app.renderer.selected = null; this.closeSheet(); }
      if (act === 'unfollow') { this.follow = null; this.rebuildFeed(); }
      if (act === 'newcity') this.app.newCity();
      if (act === 'save') { const ok = w.save(); this.toast(ok ? 'Saved to this browser.' : 'Could not save (storage full or blocked).'); }
      if (act === 'jump') this.app.jump(+el.dataset.days);
    }
    setTab(t) {
      this.tab = t;
      document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
      document.querySelectorAll('.pane').forEach(p => p.hidden = p.id !== 'pane-' + t);
      this.dirty = true; this.refresh(true);
    }
    when(t) { return `Day ${Math.floor(t / 24) + 1}, ${String(t % 24).padStart(2, '0')}:00`; }
    chip(c) { if (!c) return ''; const g = c.group ? this.world.group(c.group) : null; return `<a class="chip" data-cit="${c.id}" style="--c:${g ? g.color : '#8a939c'}">${esc(c.shortName)}</a>`; }
    gchip(g) { if (!g) return ''; return `<a class="chip g" data-grp="${g.id}" style="--c:${g.color}">${g.icon} ${esc(g.name)}</a>`; }

    // ---- Periodic refresh ----
    refresh(force) {
      const w = this.world;
      $('#clock').textContent = `${w.dayName}, Day ${w.day + 1} · ${String(w.hour).padStart(2, '0')}:00`;
      const ph = $('#phase'); ph.textContent = { peace: '🌤️ Peace', unrest: '😬 Unrest', crisis: '🚨 Crisis', conflict: '⚔️ ' + (w.conflict ? w.conflict.name : 'Conflict') }[w.phase]; ph.className = 'phase ' + w.phase;
      $('#tension-fill').style.width = w.tension + '%';
      $('#tension-fill').className = 'fill ' + w.phase;
      $('#weather').textContent = { clear: '☀️', rain: '🌧️', heat: '🥵' }[w.weather] || '';
      if (w.headlines.length) { const hl = w.headlines[0]; $('#headline').innerHTML = `<span class="hl-time">${this.when(hl.t)}</span> ${esc(hl.text)}`; }
      if (this.tab === 'feed') this.appendFeed();
      else if (force || this.dirty || w.hour === 6) { this.dirty = false; if (this.tab === 'people') this.renderPeople(); if (this.tab === 'groups') this.renderGroups(); if (this.tab === 'city') this.renderCity(); if (this.tab === 'chronicle') this.renderChronicle(); }
      if (this.sheetOpen && this.sheetKind && (force || w.hour % 3 === 0)) this.reopen();
    }

    // ---- Feed ----
    feedItem(e) {
      const w = this.world;
      const who = e.who.map(id => w.citizen(id)).filter(Boolean).slice(0, 4).map(c => this.chip(c)).join('');
      const gs = e.groups.map(id => w.group(id)).filter(Boolean).slice(0, 3).map(g => this.gchip(g)).join('');
      return `<div class="ev l${e.level}"><div class="ev-time">${this.when(e.t)}</div><div class="ev-text">${esc(e.text)}</div>${who || gs ? `<div class="ev-chips">${who}${gs}</div>` : ''}</div>`;
    }
    passes(e) { if (e.level < this.minLevel && !(this.follow && e.who.includes(this.follow))) return false; if (this.follow && !e.who.includes(this.follow) && e.level < 3) return false; return true; }
    rebuildFeed() {
      const w = this.world;
      const items = w.logs.filter(e => this.passes(e)).slice(-150).reverse();
      this.feedEl.innerHTML = items.map(e => this.feedItem(e)).join('');
      this.lastRenderedLog = w.logs.length ? w.logs[w.logs.length - 1].id : 0;
      const f = $('#follow-bar');
      if (this.follow) { const c = w.citizen(this.follow); f.hidden = false; f.innerHTML = `Following ${this.chip(c)} <a class="btn small" data-act="unfollow">stop</a>`; } else f.hidden = true;
    }
    appendFeed() {
      const w = this.world;
      const fresh = w.logs.filter(e => e.id > this.lastRenderedLog && this.passes(e));
      if (!fresh.length) { if (w.logs.length && w.logs[w.logs.length - 1].id > this.lastRenderedLog) this.lastRenderedLog = w.logs[w.logs.length - 1].id; return; }
      const html = fresh.slice().reverse().map(e => this.feedItem(e)).join('');
      this.feedEl.insertAdjacentHTML('afterbegin', html);
      this.lastRenderedLog = w.logs[w.logs.length - 1].id;
      while (this.feedEl.children.length > 200) this.feedEl.lastElementChild.remove();
    }

    // ---- People ----
    renderPeople() {
      const w = this.world;
      const list = w.citizens.filter(c => c.status !== 'gone' && (!this.search || c.name.toLowerCase().includes(this.search) || c.jobName.includes(this.search) || (c.group && w.group(c.group).name.toLowerCase().includes(this.search)))).sort((a, b) => a.last.localeCompare(b.last));
      $('#people').innerHTML = list.map(c => { const g = c.group ? w.group(c.group) : null; return `<a class="row" data-cit="${c.id}"><span class="dot" style="background:${g ? g.color : '#8a939c'}"></span><span class="row-main"><b>${esc(c.name)}</b>${c.id === w.mayor.id ? ' 🎩' : ''}${g && g.leader === c.id ? ' ★' : ''}<br><small>${c.age}, ${esc(c.jobName)} · ${esc(D.DISTRICTS.find(d => d.id === c.district).name)}${g ? ' · ' + esc(g.name) : ''}</small></span><span class="row-side">${this.moodEmoji(c)}<br><small>${c.moodWord()}</small></span></a>`; }).join('');
    }
    moodEmoji(c) { if (c.status === 'injured') return '🩹'; if (c.status === 'jailed') return '🔒'; if (c.status === 'hiding') return '🙈'; const m = c.mood; return m > 0.5 ? '😄' : m > 0.15 ? '🙂' : m > -0.2 ? '😐' : m > -0.5 ? '😠' : '😭'; }

    // ---- Groups ----
    renderGroups() {
      const w = this.world;
      const gs = w.groups.filter(g => !g.dissolved).sort((a, b) => b.size - a.size);
      $('#groups').innerHTML = gs.length ? gs.map(g => { const l = g.leaderObj(w); const foes = w.groups.filter(o => o !== g && !o.dissolved && g.stance(o.id) < -0.4); return `<a class="card" data-grp="${g.id}" style="--c:${g.color}"><div class="card-head"><span class="gicon">${g.icon}</span><b>${esc(g.name)}</b><span class="count">${g.size}</span></div><small>${esc(g.focusLabel())} · led by ${l ? esc(l.shortName) : '?'} · HQ ${esc(w.locName(g.hq))}${g.bloc ? ' · ⚔️ bloc ' + g.bloc : ''}${g.militia ? ' · 🪖' : ''}</small><div class="bars">${bar('cohesion', g.cohesion)}${bar('militancy', g.militancy, 'hot')}${bar('morale', g.morale)}</div>${foes.length ? `<small>Feuding with ${foes.map(o => esc(o.name)).join(', ')}</small>` : `<small>${g.allies.length ? 'Allied with ' + g.allies.map(id => esc(w.group(id)?.name || '')).join(', ') : 'No enemies yet. Give it time.'}</small>`}</a>`; }).join('') : '<p class="muted">No groups yet. Friendships are still forming. Give it a few days.</p>';
    }

    // ---- City ----
    renderCity() {
      const w = this.world;
      const mayor = w.citizen(w.mayor.id);
      const pols = w.policies.map(p => { const pd = D.POLICIES.find(x => x.id === p.id); return `<li>${esc(pd.name)} <small>(${Math.max(0, Math.round((p.until - w.tick) / 24))} days left)</small></li>`; }).join('');
      const dem = w.demands.map(d => { const g = w.group(d.group); const pd = D.POLICIES.find(x => x.id === d.policy); return g ? `<li>${this.gchip(g)} want the mayor to ${esc(pd.name)}</li>` : ''; }).join('');
      const pop = w.citizens.filter(c => c.status !== 'gone');
      const stats = { fights: pop.reduce((a, c) => a + c.stats.fights, 0), jokes: pop.reduce((a, c) => a + c.stats.jokes, 0), drinks: pop.reduce((a, c) => a + c.stats.drinks, 0), joints: pop.reduce((a, c) => a + c.stats.joints, 0), converts: pop.reduce((a, c) => a + c.stats.converts, 0), forgiven: pop.reduce((a, c) => a + c.stats.forgiven, 0), helped: pop.reduce((a, c) => a + c.stats.helped, 0) };
      const cf = w.conflict;
      const districts = D.DISTRICTS.map(d => { const res = pop.filter(c => c.district === d.id); const mood = res.reduce((a, c) => a + c.mood, 0) / Math.max(1, res.length); return `<a class="row" data-loc="${d.locations[0].id}"><span class="dot" style="background:${d.color}"></span><span class="row-main"><b>${esc(d.name)}</b><br><small>${esc(d.flavor)} · ${res.length} residents${cf && cf.control[d.id] ? ' · 🏴 held by ' + esc(window.Conflict.blocName(w, cf.control[d.id])) : ''}</small></span><span class="row-side">${mood > 0.2 ? '🙂' : mood > -0.2 ? '😐' : '😠'}</span></a>`; }).join('');
      $('#city').innerHTML = `
        <section><h3>🎩 Mayor</h3><p>${this.chip(mayor)} ${esc(mayor.jobName)}, in office since day ${Math.floor(w.mayor.since / 24) + 1}. Next election in ${Math.max(0, Math.round((w.mayor.termEnds - w.tick) / 24))} days.</p>${bar('approval', (w.mayor.approval + 100) / 200, w.mayor.approval < -10 ? 'hot' : '')}<p class="muted">Creed: ${mayor.creed().slice(0, 2).map(esc).join(' ')}</p></section>
        <section><h3>📜 Policies in force</h3>${pols ? `<ul>${pols}</ul>` : '<p class="muted">None. The city runs on vibes.</p>'}</section>
        <section><h3>📣 Demands on the table</h3>${dem ? `<ul>${dem}</ul>` : '<p class="muted">Nobody is demanding anything. Suspicious.</p>'}</section>
        ${cf ? `<section class="warn"><h3>⚔️ ${esc(cf.name)}</h3><p>${esc(window.Conflict.blocName(w, 'A'))} <b>vs</b> ${esc(window.Conflict.blocName(w, 'B'))}. Day ${Math.floor((w.tick - cf.started) / 24) + 1}, ${cf.clashes} clashes, ${cf.talks} rounds of talks.</p></section>` : ''}
        <section><h3>🏘️ Districts</h3>${districts}</section>
        <section><h3>📊 Numbers</h3><div class="stats"><div><b>${pop.length}</b><small>citizens</small></div><div><b>${w.groups.filter(g => !g.dissolved).length}</b><small>groups</small></div><div><b>${stats.fights}</b><small>fights</small></div><div><b>${stats.jokes}</b><small>jokes told</small></div><div><b>${stats.drinks}</b><small>drinks</small></div><div><b>${stats.joints}</b><small>joints</small></div><div><b>${stats.converts}</b><small>minds changed</small></div><div><b>${stats.forgiven}</b><small>hatchets buried</small></div><div><b>${stats.helped}</b><small>kind acts</small></div><div><b>${w.history.length}</b><small>conflicts</small></div></div></section>
        <section><h3>⚙️ Controls</h3><p class="muted">Seed: <code>${esc(String(w.seed))}</code>. Progress autosaves to this browser.</p><p><a class="btn" data-act="jump" data-days="1">Skip a day</a> <a class="btn" data-act="jump" data-days="7">Skip a week</a> <a class="btn" data-act="save">Save now</a> <a class="btn danger" data-act="newcity">New city…</a></p></section>`;
    }

    // ---- Chronicle ----
    renderChronicle() {
      const w = this.world;
      const wars = w.history.map(h => `<li><b>${esc(h.name)}</b>: ${esc(h.sides[0])} vs ${esc(h.sides[1])}, days ${Math.floor(h.started / 24) + 1}–${Math.floor(h.ended / 24) + 1}, ${h.clashes} clashes. Ended in ${esc(h.how)}.${h.winner ? ' Won by ' + esc(h.winner) + '.' : ''}</li>`).join('');
      $('#chronicle').innerHTML = `${wars ? `<section><h3>⚔️ Conflicts</h3><ul>${wars}</ul></section>` : ''}<section><h3>📖 The Chronicle of Pebbleton</h3>${w.chronicleList.slice().reverse().map(e => `<div class="ev l1"><div class="ev-time">${this.when(e.t)}</div><div class="ev-text">${esc(e.text)}</div></div>`).join('')}</section>`;
    }

    // ---- Sheet ----
    openSheet(kind, id, push = true) {
      if (push && this.sheetOpen && this.sheetKind) this.stack.push([this.sheetKind, this.sheetId]);
      if (this.stack.length > 12) this.stack.shift();
      this.sheetKind = kind; this.sheetId = id; this.sheetOpen = true;
      this.sheet.classList.add('open');
      $('#sheet-back').hidden = !this.stack.length;
      this.reopen();
      this.sheetBody.scrollTop = 0;
    }
    reopen() { if (this.sheetKind === 'cit') this.renderCitizen(this.sheetId); else if (this.sheetKind === 'grp') this.renderGroup(this.sheetId); else if (this.sheetKind === 'loc') this.renderLocation(this.sheetId); }
    back() { const prev = this.stack.pop(); if (prev) this.openSheet(prev[0], prev[1], false); else this.closeSheet(); $('#sheet-back').hidden = !this.stack.length; }
    closeSheet() { this.sheetOpen = false; this.sheetKind = null; this.stack = []; this.sheet.classList.remove('open'); this.app.renderer.selected = null; this.app.renderer.selectedGroup = null; }
    openCitizen(id) { const c = this.world.citizen(id); if (!c) return; this.app.renderer.selected = id; this.app.renderer.selectedGroup = null; this.openSheet('cit', id); }
    openGroup(id) { const g = this.world.group(id); if (!g) return; this.app.renderer.selectedGroup = id; this.app.renderer.selected = null; this.openSheet('grp', id); }
    openLocation(id) { this.openSheet('loc', id); }

    renderCitizen(id) {
      const w = this.world, c = w.citizen(id);
      if (!c) return this.closeSheet();
      const g = c.group ? w.group(c.group) : null;
      const dist = D.DISTRICTS.find(d => d.id === c.district);
      const status = c.status === 'injured' ? '🩹 recovering at the Clinic' : c.status === 'jailed' ? '🔒 in the Quiet Room' : c.status === 'hiding' ? '🙈 hiding at home' : c.status === 'gone' ? '🚢 left town' : `📍 at ${esc(w.locName(c.loc))}`;
      const rels = Object.entries(c.rel).map(([oid, r]) => ({ o: w.citizen(+oid), r })).filter(x => x.o && x.o.status !== 'gone' && (Math.abs(x.r.aff) > 20 || x.r.kind === 'partner')).sort((a, b) => b.r.aff - a.r.aff);
      const friends = rels.filter(x => x.r.aff > 20).slice(0, 8), foes = rels.filter(x => x.r.aff < -20).slice(-6).reverse();
      const relRow = x => `<div class="rel"><span>${this.chip(x.o)}</span><span class="muted">${x.r.kind}${x.o.group && x.o.group !== c.group ? ' · ' + esc(w.group(x.o.group).name) : ''}</span><span class="${x.r.aff > 0 ? 'pos' : 'neg'}">${x.r.aff > 0 ? '+' : ''}${Math.round(x.r.aff)}</span></div>`;
      const mems = c.memories.slice().reverse().slice(0, 14).map(m => `<div class="mem ${m.tone > 0.2 ? 'pos' : m.tone < -0.2 ? 'neg' : ''}"><small>${this.when(m.t)}</small><div>${esc(m.text)}</div></div>`).join('');
      const gs = w.groups.filter(x => !x.dissolved);
      const opinions = gs.map(x => { const o = c.opinionOfGroup(x, w); return { x, o }; }).sort((a, b) => b.o.score - a.o.score).map(({ x, o }) => `<div class="op"><div class="op-head">${this.gchip(x)}<b class="${o.score > 15 ? 'pos' : o.score < -15 ? 'neg' : ''}">${o.score > 0 ? '+' : ''}${o.score}</b></div>${o.reasons.slice(0, 3).map(r => `<div class="reason"><span class="${r.v > 0 ? 'pos' : 'neg'}">${r.v > 0 ? '+' : ''}${r.v}</span> ${esc(r.why)}</div>`).join('') || '<div class="reason muted">No strong feelings. Yet.</div>'}</div>`).join('');
      const axes = D.AXES.map(ax => { const v = c.beliefs[ax.id]; return `<div class="axis"><span class="ax-l ${v > 0.2 ? 'on' : ''}">${ax.pos}</span><div class="ax-bar"><div class="ax-dot" style="left:${(v + 1) / 2 * 100}%"></div></div><span class="ax-r ${v < -0.2 ? 'on' : ''}">${ax.neg}</span></div>`; }).join('');
      const believed = w.rumours.filter(r => c.believes.has(r.id) && !r.dead).slice(-4).map(r => `<li>${esc(Politics.capitalise(r.text))}</li>`).join('');
      this.sheetBody.innerHTML = `
        <div class="sheet-title"><span class="big-dot" style="background:${g ? g.color : '#8a939c'}"></span><div><h2>${esc(c.name)}${c.id === w.mayor.id ? ' 🎩' : ''}</h2><div class="muted">${c.age}, ${esc(c.jobName)} · lives in ${esc(dist.name)} · ${status}</div>${g ? `<div>${this.gchip(g)}${g.leader === c.id ? ' <b>★ leader</b>' : ''} <small class="muted">loyalty ${Math.round(c.loyalty * 100)}%</small></div>` : '<div class="muted">Not in any group</div>'}</div></div>
        <div class="actions"><a class="btn" data-act="follow" data-id="${c.id}">${this.follow === c.id ? '★ Following' : '☆ Follow in feed'}</a><a class="btn" data-act="locate" data-id="${c.id}">🔍 Find on map</a></div>
        <section><h3>Mood</h3><div class="moodline">${this.moodEmoji(c)} <b>${c.moodWord()}</b> <small class="muted">· stress ${Math.round(c.stress * 100)}% · ${c.money < 20 ? 'broke' : c.money > 600 ? 'well off' : 'getting by'} (${Math.round(c.money)} coins)${c.drunk ? ' · 🍺 tipsy' : ''}${c.hangover ? ' · hungover' : ''}</small></div>${bar('rest', c.needs.rest)}${bar('social', c.needs.social)}${bar('fun', c.needs.fun)}${bar('purpose', c.needs.purpose)}${bar('safety', c.needs.safety)}</section>
        <section><h3>Personality</h3><p>${esc(c.personalityText())}</p></section>
        <section><h3>What I believe</h3><blockquote>${c.creed().map(esc).join('<br>')}</blockquote>${axes}<small class="muted">Conviction: ${c.conviction > 0.75 ? 'unshakeable' : c.conviction > 0.5 ? 'firm' : c.conviction > 0.3 ? 'open to persuasion' : 'basically a weathervane'}</small></section>
        <section><h3>Habits & obsessions</h3><ul>${c.habitsText().map(h => `<li>${esc(h)}</li>`).join('')}</ul></section>
        <section><h3>Goals</h3>${c.goals.length ? `<ul>${c.goals.map(gl => `<li>${esc(gl.text)}</li>`).join('')}</ul>` : '<p class="muted">Drifting, pleasantly.</p>'}</section>
        <section><h3>Relationships</h3>${c.partner ? `<p>💘 Partner: ${this.chip(w.citizen(c.partner))}</p>` : ''}${friends.length ? friends.map(relRow).join('') : '<p class="muted">No real friends yet.</p>'}${foes.length ? `<h4>Grudges</h4>${foes.map(relRow).join('')}` : ''}</section>
        <section><h3>What I think about the groups</h3>${opinions || '<p class="muted">There are no groups to have opinions about. Yet.</p>'}</section>
        ${believed ? `<section><h3>Things I've heard</h3><ul>${believed}</ul></section>` : ''}
        <section><h3>Recent actions</h3>${c.recent.length ? `<ul>${c.recent.slice().reverse().map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p class="muted">Nothing much, lately.</p>'}</section>
        <section><h3>Memories</h3>${mems || '<p class="muted">A blank slate.</p>'}</section>
        <section><h3>Tally</h3><div class="stats"><div><b>${c.stats.arguments}</b><small>arguments</small></div><div><b>${c.stats.fights}</b><small>fights</small></div><div><b>${c.stats.jokes}</b><small>jokes</small></div><div><b>${c.stats.converts}</b><small>converts</small></div><div><b>${c.stats.helped}</b><small>kind acts</small></div><div><b>${c.stats.forgiven}</b><small>forgiven</small></div><div><b>${c.stats.drinks}</b><small>drinks</small></div><div><b>${c.stats.joints}</b><small>joints</small></div></div></section>`;
    }
    renderGroup(id) {
      const w = this.world, g = w.group(id);
      if (!g) return this.closeSheet();
      const leader = g.leaderObj(w);
      const members = g.memberObjs(w).sort((a, b) => (b.id === g.leader) - (a.id === g.leader) || b.loyalty - a.loyalty);
      const others = w.groups.filter(o => o !== g && !o.dissolved).map(o => ({ o, s: g.stance(o.id) })).sort((a, b) => a.s - b.s);
      const stanceRow = ({ o, s }) => { const evs = (g.stanceEvents[o.id] || []).slice(-3).reverse(); return `<div class="op"><div class="op-head">${this.gchip(o)}<b class="${s > 0.15 ? 'pos' : s < -0.15 ? 'neg' : ''}">${esc(g.describeStance(o.id))}</b></div>${evs.map(e => `<div class="reason"><span class="${e.v > 0 ? 'pos' : 'neg'}">${e.v > 0 ? '+' : ''}${Math.round(e.v * 100)}</span> ${esc(e.why)} <small class="muted">(${this.when(e.t)})</small></div>`).join('')}</div>`; };
      const axes = D.AXES.map(ax => { const v = g.ideology[ax.id]; return `<div class="axis"><span class="ax-l ${v > 0.2 ? 'on' : ''}">${ax.pos}</span><div class="ax-bar"><div class="ax-dot" style="left:${(v + 1) / 2 * 100}%;background:${g.color}"></div></div><span class="ax-r ${v < -0.2 ? 'on' : ''}">${ax.neg}</span></div>`; }).join('');
      this.sheetBody.innerHTML = `
        <div class="sheet-title"><span class="big-dot" style="background:${g.color}">${g.icon}</span><div><h2>${esc(g.name)}</h2><div class="muted">${g.size} members · founded day ${Math.floor(g.founded / 24) + 1} · about ${esc(g.focusLabel())} · HQ ${esc(w.locName(g.hq))}</div><div>${g.bloc ? `⚔️ fighting as bloc ${g.bloc} · ` : ''}${g.militia ? '🪖 has a militia · ' : ''}${g.allies.length ? '🤝 allied with ' + g.allies.map(a => this.gchip(w.group(a))).join(' ') : ''}</div></div></div>
        <div class="actions"><a class="btn" data-act="locate-group" data-id="${g.id}">🔍 Highlight on map</a></div>
        <section><h3>Leader</h3>${leader ? `<p>${this.chip(leader)} <small class="muted">${esc(leader.personalityText())}</small></p>` : '<p class="muted">Leaderless.</p>'}</section>
        <section><h3>State of the group</h3>${bar('cohesion', g.cohesion)}${bar('militancy', g.militancy, 'hot')}${bar('morale', g.morale)}${bar('reputation', (g.reputation + 1) / 2)}${g.warWeariness > 0.1 ? bar('war-weariness', g.warWeariness, 'hot') : ''}<small class="muted">Last move: ${esc(g.lastAction === 'nothing' ? 'lying low' : g.lastAction || 'none')}${g.plan ? ` · planning a ${esc(g.plan.type)} at ${g.plan.hour}:00` : ''}</small></section>
        <section><h3>Ideology</h3>${axes}</section>
        <section><h3>Stance toward other groups</h3>${others.length ? others.map(stanceRow).join('') : '<p class="muted">No other groups exist. Blissful.</p>'}</section>
        <section><h3>Members</h3>${members.map(m => `<div class="rel"><span>${this.chip(m)}${m.id === g.leader ? ' ★' : ''}</span><span class="muted">${esc(m.jobName)}</span><span>${Math.round(m.loyalty * 100)}%</span></div>`).join('')}</section>
        <section><h3>History</h3>${g.history.slice().reverse().slice(0, 15).map(h => `<div class="mem"><small>${this.when(h.t)}</small><div>${esc(h.text)}</div></div>`).join('') || '<p class="muted">Nothing yet.</p>'}</section>
        <section><h3>Tally</h3><div class="stats"><div><b>${g.stats.protests}</b><small>protests</small></div><div><b>${g.stats.clashes}</b><small>clashes</small></div><div><b>${g.stats.recruits}</b><small>recruits</small></div><div><b>${g.stats.defections}</b><small>defections</small></div></div></section>`;
    }
    renderLocation(id) {
      const w = this.world, l = w.loc(id);
      const dist = D.DISTRICTS.find(d => d.id === l.district);
      const here = (w.occupancy[id] || []).map(cid => w.citizen(cid)).filter(Boolean);
      const recent = w.logs.filter(e => e.text.includes(l.name)).slice(-8).reverse();
      const nearby = dist.locations.filter(x => x.id !== id).map(x => `<a class="btn small" data-loc="${x.id}">${x.icon} ${esc(x.name)}</a>`).join(' ');
      this.sheetBody.innerHTML = `
        <div class="sheet-title"><span class="big-dot" style="background:${dist.color}">${l.icon}</span><div><h2>${esc(l.name)}</h2><div class="muted">${esc(dist.name)} · ${esc(dist.flavor)}</div></div></div>
        <section><h3>Here right now (${here.length})</h3>${here.length ? here.map(c => { const g = c.group ? w.group(c.group) : null; return `<div class="rel"><span>${this.chip(c)}</span><span class="muted">${esc(c.jobName)}${g ? ' · ' + esc(g.name) : ''}</span><span>${this.moodEmoji(c)}</span></div>`; }).join('') : '<p class="muted">Empty. Even the pigeons have gone.</p>'}</section>
        <section><h3>Recently here</h3>${recent.map(e => this.feedItem(e)).join('') || '<p class="muted">Quiet lately.</p>'}</section>
        <section><h3>Elsewhere in ${esc(dist.name)}</h3><p>${nearby}</p></section>`;
    }
    toast(text) { const t = $('#toast'); t.textContent = text; t.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), 2500); }
  }
  function bar(label, v, cls = '') { return `<div class="bar"><span>${label}</span><div class="track"><div class="fill ${cls}" style="width:${Math.round(clamp(v, 0, 1) * 100)}%"></div></div></div>`; }
  window.UI = UI;
})();
