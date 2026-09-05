// The mayor, policies, elections, demands, and the Pebbleton Gazette.
(function () {
  const D = window.DATA;

  function init(world) {
    const cands = world.citizens.filter(c => c.age > 30 && ['lawyer', 'clerk', 'financier', 'professor', 'foreman', 'priest'].includes(c.job));
    const pool = cands.length ? cands : world.citizens;
    const m = pool.reduce((a, b) => (b.traits.charisma + b.traits.ambition > a.traits.charisma + a.traits.ambition ? b : a));
    world.mayor = { id: m.id, since: 0, termEnds: 30 * 24, approval: 0 };
    world.policies = [];
    world.demands = [];
    m.goals.push({ type: 'reelect', text: 'Get re-elected as mayor' });
    world.log(2, `🏛️ ${m.name}, ${m.jobName}, is the incumbent mayor of Pebbleton. Nobody is quite sure how that happened.`, [m]);
    world.chronicle(`🏛️ ${m.name} begins as mayor.`);
  }
  function mayorObj(world) { return world.citizen(world.mayor.id); }

  function daily(world) {
    const rng = world.rng;
    const mayor = mayorObj(world);
    // Approval
    let sum = 0;
    for (const c of world.citizens) { c.mayorApproval = clamp(c.mayorApproval * 0.97 - c.grievance.mayor * 0.5 + (mayor === c ? 0 : c.opinionOf(mayor) / 10), -100, 100); sum += c.mayorApproval; }
    world.mayor.approval = sum / world.citizens.length;
    // Expire old policies
    world.policies = world.policies.filter(p => world.tick < p.until);
    // Decide something every ~6 days, sooner in a crisis
    const interval = world.phase === 'peace' ? 6 : world.phase === 'unrest' ? 4 : 2;
    if (world.day - (world.mayor.lastDecision || 0) >= interval && rng.chance(0.6)) decide(world, mayor);
    // Elections
    if (world.tick >= world.mayor.termEnds) election(world);
    else if (world.mayor.termEnds - world.tick === 24 * 5) campaign(world);
  }

  function policyScore(world, mayor, p) {
    let s = 0;
    for (const ax in p.stance) s += p.stance[ax] * mayor.beliefs[ax] * (0.5 + mayor.conviction);
    // Demands from groups
    for (const d of world.demands) if (d.policy === p.id) s += d.strength * 0.6 * (d.group === mayor.group ? 1.5 : 1);
    if (p.crisisOnly && world.phase !== 'crisis' && world.phase !== 'conflict') return 0;
    if (p.tension < 0) s += world.tension / 40 * (0.5 + mayor.traits.agree);
    if (p.tension > 5) s -= world.tension / 80 * mayor.traits.agree;
    if (p.id === 'patrols' || p.id === 'curfew') s += world.tension / 60 * mayor.beliefs.order;
    s += world.rng.range(0, 0.6);
    return Math.max(0.01, s + 0.5);
  }

  function decide(world, mayor) {
    const rng = world.rng;
    const active = new Set(world.policies.map(p => p.id));
    const options = D.POLICIES.filter(p => !active.has(p.id));
    const p = rng.pickWeighted(options, o => policyScore(world, mayor, o));
    if (!p) return;
    world.mayor.lastDecision = world.day;
    enact(world, mayor, p);
  }

  function enact(world, mayor, p, forced) {
    const rng = world.rng;
    world.policies.push({ id: p.id, since: world.tick, until: world.tick + 24 * rng.int(15, 30) });
    world.tension = clamp(world.tension + p.tension, 0, 100);
    const backers = world.demands.filter(d => d.policy === p.id).map(d => world.group(d.group)).filter(Boolean);
    world.demands = world.demands.filter(d => d.policy !== p.id);
    let text = `🏛️ Mayor ${mayor.shortName} decides to ${p.name}.`;
    if (backers.length) text += ` ${backers.map(g => g.name).join(' and ')} claim credit.`;
    const reacts = { love: [], hate: [] };
    for (const c of world.citizens) {
      let v = 0;
      for (const ax in p.stance) v += p.stance[ax] * c.beliefs[ax] * (0.5 + c.conviction) * 18;
      for (const k of p.likes) if (c.interests[k]) v += 12 * c.interests[k];
      for (const k of p.hates) if (c.interests[k]) v -= 16 * c.interests[k];
      if (c.group && backers.some(g => g.id === c.group)) v += 10;
      c.mayorApproval = clamp(c.mayorApproval + v, -100, 100);
      if (v < -12) { c.grievance.mayor += -v / 12; c.remember(world, `The mayor decided to ${p.name}. An outrage.`, -0.6, 0.6, [mayor]); reacts.hate.push(c); c.mood -= 0.15; }
      else if (v > 12) { c.remember(world, `The mayor decided to ${p.name}. Finally, some sense.`, 0.5, 0.4, [mayor]); reacts.love.push(c); c.mood += 0.1; }
      if (v < -20 && c.group) { const g = world.group(c.group); if (g) g.mayorAnger = (g.mayorAnger || 0) + 0.3; }
    }
    if (reacts.hate.length > world.citizens.length * 0.3) text += ` Roughly a third of the city is furious.`;
    else if (reacts.hate.length > 5) text += ` ${rng.pick(reacts.hate).shortName} and ${reacts.hate.length - 1} others are livid.`;
    if (reacts.love.length > reacts.hate.length * 2) text += ` It is, surprisingly, popular.`;
    world.log(3, text, [mayor], backers);
    world.chronicle(`🏛️ Mayor ${mayor.shortName}: ${p.name}.`);
    // Groups aligned against it get angry at the mayor and at the backers
    for (const g of world.groups) {
      if (g.dissolved) continue;
      const ms = g.memberObjs(world);
      const anger = ms.reduce((a, m) => a + (reacts.hate.includes(m) ? 1 : reacts.love.includes(m) ? -1 : 0), 0) / Math.max(1, ms.length);
      if (anger > 0.4) {
        g.mayorAnger = (g.mayorAnger || 0) + anger;
        for (const b of backers) if (b !== g) { g.nudgeStance(b.id, -0.15 * anger, `they pushed the mayor to ${p.name}`, world); for (const m of ms) m.grievance.groups[b.id] = (m.grievance.groups[b.id] || 0) + 0.4; }
      } else if (anger < -0.4) g.mayorAnger = Math.max(0, (g.mayorAnger || 0) - 0.5);
    }
  }

  function policyActive(world, id) { return world.policies.some(p => p.id === id); }

  // A group demands something of the mayor.
  function pressure(world, g, cause) {
    const rng = world.rng;
    const leader = g.leaderObj(world);
    if (!leader) return;
    // Pick the policy that best fits the group's ideology
    const active = new Set(world.policies.map(p => p.id));
    const best = rng.pickWeighted(D.POLICIES.filter(p => !active.has(p.id) && !p.crisisOnly), p => {
      let s = 0.05;
      for (const ax in p.stance) s += Math.max(0, p.stance[ax] * g.ideology[ax]);
      if (p.likes.includes(g.focus)) s += 0.8;
      if (p.hates.includes(g.focus)) s = 0.01;
      return s;
    });
    if (!best) return;
    const existing = world.demands.find(d => d.group === g.id);
    const strength = g.influence / 10 + g.militancy;
    if (existing) { existing.strength += 0.3; existing.policy = best.id; }
    else world.demands.push({ group: g.id, policy: best.id, strength, t: world.tick, cause });
    world.log(2, `📜 ${leader.name}, speaking for ${g.name}, demands the mayor ${best.name}${cause ? ` (over ${cause})` : ''}.`, [leader], [g]);
    world.tension += 1;
    // The mayor sometimes refuses outright
    const mayor = mayorObj(world);
    let fit = 0; for (const ax in best.stance) fit += best.stance[ax] * mayor.beliefs[ax];
    if (fit < -0.4 && rng.chance(0.6)) {
      world.log(2, `🏛️ Mayor ${mayor.shortName} rejects ${g.name}'s demand, calling it "${rng.pick(['unserious', 'a bit much', 'something to think about', 'not a priority', 'frankly ridiculous'])}".`, [mayor], [g]);
      g.mayorAnger = (g.mayorAnger || 0) + 0.8;
      for (const m of g.memberObjs(world)) { m.grievance.mayor += 0.6; m.remember(world, `The mayor laughed off our demand that they ${best.name}.`, -0.5, 0.5, [mayor]); }
      world.demands = world.demands.filter(d => d.group !== g.id);
      world.tension += 2;
    }
  }

  function candidates(world) {
    const incumbent = mayorObj(world);
    const set = new Map();
    set.set(incumbent.id, incumbent);
    const gs = world.groups.filter(g => !g.dissolved).sort((a, b) => b.influence - a.influence).slice(0, 3);
    for (const g of gs) { const l = g.leaderObj(world); if (l && l.active && l.traits.ambition > 0.35) set.set(l.id, l); }
    const indie = world.citizens.filter(c => !c.group && c.active && c.traits.ambition > 0.6).sort((a, b) => b.traits.charisma - a.traits.charisma)[0];
    if (indie) set.set(indie.id, indie);
    return [...set.values()];
  }
  function campaign(world) {
    const cs = candidates(world);
    world.election = { candidates: cs.map(c => c.id) };
    const lines = cs.map(c => `${c.name}${c.group ? ` (${world.group(c.group).name})` : ' (independent)'}`);
    world.log(3, `🗳️ Election season! Candidates for mayor: ${lines.join('; ')}. Pamphlets everywhere.`, cs);
    for (const c of cs) { c.needs.purpose = 1; if (!c.goals.some(g => g.type === 'reelect' || g.type === 'mayor')) c.goals.push({ type: 'mayor', text: 'Win the mayoral election' }); }
  }
  function election(world) {
    const rng = world.rng;
    const cs = (world.election ? world.election.candidates.map(id => world.citizen(id)) : candidates(world)).filter(c => c && c.status !== 'gone');
    const incumbent = mayorObj(world);
    const votes = new Map(cs.map(c => [c.id, 0]));
    for (const v of world.citizens) {
      if (!v.active && v.status !== 'hiding') continue;
      let best = null, bs = -Infinity;
      for (const c of cs) {
        let s = v.opinionOf(c) / 60 + (1 - v.beliefDistance(c)) * (0.5 + v.conviction) + rng.range(-0.4, 0.4);
        if (c === incumbent) s += v.mayorApproval / 80;
        if (v.group && c.group) { const g = world.group(v.group); if (c.group === v.group) s += 0.8 * v.loyalty; else s += g.stance(c.group) * 0.6; }
        if (c === v) s += 5;
        if (s > bs) { bs = s; best = c; }
      }
      votes.set(best.id, votes.get(best.id) + 1);
    }
    const ranked = cs.slice().sort((a, b) => votes.get(b.id) - votes.get(a.id));
    const winner = ranked[0];
    const total = [...votes.values()].reduce((a, b) => a + b, 0);
    const tally = ranked.map(c => `${c.shortName} ${votes.get(c.id)}`).join(', ');
    world.mayor = { id: winner.id, since: world.tick, termEnds: world.tick + 30 * 24, approval: 0, lastDecision: world.day };
    world.election = null;
    world.policies = world.policies.filter(p => rng.chance(0.4)); // a new broom sweeps some things
    const margin = ranked.length > 1 ? (votes.get(ranked[0].id) - votes.get(ranked[1].id)) / total : 1;
    if (winner === incumbent) world.log(3, `🗳️ Election result: Mayor ${winner.name} is re-elected (${tally}). ${margin < 0.1 ? 'It was close enough that everyone is suspicious.' : 'The pigeons are indifferent.'}`, ranked);
    else world.log(3, `🗳️ Election result: ${winner.name} is the new mayor of Pebbleton, unseating ${incumbent.shortName} (${tally}).${winner.group ? ` ${world.group(winner.group).name} are triumphant.` : ''}`, ranked, winner.group ? [world.group(winner.group)] : []);
    world.chronicle(`🗳️ ${winner.name} elected mayor (${tally}).`);
    winner.remember(world, 'I was elected mayor of Pebbleton. The people have spoken, and they chose me.', 0.9, 1);
    winner.goals = winner.goals.filter(g => g.type !== 'mayor'); winner.goals.push({ type: 'reelect', text: 'Get re-elected as mayor' });
    for (const c of ranked.slice(1)) {
      c.remember(world, `I lost the election to ${winner.shortName}. ${margin < 0.1 ? 'Something about it smells.' : 'The voters are fools.'}`, -0.6, 0.8, [winner]);
      c.adjustRel(winner, -15, -0.1, world.tick);
      c.goals = c.goals.filter(g => g.type !== 'mayor' && g.type !== 'reelect');
      if (c.group && winner.group && c.group !== winner.group) { const g = world.group(c.group); g.nudgeStance(winner.group, -0.2, 'the election', world); }
    }
    if (margin < 0.1 && ranked.length > 1) {
      const r = world.inventRumour(ranked[1], null, { text: `the election was rigged by ${winner.group ? world.group(winner.group).name : winner.shortName}`, tone: -1, about: winner.group ? { group: winner.group } : { citizen: winner.id } });
      world.tension += 8;
      if (r) world.log(2, `👂 A rumour spreads that ${r.text}.`, [ranked[1]]);
    } else world.tension = Math.max(0, world.tension - 5);
  }

  // The Gazette prints something. Journalists amplify whatever they believe.
  function publish(world, j) {
    const rng = world.rng;
    const believed = world.rumours.filter(r => j.believes.has(r.id) && !r.published && !r.dead);
    if (believed.length && rng.chance(0.7)) {
      const r = rng.pick(believed);
      r.published = true;
      const truth = rng.chance(0.35);
      if (truth && rng.chance(0.5)) {
        r.dead = true;
        world.log(2, `📰 GAZETTE FACT CHECK: claims that ${r.text} are "completely made up", writes ${j.shortName}. Believers are disappointed.`, [j]);
        for (const c of world.citizens) if (c.believes.has(r.id)) { c.believes.delete(r.id); if (r.about.citizen) c.adjustRel(world.citizen(r.about.citizen) || c, -r.tone * 4, 0, world.tick); }
        return;
      }
      world.log(2, `📰 GAZETTE: "${capitalise(r.text)}", reports ${j.shortName}. The whole city reads it over breakfast.`, [j]);
      for (const c of world.citizens) if (c !== j && !c.believes.has(r.id) && rng.chance(0.35 + (c.traits.open < 0.4 ? 0.15 : 0))) { c.believes.add(r.id); r.spread++; world.applyRumour(c, r); }
      j.reputation += 0.2;
      return;
    }
    // Otherwise a mood piece
    const gs = world.groups.filter(g => !g.dissolved);
    if (gs.length && rng.chance(0.5)) {
      const g = rng.pick(gs);
      const angle = g.reputation < -0.2 || g.militancy > 0.5 ? 'neg' : 'pos';
      const heads = angle === 'neg' ? [`WHO ARE ${g.name.toUpperCase()} AND WHY ARE THEY SO ANGRY?`, `${g.name.toUpperCase()}: MENACE OR MERELY LOUD?`, `INSIDE ${g.name.toUpperCase()}'S SECRET MEETINGS (THEY HAVE BISCUITS)`] : [`${g.name.toUpperCase()}: THE FRIENDLY FACE OF ${D.DISTRICTS.find(d => d.id === g.district).name.toUpperCase()}`, `LOCAL GROUP ${g.name.toUpperCase()} "JUST WANTS TO BE HEARD"`];
      world.log(1, `📰 GAZETTE: "${rng.pick(heads)}" by ${j.shortName}.`, [j], [g]);
      g.reputation = clamp(g.reputation + (angle === 'neg' ? -0.15 : 0.1), -1, 1);
      if (angle === 'neg') { for (const m of g.memberObjs(world)) m.adjustRel(j, -6, -0.05, world.tick); const l = g.leaderObj(world); if (l) l.remember(world, `The Gazette ran a hit piece on us by ${j.shortName}.`, -0.5, 0.5, [j]); }
    } else {
      const mayor = mayorObj(world);
      const app = world.mayor.approval;
      world.log(1, `📰 GAZETTE: "${app < -10 ? `MAYOR ${mayor.last.toUpperCase()} APPROVAL HITS NEW LOW; PIGEONS ALSO UNHAPPY` : app > 10 ? `MAYOR ${mayor.last.toUpperCase()} RIDING HIGH, SAYS MAYOR ${mayor.last.toUpperCase()}` : `CITY "FINE, PROBABLY", SAYS EVERYONE`}" by ${j.shortName}.`, [j, mayor]);
    }
  }
  function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  window.Politics = { init, daily, pressure, publish, policyActive, mayorObj, enact, capitalise };
})();
