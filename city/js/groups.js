// Groups: social circles that form from friendships and shared beliefs, then
// grow leaders, rivalries, alliances and grudges of their own.
(function () {
  const D = window.DATA;
  let NEXT_GID = 1;
  const PALETTE = ['#e6553f', '#3fa7e6', '#e6b13f', '#8e5be6', '#3fe68a', '#e63f9a', '#5be6d8', '#b5e63f', '#e68a3f', '#3f5be6', '#e63f3f', '#8ae63f', '#d13fe6', '#3fe6c0', '#e6d13f', '#7a3fe6'];

  class Group {
    constructor(world, founder, members, focus, district) {
      this.id = NEXT_GID++;
      this.founded = world.tick;
      this.founder = founder.id;
      this.leader = founder.id;
      this.members = members.map(m => m.id);
      this.focus = focus; // interest id, or axis id (+'-' for the negative pole)
      this.district = district;
      this.color = PALETTE[(this.id - 1) % PALETTE.length];
      const nm = nameGroup(world.rng, focus, district, world.groups.map(g => g.name));
      this.name = nm.name; this.icon = nm.icon;
      this.ideology = {};
      this.recomputeIdeology(world, 1);
      this.hq = pickHQ(world, focus, district);
      this.cohesion = 0.6; this.militancy = 0.1; this.morale = 0.7; this.reputation = 0; this.influence = 0;
      this.stances = {}; this.stanceEvents = {}; this.allies = [];
      this.demands = []; this.history = [];
      this.bloc = null; this.warWeariness = 0;
      this.lastAction = null; this.plan = null; this.dissolved = false;
      this.recruiting = false; this.protestTarget = null;
      this.stats = { protests: 0, clashes: 0, recruits: 0, defections: 0 };
    }
    get size() { return this.members.length; }
    memberObjs(world) { return this.members.map(id => world.citizen(id)).filter(Boolean); }
    leaderObj(world) { return world.citizen(this.leader); }
    has(id) { return this.members.includes(id); }
    stance(gid) { return this.stances[gid] || 0; }
    nudgeStance(gid, delta, why, world) {
      const ev = this.stanceEvents[gid] || (this.stanceEvents[gid] = []);
      ev.push({ t: world.tick, v: delta, why });
      if (ev.length > 12) ev.shift();
    }
    dominantAxis() {
      let best = null, bv = 0;
      for (const ax of D.AXES) { const v = Math.abs(this.ideology[ax.id]); if (v > bv) { bv = v; best = ax.id; } }
      return { axis: best, value: this.ideology[best] };
    }
    focusLabel() {
      const it = D.INTERESTS.find(i => i.id === this.focus);
      if (it) return `${it.name} ${it.icon}`;
      const ax = D.AXES.find(a => a.id === this.focus.replace('-', ''));
      return this.focus.endsWith('-') ? ax.negWord : ax.posWord;
    }
    recomputeIdeology(world, blend = 0.15) {
      const ms = this.memberObjs(world);
      if (!ms.length) return;
      const leader = this.leaderObj(world);
      for (const ax of D.AXES) {
        let sum = 0, w = 0;
        for (const m of ms) { const ww = m === leader ? 3 : 1; sum += m.beliefs[ax.id] * ww; w += ww; }
        const mean = sum / w;
        this.ideology[ax.id] = this.ideology[ax.id] === undefined ? mean : lerp(this.ideology[ax.id], mean, blend);
      }
    }
    addMember(world, c, why) {
      if (this.has(c.id)) return;
      if (c.group) world.group(c.group)?.removeMember(world, c, 'left for another group');
      this.members.push(c.id); c.group = this.id; c.loyalty = 0.5; c.groupJoinedAt = world.tick;
      this.stats.recruits++;
      this.history.push({ t: world.tick, text: `${c.name} joined (${why}).` });
    }
    removeMember(world, c, why) {
      const i = this.members.indexOf(c.id);
      if (i >= 0) this.members.splice(i, 1);
      if (c.group === this.id) c.group = null;
      this.history.push({ t: world.tick, text: `${c.name} left (${why}).` });
      if (this.leader === c.id) this.chooseLeader(world, `${c.name} is gone`);
      if (this.history.length > 30) this.history.shift();
    }
    popularity(world, c) {
      let s = 0, n = 0;
      for (const m of this.memberObjs(world)) { if (m.id === c.id) continue; s += m.opinionOf(c); n++; }
      return n ? s / n : 0;
    }
    chooseLeader(world, why) {
      const ms = this.memberObjs(world).filter(m => m.status !== 'gone');
      if (!ms.length) return;
      const best = ms.reduce((a, b) => leaderScore(this, world, b) > leaderScore(this, world, a) ? b : a);
      if (best.id !== this.leader) {
        this.leader = best.id;
        this.history.push({ t: world.tick, text: `${best.name} became leader (${why}).` });
        world.log(2, `${best.name} takes over as leader of ${this.name} (${why}).`, [best], [this]);
        best.remember(world, `I became the leader of ${this.name}.`, 0.8, 0.9, [], [this.id]);
        this.recomputeIdeology(world, 0.3);
      }
    }
    // Groups with whom this group is in open conflict
    enemies(world) { return world.groups.filter(g => g !== this && !g.dissolved && this.stance(g.id) < -0.5); }
    describeStance(gid) {
      const s = this.stance(gid);
      if (this.allies.includes(gid)) return 'allied';
      if (s < -0.7) return 'at war with';
      if (s < -0.4) return 'hostile to';
      if (s < -0.15) return 'wary of';
      if (s > 0.4) return 'friendly with';
      if (s > 0.15) return 'warming to';
      return 'indifferent to';
    }
  }

  function leaderScore(g, world, c) {
    const t = c.traits;
    return t.charisma * 2 + t.ambition * 1.2 + g.popularity(world, c) / 60 + c.loyalty * 0.5 + (c.id === g.leader ? 0.6 : 0) + (c.status === 'normal' ? 0 : -3);
  }

  function pickHQ(world, focus, district) {
    const it = D.INTERESTS.find(i => i.id === focus);
    const dist = D.DISTRICTS.find(d => d.id === district);
    if (it) {
      const inDistrict = it.locs.filter(l => dist.locations.some(x => x.id === l));
      if (inDistrict.length) return inDistrict[0];
      return it.locs[0];
    }
    const social = dist.locations.filter(l => ['bar', 'cafe', 'park', 'temple', 'culture', 'club'].includes(l.kind));
    return social.length ? world.rng.pick(social).id : dist.locations[1].id;
  }

  function nameGroup(rng, focus, district, existing) {
    const bank = D.GROUP_NAMES[focus] || D.GROUP_NAMES.politics;
    const dist = D.DISTRICTS.find(d => d.id === district);
    const distWords = { docks: 'Dockside', steel: 'Steelyard', commons: 'Commons', uptown: 'Uptown', uni: 'University', green: 'Greenbelt', night: 'Nightmarket' };
    for (let tries = 0; tries < 20; tries++) {
      const style = rng.int(0, 3);
      let name;
      const adj = rng.pick(bank.adj), noun = rng.pick(bank.noun);
      if (style === 0) name = `The ${adj} ${noun}`;
      else if (style === 1) name = `${distWords[district]} ${adj} ${noun}`;
      else if (style === 2) name = `The ${adj} ${noun} of ${dist.name}`;
      else name = `${adj} ${noun}`;
      if (!existing.some(e => e.replace(/^The /, '').toLowerCase() === name.replace(/^The /, '').toLowerCase())) return { name, icon: bank.icon };
    }
    return { name: `The ${rng.pick(bank.adj)} ${rng.pick(bank.noun)} #${rng.int(2, 99)}`, icon: bank.icon };
  }

  // Try to found new groups from clusters of friends. Runs once a day.
  function tryFormGroups(world) {
    const rng = world.rng;
    const free = world.citizens.filter(c => !c.group && c.active);
    const candidates = rng.shuffle(free).sort((a, b) => (b.traits.charisma + b.traits.ambition + b.traits.extra) - (a.traits.charisma + a.traits.ambition + a.traits.extra)).slice(0, 12);
    for (const founder of candidates) {
      if (!rng.chance(0.25 + founder.traits.ambition * 0.4 + (1 - founder.needs.purpose) * 0.3)) continue;
      const friends = founder.friends(world, 28).filter(f => !f.group && f.active);
      if (friends.length < 2) continue;
      // Find what binds them: a shared interest or a shared conviction
      const focus = findFocus(world, founder, friends);
      if (!focus) continue;
      const members = [founder].concat(friends.filter(f => f.beliefDistance(founder) < 0.9 || (focus.kind === 'interest' && f.interests[focus.id])).slice(0, 5));
      if (members.length < 3) continue;
      const g = new Group(world, founder, members, focus.id, founder.district);
      for (const m of members) { m.group = g.id; m.loyalty = m === founder ? 0.9 : rng.range(0.45, 0.75); m.groupJoinedAt = world.tick; }
      world.groups.push(g);
      const where = world.locName(g.hq);
      world.log(3, `${g.icon} A new group is born: ${g.name}, founded by ${founder.name} and ${members.length - 1} friends over ${focus.kind === 'interest' ? D.INTERESTS.find(i => i.id === focus.id).name : 'a shared conviction'} at ${where}.`, members, [g]);
      world.chronicle(`${g.icon} ${g.name} founded by ${founder.name}.`);
      for (const m of members) m.remember(world, `We founded ${g.name} together. It felt like the start of something.`, 0.7, 0.8, members.filter(x => x !== m), [g.id]);
      founder.goals.push({ type: 'grow', group: g.id, text: `Make ${g.name} the biggest group in the city` });
      return g;
    }
    return null;
  }
  function findFocus(world, founder, friends) {
    const all = [founder].concat(friends);
    const taken = {};
    for (const g of world.groups) if (!g.dissolved) taken[g.focus] = (taken[g.focus] || 0) + 1;
    let best = null, bs = 0;
    for (const it of D.INTERESTS) {
      let s = 0; for (const c of all) s += c.interests[it.id] || 0;
      s = (s / all.length + (founder.interests[it.id] || 0) * 0.5) / (1 + (taken[it.id] || 0) * 0.6);
      if (s > bs) { bs = s; best = { kind: 'interest', id: it.id, s }; }
    }
    let bax = null, bv = 0;
    for (const ax of D.AXES) {
      let s = 0; for (const c of all) s += c.beliefs[ax.id] * c.conviction;
      s /= all.length;
      const key = ax.id + (s < 0 ? '-' : '');
      s /= (1 + (taken[key] || 0) * 0.6);
      if (Math.abs(s) > bv) { bv = Math.abs(s); bax = { kind: 'axis', id: key, s: Math.abs(s) * 1.4 }; }
    }
    if (bax && bax.s > bs && bv > 0.35) return bax;
    if (best && bs > 0.45) return best;
    return bax && bv > 0.3 ? bax : null;
  }

  // Daily update of every group's internal state and relations to others.
  function updateGroups(world) {
    const rng = world.rng;
    for (const g of world.groups) {
      if (g.dissolved) continue;
      const ms = g.memberObjs(world);
      if (ms.length < 2) { dissolve(world, g, 'it ran out of members'); continue; }
      g.recomputeIdeology(world, 0.1);
      // Members drift toward the group line (echo chamber), loyalty moves with fit
      const leader = g.leaderObj(world);
      for (const m of ms) {
        const d = m.beliefDistanceTo(g.ideology);
        for (const ax of D.AXES) m.beliefs[ax.id] = clamp(lerp(m.beliefs[ax.id], g.ideology[ax.id], 0.02 * m.loyalty * (1 - m.conviction * 0.5)), -1, 1);
        m.loyalty = clamp(m.loyalty + (0.35 - d) * 0.03 + (leader && m.opinionOf(leader) > 20 ? 0.01 : -0.005) + (g.morale - 0.5) * 0.01, 0, 1);
        m.needs.purpose = clamp(m.needs.purpose + 0.05 * m.loyalty, 0, 1);
        if (m.loyalty < 0.12 && rng.chance(0.3)) {
          g.removeMember(world, m, 'lost faith');
          world.log(1, `${m.name} quietly stops turning up to ${g.name}.`, [m], [g]);
          m.remember(world, `I drifted away from ${g.name}. They'd changed. Or I had.`, -0.2, 0.5, [], [g.id]);
        }
      }
      // Cohesion follows internal friendliness
      let aff = 0, n = 0;
      for (const a of ms) for (const b of ms) if (a !== b) { aff += a.opinionOf(b); n++; }
      const meanAff = n ? aff / n : 0;
      g.cohesion = clamp(lerp(g.cohesion, 0.5 + meanAff / 120, 0.1), 0, 1);
      // Militancy: temper, courage, grievances, tension, leader
      let mil = 0;
      for (const m of ms) mil += m.traits.temper * 0.22 + m.traits.courage * 0.12 + Object.values(m.grievance.groups).reduce((a, b) => a + b, 0) * 0.035 + m.grievance.mayor * 0.02;
      mil = mil / ms.length + (leader ? leader.traits.temper * 0.2 + leader.traits.ambition * 0.1 - leader.traits.agree * 0.2 : 0) + world.tension / 400 + (g.militia ? 0.1 : 0);
      g.militancy = clamp(lerp(g.militancy, mil, 0.15), 0, 1);
      g.morale = clamp(g.morale + 0.02 - g.warWeariness * 0.03 + (g.cohesion - 0.5) * 0.02, 0.05, 1);
      g.warWeariness = Math.max(0, g.warWeariness - 0.01);
      g.reputation = clamp(g.reputation * 0.98, -1, 1);
      g.influence = ms.length + ms.reduce((a, m) => a + m.money / 500 + m.reputation / 10, 0);
      // Stances toward other groups
      for (const o of world.groups) {
        if (o === g || o.dissolved) continue;
        let base = -(distance(g.ideology, o.ideology) - 0.6) * 0.9;
        if (g.focus === o.focus) base += 0.3;
        if (g.allies.includes(o.id)) base += 0.5;
        let ev = 0;
        for (const e of (g.stanceEvents[o.id] || [])) ev += e.v / (1 + (world.tick - e.t) / (24 * 15));
        let mem = 0;
        for (const m of ms) mem += (m.grievance.groups[o.id] || 0);
        mem = -clamp(mem / ms.length * 0.15, 0, 0.8);
        const target = clamp(base + ev + mem + (leader ? leader.opinionOfGroup(o, world).score / 300 : 0), -1, 1);
        g.stances[o.id] = lerp(g.stance(o.id), target, 0.2);
      }
      // Alliances break if stance sours
      g.allies = g.allies.filter(aid => { const o = world.group(aid); if (!o || o.dissolved) return false; if (g.stance(aid) < -0.2) { world.log(2, `${g.name} tears up its alliance with ${o.name}.`, [], [g, o]); o.allies = o.allies.filter(x => x !== g.id); return false; } return true; });
      // Leadership challenge
      if (rng.chance(0.08)) leadershipChallenge(world, g);
      // Splinter
      if (ms.length >= 6 && rng.chance(0.06)) trySplinter(world, g);
    }
  }
  function distance(a, b) { let s = 0; for (const ax of D.AXES) { const d = (a[ax.id] || 0) - (b[ax.id] || 0); s += d * d; } return Math.sqrt(s / D.AXES.length); }

  function leadershipChallenge(world, g) {
    const leader = g.leaderObj(world);
    const ms = g.memberObjs(world);
    const challenger = ms.filter(m => m !== leader && m.traits.ambition > 0.6).sort((a, b) => leaderScore(g, world, b) - leaderScore(g, world, a))[0];
    if (!leader || !challenger) return;
    const cs = leaderScore(g, world, challenger), ls = leaderScore(g, world, leader);
    if (cs < ls + 0.2) return;
    const rng = world.rng;
    // Vote
    let forC = 0, forL = 0;
    for (const m of ms) { if (m === leader) forL++; else if (m === challenger) forC++; else if (m.opinionOf(challenger) + rng.range(-20, 20) > m.opinionOf(leader)) forC++; else forL++; }
    if (forC > forL) {
      g.leader = challenger.id;
      g.history.push({ t: world.tick, text: `${challenger.name} ousted ${leader.name} as leader (${forC}-${forL}).` });
      world.log(3, `🗳️ Coup at ${g.name}: ${challenger.name} ousts ${leader.name} as leader by ${forC} votes to ${forL}.`, [challenger, leader], [g]);
      leader.adjustRel(challenger, -35, -0.3, world.tick); challenger.adjustRel(leader, -10, -0.1, world.tick);
      leader.remember(world, `${challenger.name} took ${g.name} from me. I won't forget it.`, -0.8, 0.9, [challenger], [g.id]);
      challenger.remember(world, `I took charge of ${g.name}. About time.`, 0.8, 0.9, [leader], [g.id]);
      leader.loyalty -= 0.3;
      if (leader.traits.loyalty < 0.4 && rng.chance(0.5)) { g.removeMember(world, leader, 'stormed out after losing the leadership'); world.log(2, `${leader.name} storms out of ${g.name}.`, [leader], [g]); }
      g.recomputeIdeology(world, 0.3);
    } else {
      world.log(2, `${challenger.name} challenges ${leader.name} for leadership of ${g.name} and loses ${forC}-${forL}. Awkward.`, [challenger, leader], [g]);
      challenger.adjustRel(leader, -15, -0.1, world.tick); leader.adjustRel(challenger, -20, -0.2, world.tick);
      challenger.remember(world, `I lost a leadership vote in ${g.name}. Everyone was very polite about it, which was worse.`, -0.5, 0.6, [leader], [g.id]);
    }
  }
  function trySplinter(world, g) {
    const ms = g.memberObjs(world);
    const dissidents = ms.filter(m => m.id !== g.leader && m.beliefDistanceTo(g.ideology) > 0.55 && m.loyalty < 0.45);
    if (dissidents.length < 3) return;
    const head = dissidents.sort((a, b) => b.traits.charisma - a.traits.charisma)[0];
    for (const d of dissidents) g.removeMember(world, d, 'splintered off');
    const nu = new Group(world, head, dissidents, g.focus, head.district);
    nu.name = world.rng.chance(0.5) ? `The True ${g.name.replace(/^The /, '')}` : `${g.name} (Reformed)`;
    for (const d of dissidents) { d.group = nu.id; d.loyalty = 0.6; }
    nu.stances[g.id] = -0.5; g.stances[nu.id] = -0.5;
    nu.nudgeStance(g.id, -0.4, 'the split', world); g.nudgeStance(nu.id, -0.4, 'the split', world);
    world.groups.push(nu);
    world.log(3, `💥 Schism! ${head.name} leads ${dissidents.length - 1} others out of ${g.name} to form ${nu.name}. Nobody agrees on who gets the banner.`, dissidents, [g, nu]);
    world.chronicle(`💥 ${nu.name} split from ${g.name}, led by ${head.name}.`);
    for (const d of dissidents) d.remember(world, `We walked out of ${g.name} and started ${nu.name}. They were never really listening.`, 0.2, 0.8, [], [g.id, nu.id]);
    for (const m of g.memberObjs(world)) m.remember(world, `${head.name} and the others split from us to form ${nu.name}. Traitors, frankly.`, -0.5, 0.7, dissidents, [nu.id]);
  }
  function dissolve(world, g, why) {
    g.dissolved = true;
    for (const m of g.memberObjs(world)) if (m.group === g.id) m.group = null;
    for (const o of world.groups) o.allies = o.allies.filter(x => x !== g.id);
    world.log(2, `${g.icon} ${g.name} has dissolved: ${why}.`, [], [g]);
    world.chronicle(`${g.icon} ${g.name} dissolved (${why}).`);
  }

  Group.resetIds = n => { NEXT_GID = n; };
  Group.nextId = () => NEXT_GID;
  window.Group = Group;
  window.GroupSystem = { tryFormGroups, updateGroups, dissolve, nameGroup, leaderScore };
})();
