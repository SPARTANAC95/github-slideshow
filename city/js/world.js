// The world: time, places, the hourly loop, daily happenings, rumours, goals, save/load.
(function () {
  const D = window.DATA;
  const SAVE_KEY = 'pebbleton-save-v1';

  class World {
    constructor(seed) {
      this.seed = seed;
      this.rng = new RNG(seed);
      this.tick = 0; this.day = 0; this.hour = 0;
      this.tension = 12; this.phase = 'peace'; this.ceasefire = 0;
      this.citizens = []; this.groups = []; this.rumours = []; this.history = [];
      this.logs = []; this.chronicleList = []; this.headlines = [];
      this.weather = 'clear'; this.conflict = null; this.election = null;
      this.rumourId = 1;
      this.locIndex = {};
      for (const d of D.DISTRICTS) for (const l of d.locations) this.locIndex[l.id] = Object.assign({ district: d.id }, l);
      this.occupancy = {};
      this.onLog = null;
    }

    // ---- Generation ----
    generate(population = 96) {
      const rng = this.rng;
      Citizen.resetIds(1); Group.resetIds(1);
      const weights = { docks: 1.1, steel: 1.1, commons: 1, uptown: 0.7, uni: 1.1, green: 1, night: 1 };
      for (let i = 0; i < population; i++) {
        const d = rng.pickWeighted(D.DISTRICTS, x => weights[x.id]);
        this.citizens.push(new Citizen(rng, this, { district: d.id }));
      }
      // Make sure the city has a few key roles
      const ensure = (job, n) => { let have = this.citizens.filter(c => c.job === job).length; for (const c of rng.shuffle(this.citizens)) { if (have >= n) break; if (['retired', 'student'].includes(c.job) || c.age > 65) continue; const jd = D.JOBS.find(j => j.id === job); c.job = job; c.work = jd.loc; have++; } };
      ensure('officer', 3); ensure('journalist', 2); ensure('priest', 1); ensure('bartender', 3); ensure('coach', 1); ensure('lawyer', 2);
      // Pre-existing acquaintances: neighbours and colleagues
      for (const c of this.citizens) {
        const neighbours = rng.shuffle(this.citizens.filter(o => o !== c && (o.district === c.district || (o.work && o.work === c.work)))).slice(0, rng.int(3, 6));
        for (const o of neighbours) { const comp = c.compatibility(o); const aff = comp * 25 + rng.range(-8, 12); c.adjustRel(o, aff, 0.1, 0); o.adjustRel(c, aff + rng.range(-5, 5), 0.1, 0); }
        if (c.age > 24 && rng.chance(0.25)) {
          const p = rng.shuffle(this.citizens.filter(o => o !== c && !o.partner && Math.abs(o.age - c.age) < 12 && o.district === c.district))[0];
          if (p) { c.partner = p.id; p.partner = c.id; c.adjustRel(p, 60, 0.5, 0); p.adjustRel(c, 60, 0.5, 0); }
        }
        assignGoals(this, c);
      }
      this.placeCitizens();
      window.Politics.init(this);
      this.log(3, `🏙️ Welcome to Pebbleton, population ${this.citizens.length}. Seed: ${this.seed}. Nobody dies here; the worst that can happen is a stern letter and a week at the Clinic.`);
      this.chronicle(`🏙️ Pebbleton founded with ${this.citizens.length} citizens.`);
    }
    placeCitizens() { for (const c of this.citizens) { c.loc = c.home; c.dest = c.home; } this.rebuildOccupancy(); }

    // ---- Lookups ----
    citizen(id) { return this.citizens.find(c => c.id === id) || null; }
    group(id) { return this.groups.find(g => g.id === id) || null; }
    loc(id) { return this.locIndex[id]; }
    locName(id) { const l = this.locIndex[id]; return l ? l.name : id; }
    at(locId) { return (this.occupancy[locId] || []).map(id => this.citizen(id)).filter(c => c && c.status === 'normal'); }
    rebuildOccupancy() { this.occupancy = {}; for (const c of this.citizens) { if (c.status === 'gone') continue; (this.occupancy[c.loc] || (this.occupancy[c.loc] = [])).push(c.id); } }
    policyActive(id) { return window.Politics.policyActive(this, id); }
    pressure(g, cause) { window.Politics.pressure(this, g, cause); }
    get dayName() { return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][this.day % 7]; }
    get weekend() { return this.day % 7 >= 5; }

    // ---- Logging ----
    log(level, text, who = [], groups = []) {
      const e = { id: this.logs.length ? this.logs[this.logs.length - 1].id + 1 : 1, t: this.tick, level, text, who: who.filter(Boolean).map(c => c.id), groups: groups.filter(Boolean).map(g => g.id) };
      this.logs.push(e);
      if (this.logs.length > 600) this.logs.splice(0, this.logs.length - 600);
      if (level >= 3) this.pushHeadline(text);
      if (this.onLog) this.onLog(e);
      return e;
    }
    chronicle(text) { this.chronicleList.push({ t: this.tick, text }); if (this.chronicleList.length > 200) this.chronicleList.shift(); }
    pushHeadline(text) { this.headlines.unshift({ t: this.tick, text }); if (this.headlines.length > 6) this.headlines.pop(); }

    // ---- Rumours ----
    inventRumour(author, listener, override) {
      const rng = this.rng;
      let text, tone, about;
      if (override && override.text) { text = override.text; tone = override.tone; about = override.about; }
      else {
        const tmpl = override && override.group ? rng.pick(D.RUMOURS.filter(r => r.about === 'group')) : rng.pick(D.RUMOURS);
        let A = null, B = null, G = null;
        if (tmpl.about === 'group' || tmpl.about === 'citizen_group') {
          G = override && override.group ? this.group(override.group) : rng.pick(this.groups.filter(g => !g.dissolved && g.id !== author.group));
          if (!G) return null;
        }
        if (tmpl.about !== 'group') {
          // Target someone the author dislikes, or a random notable
          const disliked = author.enemies(this, -10).filter(c => c !== listener);
          A = disliked.length && rng.chance(0.7) ? rng.pick(disliked) : rng.pick(this.citizens.filter(c => c !== author && c !== listener));
          if (!A) return null;
        }
        if (tmpl.about === 'pair') { B = rng.pick(this.citizens.filter(c => c !== A && c !== author && c !== listener)); if (!B) return null; }
        text = tmpl.t.replace('{A}', A ? A.shortName : '').replace('{B}', B ? B.shortName : '').replace('{G}', G ? G.name : '');
        tone = tmpl.tone;
        about = G && !A ? { group: G.id } : { citizen: A.id, group: G ? G.id : undefined };
      }
      const r = { id: this.rumourId++, text, tone, about, source: author.id, born: this.tick, spread: 1, published: false, dead: false };
      this.rumours.push(r);
      if (this.rumours.length > 40) this.rumours.shift();
      author.believes.add(r.id);
      return r;
    }
    applyRumour(c, r) {
      if (r.about.citizen && r.about.citizen !== c.id) { const target = this.citizen(r.about.citizen); if (target) { c.adjustRel(target, r.tone * 7, r.tone * 0.05, this.tick); target.reputation += r.tone * 0.03; } }
      if (r.about.group && r.about.group !== c.group) { if (r.tone < 0) c.grievance.groups[r.about.group] = (c.grievance.groups[r.about.group] || 0) + 0.4 * -r.tone; const g = this.group(r.about.group); if (g) g.reputation = clamp(g.reputation + r.tone * 0.02, -1, 1); }
      // Being the subject of a rumour you hear about yourself
      if (r.about.citizen === c.id) { const src = this.citizen(r.source); if (src && src !== c) { c.adjustRel(src, -12, -0.2, this.tick); c.remember(this, `${src.shortName} has been telling people that ${r.text.replace(c.shortName, 'I')}. Unbelievable.`, -0.6, 0.6, [src]); } }
    }

    // ---- The hourly loop ----
    step() {
      this.tick++;
      this.hour = this.tick % 24;
      this.day = Math.floor(this.tick / 24);
      if (this.hour === 5) this.daily();
      const rng = this.rng;
      for (const c of this.citizens) {
        if (c.status === 'gone') continue;
        c.upkeep(this, this.hour);
        if (c.drunk > 0 && this.hour % 2 === 0) { c.drunk--; if (c.drunk === 0) c.hangover = 3; }
        c.dest = this.chooseDestination(c);
        c.loc = c.dest;
      }
      this.rebuildOccupancy();
      for (const locId in this.occupancy) {
        const here = this.at(locId);
        if (!here.length) continue;
        const loc = this.loc(locId);
        const base = loc.kind === 'home' ? 0.12 : loc.kind === 'work' ? 0.22 : (this.hour >= 22 || this.hour < 7) ? 0.35 : 0.5;
        for (const c of rng.shuffle(here)) {
          const others = here.filter(o => o !== c);
          if (others.length && rng.chance(base * (0.5 + c.traits.extra) + (c.needs.social < 0.3 ? 0.2 : 0))) {
            const o = rng.pickWeighted(others, o => {
              const r = c.rel[o.id];
              let w = 0.6 + c.traits.open * 0.4;
              if (r) { if (r.aff > 30) w = 3; else if (r.aff < -25) w = 1.4; else w = 1.2; }
              if (o.id === c.partner) w = 3.5;
              if (c.group && o.group === c.group) w += 1;
              if (c.group && o.group && o.group !== c.group) w += 0.4;
              return w;
            });
            window.Interactions.interact(this, c, o);
          } else window.Interactions.solo(this, c);
        }
      }
      window.Conflict.hourly(this);
    }

    chooseDestination(c) {
      const rng = this.rng;
      const h = this.hour;
      if (c.status === 'injured') return 'clinic';
      if (c.status === 'jailed') return 'townhall';
      if (c.status === 'hiding') return c.home;
      const nightOwl = (c.interests.music || 0) + (c.interests.booze || 0) > 0.8;
      if (h < 6 || (h < 8 && !nightOwl && c.age > 30)) { if (c.drunk > 1 && h < 2 && rng.chance(0.5)) return c.loc; return c.home; }
      const curfew = this.policyActive('curfew') && h >= 23;
      if (curfew) return c.home;
      if (h >= 9 && h < 17 && !this.weekend && c.work && c.job !== 'unemployed' && c.job !== 'retired') {
        if (c.traits.consc > 0.2 || rng.chance(0.85)) return c.work;
      }
      // Free time: score every place
      const candidates = Object.values(this.locIndex).filter(l => l.kind !== 'home' || l.id === c.home);
      const myGroup = c.group ? this.group(c.group) : null;
      const enemyControl = this.conflict ? this.conflict.control : null;
      const scores = candidates.map(l => {
        let s = -0.4 + rng.range(0, 0.6);
        if (l.id === c.home) s += (1 - c.needs.rest) * 2.2 + (h >= 22 ? 1.2 : 0) + (c.traits.extra < 0.3 ? 0.5 : 0) + (c.needs.safety < 0.5 ? 1 : 0);
        for (const it of D.INTERESTS) if (c.interests[it.id] && it.locs.includes(l.id)) s += c.interests[it.id] * (1 - c.needs.fun) * 2.2 + (c.addiction[it.id] || 0) * 0.8;
        if (['bar', 'cafe', 'club', 'park', 'market', 'stadium'].includes(l.kind)) s += (1 - c.needs.social) * (0.4 + c.traits.extra) * 1.2;
        if (l.kind === 'bar' || l.kind === 'club') { if (h < 17) s -= 0.8; if (c.money < 15) s -= 1; if (c.age > 60) s -= 0.3; }
        if (l.kind === 'club' && (h < 21 || c.age > 45)) s -= 1.2;
        if (l.kind === 'temple') s += (c.interests.religion || 0) * (1 - c.needs.purpose) * 2 + (this.day % 7 === 6 && c.beliefs.faith > 0.3 ? 1 : 0);
        if (l.kind === 'plaza') s += (c.interests.politics || 0) * 0.8 + (c.grievance.mayor > 1.5 ? 0.6 : 0) + this.tension / 200 - 0.3;
        if (l.kind === 'betting' && c.money < 30) s -= 1;
        if (l.kind === 'market' && l.id === 'boutique' && c.money < 100) s -= 1.5;
        if (l.kind === 'stadium') s += (this.weekend && c.interests.sports ? 1.5 : -1.2);
        if (l.kind === 'clinic') s -= 4;
        if (l.kind === 'civic') s -= 1.5;
        if (myGroup && l.id === myGroup.hq) s += 0.5 + c.loyalty * 0.6 + (myGroup.recruiting ? 0.2 : 0);
        // Friends currently there
        const here = this.occupancy[l.id] || [];
        let friends = 0, foes = 0;
        for (const id of here) { const r = c.rel[id]; if (!r) continue; if (r.aff > 30) friends++; else if (r.aff < -30) foes++; }
        s += Math.min(3, friends) * 0.35 * (0.5 + c.traits.extra) - foes * 0.3 * (1 - c.traits.courage);
        if (c.partner && here.includes(c.partner)) s += 0.6;
        if (l.district !== c.district) s -= 0.35 + Math.max(0, c.beliefs.pride) * 0.3;
        if (enemyControl && myGroup && myGroup.bloc && enemyControl[l.district] && enemyControl[l.district] !== myGroup.bloc) s -= 1.5 * (1 - c.traits.courage);
        if (this.weather === 'rain' && (l.kind === 'park' || l.kind === 'plaza')) s -= 0.8;
        if (this.policyActive('gambling_ban') && l.kind === 'betting') s -= 3;
        if (this.policyActive('herb_ban') && l.kind === 'park' && c.interests.weed) s -= 0.6;
        return s;
      });
      const max = Math.max(...scores);
      return rng.pickWeighted(candidates, (l, i) => Math.exp((scores[candidates.indexOf(l)] - max) * 2.2)).id;
    }

    // ---- Once a day ----
    daily() {
      const rng = this.rng;
      this.weather = rng.chance(0.2) ? 'rain' : rng.chance(0.1) ? 'heat' : 'clear';
      for (const g of this.groups) g.recruiting = false;
      window.GroupSystem.updateGroups(this);
      if (rng.chance(0.7)) window.GroupSystem.tryFormGroups(this);
      window.Politics.daily(this);
      window.Conflict.daily(this);
      if (rng.chance(0.35)) this.incident();
      // Rumours age out
      for (const r of this.rumours) if (this.tick - r.born > 24 * 25) r.dead = true;
      this.rumours = this.rumours.filter(r => !r.dead || this.tick - r.born < 24 * 30);
      // Money: rent and radicalisation
      if (this.day % 7 === 0) for (const c of this.citizens) { const rent = D.DISTRICTS.find(d => d.id === c.district).wealth * 60 + 20; c.money -= rent; if (c.money < 0) { c.money = 0; c.stress += 0.2; c.grievance.mayor += 0.3; c.beliefs.share = clamp(c.beliefs.share + 0.06, -1, 1); if (rng.chance(0.3)) this.log(0, `${c.name} can't make rent this week and is starting to think the whole system is rigged.`, [c]); } else if (c.money > 800) c.beliefs.share = clamp(c.beliefs.share - 0.02, -1, 1); }
      for (const c of this.citizens) {
        if (c.status === 'gone') continue;
        // Breakups
        if (c.partner) { const p = this.citizen(c.partner); const r = c.relWith(c.partner); if (!p || p.status === 'gone' || r.aff < 15) { if (p) { p.partner = null; p.relWith(c.id).kind = 'ex'; p.remember(this, `${c.shortName} and I broke up. ${rng.pick(['It was mutual.', 'It was not mutual.', 'It was about bins, in the end.'])}`, -0.6, 0.8, [c]); p.mood -= 0.3; } c.partner = null; r.kind = 'ex'; c.remember(this, `${p ? p.shortName : 'They'} and I are over.`, -0.5, 0.8, p ? [p] : []); this.log(1, `💔 ${c.name} and ${p ? p.name : 'their partner'} have split up. The district takes sides.`, [c, p]); } }
        checkGoals(this, c);
        if (!c.goals.length || (c.goals.length < 2 && rng.chance(0.15))) assignGoals(this, c);
        // Leaving town
        if (c.mood < -0.75 && c.stress > 0.8 && c.traits.loyalty < 0.4 && rng.chance(0.08)) { c.status = 'gone'; c.statusUntil = Infinity; if (c.group) this.group(c.group)?.removeMember(this, c, 'left town'); this.log(2, `🚢 ${c.name} takes the morning ferry out of Pebbleton, muttering "never again". Their cat stays.`, [c]); this.chronicle(`🚢 ${c.name} left town.`); if (c.partner) { const p = this.citizen(c.partner); if (p) { p.partner = null; p.remember(this, `${c.shortName} left town without me. Rude.`, -0.7, 0.8, [c]); } c.partner = null; } }
      }
      // Newcomers keep the population steady
      if (this.citizens.filter(c => c.status !== 'gone').length < 85 && rng.chance(0.3)) this.spawnCitizen('arrives on the ferry looking for a fresh start');
      if (this.onDay) this.onDay();
    }

    spawnCitizen(how, opts = {}) {
      const c = new Citizen(this.rng, this, opts);
      c.arrived = this.tick;
      this.citizens.push(c);
      c.loc = c.home; c.dest = c.home;
      assignGoals(this, c);
      this.log(1, `🚢 ${c.name}, ${c.age}, ${c.jobName}, ${how}. They settle in ${D.DISTRICTS.find(d => d.id === c.district).name}.`, [c]);
      return c;
    }

    incident() {
      const rng = this.rng;
      const inc = rng.pickWeighted(D.INCIDENTS, i => i.weight * (i.interest === 'sports' && !this.weekend ? 0.2 : 1));
      let text = inc.text;
      const involved = [];
      if (inc.targetEffect === 'rich') { const c = rng.pick(this.citizens.filter(c => c.active)); c.money += 900; c.interests.status = clamp((c.interests.status || 0) + 0.5, 0, 1); c.remember(this, 'I won the lottery. I am now a person of consequence.', 0.9, 0.9); text = text.replace('{A}', c.name); involved.push(c); for (const f of c.friends(this)) if (f.interests.status) { f.adjustRel(c, -8, -0.05, this.tick); f.remember(this, `${c.shortName} won the lottery and won't shut up about it.`, -0.3, 0.4, [c]); } }
      if (inc.spawn) { const s = this.spawnCitizen('steps off the ferry with a pamphlet and a cause', { conviction: 0.95 }); const ax = rng.pick(D.AXES); s.beliefs[ax.id] = rng.chance(0.5) ? 0.95 : -0.95; s.traits.charisma = clamp(s.traits.charisma + 0.35, 0, 1); s.traits.ambition = 0.9; s.interests.politics = 0.9; involved.push(s); }
      if (inc.interest) for (const c of this.citizens) { if (c.interests[inc.interest]) c.mood = clamp(c.mood + inc.mood * c.interests[inc.interest] * 1.5, -1, 1); }
      else for (const c of this.citizens) c.mood = clamp(c.mood + inc.mood, -1, 1);
      if (inc.id === 'rain') this.weather = 'rain';
      if (inc.id === 'heatwave') { this.weather = 'heat'; for (const c of this.citizens) c.stress += 0.05; }
      if (inc.id === 'match_loss') { for (const c of this.citizens) if (c.interests.sports > 0.7) { c.grievance.mayor += 0.3; c.stress += 0.15; } }
      if (inc.id === 'match_win') { for (const c of this.citizens) if (c.interests.sports) { c.drunk = 2; c.stats.drinks++; } }
      this.tension = clamp(this.tension + inc.tension, 0, 100);
      const groups = [];
      if (inc.blameable && this.tension > 35 && this.groups.length) {
        const g = rng.pickWeighted(this.groups.filter(g => !g.dissolved), g => 1 - g.reputation + g.militancy);
        if (g) { groups.push(g); text += ` Everyone assumes ${g.name} did it.`; g.reputation -= 0.15; for (const c of this.citizens) if (c.group !== g.id && rng.chance(0.4)) c.grievance.groups[g.id] = (c.grievance.groups[g.id] || 0) + 0.5; const l = g.leaderObj(this); if (l) l.remember(this, `They blamed us for the ${inc.id} thing. We didn't do it. Probably.`, -0.5, 0.6, [], []); const r = this.inventRumour(rng.pick(this.citizens), null, { text: `${g.name} were behind the ${inc.id === 'fire' ? 'warehouse fire' : inc.id === 'statue' ? 'statue business' : 'missing mascot'}`, tone: -1, about: { group: g.id } }); if (r) r.spread = 3; }
      }
      this.log(2, `📻 ${text}`, involved, groups);
    }

    // ---- Save / load ----
    toJSON() {
      const cit = this.citizens.map(c => { const o = Object.assign({}, c); o.believes = [...c.believes]; delete o._gcache; return o; });
      return { v: 1, seed: this.seed, rng: this.rng.a, tick: this.tick, tension: this.tension, phase: this.phase, ceasefire: this.ceasefire, weather: this.weather, conflict: this.conflict, election: this.election, rumourId: this.rumourId, rumours: this.rumours, history: this.history, logs: this.logs.slice(-250), chronicleList: this.chronicleList, headlines: this.headlines, mayor: this.mayor, policies: this.policies, demands: this.demands, citizens: cit, groups: this.groups, nextCid: Citizen.nextId(), nextGid: Group.nextId() };
    }
    static fromJSON(data) {
      const w = new World(data.seed);
      w.rng = RNG.fromState(data.seed, data.rng);
      for (const k of ['tick', 'tension', 'phase', 'ceasefire', 'weather', 'conflict', 'election', 'rumourId', 'rumours', 'history', 'logs', 'chronicleList', 'headlines', 'mayor', 'policies', 'demands']) w[k] = data[k];
      w.hour = w.tick % 24; w.day = Math.floor(w.tick / 24);
      w.citizens = data.citizens.map(o => { const c = Object.create(Citizen.prototype); Object.assign(c, o); c.believes = new Set(o.believes); return c; });
      w.groups = data.groups.map(o => { const g = Object.create(Group.prototype); Object.assign(g, o); return g; });
      Citizen.resetIds(data.nextCid); Group.resetIds(data.nextGid);
      w.rebuildOccupancy();
      return w;
    }
    save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.toJSON())); return true; } catch (e) { return false; } }
    static load() { try { const s = localStorage.getItem(SAVE_KEY); if (!s) return null; return World.fromJSON(JSON.parse(s)); } catch (e) { console.warn('load failed', e); return null; } }
    static clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }
  }

  // ---- Goals ----
  function assignGoals(world, c) {
    const rng = world.rng;
    const t = c.traits;
    const opts = [];
    const has = type => c.goals.some(g => g.type === type);
    if (!c.partner && !has('partner') && c.age < 60) opts.push({ w: t.extra + 0.3, g: { type: 'partner', text: 'Find someone to share the noodles with' } });
    if (c.interests.status && !has('rich')) opts.push({ w: 1 + t.ambition, g: { type: 'rich', target: Math.round(c.money * 2 + 400), text: `Amass ${Math.round(c.money * 2 + 400)} coins and a reputation` } });
    if (c.group && world.group(c.group) && world.group(c.group).leader !== c.id && t.ambition > 0.55 && !has('lead')) opts.push({ w: t.ambition * 2, g: { type: 'lead', group: c.group, text: `Take over leadership of ${world.group(c.group).name}` } });
    if (!c.group && t.ambition > 0.4 && !has('found')) opts.push({ w: t.ambition + t.extra, g: { type: 'found', text: 'Start a movement of my own' } });
    if (c.conviction > 0.7 && !has('convert')) opts.push({ w: c.conviction, g: { type: 'convert', n: rng.int(2, 5), start: c.stats.converts, text: `Convince ${rng.int(2, 5)} people that I'm right` } });
    if (t.agree > 0.7 && !has('peace')) opts.push({ w: t.agree, g: { type: 'peace', text: 'Keep the peace between my neighbours' } });
    for (const v in c.addiction) if (c.addiction[v] > 0.65 && !has('sober')) opts.push({ w: 0.6, g: { type: 'sober', vice: v, since: world.tick, text: `Quit ${D.INTERESTS.find(i => i.id === v).name}. Starting Monday.` } });
    const stranger = rng.pick(world.citizens.filter(o => o !== c && o.active && !c.rel[o.id]));
    if (stranger && c.compatibility(stranger) > 0.3 && !has('befriend')) opts.push({ w: 0.6 + t.extra * 0.5, g: { type: 'befriend', target: stranger.id, text: `Get to know ${stranger.shortName}, who seems all right` } });
    if (!has('hobby')) opts.push({ w: 0.4, g: { type: 'hobby', n: 10, start: Object.values(c.stats).reduce((a, b) => a + b, 0), text: rng.pick(['Finally finish that book', 'Beat my personal best at something', 'See every noodle stand in the city', 'Win an argument for once', 'Grow a courgette bigger than the neighbour\'s']) } });
    const pick = rng.pickWeighted(opts, o => o.w);
    if (pick) c.goals.push(pick.g);
    if (c.goals.length > 3) c.goals.shift();
  }
  function checkGoals(world, c) {
    const rng = world.rng;
    const done = [];
    for (const g of c.goals) {
      let ok = false, text = null;
      if (g.type === 'partner' && c.partner) ok = true;
      if (g.type === 'rich' && c.money >= g.target) { ok = true; text = `${c.name} has amassed ${g.target} coins and has started saying "as a person of means".`; }
      if (g.type === 'lead' && c.group === g.group && world.group(g.group)?.leader === c.id) ok = true;
      if (g.type === 'lead' && c.group !== g.group) { done.push(g); continue; }
      if (g.type === 'found' && c.group && world.group(c.group)?.founder === c.id) ok = true;
      if (g.type === 'convert' && c.stats.converts - g.start >= g.n) { ok = true; text = `${c.name} has now talked ${g.n} people round to their way of thinking and feels vindicated.`; }
      if (g.type === 'befriend') { const r = c.rel[g.target]; if (r && r.aff > 35) ok = true; }
      if (g.type === 'sober') {
        const used = g.vice === 'weed' ? c.stats.joints : g.vice === 'booze' ? c.stats.drinks : c.stats.betsLost;
        if (g.count === undefined) g.count = used;
        if (used > g.count + 3) { c.goals = c.goals.filter(x => x !== g); if (rng.chance(0.5)) world.log(1, `${c.name} was going to quit ${D.INTERESTS.find(i => i.id === g.vice).name}, and has now formally rescheduled quitting to "next Monday".`, [c]); c.remember(world, `Tried to quit ${D.INTERESTS.find(i => i.id === g.vice).name}. Lasted ${Math.round((world.tick - g.since) / 24)} days. Monday, then.`, -0.2, 0.4); continue; }
        if (world.tick - g.since > 24 * 14) { ok = true; c.addiction[g.vice] *= 0.5; text = `${c.name} has been off ${D.INTERESTS.find(i => i.id === g.vice).name} for two whole weeks and will tell you about it.`; }
      }
      if (g.type === 'hobby' && Object.values(c.stats).reduce((a, b) => a + b, 0) - g.start >= g.n) ok = true;
      if (g.type === 'revenge') { const t = world.citizen(g.target); if (!t || t.status === 'gone' || (c.rel[g.target] && c.rel[g.target].aff > 0)) { done.push(g); continue; } const m = c.memories.find(mm => mm.who.includes(g.target) && mm.tone < -0.5); if (t.status === 'injured' && m && world.tick - m.t < 24 * 5 && rng.chance(0.3)) { ok = true; text = `${c.name} considers the score with ${t.shortName} settled, for now.`; } }
      if (ok) { done.push(g); c.remember(world, `Goal achieved: ${g.text}.`, 0.6, 0.6); c.mood = clamp(c.mood + 0.25, -1, 1); if (text) world.log(1, `🎯 ${text}`, [c]); }
    }
    if (done.length) c.goals = c.goals.filter(g => !done.includes(g));
  }

  window.World = World;
})();
