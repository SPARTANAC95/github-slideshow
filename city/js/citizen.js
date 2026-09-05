// A citizen of Pebbleton: personality, beliefs, needs, memories, relationships and goals.
(function () {
  const D = window.DATA;
  let NEXT_ID = 1;

  const TRAIT_WORDS = {
    open: ['closed-minded', 'set in their ways', 'practical', 'curious', 'wildly open-minded'],
    consc: ['chaotic', 'scatterbrained', 'easygoing', 'diligent', 'obsessively organised'],
    extra: ['hermit-like', 'quiet', 'sociable enough', 'outgoing', 'the loudest person in any room'],
    agree: ['prickly', 'blunt', 'fair-minded', 'warm', 'a total softie'],
    neuro: ['unflappable', 'steady', 'a bit twitchy', 'anxious', 'permanently on edge'],
    charisma: ['forgettable', 'plain-spoken', 'likeable', 'magnetic', 'dangerously persuasive'],
    ambition: ['content', 'unambitious', 'quietly driven', 'ambitious', 'hungry for power'],
    courage: ['timid', 'cautious', 'brave when needed', 'bold', 'recklessly brave'],
    humor: ['humourless', 'dry', 'funny-ish', 'very funny', 'a menace with a punchline'],
    loyalty: ['fickle', 'flaky', 'reliable', 'loyal', 'loyal to a fault'],
    temper: ['serene', 'patient', 'fair-tempered', 'short-fused', 'a walking argument'],
  };
  function word(trait, v) { return TRAIT_WORDS[trait][Math.min(4, Math.floor(v * 5))]; }

  class Citizen {
    constructor(rng, world, opts = {}) {
      this.id = NEXT_ID++;
      this.first = rng.pick(D.FIRST);
      this.last = rng.pick(D.LAST);
      this.age = opts.age || rng.int(18, 79);
      this.district = opts.district || rng.pick(D.DISTRICTS).id;
      this.home = this.district + '_home';
      const t = this.traits = {
        open: rng.trait(), consc: rng.trait(), extra: rng.trait(), agree: rng.trait(), neuro: rng.trait(),
        charisma: rng.trait(0.45, 0.22), ambition: rng.trait(0.4, 0.25), courage: rng.trait(), humor: rng.trait(),
        loyalty: rng.trait(0.55, 0.2), temper: rng.trait(0.4, 0.22),
      };
      // Beliefs are shaped a little by home district, then by personal noise.
      const dist = D.DISTRICTS.find(d => d.id === this.district);
      const lean = DISTRICT_LEAN[this.district] || {};
      this.beliefs = {};
      for (const ax of D.AXES) this.beliefs[ax.id] = clamp(rng.gauss(lean[ax.id] || 0, 0.45), -1, 1);
      if (opts.beliefs) Object.assign(this.beliefs, opts.beliefs);
      this.conviction = opts.conviction || rng.trait(0.5, 0.25);
      // Interests: two to four, weighted by district and age.
      this.interests = {};
      const nInt = rng.int(2, 4);
      const pool = rng.shuffle(D.INTERESTS);
      pool.sort((a, b) => interestWeight(b, this, rng) - interestWeight(a, this, rng));
      for (let i = 0; i < nInt; i++) this.interests[pool[i].id] = clamp(rng.gauss(0.6, 0.2), 0.2, 1);
      if (opts.interests) Object.assign(this.interests, opts.interests);
      this.addiction = {};
      for (const it of D.INTERESTS) if (it.vice && this.interests[it.id]) this.addiction[it.id] = clamp(this.interests[it.id] * rng.range(0.4, 1.1), 0.1, 1);
      // Job
      this.job = opts.job || pickJob(rng, this);
      const job = D.JOBS.find(j => j.id === this.job);
      this.work = job.loc;
      this.money = Math.round(job.wage * rng.range(8, 30) * (dist.wealth + 0.5));
      // Nickname from strongest interest, sometimes
      const topInt = Object.entries(this.interests).sort((a, b) => b[1] - a[1])[0];
      this.nick = (topInt && rng.chance(0.3)) ? rng.pick(D.NICKNAMES[topInt[0]]) : null;
      // Dynamic state
      this.needs = { rest: rng.range(0.5, 1), social: rng.range(0.3, 0.9), fun: rng.range(0.3, 0.9), purpose: rng.range(0.3, 0.9), safety: 1 };
      this.mood = rng.range(-0.2, 0.4);
      this.stress = rng.range(0, 0.3);
      this.reputation = 0;
      this.rel = {};
      this.memories = [];
      this.group = null; this.loyalty = 0.5; this.groupJoinedAt = 0;
      this.goals = [];
      this.loc = this.home; this.dest = this.home;
      this.status = 'normal'; this.statusUntil = 0; // normal | injured | jailed | hiding | gone
      this.grievance = { mayor: 0, groups: {} };
      this.recent = [];
      this.partner = null;
      this.hangover = 0;
      this.mayorApproval = 0;
      this.believes = new Set();
      this.drunk = 0;
      this.arrived = world ? world.tick : 0;
      this.x = 0; this.y = 0;
      this.stats = { arguments: 0, fights: 0, jokes: 0, converts: 0, drinks: 0, joints: 0, betsLost: 0, helped: 0, forgiven: 0 };
    }

    get name() { return this.nick ? `${this.first} "${this.nick}" ${this.last}` : `${this.first} ${this.last}`; }
    get shortName() { return this.nick && !/^the /.test(this.nick) ? `${this.nick} ${this.last}` : this.first + ' ' + this.last; }
    get active() { return this.status === 'normal'; }
    get jobName() { return D.JOBS.find(j => j.id === this.job).name; }

    // ---- Beliefs & compatibility ----
    beliefDistance(o) {
      let s = 0;
      for (const ax of D.AXES) { const d = this.beliefs[ax.id] - o.beliefs[ax.id]; s += d * d; }
      return Math.sqrt(s / D.AXES.length); // 0..2
    }
    beliefDistanceTo(vec) {
      let s = 0;
      for (const ax of D.AXES) { const d = this.beliefs[ax.id] - (vec[ax.id] || 0); s += d * d; }
      return Math.sqrt(s / D.AXES.length);
    }
    sharedInterests(o) {
      const out = [];
      for (const k in this.interests) if (o.interests[k]) out.push(k);
      return out;
    }
    // How naturally these two get along: -1 .. 1
    compatibility(o) {
      const bd = this.beliefDistance(o);
      const beliefTerm = (0.55 - bd) * (0.5 + 0.5 * (this.conviction + o.conviction) / 2);
      const shared = this.sharedInterests(o).length;
      const openness = (this.traits.open + o.traits.open) / 2;
      let c = beliefTerm * (1.2 - openness * 0.6) + shared * 0.25 + (this.traits.agree + o.traits.agree - 1) * 0.2;
      if (Math.abs(this.age - o.age) > 30) c -= 0.1;
      if (this.district === o.district) c += 0.08;
      return clamp(c, -1, 1);
    }
    dominantBelief() {
      let best = null, bv = 0;
      for (const ax of D.AXES) { const v = Math.abs(this.beliefs[ax.id]); if (v > bv) { bv = v; best = ax; } }
      return { axis: best, value: this.beliefs[best.id] };
    }
    topInterests(n = 3) { return Object.entries(this.interests).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]); }

    // ---- Relationships ----
    relWith(id) {
      let r = this.rel[id];
      if (!r) r = this.rel[id] = { aff: 0, trust: 0.3, fam: 0, kind: 'stranger', last: 0 };
      return r;
    }
    adjustRel(other, dAff, dTrust = 0, tick = 0) {
      const r = this.relWith(other.id);
      if (dAff > 0) dAff *= 1 - Math.max(0, r.aff) / 105; else dAff *= 1 - Math.max(0, -r.aff) / 105;
      r.aff = clamp(r.aff + dAff, -100, 100);
      r.trust = clamp(r.trust + dTrust, 0, 1);
      r.fam = clamp(r.fam + 0.04, 0, 1);
      r.last = tick;
      if (this.partner === other.id) r.kind = 'partner';
      else if (r.aff > 70) r.kind = 'best friend';
      else if (r.aff > 35) r.kind = 'friend';
      else if (r.aff < -60) r.kind = 'enemy';
      else if (r.aff < -25) r.kind = 'rival';
      else if (r.fam > 0.15) r.kind = 'acquaintance';
      else r.kind = 'stranger';
      return r;
    }
    opinionOf(other) {
      const r = this.rel[other.id];
      let v = r ? r.aff : 0;
      if (other.group && other.group !== this.group) v += this.groupBias(other.group) * 0.3;
      return v;
    }
    friends(world, min = 35) {
      return Object.entries(this.rel).filter(([id, r]) => r.aff >= min).map(([id]) => world.citizen(+id)).filter(Boolean);
    }
    enemies(world, max = -25) {
      return Object.entries(this.rel).filter(([id, r]) => r.aff <= max).map(([id]) => world.citizen(+id)).filter(Boolean);
    }

    // ---- Memories ----
    remember(world, text, tone, importance, subjects = [], groups = []) {
      this.memories.push({ t: world.tick, text, tone, imp: importance, who: subjects.map(s => (typeof s === 'number' ? s : s.id)), groups });
      if (this.memories.length > 40) {
        // Keep the most salient: importance decays with age
        this.memories.sort((a, b) => salience(b, world.tick) - salience(a, world.tick));
        this.memories.length = 32;
        this.memories.sort((a, b) => a.t - b.t);
      }
      this.mood = clamp(this.mood + tone * importance * 0.15, -1, 1);
      if (tone < 0) this.stress = clamp(this.stress + importance * 0.08, 0, 1);
    }
    act(text) { this.recent.push(text); if (this.recent.length > 8) this.recent.shift(); }

    // ---- Group opinion ----
    // Bias toward a group from ideology alone, -1..1
    ideologyBias(group) {
      const d = this.beliefDistanceTo(group.ideology);
      return clamp((0.5 - d) * 1.4 * (0.4 + this.conviction), -1, 1);
    }
    // Total feeling about a group, -100..100, with reasons
    opinionOfGroup(group, world) {
      const reasons = [];
      let score = 0;
      if (this.group === group.id) {
        score += 40 * this.loyalty + 10; reasons.push({ v: Math.round(40 * this.loyalty + 10), why: this.loyalty > 0.6 ? 'These are my people.' : 'I\'m a member, though my heart isn\'t fully in it.' });
      }
      const ib = this.ideologyBias(group) * 35;
      if (Math.abs(ib) > 4) {
        const ax = group.dominantAxis();
        const axInfo = D.AXES.find(a => a.id === ax.axis);
        const gWord = ax.value > 0 ? axInfo.posWord : axInfo.negWord;
        reasons.push({ v: Math.round(ib), why: ib > 0 ? `Their whole "${gWord}" thing makes sense to me.` : `All that "${gWord}" talk gets on my nerves.` });
        score += ib;
      }
      const mine = this.group ? world.group(this.group) : null;
      if (mine && mine.id !== group.id) {
        const st = mine.stance(group.id);
        if (Math.abs(st) > 0.15) {
          const v = st * 30 * this.loyalty;
          score += v;
          reasons.push({ v: Math.round(v), why: st > 0 ? `${mine.name} count them as allies.` : `${mine.name} have a grudge against them, and I'm loyal.` });
        }
      }
      // Memories about their members or the group itself
      let memV = 0; const memWhy = [];
      for (const m of this.memories) {
        const involved = m.groups.includes(group.id) || m.who.some(id => { const c = world.citizen(id); return c && c.group === group.id && id !== this.id; });
        if (involved) { const v = m.tone * m.imp * 12; memV += v; if (Math.abs(v) > 3) memWhy.push({ v, why: m.text }); }
      }
      memV = clamp(memV, -40, 40); score += memV;
      memWhy.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
      for (const w of memWhy.slice(0, 3)) reasons.push({ v: Math.round(w.v), why: w.why });
      // Friends and enemies inside the group
      let fv = 0; let fCount = 0, eCount = 0;
      for (const m of group.members) {
        if (m === this.id) continue;
        const r = this.rel[m];
        if (!r) continue;
        if (r.aff > 35) { fv += 6; fCount++; } else if (r.aff < -25) { fv -= 6; eCount++; }
      }
      if (fCount) reasons.push({ v: 6 * fCount, why: `I've got ${fCount === 1 ? 'a friend' : fCount + ' friends'} in there.` });
      if (eCount) reasons.push({ v: -6 * eCount, why: `${eCount === 1 ? 'Someone' : eCount + ' people'} in there can't stand me, and it's mutual.` });
      score += fv;
      const gr = this.grievance.groups[group.id] || 0;
      if (gr > 2) { score -= gr * 3; reasons.push({ v: -Math.round(gr * 3), why: 'They have wronged me, and I keep count.' }); }
      // Popular reputation
      if (group.reputation !== 0) { const v = group.reputation * 10; score += v; if (Math.abs(v) > 3) reasons.push({ v: Math.round(v), why: v > 0 ? 'People say they do good work around town.' : 'People say they cause nothing but trouble.' }); }
      return { score: Math.round(clamp(score, -100, 100)), reasons: reasons.sort((a, b) => Math.abs(b.v) - Math.abs(a.v)) };
    }
    groupBias(gid) { return (this.grievance.groups[gid] || 0) * -8 + (this._gcache && this._gcache[gid] || 0); }

    // ---- Needs and mood upkeep, once per hour ----
    upkeep(world, hour) {
      const n = this.needs;
      n.rest = clamp(n.rest - (hour >= 0 && hour < 7 ? 0 : 0.045), 0, 1);
      n.social = clamp(n.social - 0.03 * (0.5 + this.traits.extra), 0, 1);
      n.fun = clamp(n.fun - 0.03, 0, 1);
      n.purpose = clamp(n.purpose - 0.02 * (0.5 + this.conviction), 0, 1);
      n.safety = clamp(n.safety + 0.02 - world.tension / 4000, 0, 1);
      // Cravings
      for (const v in this.addiction) n.fun = clamp(n.fun - 0.02 * this.addiction[v], 0, 1);
      if (this.hangover > 0) { this.hangover -= 1; this.mood -= 0.02; }
      // Mood drifts toward a baseline set by needs and temperament
      const baseline = (n.rest + n.social + n.fun + n.purpose + n.safety) / 5 * 1.2 - 0.6 - this.traits.neuro * 0.25 + (this.money < 20 ? -0.2 : 0) - this.stress * 0.3;
      this.mood = clamp(lerp(this.mood, baseline, 0.06), -1, 1);
      this.stress = clamp(this.stress - 0.01 - this.traits.agree * 0.005, 0, 1);
      // Grievances fade a little
      this.grievance.mayor *= 0.995;
      for (const g in this.grievance.groups) this.grievance.groups[g] *= 0.996;
      // Relationships slowly cool if not seen
      if (hour === 3) for (const id in this.rel) { const r = this.rel[id]; if (world.tick - r.last > 24 * 10) r.aff *= 0.985; }
      if (this.status !== 'normal' && world.tick >= this.statusUntil) {
        const was = this.status;
        this.status = 'normal';
        if (was === 'injured') world.log(1, `${this.name} is discharged from the Clinic with a bandage and a grudge.`, [this]);
        if (was === 'jailed') world.log(1, `${this.name} is released from the Quiet Room, having thought about what they did (they have not).`, [this]);
        if (was === 'hiding') world.log(1, `${this.name} emerges from hiding, blinking.`, [this]);
      }
    }

    // ---- Descriptions ----
    moodWord() {
      let w = 'fine';
      for (const [v, name] of D.MOODS) if (this.mood >= v) w = name;
      return w;
    }
    personalityText() {
      const t = this.traits;
      const bits = [];
      bits.push(`${word('extra', t.extra)} and ${word('agree', t.agree)}`);
      bits.push(`${word('open', t.open)}, ${word('temper', t.temper)}, ${word('humor', t.humor)}`);
      const extras = [];
      if (t.ambition > 0.7) extras.push(word('ambition', t.ambition));
      if (t.courage > 0.75 || t.courage < 0.25) extras.push(word('courage', t.courage));
      if (t.charisma > 0.7) extras.push(word('charisma', t.charisma));
      if (t.neuro > 0.75) extras.push(word('neuro', t.neuro));
      if (t.loyalty > 0.8 || t.loyalty < 0.25) extras.push(word('loyalty', t.loyalty));
      if (t.consc < 0.2) extras.push(word('consc', t.consc));
      if (extras.length) bits.push(extras.join(', '));
      return bits.join('; ') + '.';
    }
    creed() {
      const lines = [];
      const sorted = D.AXES.map(ax => ({ ax, v: this.beliefs[ax.id] })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
      for (const { ax, v } of sorted.slice(0, 3)) {
        const strength = Math.abs(v);
        if (strength < 0.15) continue;
        const w = v > 0 ? ax.posWord : ax.negWord;
        const pre = strength > 0.7 ? 'I would die on this hill:' : strength > 0.4 ? 'I firmly believe in' : 'I lean toward';
        lines.push(`${pre} ${w}.`);
      }
      if (!lines.length) lines.push('Honestly? I could be talked into almost anything.');
      const ints = this.topInterests(2).map(i => D.INTERESTS.find(x => x.id === i).name);
      lines.push(`Life is mostly about ${ints.join(' and ')}.`);
      if (this.conviction > 0.8) lines.push('And I am never, ever wrong.');
      else if (this.conviction < 0.25) lines.push("But don't quote me on any of it.");
      return lines;
    }
    habitsText() {
      const out = [];
      for (const k of this.topInterests(4)) {
        const it = D.INTERESTS.find(x => x.id === k);
        const lvl = this.interests[k];
        const adj = lvl > 0.8 ? 'obsessed with' : lvl > 0.5 ? 'really into' : 'fond of';
        let s = `${adj} ${it.name} ${it.icon}`;
        if (this.addiction[k]) s += this.addiction[k] > 0.7 ? ' (a genuine problem)' : this.addiction[k] > 0.4 ? ' (more than is wise)' : '';
        out.push(s);
      }
      return out;
    }
  }

  const DISTRICT_LEAN = {
    docks: { share: 0.4, pride: 0.5, roots: 0.3, order: -0.1 },
    steel: { share: 0.3, order: 0.3, roots: 0.3, pride: 0.3 },
    commons: { order: 0.2 },
    uptown: { share: -0.6, order: 0.4, roots: 0.2, faith: 0.1 },
    uni: { faith: -0.5, roots: -0.5, pride: -0.4, order: -0.3 },
    green: { faith: 0.3, order: -0.4, share: 0.3, roots: 0.1 },
    night: { order: -0.5, roots: -0.3, pride: -0.2 },
  };
  const DISTRICT_INTERESTS = {
    docks: ['booze', 'sports', 'gossip', 'conspiracy', 'food'],
    steel: ['gym', 'sports', 'booze', 'politics'],
    commons: ['politics', 'gossip', 'cats', 'food'],
    uptown: ['status', 'art', 'gambling', 'religion'],
    uni: ['philosophy', 'weed', 'art', 'politics', 'music'],
    green: ['weed', 'nature', 'religion', 'cats', 'philosophy'],
    night: ['music', 'booze', 'gambling', 'sports', 'food'],
  };
  function interestWeight(it, c, rng) {
    let w = 1 + rng.float() * 1.5;
    if ((DISTRICT_INTERESTS[c.district] || []).includes(it.id)) w += 1.5;
    if (c.age > 60 && ['religion', 'nature', 'cats', 'gossip'].includes(it.id)) w += 1;
    if (c.age < 30 && ['music', 'weed', 'sports', 'gym'].includes(it.id)) w += 1;
    if (it.id === 'status' && c.traits.ambition > 0.6) w += 1;
    if (it.id === 'politics' && c.conviction > 0.6) w += 1;
    return w;
  }
  function pickJob(rng, c) {
    if (c.age >= 66) return 'retired';
    const local = D.JOBS.filter(j => j.districts && j.districts.includes(c.district) && (j.id !== 'student' || c.age < 30));
    if (rng.chance(0.08)) return 'unemployed';
    if (c.district === 'uni' && c.age < 27 && rng.chance(0.6)) return 'student';
    return rng.pick(local.length ? local : D.JOBS.filter(j => j.districts)).id;
  }
  function salience(m, tick) { return m.imp * (1 + Math.abs(m.tone)) / (1 + (tick - m.t) / (24 * 20)); }

  Citizen.resetIds = (n) => { NEXT_ID = n; };
  Citizen.nextId = () => NEXT_ID;
  window.Citizen = Citizen;
})();
