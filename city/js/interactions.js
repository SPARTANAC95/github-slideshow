// Pairwise interactions between citizens. This is where friendships, grudges,
// conversions, rumours and brawls come from.
(function () {
  const D = window.DATA;

  function groupsOf(world, a, b) {
    const ga = a.group ? world.group(a.group) : null;
    const gb = b.group ? world.group(b.group) : null;
    const same = ga && gb && ga === gb;
    const rivals = ga && gb && !same && (ga.stance(gb.id) < -0.35 || gb.stance(ga.id) < -0.35);
    const atWar = ga && gb && !same && (ga.stance(gb.id) < -0.7 || gb.stance(ga.id) < -0.7);
    return { ga, gb, same, rivals, atWar };
  }
  function drunk(c) { return c.drunk || 0; }

  function interact(world, a, b) {
    const rng = world.rng;
    const t = world.tick;
    const ra = a.relWith(b.id), rb = b.relWith(a.id);
    const compat = a.compatibility(b);
    const bd = a.beliefDistance(b);
    const ctx = groupsOf(world, a, b);
    const loc = world.loc(a.loc);
    const shared = a.sharedInterests(b);
    const hereInterest = shared.find(k => D.INTERESTS.find(i => i.id === k).locs.includes(a.loc));
    const irritation = Math.max(0, -a.mood) * 0.6 + a.traits.temper * 0.5 + a.stress * 0.4 + drunk(a) * 0.3 + Math.max(0, -ra.aff) / 100;
    const opts = [];
    const push = (id, w) => { if (w > 0) opts.push({ id, w }); };
    push('chat', 2.5);
    push('bond', hereInterest ? 2 + shared.length : shared.length * 0.5);
    push('joke', a.traits.humor * 1.8 * (0.5 + a.mood + 0.5));
    push('gossip', (a.interests.gossip ? 2 : 0.6) * (a.traits.extra + 0.3) * (world.rumours.length ? 1 : 0.4));
    push('debate', (bd > 0.35 && bd < 1.1 ? 1.4 : 0.3) * (a.traits.open + 0.3) * (a.conviction + 0.4));
    push('argue', (bd * 1.2 + irritation * 1.5 + (ctx.rivals ? 1.2 : 0) + (ra.aff < -20 ? 1 : 0)) * (1 - a.traits.agree * 0.6));
    push('insult', (ra.aff < -25 || ctx.atWar ? 1 : 0) * (a.traits.temper + irritation) * 1.2 + (a.goals.some(g => g.type === 'revenge' && g.target === b.id) ? 2.5 : 0));
    push('recruit', ctx.ga && !ctx.gb && compat > 0.05 && (ctx.ga.recruiting || a.traits.ambition > 0.5 || a.loyalty > 0.7) ? 1.6 : 0);
    push('preach', a.conviction > 0.7 && (a.interests.religion || a.interests.philosophy || a.interests.politics || a.interests.conspiracy) ? 1.1 : 0);
    push('help', (b.mood < -0.45 || b.money < 15 || b.stress > 0.7) && a.traits.agree > 0.45 && ra.aff > -40 ? 2.2 : 0);
    push('flirt', !a.partner && !b.partner && Math.abs(a.age - b.age) < 16 && ra.aff > 15 && compat > 0 ? 0.9 + a.traits.extra * 0.5 : 0);
    push('forgive', ra.aff < -25 && a.traits.agree > 0.55 && a.mood > 0.1 && rng.chance(0.5) ? 1.2 : 0);
    push('betray', ctx.ga && ctx.gb && !ctx.same && a.loyalty < 0.3 && a.traits.loyalty < 0.35 && (a.traits.ambition > 0.5 || ra.aff > 30) ? 0.5 : 0);
    push('negotiate', ctx.ga && ctx.gb && ctx.rivals && ctx.ga.leader === a.id && ctx.gb.leader === b.id ? 3 : 0);
    const choice = rng.pickWeighted(opts, o => o.w).id;
    ACTIONS[choice](world, a, b, { ra, rb, compat, bd, ctx, loc, shared, hereInterest, irritation, t });
  }

  const ACTIONS = {
    chat(world, a, b, s) {
      const rng = world.rng;
      const topic = rng.pick(D.CHAT_TOPICS);
      const d = s.compat * 4 + rng.range(-2, 3) + (a.mood + b.mood) * 1.5;
      a.adjustRel(b, d, 0.02, s.t); b.adjustRel(a, d, 0.02, s.t);
      a.needs.social = clamp(a.needs.social + 0.25, 0, 1); b.needs.social = clamp(b.needs.social + 0.25, 0, 1);
      if (rng.chance(0.06)) world.log(0, `${a.shortName} and ${b.shortName} chat about ${topic} at ${s.loc.name}.`, [a, b]);
      if (s.ra.kind === 'stranger' && a.relWith(b.id).kind !== 'stranger' && rng.chance(0.3)) world.log(0, `${a.shortName} meets ${b.shortName} over ${topic}. ${d > 0 ? 'They hit it off.' : 'It is awkward.'}`, [a, b]);
      a.act(`chatted with ${b.shortName} about ${topic}`);
      if (a.relWith(b.id).kind === 'friend' && s.ra.kind === 'acquaintance') { world.log(1, `${a.name} and ${b.name} are now proper friends, bonded over ${topic}.`, [a, b]); a.remember(world, `${b.shortName} and I became friends, mostly by talking about ${topic}.`, 0.5, 0.5, [b]); b.remember(world, `${a.shortName} is good company. We became friends.`, 0.5, 0.5, [a]); }
    },
    bond(world, a, b, s) {
      const rng = world.rng;
      const k = s.hereInterest || rng.pick(s.shared);
      const it = D.INTERESTS.find(i => i.id === k);
      const d = 5 + rng.range(0, 5) + (a.interests[k] + b.interests[k]) * 3;
      a.adjustRel(b, d, 0.05, s.t); b.adjustRel(a, d, 0.05, s.t);
      for (const c of [a, b]) { c.needs.fun = clamp(c.needs.fun + 0.35, 0, 1); c.needs.social = clamp(c.needs.social + 0.3, 0, 1); c.mood = clamp(c.mood + 0.1, -1, 1); }
      if (k === 'weed') { a.stats.joints++; b.stats.joints++; a.hangover = 2; }
      if (k === 'booze') { a.stats.drinks++; b.stats.drinks++; a.drunk = (a.drunk || 0) + 1; b.drunk = (b.drunk || 0) + 1; a.money -= 4; b.money -= 4; }
      if (k === 'gambling') { for (const c of [a, b]) { const win = rng.chance(0.4); c.money += win ? 25 : -20; if (!win) c.stats.betsLost++; } }
      const lvl = rng.chance(0.12) ? 1 : 0;
      world.log(lvl, `${a.shortName} and ${b.shortName} ${it.verb} at ${s.loc.name}. ${bondFlavour(rng, k)}`, [a, b]);
      a.act(`${it.verb} with ${b.shortName}`); b.act(`${it.verb} with ${a.shortName}`);
      if (rng.chance(0.25)) { a.remember(world, `${b.shortName} and I ${it.verb.replace(/^(get|put|share|argue|pray|debate|compare|spot|critique|rank|dance|swap|connect|show|draft)/, m => ({ get: 'got', put: 'put', share: 'shared', argue: 'argued', pray: 'prayed', debate: 'debated', compare: 'compared', spot: 'spotted', critique: 'critiqued', rank: 'ranked', dance: 'danced', swap: 'swapped', connect: 'connected', show: 'showed', draft: 'drafted' }[m]))} at ${s.loc.name}. Good times.`, 0.4, 0.35, [b]); }
      // Bonding across group lines softens stances
      if (s.ctx.rivals && rng.chance(0.5)) { s.ctx.ga.nudgeStance(s.ctx.gb.id, 0.05, `${a.shortName} and ${b.shortName} got on`, world); s.ctx.gb.nudgeStance(s.ctx.ga.id, 0.05, 'a friendly evening', world); }
    },
    joke(world, a, b, s) {
      const rng = world.rng;
      const joke = rng.pick(D.JOKES);
      const lands = rng.chance(0.35 + a.traits.humor * 0.5 + b.traits.humor * 0.15 - (s.ra.aff < -30 ? 0.2 : 0));
      a.stats.jokes++;
      if (lands) {
        const d = 4 + a.traits.humor * 6;
        a.adjustRel(b, d * 0.6, 0.02, s.t); b.adjustRel(a, d, 0.04, s.t);
        b.mood = clamp(b.mood + 0.15, -1, 1); a.reputation += 0.05;
        if (rng.chance(0.1)) world.log(0, `${a.shortName} tells ${b.shortName} ${joke}. ${b.shortName} laughs so hard they have to sit down.`, [a, b]);
        if (s.ctx.rivals && rng.chance(0.4)) { world.log(1, `${a.name} (${s.ctx.ga.name}) makes ${b.name} (${s.ctx.gb.name}) laugh with ${joke}. Laughter is briefly bipartisan.`, [a, b], [s.ctx.ga, s.ctx.gb]); s.ctx.gb.nudgeStance(s.ctx.ga.id, 0.06, 'a good joke', world); b.remember(world, `${a.shortName} from ${s.ctx.ga.name} is actually funny. Annoying.`, 0.4, 0.4, [a], [s.ctx.ga.id]); }
      } else {
        b.adjustRel(a, -2, 0, s.t);
        if (rng.chance(0.08)) world.log(0, `${a.shortName} tries ${joke} on ${b.shortName}. Silence. A pigeon coughs.`, [a, b]);
      }
      a.act(`told ${b.shortName} ${joke}`);
    },
    gossip(world, a, b, s) {
      const rng = world.rng;
      // Either pass on a rumour or invent one
      let rumour = world.rumours.filter(r => a.believes.has(r.id) && !b.believes.has(r.id) && r.about.citizen !== b.id && r.about.citizen !== a.id)[0];
      if (!rumour && rng.chance(0.15 + (a.interests.gossip || 0) * 0.3 + (1 - a.traits.agree) * 0.2)) rumour = world.inventRumour(a, b);
      if (!rumour) return ACTIONS.chat(world, a, b, s);
      const believeP = 0.3 + s.ra.trust * 0.5 + (b.traits.open < 0.4 ? 0.1 : 0) + rumourBias(world, b, rumour);
      a.act(`told ${b.shortName} that ${rumour.text}`);
      if (rng.chance(believeP)) {
        b.believes.add(rumour.id); rumour.spread++;
        b.remember(world, `${a.shortName} told me ${rumour.text}.`, rumour.tone * 0.5, 0.45, [a].concat(rumour.about.citizen ? [rumour.about.citizen] : []), rumour.about.group ? [rumour.about.group] : []);
        world.applyRumour(b, rumour);
        if (rumour.spread === 3 || rumour.spread === 8 || rng.chance(0.1)) world.log(1, `👂 Word is getting around: ${rumour.text}. (${b.shortName} heard it from ${a.shortName}.)`, [a, b]);
      } else {
        if (rng.chance(0.15)) world.log(0, `${b.shortName} refuses to believe ${a.shortName}'s claim that ${rumour.text}.`, [a, b]);
        b.adjustRel(a, -1, -0.02, s.t);
      }
      a.needs.social = clamp(a.needs.social + 0.2, 0, 1); a.needs.fun = clamp(a.needs.fun + 0.1, 0, 1);
    },
    debate(world, a, b, s) {
      const rng = world.rng;
      // Find the axis they most disagree on
      let ax = null, dv = 0;
      for (const x of D.AXES) { const d = Math.abs(a.beliefs[x.id] - b.beliefs[x.id]); if (d > dv) { dv = d; ax = x; } }
      const pa = a.traits.charisma * (0.5 + a.conviction) * (1 + a.reputation * 0.1);
      const pb = b.traits.charisma * (0.5 + b.conviction) * (1 + b.reputation * 0.1);
      const openB = b.traits.open * (1 - b.conviction * 0.7);
      const openA = a.traits.open * (1 - a.conviction * 0.7);
      const shiftB = clamp(pa * openB * 0.18 + rng.range(-0.02, 0.04), 0, 0.25);
      const shiftA = clamp(pb * openA * 0.18 + rng.range(-0.02, 0.04), 0, 0.25);
      b.beliefs[ax.id] = clamp(lerp(b.beliefs[ax.id], a.beliefs[ax.id], shiftB), -1, 1);
      a.beliefs[ax.id] = clamp(lerp(a.beliefs[ax.id], b.beliefs[ax.id], shiftA), -1, 1);
      const civil = rng.chance(0.55 + (a.traits.agree + b.traits.agree) * 0.2 - s.irritation * 0.3);
      const topic = a.beliefs[ax.id] > b.beliefs[ax.id] ? ax.posWord : ax.negWord;
      if (civil) {
        a.adjustRel(b, 2 + shiftB * 20, 0.03, s.t); b.adjustRel(a, 2 + shiftA * 20, 0.03, s.t);
        for (const c of [a, b]) c.needs.purpose = clamp(c.needs.purpose + 0.2, 0, 1);
        if (shiftB > 0.12) { world.log(1, `🧠 ${a.name} talks ${b.name} some way round to ${topic} over a long conversation at ${s.loc.name}.`, [a, b]); b.remember(world, `${a.shortName} made a good point about ${topic}. I've been thinking about it.`, 0.2, 0.5, [a]); a.stats.converts++; }
        else if (rng.chance(0.08)) world.log(0, `${a.shortName} and ${b.shortName} debate ${ax.pos} vs ${ax.neg} at ${s.loc.name}. Nobody wins, but they enjoy it.`, [a, b]);
      } else {
        return ACTIONS.argue(world, a, b, Object.assign({}, s, { forcedTopic: `${ax.pos.toLowerCase()} versus ${ax.neg.toLowerCase()}` }));
      }
      a.act(`debated ${topic} with ${b.shortName}`);
    },
    argue(world, a, b, s) {
      const rng = world.rng;
      const topic = s.forcedTopic || rng.pick(D.ARGUMENT_STARTERS);
      a.stats.arguments++; b.stats.arguments++;
      const heat = s.irritation + b.traits.temper * 0.5 + Math.max(0, -b.mood) * 0.4 + drunk(b) * 0.3 + (s.ctx.rivals ? 0.4 : 0) + (s.ctx.atWar ? 0.5 : 0);
      // Someone nearby might defuse it with a joke, or mediate
      const bystanders = world.at(a.loc).filter(c => c !== a && c !== b);
      const comedian = bystanders.find(c => c.traits.humor > 0.75 && rng.chance(0.5));
      const mediator = bystanders.find(c => c.traits.agree > 0.7 && c.traits.charisma > 0.5 && rng.chance(0.6));
      const d = -(4 + heat * 6);
      a.adjustRel(b, d, -0.03, s.t); b.adjustRel(a, d, -0.03, s.t);
      a.stress += 0.05; b.stress += 0.05;
      if (s.ctx.rivals || (s.ctx.ga && s.ctx.gb && !s.ctx.same)) {
        a.grievance.groups[s.ctx.gb.id] = (a.grievance.groups[s.ctx.gb.id] || 0) + 0.3;
        b.grievance.groups[s.ctx.ga.id] = (b.grievance.groups[s.ctx.ga.id] || 0) + 0.3;
      }
      if (comedian && heat < 1.6) {
        world.log(s.ctx.ga && s.ctx.gb && !s.ctx.same ? 1 : 0, `${a.shortName} and ${b.shortName} start arguing about ${topic} at ${s.loc.name}, but ${comedian.shortName} interrupts with ${rng.pick(D.JOKES)} and everyone forgets what the fight was about.`, [a, b, comedian]);
        a.adjustRel(comedian, 4, 0.02, s.t); b.adjustRel(comedian, 4, 0.02, s.t); comedian.reputation += 0.1; comedian.stats.jokes++;
        return;
      }
      if (mediator && heat < 2) {
        world.log(1, `${mediator.shortName} steps between ${a.shortName} and ${b.shortName} mid-argument about ${topic} and talks them down. Peace, for now.`, [a, b, mediator]);
        a.adjustRel(mediator, 3, 0.05, s.t); b.adjustRel(mediator, 3, 0.05, s.t); mediator.reputation += 0.1;
        a.adjustRel(b, 2, 0, s.t); b.adjustRel(a, 2, 0, s.t);
        return;
      }
      let fightP = clamp((heat - 1) * 0.3 * (a.traits.courage + b.traits.courage) / 2 + (s.ctx.atWar ? 0.2 : 0) + world.tension / 600, 0, 0.6);
      if (world.tick - (a.lastFight || -999) < 48 || world.tick - (b.lastFight || -999) < 48) fightP *= 0.15;
      if (rng.chance(fightP)) return scuffle(world, a, b, s, topic);
      world.log(heat > 1.3 || s.ctx.rivals ? 1 : 0, `${a.shortName} and ${b.shortName} have a ${heat > 1.5 ? 'blazing' : 'heated'} argument about ${topic} at ${s.loc.name}.${s.ctx.rivals ? ` ${s.ctx.ga.name} vs ${s.ctx.gb.name}, again.` : ''}`, [a, b], s.ctx.rivals ? [s.ctx.ga, s.ctx.gb] : []);
      a.remember(world, `Had a row with ${b.shortName} about ${topic}. They were being impossible.`, -0.4, 0.4, [b]);
      b.remember(world, `${a.shortName} started an argument about ${topic}. Typical.`, -0.4, 0.4, [a]);
      a.act(`argued with ${b.shortName} about ${topic}`); b.act(`argued with ${a.shortName} about ${topic}`);
    },
    insult(world, a, b, s) {
      const rng = world.rng;
      const insult = rng.pick(['a coward', 'a fraud', 'a bin-adjacent person', 'exactly what\'s wrong with this city', 'a pigeon in a coat', 'someone who has never paid for a round', 'a walking pamphlet', 'a stain on Pebbleton']);
      b.adjustRel(a, -10 - b.traits.neuro * 8, -0.1, s.t);
      a.adjustRel(b, -4, -0.02, s.t);
      b.remember(world, `${a.shortName} called me ${insult} in front of everyone at ${s.loc.name}.`, -0.7, 0.6, [a], a.group ? [a.group] : []);
      if (s.ctx.gb && !s.ctx.same) b.grievance.groups[s.ctx.ga ? s.ctx.ga.id : 0] = ((b.grievance.groups[s.ctx.ga ? s.ctx.ga.id : 0]) || 0) + 0.7;
      world.log(1, `${a.name} calls ${b.name} ${insult} at ${s.loc.name}.`, [a, b], s.ctx.ga && s.ctx.gb ? [s.ctx.ga, s.ctx.gb] : []);
      a.act(`called ${b.shortName} ${insult}`);
      if (rng.chance(0.3 + b.traits.temper * 0.4 + drunk(b) * 0.2)) scuffle(world, b, a, Object.assign({}, s, { ra: s.rb, rb: s.ra }), 'the insult');
    },
    recruit(world, a, b, s) {
      const rng = world.rng;
      const g = s.ctx.ga;
      const fit = b.ideologyBias(g) * 0.5 + s.ra.aff / 100 + (1 - b.needs.purpose) * 0.4 + (b.interests[g.focus] ? 0.3 : 0) + a.traits.charisma * 0.3 - 0.35;
      a.act(`tried to recruit ${b.shortName} into ${g.name}`);
      if (rng.chance(clamp(fit, 0.02, 0.85))) {
        g.addMember(world, b, `recruited by ${a.shortName}`);
        b.adjustRel(a, 8, 0.1, s.t); a.adjustRel(b, 6, 0.05, s.t);
        b.remember(world, `${a.shortName} brought me into ${g.name}. Finally, people who get it.`, 0.6, 0.7, [a], [g.id]);
        world.log(1, `${g.icon} ${b.name} joins ${g.name}, talked into it by ${a.shortName} at ${s.loc.name}.`, [a, b], [g]);
        b.needs.purpose = 1;
      } else if (rng.chance(0.2)) {
        world.log(0, `${a.shortName} tries to get ${b.shortName} to join ${g.name}. ${b.shortName} says they'll "think about it".`, [a, b], [g]);
        b.adjustRel(a, -1, 0, s.t);
      }
    },
    preach(world, a, b, s) {
      const rng = world.rng;
      const dom = a.dominantBelief();
      const topic = dom.value > 0 ? dom.axis.posWord : dom.axis.negWord;
      const open = b.traits.open * (1 - b.conviction * 0.8) * (0.5 + s.ra.trust);
      const p = a.traits.charisma * open * 0.7;
      a.act(`preached to ${b.shortName} about ${topic}`);
      a.needs.purpose = clamp(a.needs.purpose + 0.3, 0, 1);
      if (rng.chance(p)) {
        b.beliefs[dom.axis.id] = clamp(lerp(b.beliefs[dom.axis.id], dom.value, 0.25), -1, 1);
        b.conviction = clamp(b.conviction + 0.05, 0, 1);
        b.adjustRel(a, 6, 0.08, s.t);
        b.remember(world, `${a.shortName} opened my eyes about ${topic}. Everything makes more sense now.`, 0.5, 0.7, [a]);
        world.log(1, `✨ ${a.name} converts ${b.name} to the cause of ${topic} at ${s.loc.name}.`, [a, b]);
        a.stats.converts++;
      } else {
        b.adjustRel(a, -3 - b.conviction * 4, -0.02, s.t);
        if (rng.chance(0.15)) world.log(0, `${a.shortName} lectures ${b.shortName} about ${topic}. ${b.shortName} stares at the middle distance.`, [a, b]);
        if (b.conviction > 0.7 && rng.chance(0.4)) return ACTIONS.argue(world, b, a, Object.assign({}, s, { ra: s.rb, rb: s.ra, forcedTopic: topic }));
      }
    },
    help(world, a, b, s) {
      const rng = world.rng;
      let what;
      if (b.money < 15) { const amt = Math.min(30, Math.max(5, Math.floor(a.money * 0.1))); a.money -= amt; b.money += amt; what = `lends ${b.shortName} ${amt} coins, no questions asked`; }
      else if (b.stress > 0.7) { b.stress = clamp(b.stress - 0.3, 0, 1); what = `sits with ${b.shortName} until they stop shaking`; }
      else { b.mood = clamp(b.mood + 0.3, -1, 1); what = `buys ${b.shortName} a bowl of noodles and listens`; }
      a.stats.helped++;
      const d = 14 + a.traits.agree * 6;
      b.adjustRel(a, d, 0.2, s.t); a.adjustRel(b, 6, 0.05, s.t);
      a.reputation += 0.1;
      b.remember(world, `${a.shortName} helped me when I was at my lowest.${s.ctx.rivals ? ` And they're ${s.ctx.ga.name}. I don't know what to think any more.` : ''}`, 0.8, 0.9, [a], a.group ? [a.group] : []);
      a.remember(world, `I helped ${b.shortName} out. Felt right.`, 0.4, 0.4, [b]);
      world.log(s.ctx.rivals ? 2 : 1, `💛 ${a.name} ${what}.${s.ctx.rivals ? ` Across enemy lines, no less: ${s.ctx.ga.name} helping ${s.ctx.gb.name}.` : ''}`, [a, b], s.ctx.rivals ? [s.ctx.ga, s.ctx.gb] : []);
      if (s.ctx.rivals) { s.ctx.gb.nudgeStance(s.ctx.ga.id, 0.12, `${a.shortName}'s kindness`, world); b.grievance.groups[s.ctx.ga.id] = Math.max(0, (b.grievance.groups[s.ctx.ga.id] || 0) - 2); }
      a.act(`helped ${b.shortName}`);
    },
    flirt(world, a, b, s) {
      const rng = world.rng;
      const p = 0.25 + s.compat * 0.3 + a.traits.charisma * 0.3 + s.rb.aff / 200;
      a.act(`flirted with ${b.shortName}`);
      if (rng.chance(p)) {
        a.adjustRel(b, 8, 0.05, s.t); b.adjustRel(a, 8, 0.05, s.t);
        if (a.relWith(b.id).aff > 55 && b.relWith(a.id).aff > 50) {
          a.partner = b.id; b.partner = a.id;
          a.relWith(b.id).kind = 'partner'; b.relWith(a.id).kind = 'partner';
          const crossed = s.ctx.ga && s.ctx.gb && !s.ctx.same && s.ctx.rivals;
          world.log(crossed ? 3 : 2, `💘 ${a.name} and ${b.name} are officially an item.${crossed ? ` One is ${s.ctx.ga.name}, the other ${s.ctx.gb.name}. This will go smoothly.` : ''}`, [a, b], crossed ? [s.ctx.ga, s.ctx.gb] : []);
          a.remember(world, `${b.shortName} and I got together. I can't stop grinning.`, 0.9, 0.9, [b]); b.remember(world, `${a.shortName} and I got together. Everyone saw it coming, apparently.`, 0.9, 0.9, [a]);
          a.goals = a.goals.filter(g => g.type !== 'partner'); b.goals = b.goals.filter(g => g.type !== 'partner');
          if (crossed) { for (const m of s.ctx.ga.memberObjs(world)) if (m !== a) m.remember(world, `${a.shortName} is dating one of ${s.ctx.gb.name}. Is that allowed?`, -0.2, 0.4, [a, b], [s.ctx.gb.id]); }
        } else if (rng.chance(0.15)) world.log(0, `${a.shortName} flirts with ${b.shortName} at ${s.loc.name}. It goes well, mostly.`, [a, b]);
      } else {
        a.adjustRel(b, -1, 0, s.t); b.adjustRel(a, -2, 0, s.t);
        if (rng.chance(0.1)) world.log(0, `${a.shortName} flirts with ${b.shortName}, who suddenly needs to be somewhere else.`, [a, b]);
      }
    },
    forgive(world, a, b, s) {
      const rng = world.rng;
      a.act(`offered ${b.shortName} an olive branch`);
      if (rng.chance(0.3 + b.traits.agree * 0.5 + b.mood * 0.2)) {
        a.rel[b.id].aff = 10; b.rel[a.id].aff = 8;
        a.adjustRel(b, 0, 0.1, s.t); b.adjustRel(a, 0, 0.1, s.t);
        a.stats.forgiven++;
        a.remember(world, `I made peace with ${b.shortName}. Life's too short.`, 0.6, 0.7, [b]);
        b.remember(world, `${a.shortName} apologised, or something like it. We're all right now.`, 0.6, 0.7, [a]);
        world.log(2, `🕊️ ${a.name} and ${b.name} bury the hatchet at ${s.loc.name}. There is an awkward hug.`, [a, b]);
        if (s.ctx.rivals) { s.ctx.ga.nudgeStance(s.ctx.gb.id, 0.08, 'a reconciliation', world); s.ctx.gb.nudgeStance(s.ctx.ga.id, 0.08, 'a reconciliation', world); }
      } else {
        world.log(1, `${a.name} tries to make peace with ${b.name}, who is not ready. ${b.shortName} leaves without a word.`, [a, b]);
        a.adjustRel(b, -3, 0, s.t);
      }
    },
    betray(world, a, b, s) {
      const rng = world.rng;
      const old = s.ctx.ga, nu = s.ctx.gb;
      old.removeMember(world, a, 'defected');
      nu.addMember(world, a, 'defected from ' + old.name);
      old.stats.defections++;
      a.loyalty = 0.6;
      const secret = rng.pick(['their plans for the plaza', 'who really runs the meetings', 'the location of the good snacks', 'the leader\'s embarrassing nickname', 'the membership list']);
      world.log(3, `🐍 Betrayal! ${a.name} defects from ${old.name} to ${nu.name}, taking ${secret} with them.`, [a, b], [old, nu]);
      world.chronicle(`🐍 ${a.name} defected from ${old.name} to ${nu.name}.`);
      for (const m of old.memberObjs(world)) { m.adjustRel(a, -35, -0.4, s.t); m.grievance.groups[nu.id] = (m.grievance.groups[nu.id] || 0) + 1.2; m.remember(world, `${a.shortName} betrayed us and ran off to ${nu.name} with ${secret}.`, -0.8, 0.9, [a], [nu.id]); }
      old.nudgeStance(nu.id, -0.35, `${a.shortName}'s defection`, world);
      nu.nudgeStance(old.id, -0.1, 'poaching', world);
      nu.reputation -= 0.1;
      a.remember(world, `I left ${old.name} for ${nu.name}. They'll call it betrayal. I call it growth.`, 0.2, 0.9, [b], [old.id, nu.id]);
      b.adjustRel(a, 10, 0.05, s.t);
    },
    negotiate(world, a, b, s) {
      window.Conflict.negotiate(world, s.ctx.ga, s.ctx.gb, a, b, null);
    },
  };

  function bondFlavour(rng, k) {
    const F = {
      weed: ['The conversation reaches the moon.', 'They agree that time is a circle.', 'Someone mentions bins. It is profound.'],
      booze: ['Rounds are bought. Rounds are regretted.', 'They sing. Badly. Loudly.', 'Nobody can find their coat.'],
      gambling: ['The horse was a sure thing. The horse was not.', 'Someone wins. Someone else "was about to".'],
      sports: ['The referee is discussed at length.', 'A tactical diagram is drawn on a napkin.'],
      religion: ['The candles flicker meaningfully.', 'St. Pebble is invoked, twice.'],
      philosophy: ['Nothing is resolved, which is the point.', 'A chair is used as an example of something.'],
      status: ['Someone mentions their boat.', 'A handshake is evaluated.'],
      gym: ['Protein is discussed.', 'Someone adds a plate they should not have.'],
      art: ['A canvas is called "brave".', 'They agree the gallery lighting is a crime.'],
      nature: ['Slugs are denounced.', 'There is a lot of pointing at soil.'],
      food: ['Noodle Stand No. 4 remains undefeated.', 'A sauce is ranked.'],
      music: ['The bass is felt in the teeth.', 'A song comes on and everyone screams.'],
      gossip: ['Names are named.', 'Someone says "you didn\'t hear it from me".'],
      conspiracy: ['The geese are clearly involved.', 'A string is connected to another string.'],
      cats: ['Chairman is shown at seventeen angles.', 'A kitten photo ends all disagreement.'],
      politics: ['A petition acquires its third signature.', 'A slogan is workshopped.'],
    };
    return rng.pick(F[k] || ['A good time is had.']);
  }
  function rumourBias(world, c, r) {
    if (r.about.group) { const g = world.group(r.about.group); if (!g) return 0; const op = c.ideologyBias(g); return r.tone < 0 ? -op * 0.3 : op * 0.3; }
    if (r.about.citizen) { const rel = c.rel[r.about.citizen]; if (!rel) return 0; return r.tone < 0 ? -rel.aff / 300 : rel.aff / 300; }
    return 0;
  }

  // A physical fight. Non-graphic: bruises, dignity, and the Clinic.
  function scuffle(world, a, b, s, why) {
    const rng = world.rng;
    const t = world.tick;
    a.stats.fights++; b.stats.fights++;
    a.lastFight = t; b.lastFight = t;
    const pa = a.traits.courage + (a.interests.gym || 0) + rng.float() * 0.8 + drunk(a) * -0.2;
    const pb = b.traits.courage + (b.interests.gym || 0) + rng.float() * 0.8 + drunk(b) * -0.2;
    const winner = pa >= pb ? a : b, loser = winner === a ? b : a;
    const here = world.at(a.loc).filter(c => c !== a && c !== b);
    const officer = here.find(c => c.job === 'officer');
    const merciful = winner.traits.agree > 0.55 && rng.chance(0.6);
    const silly = rng.chance(0.2);
    let text = `👊 ${a.name} and ${b.name} come to blows over ${why} at ${s.loc.name}. `;
    if (silly) text += rng.pick(['They fight like two people who have only seen fighting on television. ', 'A chair is thrown. It misses everything. ', 'The fight is paused so both can put their glasses down safely. ', 'Someone shouts "not the noodles!" ']);
    if (merciful) {
      text += `${winner.shortName} gets the upper hand, then stops and helps ${loser.shortName} up. "We're both idiots," ${winner.shortName} says.`;
      loser.adjustRel(winner, 12, 0.15, t); winner.adjustRel(loser, 4, 0.05, t);
      loser.remember(world, `${winner.shortName} could have flattened me and didn't. I owe them one.`, 0.3, 0.8, [winner], winner.group ? [winner.group] : []);
      winner.remember(world, `I let ${loser.shortName} off the hook after our fight. Felt better than winning.`, 0.3, 0.6, [loser]);
      loser.mood -= 0.1;
    } else {
      text += `${winner.shortName} wins on points. ${loser.shortName} is escorted to the Clinic, mostly for their pride.`;
      loser.status = 'injured'; loser.statusUntil = t + 24 * rng.int(1, 3); loser.loc = 'clinic'; loser.dest = 'clinic';
      loser.adjustRel(winner, -25, -0.2, t); winner.adjustRel(loser, -12, -0.1, t);
      loser.remember(world, `${winner.shortName} put me in the Clinic over ${why}. This isn't over.`, -0.9, 1, [winner], winner.group ? [winner.group] : []);
      winner.remember(world, `Fought ${loser.shortName} over ${why}. Won. Felt great for about an hour.`, 0.1, 0.7, [loser]);
      if (loser.traits.temper > 0.5 && !loser.goals.some(g => g.type === 'revenge')) loser.goals.push({ type: 'revenge', target: winner.id, text: `Get even with ${winner.shortName}` });
      if (winner.group && loser.group && winner.group !== loser.group) { loser.grievance.groups[winner.group] = (loser.grievance.groups[winner.group] || 0) + 2; }
    }
    if (officer && officer !== winner && officer !== loser) {
      const arrested = world.policyActive('patrols') || rng.chance(0.5) ? winner : null;
      if (arrested) {
        arrested.status = 'jailed'; arrested.statusUntil = t + 24 * rng.int(1, 2); arrested.loc = 'townhall'; arrested.dest = 'townhall';
        text += ` Peace Officer ${officer.shortName} arrests ${arrested.shortName} and marches them to the Quiet Room.`;
        arrested.grievance.mayor += 1.5;
        arrested.remember(world, `Officer ${officer.shortName} threw me in the Quiet Room. The mayor's goons.`, -0.6, 0.7, [officer]);
        if (arrested.group) { const g = world.group(arrested.group); for (const m of g.memberObjs(world)) { m.grievance.mayor += 0.5; } world.pressure(g, 'the arrest of ' + arrested.shortName); }
      }
    }
    // Witnesses take sides and groups take note
    for (const w of here) {
      const oa = w.opinionOf(a), ob = w.opinionOf(b);
      const sideWith = oa > ob + 10 ? a : ob > oa + 10 ? b : null;
      if (sideWith) { const against = sideWith === a ? b : a; w.adjustRel(against, -5, -0.05, t); if (against.group && against.group !== w.group) w.grievance.groups[against.group] = (w.grievance.groups[against.group] || 0) + 0.3; }
    }
    const groups = [];
    if (s.ctx.ga && s.ctx.gb && !s.ctx.same) {
      groups.push(s.ctx.ga, s.ctx.gb);
      s.ctx.ga.nudgeStance(s.ctx.gb.id, -0.2, 'a brawl', world); s.ctx.gb.nudgeStance(s.ctx.ga.id, -0.2, 'a brawl', world);
      s.ctx.ga.stats.clashes++; s.ctx.gb.stats.clashes++;
      world.tension += 3;
      text += ` ${s.ctx.ga.name} and ${s.ctx.gb.name} both claim the moral high ground.`;
    } else world.tension += 1;
    world.log(2, text, [a, b], groups);
    a.act(`fought ${b.shortName}`); b.act(`fought ${a.shortName}`);
  }

  // Things a citizen does alone at a location.
  function solo(world, c) {
    const rng = world.rng;
    const loc = world.loc(c.loc);
    const n = c.needs;
    const k = loc.kind;
    if (k === 'home') {
      n.rest = clamp(n.rest + 0.25, 0, 1);
      if (c.interests.cats && rng.chance(0.03)) world.log(0, `${c.shortName} explains the day's events to their cat, who is unmoved.`, [c]);
      return;
    }
    if (k === 'work' || (loc.id === c.work)) {
      const job = D.JOBS.find(j => j.id === c.job);
      c.money += job.wage; n.purpose = clamp(n.purpose + 0.05, 0, 1); n.rest -= 0.02;
      if (c.job === 'journalist' && rng.chance(0.15)) window.Politics.publish(world, c);
      if (c.job === 'officer' && rng.chance(0.1) && world.tension > 40) { n.purpose = clamp(n.purpose + 0.2, 0, 1); }
      return;
    }
    // Vices and hobbies
    for (const it of D.INTERESTS) {
      if (!c.interests[it.id] || !it.locs.includes(loc.id)) continue;
      n.fun = clamp(n.fun + 0.3 * c.interests[it.id], 0, 1);
      if (it.id === 'weed') { c.stats.joints++; c.mood += 0.1; c.stress = clamp(c.stress - 0.15, 0, 1); c.hangover = 2; if (rng.chance(0.05)) world.log(0, `${c.shortName} ${rng.pick(['contemplates a leaf for forty minutes', 'has a profound thought and immediately loses it', 'orders noodles for the third time', 'agrees with the sky'])} at ${loc.name}.`, [c]); if (world.policyActive('herb_ban') && loc.kind === 'park' && rng.chance(0.3)) { c.grievance.mayor += 0.6; c.money -= 15; world.log(1, `${c.name} is fined for herb in the park under the mayor's ban and mutters something about tyranny.`, [c]); } }
      if (it.id === 'booze') { c.stats.drinks++; c.drunk = (c.drunk || 0) + 1; c.money -= 5; c.mood += 0.08; if (c.drunk > 3 && rng.chance(0.15)) world.log(0, `${c.shortName} ${rng.pick(['tells the bartender the truth about everything', 'attempts to buy the bar', 'declares love for the jukebox', 'forgets which district they live in'])}.`, [c]); }
      if (it.id === 'gambling') { const win = rng.chance(0.38 - (c.addiction.gambling || 0) * 0.08); const stake = Math.min(c.money, 10 + Math.round(c.addiction.gambling * 40)); c.money += win ? stake * 1.5 : -stake; if (!win) { c.stats.betsLost++; c.mood -= 0.1; } if (c.money < 10 && rng.chance(0.3)) { world.log(1, `${c.name} has lost the rent at Lucky Otto's again. The horse "looked confident".`, [c]); c.remember(world, 'Lost everything at Lucky Otto\'s. The system is rigged. Probably the mayor.', -0.6, 0.6); c.grievance.mayor += 0.3; c.stress += 0.2; } }
      if (it.id === 'religion') { n.purpose = clamp(n.purpose + 0.35, 0, 1); c.stress = clamp(c.stress - 0.1, 0, 1); if (world.policyActive('secular') && rng.chance(0.2)) c.grievance.mayor += 0.5; }
      if (it.id === 'gym') { c.traits.courage = clamp(c.traits.courage + 0.002, 0, 1); }
      if (it.id === 'sports' && loc.kind === 'stadium') { n.social = clamp(n.social + 0.2, 0, 1); }
      if (it.id === 'philosophy') { n.purpose = clamp(n.purpose + 0.2, 0, 1); if (rng.chance(0.03)) world.log(0, `${c.shortName} ${rng.pick(['proves the chair does not exist and then sits on it', 'writes "WHY?" on a napkin and underlines it', 'reads one page of a very heavy book and feels transformed'])}.`, [c]); }
      if (it.id === 'status') { c.money -= 8; c.reputation += 0.02; }
      if (it.id === 'politics' && loc.kind === 'plaza') { n.purpose = clamp(n.purpose + 0.2, 0, 1); }
      if (it.id === 'nature') { c.stress = clamp(c.stress - 0.1, 0, 1); }
    }
    if (k === 'park' || k === 'temple' || k === 'culture') { n.rest = clamp(n.rest + 0.05, 0, 1); c.stress = clamp(c.stress - 0.03, 0, 1); }
    if (k === 'cafe' || k === 'market') { c.money -= 2; n.fun = clamp(n.fun + 0.08, 0, 1); }
    if (k === 'clinic' && c.status === 'normal') { c.stress = clamp(c.stress - 0.05, 0, 1); }
  }

  window.Interactions = { interact, solo, scuffle };
})();
