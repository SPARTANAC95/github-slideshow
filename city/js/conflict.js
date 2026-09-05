// Tension, group decisions, protests, clashes, blocs, negotiation and peace.
(function () {
  const D = window.DATA;
  const TOPIC_WORDS = { weed: 'Herb', booze: 'Last Orders', gambling: 'Betting Slip', sports: 'Matchday', religion: 'Bell', philosophy: 'Footnote', status: 'Hedge', gym: 'Dumbbell', art: 'Sculpture', nature: 'Courgette', food: 'Noodle', music: 'Bass', gossip: 'Whisper', conspiracy: 'Goose', cats: 'Cat', politics: 'Petition', order: 'Curfew', 'order-': 'Bin', faith: 'Bell', 'faith-': 'Bell', share: 'Tax', 'share-': 'Villa', roots: 'Statue', 'roots-': 'Bus Route', pride: 'Ferry', 'pride-': 'Ferry' };

  function baseline(world) {
    let hostility = 0, pairs = 0;
    const gs = world.groups.filter(g => !g.dissolved);
    for (const a of gs) for (const b of gs) if (a.id < b.id) { const s = Math.min(a.stance(b.id), b.stance(a.id)); if (s < -0.3) { hostility += (-s) * (a.size + b.size) * (0.5 + (a.militancy + b.militancy) / 2); pairs++; } }
    let griev = 0;
    for (const c of world.citizens) griev += c.grievance.mayor + Object.values(c.grievance.groups).reduce((x, y) => x + y, 0);
    griev /= Math.max(1, world.citizens.length);
    const policyT = world.policies.reduce((a, p) => a + (D.POLICIES.find(x => x.id === p.id).tension || 0), 0);
    const weary = world.ceasefire > 0 ? 0.55 : 1;
    return clamp((hostility * 1.1 + griev * 5 + Math.max(0, policyT) * 0.6) * weary - Math.max(0, world.mayor.approval) / 6, 0, 100);
  }

  function hourly(world) {
    const rng = world.rng;
    world.tension = clamp(lerp(world.tension, baseline(world), 0.02), 0, 100);
    // Planned group events fire at their hour
    for (const g of world.groups) {
      if (g.dissolved || !g.plan || g.plan.day !== world.day || g.plan.hour !== world.hour) continue;
      const plan = g.plan; g.plan = null;
      EVENTS[plan.type](world, g, plan);
    }
    if (world.phase === 'conflict') conflictHour(world);
  }

  function daily(world) {
    const rng = world.rng;
    updatePhase(world);
    const gs = world.groups.filter(g => !g.dissolved);
    for (const g of rng.shuffle(gs)) decideGroupAction(world, g);
    if (world.phase === 'conflict') conflictDay(world);
    if (world.ceasefire > 0) world.ceasefire--;
  }

  function updatePhase(world) {
    const T = world.tension;
    const old = world.phase;
    const gs = world.groups.filter(g => !g.dissolved);
    let hostilePair = null, worst = 0;
    for (const a of gs) for (const b of gs) if (a.id < b.id) { const s = Math.min(a.stance(b.id), b.stance(a.id)); const m = Math.max(a.militancy, b.militancy); if (s < -0.6 && m > 0.4 && (-s) * m > worst) { worst = (-s) * m; hostilePair = [a, b]; } }
    let phase = old;
    if (old === 'conflict') { /* ends only through peace events */ }
    else if (T >= 74 && hostilePair && world.ceasefire <= 0) phase = 'conflict';
    else if (T >= 55) phase = 'crisis';
    else if (T >= 30) phase = 'unrest';
    else if (T < 25) phase = 'peace';
    if (phase !== old) {
      world.phase = phase;
      if (phase === 'unrest') world.log(3, `😬 The mood in Pebbleton has soured. People are arguing in queues. The Gazette uses the word "unrest".`);
      if (phase === 'crisis') world.log(3, `🚨 Crisis. Groups are meeting behind closed doors, and the Noodle Stand has started closing early.`);
      if (phase === 'peace' && old !== 'peace') world.log(3, `🌤️ Things have calmed down. Pebbleton returns to its usual gentle bickering.`);
      if (phase === 'conflict') declareConflict(world, hostilePair);
      world.chronicle(`Phase: ${phase}.`);
    }
  }

  function declareConflict(world, pair) {
    const rng = world.rng;
    const [a, b] = pair;
    const gs = world.groups.filter(g => !g.dissolved);
    const blocA = [a], blocB = [b];
    for (const g of gs) {
      if (g === a || g === b) continue;
      const sa = g.stance(a.id) + (g.allies.includes(a.id) ? 0.5 : 0), sb = g.stance(b.id) + (g.allies.includes(b.id) ? 0.5 : 0);
      if (sa > 0.2 && sb < 0 && g.militancy > 0.2) blocA.push(g);
      else if (sb > 0.2 && sa < 0 && g.militancy > 0.2) blocB.push(g);
    }
    for (const g of blocA) { g.bloc = 'A'; for (const o of blocB) { g.nudgeStance(o.id, -0.3, 'the conflict', world); } }
    for (const g of blocB) { g.bloc = 'B'; for (const o of blocA) { g.nudgeStance(o.id, -0.3, 'the conflict', world); } }
    const topic = TOPIC_WORDS[a.focus] || TOPIC_WORDS[b.focus] || 'Pigeon';
    const name = `The ${rng.pick(['Great', 'Little', 'Regrettable', 'Damp', 'Second', 'Unpleasant'])} ${topic} ${rng.pick(['War', 'Troubles', 'Unpleasantness', 'Kerfuffle', 'Dispute'])}`;
    world.conflict = { name, blocA: blocA.map(g => g.id), blocB: blocB.map(g => g.id), started: world.tick, clashes: 0, control: {}, talks: 0 };
    const nameA = blocName(world, 'A'), nameB = blocName(world, 'B');
    world.log(3, `⚔️ It has come to this: ${name} begins. ${nameA} against ${nameB}. The rest of the city hides its good crockery.`, [a.leaderObj(world), b.leaderObj(world)].filter(Boolean), blocA.concat(blocB));
    world.chronicle(`⚔️ ${name} begins: ${nameA} vs ${nameB}.`);
    for (const g of blocA.concat(blocB)) for (const m of g.memberObjs(world)) { m.remember(world, `${name} began. We're ${g.bloc === 'A' ? nameA : nameB}. I believe in this. Mostly.`, -0.3, 0.9, [], [g.id]); m.needs.safety = 0.4; }
    world.tension = Math.max(world.tension, 85);
    for (const c of world.citizens) c.stress = clamp(c.stress + 0.15, 0, 1);
    world.demands = [];
    world.pushHeadline(`⚔️ ${name}: ${nameA} vs ${nameB}`);
  }
  function blocName(world, bloc) {
    const gs = world.groups.filter(g => g.bloc === bloc && !g.dissolved).sort((a, b) => b.size - a.size);
    if (!gs.length) return 'nobody';
    if (gs.length === 1) return gs[0].name;
    return `${gs[0].name} and ${gs.length - 1} ${gs.length === 2 ? 'ally' : 'allies'}`;
  }
  function blocMembers(world, bloc) { return world.groups.filter(g => g.bloc === bloc && !g.dissolved).flatMap(g => g.memberObjs(world)); }

  // ---- Group decision-making, once per day ----
  function decideGroupAction(world, g) {
    const rng = world.rng;
    const leader = g.leaderObj(world);
    if (!leader || !leader.active) return;
    const enemies = g.enemies(world);
    const worst = enemies.sort((a, b) => g.stance(a.id) - g.stance(b.id))[0];
    const anger = g.mayorAnger || 0;
    const opts = [];
    const push = (id, w) => { if (w > 0) opts.push({ id, w }); };
    const T = world.tension;
    push('meeting', 1.5 + (g.cohesion < 0.5 ? 2 : 0));
    push('party', 1 + (g.morale < 0.5 ? 1.5 : 0) + leader.traits.extra);
    push('recruit', 1.2 + leader.traits.ambition * 2 - g.size / 8);
    push('charity', leader.traits.agree * 1.5 + (g.reputation < 0 ? 1.5 : 0));
    push('protest', (anger > 1 ? 1.5 + anger : 0) + (worst && g.stance(worst.id) < -0.5 ? 1 + g.militancy * 2 : 0) + (T > 40 ? 0.5 : 0));
    push('demand', (anger > 0.5 ? 1 + anger * 0.5 : 0.3) * (1 + leader.traits.ambition));
    push('denounce', worst ? 0.8 + leader.traits.temper * 1.5 + g.militancy : 0);
    const allyCand = world.groups.find(o => o !== g && !o.dissolved && !g.allies.includes(o.id) && g.stance(o.id) > 0.3 && o.stance(g.id) > 0.2);
    push('ally', allyCand ? 1.2 + (enemies.length ? 1 : 0) : 0);
    push('militia', T > 50 && g.militancy > 0.45 && !g.militia ? 1.5 + g.militancy : 0);
    push('raid', world.phase === 'conflict' && g.bloc ? g.militancy * 3 * g.morale : 0);
    push('truce', world.phase === 'conflict' && g.bloc ? g.warWeariness * 3 + leader.traits.agree * 2 + (g.morale < 0.4 ? 2 : 0) : 0);
    push('nothing', 1.5);
    const choice = rng.pickWeighted(opts, o => o.w).id;
    g.lastAction = choice;
    if (choice === 'nothing') return;
    if (choice === 'meeting') g.plan = { type: 'meeting', day: world.day, hour: rng.int(18, 20) };
    if (choice === 'party') g.plan = { type: 'party', day: world.day, hour: rng.int(19, 22) };
    if (choice === 'recruit') { g.recruiting = true; if (rng.chance(0.3)) world.log(0, `${g.name} are on a recruitment drive. There are flyers.`, [], [g]); }
    if (choice === 'charity') g.plan = { type: 'charity', day: world.day, hour: rng.int(10, 15) };
    if (choice === 'protest') g.plan = { type: 'protest', day: world.day, hour: rng.int(12, 16), target: worst && (g.stance(worst.id) < -0.5 && (anger < 1 || rng.chance(0.5))) ? { group: worst.id } : { mayor: true } };
    if (choice === 'demand') g.plan = { type: 'demand', day: world.day, hour: rng.int(9, 17) };
    if (choice === 'denounce') g.plan = { type: 'denounce', day: world.day, hour: rng.int(8, 21), target: worst.id };
    if (choice === 'ally') g.plan = { type: 'ally', day: world.day, hour: rng.int(10, 20), target: allyCand.id };
    if (choice === 'truce') g.plan = { type: 'truce', day: world.day, hour: rng.int(9, 22) };
    if (choice === 'militia') { g.militia = true; g.militancy = clamp(g.militancy + 0.15, 0, 1); world.log(2, `🪖 ${g.name} form a "${rng.pick(['Neighbourhood Safety Committee', 'Community Defence League', 'Vigilance Group', 'Emergency Snack Guard'])}". They have armbands. The armbands are ${rng.pick(['orange', 'lilac', 'beige', 'a bit small'])}.`, [leader], [g]); world.tension += 5; for (const o of world.groups) if (o !== g && !o.dissolved && o.stance(g.id) < 0) o.nudgeStance(g.id, -0.15, 'their militia', world); }
    if (choice === 'raid') g.plan = { type: 'raid', day: world.day, hour: rng.int(13, 22) };
  }

  function denounce(world, g, target) {
    const rng = world.rng;
    const leader = g.leaderObj(world);
    const r = world.inventRumour(leader, null, { group: target.id });
    const line = rng.pick([`"${target.name} are a danger to this city."`, `"We will not be lectured by ${target.name}."`, `"${target.name} know what they did."`, `"Everything wrong with ${D.DISTRICTS.find(d => d.id === target.district).name} starts with ${target.name}."`]);
    world.log(2, `📣 ${leader.name} of ${g.name} publicly denounces ${target.name}: ${line}${r ? ` Also, apparently, ${r.text}.` : ''}`, [leader], [g, target]);
    target.nudgeStance(g.id, -0.15, 'being denounced', world);
    g.nudgeStance(target.id, -0.05, 'denouncing them', world);
    target.reputation -= 0.08;
    for (const m of target.memberObjs(world)) { m.grievance.groups[g.id] = (m.grievance.groups[g.id] || 0) + 0.5; m.adjustRel(leader, -6, -0.05, world.tick); }
    const tl = target.leaderObj(world);
    if (tl) tl.remember(world, `${leader.shortName} called us a danger to the city in front of everyone.`, -0.6, 0.6, [leader], [g.id]);
    world.tension += 2;
  }
  function propose(world, g, o) {
    const rng = world.rng;
    const la = g.leaderObj(world), lb = o.leaderObj(world);
    if (!la || !lb) return;
    if (rng.chance(0.5 + o.stance(g.id) * 0.4 + la.traits.charisma * 0.2)) {
      g.allies.push(o.id); o.allies.push(g.id);
      g.nudgeStance(o.id, 0.3, 'alliance', world); o.nudgeStance(g.id, 0.3, 'alliance', world);
      la.adjustRel(lb, 15, 0.15, world.tick); lb.adjustRel(la, 15, 0.15, world.tick);
      world.log(3, `🤝 ${g.name} and ${o.name} announce an alliance. ${la.shortName} and ${lb.shortName} shake hands for slightly too long.`, [la, lb], [g, o]);
      world.chronicle(`🤝 ${g.name} allied with ${o.name}.`);
      // Enemies of either take note
      for (const e of world.groups) if (!e.dissolved && e !== g && e !== o && (e.stance(g.id) < -0.4 || e.stance(o.id) < -0.4)) { e.nudgeStance(g.id, -0.1, 'their alliance', world); e.nudgeStance(o.id, -0.1, 'their alliance', world); }
    } else {
      world.log(1, `${la.name} proposes an alliance to ${lb.name} of ${o.name}. ${lb.shortName} says they'll "circle back".`, [la, lb], [g, o]);
      g.nudgeStance(o.id, -0.05, 'being snubbed', world);
    }
  }

  // ---- Planned events ----
  const EVENTS = {
    demand(world, g) { world.pressure(g, null); },
    denounce(world, g, plan) { const t = world.group(plan.target); if (t && !t.dissolved) denounce(world, g, t); },
    ally(world, g, plan) { const t = world.group(plan.target); if (t && !t.dissolved && !g.allies.includes(t.id)) propose(world, g, t); },
    truce(world, g) { seekTruce(world, g); },
    meeting(world, g) {
      const rng = world.rng;
      const ms = g.memberObjs(world).filter(m => m.active);
      for (const m of ms) { m.loc = g.hq; m.dest = g.hq; }
      const leader = g.leaderObj(world);
      const present = ms.length;
      g.cohesion = clamp(g.cohesion + 0.08, 0, 1);
      for (const m of ms) { m.loyalty = clamp(m.loyalty + 0.04, 0, 1); m.needs.purpose = clamp(m.needs.purpose + 0.3, 0, 1); m.needs.social = clamp(m.needs.social + 0.3, 0, 1); m.conviction = clamp(m.conviction + 0.01, 0, 1); for (const o of ms) if (o !== m) m.adjustRel(o, 1.5, 0.02, world.tick); }
      const enemy = g.enemies(world)[0];
      const topic = enemy ? `what to do about ${enemy.name}` : (g.mayorAnger > 1 ? 'the mayor' : rng.pick(['the banner', 'subs', 'whose turn it is to bring biscuits', 'the Constitution (draft 4)', 'the noise from next door']));
      const dissenter = ms.filter(m => m !== leader && m.beliefDistanceTo(g.ideology) > 0.5)[0];
      let text = `${g.icon} ${g.name} hold a meeting at ${world.locName(g.hq)} (${present} present). ${leader ? leader.shortName + ' speaks at length about ' + topic + '.' : ''}`;
      if (dissenter && rng.chance(0.5)) { text += ` ${dissenter.shortName} disagrees with everything and is asked to "take it outside".`; dissenter.loyalty -= 0.1; dissenter.adjustRel(leader, -5, -0.03, world.tick); }
      if (enemy && rng.chance(0.4 + g.militancy * 0.4)) { g.nudgeStance(enemy.id, -0.08, 'the meeting', world); text += ` Resolutions are passed. Strongly worded ones.`; }
      world.log(rng.chance(0.4) ? 1 : 0, text, ms.slice(0, 3), [g]);
    },
    party(world, g) {
      const rng = world.rng;
      const ms = g.memberObjs(world).filter(m => m.active);
      for (const m of ms) { m.loc = g.hq; m.dest = g.hq; m.needs.fun = 1; m.needs.social = 1; m.mood = clamp(m.mood + 0.2, -1, 1); for (const o of ms) if (o !== m) m.adjustRel(o, 3, 0.03, world.tick); if (m.interests.booze) { m.drunk = 2; m.stats.drinks += 2; } }
      g.morale = clamp(g.morale + 0.15, 0, 1);
      // Outsiders may wander in
      const guests = world.at(g.hq).filter(c => !g.has(c.id));
      for (const guest of guests) if (rng.chance(0.5)) { const host = rng.pick(ms); if (host) { host.adjustRel(guest, 5, 0.03, world.tick); guest.adjustRel(host, 6, 0.03, world.tick); } }
      world.log(1, `🎉 ${g.name} throw a party at ${world.locName(g.hq)}. ${rng.pick(['The playlist is contested.', 'Someone brings a courgette.', 'A speech is made and forgotten.', 'The neighbours are invited, to be safe.', 'There is a conga.'])}${guests.length ? ` ${guests.length} outsiders wander in and are fed.` : ''}`, ms.slice(0, 3), [g]);
    },
    charity(world, g) {
      const rng = world.rng;
      const ms = g.memberObjs(world).filter(m => m.active);
      const act = rng.pick(['hand out free noodles in Pigeon Plaza', 'repaint the Clinic', 'clean the Long Pier', 'run a cat-adoption fair', 'fix the sentient pothole', 'host a free lecture that is mostly fine']);
      g.reputation = clamp(g.reputation + 0.2, -1, 1);
      for (const m of ms) { m.reputation += 0.05; m.needs.purpose = 1; }
      const poor = world.citizens.filter(c => c.money < 20 && !g.has(c.id));
      for (const c of poor) { c.money += 10; const m = rng.pick(ms); if (m) c.adjustRel(m, 5, 0.05, world.tick); if (c.group && c.group !== g.id) { const og = world.group(c.group); og.nudgeStance(g.id, 0.05, 'their charity', world); } }
      world.log(1, `💐 ${g.name} ${act}. Even their critics grudgingly approve.`, ms.slice(0, 2), [g]);
      world.tension = Math.max(0, world.tension - 2);
    },
    protest(world, g, plan) {
      const rng = world.rng;
      if (world.weather === 'rain' && rng.chance(0.6)) { world.log(1, `☔ ${g.name}'s protest is rained off. Everyone goes for soup instead.`, [], [g]); return; }
      const ms = g.memberObjs(world).filter(m => m.active);
      const leader = g.leaderObj(world);
      for (const m of ms) { m.loc = 'plaza'; m.dest = 'plaza'; m.needs.purpose = 1; }
      g.stats.protests++;
      const target = plan.target.group ? world.group(plan.target.group) : null;
      const mayor = window.Politics.mayorObj(world);
      // Sympathisers join
      const joiners = world.citizens.filter(c => c.active && !g.has(c.id) && (target ? (c.grievance.groups[target.id] || 0) > 1 : c.grievance.mayor > 1) && c.ideologyBias(g) > -0.1 && rng.chance(0.4));
      for (const j of joiners) { j.loc = 'plaza'; j.dest = 'plaza'; j.adjustRel(leader, 4, 0.03, world.tick); }
      const size = ms.length + joiners.length;
      const slogan = target ? rng.pick([`"${target.name.toUpperCase()} OUT"`, `"NO MORE ${TOPIC_WORDS[target.focus] ? TOPIC_WORDS[target.focus].toUpperCase() : 'THIS'}"`, `"WE'VE HAD IT WITH ${target.name.toUpperCase()}"`]) : rng.pick([`"${mayor.last.toUpperCase()} MUST GO"`, `"HANDS OFF OUR ${TOPIC_WORDS[g.focus] ? TOPIC_WORDS[g.focus].toUpperCase() : 'THINGS'}"`, `"WHAT DO WE WANT? ${TOPIC_WORDS[g.focus] ? TOPIC_WORDS[g.focus].toUpperCase() + 'S' : 'CHANGE'}!"`]);
      let text = `📢 ${g.name} march on Pigeon Plaza, ${size} strong, chanting ${slogan}.${joiners.length ? ` ${joiners.length} sympathisers join in.` : ''}`;
      world.tension += 3 + size * 0.3;
      g.reputation = clamp(g.reputation + 0.05, -1, 1);
      if (target) {
        target.nudgeStance(g.id, -0.25, 'a protest against them', world);
        for (const m of target.memberObjs(world)) m.grievance.groups[g.id] = (m.grievance.groups[g.id] || 0) + 0.8;
        // Counter-protest
        if (target.militancy > 0.3 && rng.chance(0.35 + target.militancy * 0.4)) {
          const tms = target.memberObjs(world).filter(m => m.active && m.traits.courage > 0.35);
          for (const m of tms) { m.loc = 'plaza'; m.dest = 'plaza'; }
          text += ` ${target.name} turn up to counter-protest with ${tms.length} people and a much louder megaphone.`;
          world.log(3, text, [leader], [g, target]);
          if (rng.chance(0.3 + (g.militancy + target.militancy) * 0.35 + world.tension / 300)) clash(world, g, target, 'plaza', 'the protest');
          else { world.log(2, `The two crowds shout at each other across the fountain for two hours. ${rng.pick(['A pigeon is caught in the middle.', 'The noodle stand does record business.', 'Someone\'s nan tells everyone to go home, and eventually they do.', 'It ends when both megaphones run out of battery.'])}`, [], [g, target]); g.nudgeStance(target.id, -0.1, 'the standoff', world); target.nudgeStance(g.id, -0.1, 'the standoff', world); }
          return;
        }
      } else {
        g.mayorAnger = Math.max(0, (g.mayorAnger || 0) - 0.5);
        world.pressure(g, 'the protest');
        mayor.remember(world, `${g.name} marched on the plaza calling for my head. Charming.`, -0.5, 0.6, [leader], [g.id]);
        if (world.policyActive('patrols') || mayor.beliefs.order > 0.5) {
          const officers = world.citizens.filter(c => c.job === 'officer' && c.active);
          if (officers.length && rng.chance(0.5)) {
            const victim = rng.pick(ms);
            victim.status = 'jailed'; victim.statusUntil = world.tick + 24 * 2; victim.loc = 'townhall';
            text += ` Peace Officers break it up and arrest ${victim.shortName} for "aggravated chanting".`;
            for (const m of ms) { m.grievance.mayor += 1; m.remember(world, `They arrested ${victim.shortName} at our protest. The mayor has shown their true face.`, -0.7, 0.8, [victim, mayor]); }
            world.tension += 6;
            g.militancy = clamp(g.militancy + 0.1, 0, 1);
          }
        }
      }
      world.log(3, text, [leader], target ? [g, target] : [g]);
      for (const m of ms) m.remember(world, `We marched on the Plaza chanting ${slogan}. I've never felt so alive.`, 0.4, 0.6, [], [g.id]);
    },
    raid(world, g) {
      const rng = world.rng;
      const enemy = world.groups.filter(o => !o.dissolved && o.bloc && o.bloc !== g.bloc).sort((a, b) => g.stance(a.id) - g.stance(b.id))[0];
      if (!enemy) return;
      const attackers = g.memberObjs(world).filter(m => m.active && m.traits.courage > 0.3);
      if (attackers.length < 2) return;
      for (const m of attackers) { m.loc = enemy.hq; m.dest = enemy.hq; }
      clash(world, g, enemy, enemy.hq, `${g.name}'s raid on ${world.locName(enemy.hq)}`);
    },
  };

  // ---- Clashes ----
  function clash(world, g1, g2, locId, cause) {
    const rng = world.rng;
    const here = world.at(locId);
    const side1 = here.filter(c => c.group === g1.id || (g1.bloc && world.group(c.group)?.bloc === g1.bloc));
    const side2 = here.filter(c => c.group === g2.id || (g2.bloc && world.group(c.group)?.bloc === g2.bloc));
    if (!side1.length || !side2.length) return;
    const str = side => side.reduce((a, c) => a + c.traits.courage + (c.interests.gym || 0) * 0.5 + rng.float() * 0.5, 0) * (side === side1 ? g1.morale : g2.morale);
    const s1 = str(side1), s2 = str(side2);
    const winner = s1 >= s2 ? g1 : g2, loser = winner === g1 ? g2 : g1;
    const winSide = winner === g1 ? side1 : side2, loseSide = winner === g1 ? side2 : side1;
    g1.stats.clashes++; g2.stats.clashes++;
    if (world.conflict) world.conflict.clashes++;
    const silly = rng.chance(0.25);
    let text = `⚔️ Clash at ${world.locName(locId)} over ${cause}: ${side1.length} from ${g1.name} vs ${side2.length} from ${g2.name}. `;
    if (silly) {
      text += rng.pick(['It stops almost immediately when the noodle stand opens. ', 'Both sides pause to let a funeral procession pass, then can\'t remember who was winning. ', 'It is briefly interrupted by a very calm cat. ', 'Someone\'s mum arrives and everyone pretends to be shaking hands. ', 'It rains, and the fight is postponed by mutual agreement. ']);
      g1.nudgeStance(g2.id, -0.05, 'the scuffle', world); g2.nudgeStance(g1.id, -0.05, 'the scuffle', world);
      world.tension += 2;
      world.log(2, text, side1.slice(0, 2).concat(side2.slice(0, 2)), [g1, g2]);
      return;
    }
    const wl = winner.leaderObj(world);
    const merciful = (wl ? wl.traits.agree : 0.5) > 0.55 && rng.chance(0.6);
    const casualties = [];
    for (const c of loseSide) {
      if (merciful) { if (rng.chance(0.3)) { c.status = 'hiding'; c.statusUntil = world.tick + 24; } c.remember(world, `${winner.name} had us beaten at ${world.locName(locId)} and let us walk away. I don't know what to do with that.`, 0.1, 0.8, [], [winner.id]); c.grievance.groups[winner.id] = Math.max(0, (c.grievance.groups[winner.id] || 0) - 0.5); }
      else if (rng.chance(0.45)) { c.status = 'injured'; c.statusUntil = world.tick + 24 * rng.int(1, 3); c.loc = 'clinic'; c.dest = 'clinic'; casualties.push(c); c.remember(world, `${winner.name} put me in the Clinic at ${world.locName(locId)}. I will remember every face.`, -0.9, 1, [], [winner.id]); c.grievance.groups[winner.id] = (c.grievance.groups[winner.id] || 0) + 2; }
      else { c.status = 'hiding'; c.statusUntil = world.tick + 24 * rng.int(1, 2); c.remember(world, `We were chased off from ${world.locName(locId)} by ${winner.name}. Humiliating.`, -0.6, 0.8, [], [winner.id]); c.grievance.groups[winner.id] = (c.grievance.groups[winner.id] || 0) + 1; }
      c.stats.fights++;
    }
    for (const c of winSide) { c.stats.fights++; c.remember(world, `We won at ${world.locName(locId)} against ${loser.name}. ${merciful ? 'We let them go.' : 'They ran.'}`, 0.3, 0.7, [], [loser.id]); if (rng.chance(0.15)) { c.status = 'injured'; c.statusUntil = world.tick + 24; c.loc = 'clinic'; c.dest = 'clinic'; casualties.push(c); } }
    text += `${winner.name} come out on top. `;
    if (merciful) text += `${wl ? wl.shortName : 'Their leader'} calls a halt and lets ${loser.name} leave with their dignity, mostly. `;
    else text += `${casualties.length} people end up at the Clinic, ${rng.pick(['none seriously', 'mostly for bruised egos', 'one with a sprained thumb from pointing', 'one because they fainted at the sight of their own scraped knee'])}. `;
    winner.morale = clamp(winner.morale + 0.1, 0, 1); loser.morale = clamp(loser.morale - 0.2, 0.05, 1);
    winner.warWeariness += 0.1; loser.warWeariness += 0.2;
    winner.reputation -= merciful ? 0 : 0.1; loser.reputation -= 0.05;
    if (merciful) { loser.nudgeStance(winner.id, 0.15, 'their mercy', world); winner.reputation += 0.1; }
    g1.nudgeStance(g2.id, -0.3, 'the clash', world); g2.nudgeStance(g1.id, -0.3, 'the clash', world);
    world.tension += 8;
    // Bystanders are shaken
    for (const c of here) if (!side1.includes(c) && !side2.includes(c)) { c.needs.safety = clamp(c.needs.safety - 0.3, 0, 1); c.remember(world, `Saw ${g1.name} and ${g2.name} brawling at ${world.locName(locId)}. This city.`, -0.4, 0.5, [], [g1.id, g2.id]); c.grievance.groups[winner.id] = (c.grievance.groups[winner.id] || 0) + 0.3; }
    world.log(3, text, side1.slice(0, 2).concat(side2.slice(0, 2)), [g1, g2]);
    world.chronicle(`⚔️ Clash at ${world.locName(locId)}: ${winner.name} beat ${loser.name}.`);
    if (world.phase !== 'conflict') { for (const p of world.citizens) if (p.job === 'officer') { p.needs.purpose = 1; } }
  }

  // ---- Conflict phase ----
  function conflictHour(world) {
    const rng = world.rng;
    const cf = world.conflict;
    if (!cf) return;
    // Skirmishes wherever both blocs meet
    if (rng.chance(0.12)) {
      const gA = world.groups.filter(g => g.bloc === 'A' && !g.dissolved), gB = world.groups.filter(g => g.bloc === 'B' && !g.dissolved);
      if (!gA.length || !gB.length) return endByCollapse(world);
      for (const locId of rng.shuffle(Object.keys(world.locIndex))) {
        const here = world.at(locId);
        const a = here.filter(c => c.group && world.group(c.group)?.bloc === 'A'), b = here.filter(c => c.group && world.group(c.group)?.bloc === 'B');
        if (a.length >= 2 && b.length >= 2 && rng.chance(0.5)) { clash(world, world.group(a[0].group), world.group(b[0].group), locId, rng.pick(['a dirty look', 'territory', 'a spilled drink', 'the last table', 'who started it last time', 'a flag'])); break; }
      }
    }
    // Frightened citizens hide, brave ones seek out their side
    if (world.hour === 8 && rng.chance(0.3)) {
      const c = rng.pick(world.citizens.filter(c => c.active && c.traits.courage < 0.3 && c.needs.safety < 0.5));
      if (c) { c.status = 'hiding'; c.statusUntil = world.tick + 24 * rng.int(1, 3); world.log(1, `${c.name} decides to "work from home" until this all blows over. The blinds are drawn.`, [c]); }
    }
  }
  function conflictDay(world) {
    const rng = world.rng;
    const cf = world.conflict;
    if (!cf) return;
    // District control
    for (const d of D.DISTRICTS) {
      const res = world.citizens.filter(c => c.district === d.id && c.status !== 'gone' && c.group);
      let a = 0, b = 0;
      for (const c of res) { const g = world.group(c.group); if (g?.bloc === 'A') a++; else if (g?.bloc === 'B') b++; }
      const owner = a > b + 1 ? 'A' : b > a + 1 ? 'B' : null;
      if (owner && cf.control[d.id] !== owner) { cf.control[d.id] = owner; world.log(2, `🏴 ${blocName(world, owner)} now hold ${d.name}. ${rng.pick(['They have put up a flag. It is a bedsheet.', 'A checkpoint is established. It is a deckchair.', 'They rename the bus stop.', 'Residents are asked to show "loyalty". Most show snacks.'])}`, [], world.groups.filter(g => g.bloc === owner)); }
      else if (!owner && cf.control[d.id]) { delete cf.control[d.id]; }
    }
    // Economy suffers, everyone gets wearier
    for (const c of world.citizens) { c.money -= 2; c.needs.safety = clamp(c.needs.safety - 0.05, 0, 1); }
    for (const g of world.groups) if (g.bloc) g.warWeariness += 0.06 + (1 - g.morale) * 0.05;
    const gA = world.groups.filter(g => g.bloc === 'A' && !g.dissolved), gB = world.groups.filter(g => g.bloc === 'B' && !g.dissolved);
    if (!gA.length || !gB.length) return endByCollapse(world);
    const moraleA = gA.reduce((s, g) => s + g.morale, 0) / gA.length, moraleB = gB.reduce((s, g) => s + g.morale, 0) / gB.length;
    const wearyA = gA.reduce((s, g) => s + g.warWeariness, 0) / gA.length, wearyB = gB.reduce((s, g) => s + g.warWeariness, 0) / gB.length;
    const daysIn = (world.tick - cf.started) / 24;
    if (daysIn < 2) return;
    if (moraleA < 0.2 && moraleA < moraleB - 0.15) return surrender(world, 'A', 'B');
    if (moraleB < 0.2 && moraleB < moraleA - 0.15) return surrender(world, 'B', 'A');
    if (wearyA > 0.9 && wearyB > 0.9 && rng.chance(0.4)) return exhaustion(world);
    // Mediators emerge
    if (rng.chance(0.15 + (wearyA + wearyB) * 0.15)) {
      const mediator = world.citizens.filter(c => c.active && (!c.group || !world.group(c.group)?.bloc) && c.traits.agree > 0.6 && c.traits.charisma > 0.5).sort((a, b) => b.traits.charisma + b.reputation - a.traits.charisma - a.reputation)[0];
      if (mediator) { const la = gA.sort((x, y) => y.size - x.size)[0], lb = gB.sort((x, y) => y.size - x.size)[0]; negotiate(world, la, lb, la.leaderObj(world), lb.leaderObj(world), mediator); }
    }
    // Mayor may attempt amnesty
    const mayor = window.Politics.mayorObj(world);
    if (mayor && !world.policyActive('amnesty') && rng.chance(0.1 + mayor.traits.agree * 0.2)) window.Politics.enact(world, mayor, D.POLICIES.find(p => p.id === 'amnesty'));
  }
  function seekTruce(world, g) {
    const enemy = world.groups.filter(o => !o.dissolved && o.bloc && o.bloc !== g.bloc).sort((a, b) => b.size - a.size)[0];
    if (!enemy) return;
    negotiate(world, g, enemy, g.leaderObj(world), enemy.leaderObj(world), null);
  }
  function negotiate(world, ga, gb, la, lb, mediator) {
    const rng = world.rng;
    if (!la || !lb) return;
    const inConflict = world.phase === 'conflict' && ga.bloc && gb.bloc && ga.bloc !== gb.bloc;
    if (world.conflict) world.conflict.talks++;
    const venue = mediator ? world.locName(mediator.loc) : rng.pick(['the back room of the Salty Herring', 'a neutral noodle stand', 'the Library (quietly)', 'the Long Pier', 'the Temple steps']);
    const weary = inConflict ? (ga.warWeariness + gb.warWeariness) / 2 : 0.3;
    const daysIn = inConflict ? (world.tick - world.conflict.started) / 24 : 99;
    let p = 0.15 + weary * 0.4 + (la.traits.agree + lb.traits.agree) * 0.15 + (mediator ? mediator.traits.charisma * 0.3 + mediator.reputation * 0.05 : 0) - (la.traits.temper + lb.traits.temper) * 0.15 + (world.policyActive('amnesty') ? 0.15 : 0) + Math.min(0, ga.stance(gb.id) + gb.stance(ga.id)) * 0.1;
    if (la.opinionOf(lb) > 0) p += 0.1;
    if (inConflict) p *= clamp(daysIn / 4, 0.05, 1);
    const who = mediator ? `${mediator.name} brings ${la.shortName} (${ga.name}) and ${lb.shortName} (${gb.name}) together at ${venue}` : `${la.name} of ${ga.name} and ${lb.name} of ${gb.name} meet at ${venue}`;
    const joke = rng.chance(0.3);
    if (rng.chance(clamp(p, 0.05, 0.9))) {
      const terms = rng.pick(['a shared custody arrangement for Pigeon Plaza', 'an exchange of apologies, both read from cards', 'a joint noodle night every second Thursday', 'a promise to "stop doing the thing", details to follow', 'the return of the mascot costume, no questions asked', 'a new rule that all future disputes go to penalties']);
      world.log(3, `🕊️ ${who}. After ${rng.pick(['four hours', 'a long night', 'two pots of tea', 'one enormous row'])} they agree to ${terms}.${joke ? ` ${la.shortName} and ${lb.shortName} discover they went to the same school and are both furious about it.` : ''}`, [la, lb, mediator].filter(Boolean), [ga, gb]);
      la.adjustRel(lb, 20, 0.2, world.tick); lb.adjustRel(la, 20, 0.2, world.tick);
      if (mediator) { mediator.reputation += 0.4; la.adjustRel(mediator, 15, 0.2, world.tick); lb.adjustRel(mediator, 15, 0.2, world.tick); mediator.remember(world, `I brokered peace between ${ga.name} and ${gb.name}. Somebody had to.`, 0.9, 1, [la, lb], [ga.id, gb.id]); mediator.stats.helped++; }
      la.remember(world, `${lb.shortName} and I made peace at ${venue}. Turns out they're a person.`, 0.6, 0.9, [lb], [gb.id]);
      lb.remember(world, `Signed a truce with ${la.shortName}. My lot grumbled, but it was time.`, 0.6, 0.9, [la], [ga.id]);
      if (inConflict) endConflict(world, `a truce brokered${mediator ? ' by ' + mediator.name : ''} at ${venue}`, null);
      else { ga.stances[gb.id] = Math.max(ga.stance(gb.id), -0.1); gb.stances[ga.id] = Math.max(gb.stance(ga.id), -0.1); ga.stanceEvents[gb.id] = []; gb.stanceEvents[ga.id] = []; ga.nudgeStance(gb.id, 0.3, 'the truce', world); gb.nudgeStance(ga.id, 0.3, 'the truce', world); for (const m of ga.memberObjs(world)) m.grievance.groups[gb.id] = (m.grievance.groups[gb.id] || 0) * 0.3; for (const m of gb.memberObjs(world)) m.grievance.groups[ga.id] = (m.grievance.groups[ga.id] || 0) * 0.3; world.tension = Math.max(0, world.tension - 12); world.chronicle(`🕊️ Truce between ${ga.name} and ${gb.name}.`); }
    } else {
      const fail = rng.pick(['the talks collapse over seating arrangements', 'someone mentions the thing nobody was supposed to mention', `${lb.shortName} storms out after ${la.shortName} calls the terms "cute"`, 'both sides agree in principle and then disagree about what "principle" means', 'a pigeon lands on the treaty and it is taken as an omen', `${la.shortName} laughs at the wrong moment`]);
      world.log(2, `${who}, but ${fail}.`, [la, lb, mediator].filter(Boolean), [ga, gb]);
      la.adjustRel(lb, -5, -0.05, world.tick); lb.adjustRel(la, -5, -0.05, world.tick);
      if (mediator) mediator.stress += 0.1;
    }
  }
  function surrender(world, loserBloc, winnerBloc) {
    const rng = world.rng;
    const losers = world.groups.filter(g => g.bloc === loserBloc && !g.dissolved), winners = world.groups.filter(g => g.bloc === winnerBloc && !g.dissolved);
    const wl = winners.sort((a, b) => b.size - a.size)[0].leaderObj(world);
    const ll = losers.sort((a, b) => b.size - a.size)[0].leaderObj(world);
    const merciful = wl ? wl.traits.agree > 0.45 || rng.chance(0.3) : true;
    const how = rng.pick(['a white flag (a pillowcase)', 'a strongly worded surrender note', 'a bouquet and a wince', 'a song, badly sung']);
    let text = `🏳️ ${blocName(world, loserBloc)} surrender with ${how}. `;
    if (merciful) {
      text += `${wl ? wl.name : 'The winners'} accept graciously: no reprisals, shared noodles, and a promise to never speak of the pillowcase.`;
      for (const g of losers) { g.nudgeStance(winners[0].id, 0.3, 'their mercy', world); for (const m of g.memberObjs(world)) { m.remember(world, `We lost ${world.conflict.name}, and ${winners[0].name} were decent about it. I didn't expect that.`, 0.1, 0.9, [], [winners[0].id]); m.grievance.groups[winners[0].id] = 0; } }
      for (const g of winners) g.reputation = clamp(g.reputation + 0.2, -1, 1);
    } else {
      text += `${wl ? wl.name : 'The winners'} are not gracious: ${rng.pick(['the losers must wear the beige armbands for a month', `${losers[0].name}'s banner is confiscated and used as a tablecloth`, 'the losers must publicly admit the referee was right'])}. Grudges are filed for later.`;
      for (const g of losers) { for (const m of g.memberObjs(world)) { m.remember(world, `We surrendered and ${winners[0].name} humiliated us. This is not over. It is merely paused.`, -0.7, 1, [], [winners[0].id]); m.grievance.groups[winners[0].id] = (m.grievance.groups[winners[0].id] || 0) + 1.5; } g.reputation += 0.1; }
      for (const g of winners) g.reputation = clamp(g.reputation - 0.15, -1, 1);
      if (ll && rng.chance(0.5)) { losers[0].chooseLeader(world, `${ll.shortName} resigned in disgrace`); }
    }
    world.log(3, text, [wl, ll].filter(Boolean), losers.concat(winners));
    endConflict(world, `the surrender of ${blocName(world, loserBloc)}`, winnerBloc);
  }
  function exhaustion(world) {
    world.log(3, `🤷 The Great Shrug: both sides of ${world.conflict.name} are too tired to continue. Nobody surrenders. Everybody just goes home and has a bath.`, [], world.groups.filter(g => g.bloc));
    endConflict(world, 'mutual exhaustion', null);
  }
  function endByCollapse(world) {
    world.log(3, `${world.conflict.name} peters out because one side has simply stopped existing.`, []);
    endConflict(world, 'the collapse of one side', null);
  }
  function endConflict(world, how, winnerBloc) {
    const rng = world.rng;
    const cf = world.conflict;
    const days = Math.round((world.tick - cf.started) / 24);
    world.log(3, `🕊️ ${cf.name} is over after ${days} day${days === 1 ? '' : 's'}, ${cf.clashes} clash${cf.clashes === 1 ? '' : 'es'} and ${cf.talks} round${cf.talks === 1 ? '' : 's'} of talks, ending in ${how}. There is a peace festival. The Temple bell is rung until someone asks it to stop.`, []);
    world.chronicle(`🕊️ ${cf.name} ended after ${days} days: ${how}.`);
    world.history.push({ name: cf.name, started: cf.started, ended: world.tick, how, clashes: cf.clashes, winner: winnerBloc ? blocName(world, winnerBloc) : null, sides: [blocName(world, 'A'), blocName(world, 'B')] });
    for (const g of world.groups) {
      if (!g.bloc) continue;
      for (const o of world.groups) if (o.bloc && o.bloc !== g.bloc) { g.stances[o.id] = Math.max(g.stance(o.id), -0.2); g.stanceEvents[o.id] = []; g.nudgeStance(o.id, 0.7, 'the peace treaty', world); for (const m of g.memberObjs(world)) m.grievance.groups[o.id] = (m.grievance.groups[o.id] || 0) * 0.25; }
      g.bloc = null; g.militia = false; g.warWeariness = 0; g.morale = 0.6; g.militancy *= 0.5;
    }
    for (const c of world.citizens) { c.needs.safety = 1; c.stress = clamp(c.stress - 0.3, 0, 1); c.mood = clamp(c.mood + 0.3, -1, 1); for (const k in c.grievance.groups) c.grievance.groups[k] *= 0.5; c.grievance.mayor *= 0.5; if (c.status === 'hiding') c.status = 'normal'; }
    world.conflict = null; world.phase = 'peace'; world.tension = 15; world.ceasefire = 20;
    world.pushHeadline(`🕊️ Peace: ${cf.name} ends after ${days} days`);
    // Festival: bonds across the old lines
    const all = world.citizens.filter(c => c.active);
    for (let i = 0; i < 40; i++) { const a = rng.pick(all), b = rng.pick(all); if (a !== b) { a.adjustRel(b, 6, 0.05, world.tick); b.adjustRel(a, 6, 0.05, world.tick); } }
  }

  window.Conflict = { hourly, daily, clash, negotiate, blocName, baseline };
})();
