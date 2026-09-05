// Static content for the city: names, places, beliefs, habits, policies, phrases.
window.DATA = (function () {
  const FIRST = ['Marla','Dev','Ingrid','Tobias','Sunny','Bartholomew','Priya','Ezra','Wren','Kofi','Lupe','Otto','Nadia','Felix','Yusuf','Bea','Rufus','Amara','Gideon','Hana','Lars','Tamsin','Jonah','Zola','Percy','Mina','Caspian','Dolores','Ivo','Sasha','Bram','Ophelia','Tariq','Greta','Milo','Rosalind','Kwame','Edith','Sol','Juniper','Basil','Nell','Hamid','Vera','Clem','Aurelio','Pip','Ludmila','Ravi','Delphine','Ansel','Fenna','Ozzie','Beatrix','Corvin','Ludo','Maeve','Idris','Tilly','Horace','Anouk','Silas','Lettie','Emeka','Marigold','Quentin','Ines','Rocco','Sigrid','Teo','Wilhelmina','Arlo','Petra','Hugo','Dot','Reuben','Yara','Ambrose','Coco','Leopold'];
  const LAST = ['Pebble','Okonkwo','Vandermeer','Bright','Castellano','Quill','Haddad','Fjord','Mbeki','Lindqvist','Applebaum','Sato','Duque','Marsh','Ravenscroft','Nakamura','Oyelaran','Thistle','Blanco','Grimsby','Ferreira','Popescu','Halloran','Ngata','Winterbottom','Ashby','Delacroix','Kowalczyk','Beauregard','Solano','Tanaka','Gallagher','Idowu','Brannigan','Kestrel','Volkov','Mahler','Oduya','Pettibone','Huang','Ruiz','Stollen','Crumb','Vasquez','Barnacle','Abernathy','Lowe','Okafor','Peregrine','Rasmussen','Sallow','Tremont','Underhill','Wexley','Yildiz','Zimmer','Amundsen','Bexley','Cordova','Doyle'];

  const DISTRICTS = [
    { id: 'docks', name: 'Old Docks', color: '#4f7cac', flavor: 'salt, rope, and opinions', wealth: 0.3,
      locations: [
        { id: 'docks_home', name: 'Dockside Rowhouses', icon: '🏠', kind: 'home' },
        { id: 'herring', name: 'The Salty Herring', icon: '🍺', kind: 'bar' },
        { id: 'fishmarket', name: 'Fish Market', icon: '🐟', kind: 'work' },
        { id: 'warehouse', name: 'Warehouse 9', icon: '📦', kind: 'work' },
        { id: 'pier', name: 'The Long Pier', icon: '🎣', kind: 'park' },
      ] },
    { id: 'steel', name: 'Steelyard', color: '#8a6d4a', flavor: 'sparks, sweat, and strong handshakes', wealth: 0.35,
      locations: [
        { id: 'steel_home', name: 'Foundry Flats', icon: '🏠', kind: 'home' },
        { id: 'factory', name: 'The Bolt Works', icon: '🏭', kind: 'work' },
        { id: 'irontemple', name: 'Iron Temple Gym', icon: '🏋️', kind: 'gym' },
        { id: 'rivet', name: 'Rivet & Pint', icon: '🍻', kind: 'bar' },
      ] },
    { id: 'commons', name: 'The Commons', color: '#7a9b6d', flavor: 'pigeons, paperwork, and protests', wealth: 0.5,
      locations: [
        { id: 'commons_home', name: 'Commons Terraces', icon: '🏠', kind: 'home' },
        { id: 'townhall', name: 'Town Hall', icon: '🏛️', kind: 'civic' },
        { id: 'plaza', name: 'Pigeon Plaza', icon: '⛲', kind: 'plaza' },
        { id: 'market', name: 'Saturday Market', icon: '🧺', kind: 'market' },
        { id: 'clinic', name: 'The Clinic', icon: '🏥', kind: 'clinic' },
      ] },
    { id: 'uptown', name: 'Uptown Heights', color: '#b08cc4', flavor: 'hedges, gates, and quiet judgement', wealth: 0.9,
      locations: [
        { id: 'uptown_home', name: 'Gated Villas', icon: '🏠', kind: 'home' },
        { id: 'club', name: 'The Peregrine Club', icon: '🥂', kind: 'bar' },
        { id: 'gallery', name: 'Gallery Pomp', icon: '🖼️', kind: 'culture' },
        { id: 'boutique', name: 'Boutique Vanité', icon: '👜', kind: 'market' },
      ] },
    { id: 'uni', name: 'University Row', color: '#c4a35a', flavor: 'coffee, footnotes, and manifestos', wealth: 0.45,
      locations: [
        { id: 'uni_home', name: 'Student Dorms', icon: '🏠', kind: 'home' },
        { id: 'lecture', name: 'Lecture Hall B', icon: '🎓', kind: 'work' },
        { id: 'library', name: 'The Library', icon: '📚', kind: 'culture' },
        { id: 'descartes', name: "Descartes' Beans", icon: '☕', kind: 'cafe' },
        { id: 'studentbar', name: 'The Thesis Defence', icon: '🍷', kind: 'bar' },
      ] },
    { id: 'green', name: 'Greenbelt', color: '#5da271', flavor: 'compost, incense, and slow mornings', wealth: 0.4,
      locations: [
        { id: 'green_home', name: 'Willow Cottages', icon: '🏠', kind: 'home' },
        { id: 'park', name: 'Dandelion Park', icon: '🌳', kind: 'park' },
        { id: 'garden', name: 'Community Garden', icon: '🥕', kind: 'work' },
        { id: 'greenroom', name: 'The Green Room', icon: '🌿', kind: 'herb' },
        { id: 'temple', name: 'Temple of St. Pebble', icon: '⛪', kind: 'temple' },
      ] },
    { id: 'night', name: 'Nightmarket', color: '#d16a6a', flavor: 'neon, noodles, and bad decisions', wealth: 0.4,
      locations: [
        { id: 'night_home', name: 'Neon Lofts', icon: '🏠', kind: 'home' },
        { id: 'arena', name: 'Pebbleton Arena', icon: '🏟️', kind: 'stadium' },
        { id: 'goat', name: 'The Neon Goat', icon: '🪩', kind: 'club' },
        { id: 'betting', name: "Lucky Otto's Betting", icon: '🎰', kind: 'betting' },
        { id: 'noodles', name: 'Noodle Stand No. 4', icon: '🍜', kind: 'cafe' },
      ] },
  ];

  const JOBS = [
    { id: 'dockworker', name: 'dockworker', loc: 'warehouse', wage: 9, districts: ['docks'] },
    { id: 'fishmonger', name: 'fishmonger', loc: 'fishmarket', wage: 8, districts: ['docks'] },
    { id: 'welder', name: 'welder', loc: 'factory', wage: 10, districts: ['steel'] },
    { id: 'foreman', name: 'shift foreman', loc: 'factory', wage: 13, districts: ['steel'] },
    { id: 'clerk', name: 'town hall clerk', loc: 'townhall', wage: 10, districts: ['commons'] },
    { id: 'nurse', name: 'nurse', loc: 'clinic', wage: 11, districts: ['commons', 'green'] },
    { id: 'officer', name: 'peace officer', loc: 'townhall', wage: 11, districts: ['commons', 'steel'] },
    { id: 'journalist', name: 'journalist at the Gazette', loc: 'townhall', wage: 9, districts: ['commons', 'uni'] },
    { id: 'shopkeeper', name: 'market trader', loc: 'market', wage: 8, districts: ['commons', 'docks'] },
    { id: 'financier', name: 'financier', loc: 'club', wage: 24, districts: ['uptown'] },
    { id: 'gallerist', name: 'gallerist', loc: 'gallery', wage: 15, districts: ['uptown'] },
    { id: 'influencer', name: 'lifestyle influencer', loc: 'boutique', wage: 12, districts: ['uptown', 'night'] },
    { id: 'lawyer', name: 'lawyer', loc: 'townhall', wage: 20, districts: ['uptown', 'commons'] },
    { id: 'professor', name: 'professor', loc: 'lecture', wage: 14, districts: ['uni'] },
    { id: 'student', name: 'student', loc: 'lecture', wage: 3, districts: ['uni'] },
    { id: 'librarian', name: 'librarian', loc: 'library', wage: 9, districts: ['uni'] },
    { id: 'barista', name: 'barista', loc: 'descartes', wage: 7, districts: ['uni', 'night'] },
    { id: 'gardener', name: 'gardener', loc: 'garden', wage: 7, districts: ['green'] },
    { id: 'priest', name: 'Speaker of the Temple', loc: 'temple', wage: 8, districts: ['green'] },
    { id: 'herbalist', name: 'herbalist', loc: 'greenroom', wage: 9, districts: ['green'] },
    { id: 'coach', name: 'football coach', loc: 'arena', wage: 11, districts: ['night', 'steel'] },
    { id: 'dj', name: 'DJ', loc: 'goat', wage: 8, districts: ['night'] },
    { id: 'bookie', name: 'bookie', loc: 'betting', wage: 12, districts: ['night'] },
    { id: 'cook', name: 'noodle cook', loc: 'noodles', wage: 7, districts: ['night'] },
    { id: 'bartender', name: 'bartender', loc: 'herring', wage: 8, districts: ['docks', 'steel', 'night'] },
    { id: 'retired', name: 'retiree', loc: null, wage: 6, districts: null },
    { id: 'unemployed', name: 'between jobs', loc: null, wage: 2, districts: null },
    { id: 'philosopher', name: 'freelance philosopher', loc: null, wage: 2, districts: ['uni', 'green'] },
  ];

  // Belief axes. Positive pole first, negative second.
  const AXES = [
    { id: 'order', pos: 'Order', neg: 'Freedom', posWord: 'rules and order', negWord: 'personal freedom' },
    { id: 'faith', pos: 'Sacred', neg: 'Secular', posWord: 'faith and the Temple', negWord: 'reason over religion' },
    { id: 'share', pos: 'Collective', neg: 'Individual', posWord: 'sharing the wealth', negWord: 'earning your own way' },
    { id: 'roots', pos: 'Tradition', neg: 'Progress', posWord: 'the old ways', negWord: 'change and progress' },
    { id: 'pride', pos: 'Local', neg: 'Cosmopolitan', posWord: 'Pebbleton first', negWord: 'an open city' },
  ];

  // Obsessions, habits and vices. Each has a place it pulls people toward.
  const INTERESTS = [
    { id: 'weed', name: 'weed', icon: '🌿', locs: ['greenroom', 'park'], vice: true, verb: 'share a joint' },
    { id: 'booze', name: 'drinking', icon: '🍺', locs: ['herring', 'rivet', 'studentbar', 'club', 'goat'], vice: true, verb: 'get a few rounds in' },
    { id: 'gambling', name: 'gambling', icon: '🎰', locs: ['betting'], vice: true, verb: 'put a bet on' },
    { id: 'sports', name: 'football', icon: '⚽', locs: ['arena', 'rivet', 'herring'], verb: 'argue about the match' },
    { id: 'religion', name: 'the Temple', icon: '⛪', locs: ['temple'], verb: 'pray together' },
    { id: 'philosophy', name: 'philosophy', icon: '🤔', locs: ['descartes', 'library'], verb: 'debate the nature of reality' },
    { id: 'status', name: 'status', icon: '💎', locs: ['club', 'boutique', 'gallery'], verb: 'compare watches' },
    { id: 'gym', name: 'lifting', icon: '🏋️', locs: ['irontemple'], verb: 'spot each other on the bench' },
    { id: 'art', name: 'art', icon: '🎨', locs: ['gallery', 'library'], verb: 'critique a painting' },
    { id: 'nature', name: 'gardening', icon: '🌱', locs: ['garden', 'park', 'pier'], verb: 'compare tomatoes' },
    { id: 'food', name: 'food', icon: '🍜', locs: ['noodles', 'market'], verb: 'rank the noodle stands' },
    { id: 'music', name: 'music', icon: '🎶', locs: ['goat', 'studentbar'], verb: 'dance badly' },
    { id: 'gossip', name: 'gossip', icon: '👂', locs: ['market', 'descartes', 'noodles'], verb: 'swap rumours' },
    { id: 'conspiracy', name: 'conspiracies', icon: '🛸', locs: ['pier', 'library'], verb: 'connect the dots' },
    { id: 'cats', name: 'cats', icon: '🐈', locs: ['park', 'market'], verb: 'show each other cat photos' },
    { id: 'politics', name: 'politics', icon: '📢', locs: ['plaza', 'townhall'], verb: 'draft a petition' },
  ];

  const NICKNAMES = {
    weed: ['Hazy', 'Dizzy', 'Cloud'], booze: ['Two-Pints', 'Last-Orders'], gambling: ['Lucky', 'Odds'],
    sports: ['Coach', 'Ultra'], religion: ['the Devout', 'Sister', 'Brother'], philosophy: ['the Thinker', 'Why'],
    status: ['Fancy', 'the Third'], gym: ['Big', 'Reps'], art: ['Sketch'], nature: ['Green-Thumb', 'Compost'],
    food: ['Noodles', 'Snacks'], music: ['Bass', 'DJ'], gossip: ['Mouth', 'the Ear'], conspiracy: ['Tinfoil', 'Truth'],
    cats: ['Whiskers'], politics: ['Petition', 'the Senator'],
  };

  // Group name generation pieces, keyed by the dominant trait of a group.
  const GROUP_NAMES = {
    order: { adj: ['Orderly', 'Upstanding', 'Law-Abiding', 'Respectable'], noun: ['Association', 'Committee', 'Watch', 'League'], icon: '🛡️' },
    'order-': { adj: ['Free', 'Unbothered', 'Loose', 'Wild'], noun: ['Collective', 'Crew', 'Front', 'Rabble'], icon: '🔥' },
    faith: { adj: ['Faithful', 'Blessed', 'Pious', 'Devoted'], noun: ['Congregation', 'Fellowship', 'Choir', 'Circle'], icon: '🕯️' },
    'faith-': { adj: ['Rational', 'Skeptical', 'Enlightened', 'Empirical'], noun: ['Society', 'Institute', 'Forum', 'Salon'], icon: '🔬' },
    share: { adj: ['United', 'Common', 'Mutual', "People's"], noun: ['Union', 'Cooperative', 'Assembly', 'Commune'], icon: '✊' },
    'share-': { adj: ['Self-Made', 'Enterprising', 'Prosperous', 'Independent'], noun: ['Club', 'Syndicate', 'Chamber', 'Trust'], icon: '💼' },
    roots: { adj: ['Old', 'Traditional', 'Heritage', 'Proper'], noun: ['Guild', 'Order', 'Society', 'Lodge'], icon: '🏺' },
    'roots-': { adj: ['New', 'Future', 'Modern', 'Progressive'], noun: ['Movement', 'Lab', 'Alliance', 'Project'], icon: '🚀' },
    pride: { adj: ['Pebbleton', 'Hometown', 'Native', 'Loyal'], noun: ['Patriots', 'Firsters', 'Brigade', 'Guard'], icon: '🏴' },
    'pride-': { adj: ['Open', 'Worldly', 'Cosmopolitan', 'Borderless'], noun: ['Network', 'Exchange', 'Circle', 'Coalition'], icon: '🌍' },
    weed: { adj: ['Hazy', 'Mellow', 'Elevated', 'Green'], noun: ['Collective', 'Circle', 'Garden Club', 'Society'], icon: '🌿' },
    booze: { adj: ['Thirsty', 'Merry', 'Last-Orders', 'Bottomless'], noun: ['Brotherhood', 'Regulars', 'Drinking Society', 'Tavern Council'], icon: '🍺' },
    gambling: { adj: ['Lucky', 'High-Rolling', 'All-In'], noun: ['Syndicate', 'Club', 'Circle'], icon: '🎲' },
    sports: { adj: ['Pebbleton', 'Arena', 'Ultras', 'Matchday'], noun: ['Ultras', 'Supporters', 'Firm', 'Faithful'], icon: '⚽' },
    religion: { adj: ['Faithful', 'Blessed', 'Devoted'], noun: ['Fellowship', 'Choir', 'Congregation'], icon: '⛪' },
    philosophy: { adj: ['Reflective', 'Socratic', 'Unbearable', 'Dialectical'], noun: ['Society', 'Circle', 'Salon', 'Seminar'], icon: '🤔' },
    status: { adj: ['Distinguished', 'Exclusive', 'Peregrine', 'Gilded'], noun: ['Society', 'Club', 'Set', 'Council'], icon: '💎' },
    gym: { adj: ['Iron', 'Heavy', 'Swole', 'Mighty'], noun: ['Brotherhood', 'Crew', 'Temple', 'Legion'], icon: '🏋️' },
    art: { adj: ['Bohemian', 'Avant', 'Painted', 'Restless'], noun: ['Collective', 'Salon', 'Studio', 'Movement'], icon: '🎨' },
    nature: { adj: ['Green', 'Rooted', 'Compost', 'Dandelion'], noun: ['Gardeners', 'Circle', 'Alliance', 'Society'], icon: '🌱' },
    food: { adj: ['Hungry', 'Noodle', 'Gourmet', 'Snacking'], noun: ['Society', 'Council', 'Appreciation Club'], icon: '🍜' },
    music: { adj: ['Loud', 'Neon', 'Midnight', 'Bass'], noun: ['Collective', 'Crew', 'Scene', 'Sound System'], icon: '🎶' },
    gossip: { adj: ['Whispering', 'Well-Informed', 'Curious'], noun: ['Circle', 'Network', 'Society'], icon: '👂' },
    conspiracy: { adj: ['Awakened', 'Vigilant', 'Truth-Seeking', 'Suspicious'], noun: ['Society', 'Watch', 'Network', 'Front'], icon: '🛸' },
    cats: { adj: ['Feline', 'Whiskered', 'Purring'], noun: ['Society', 'Appreciation Club', 'Council'], icon: '🐈' },
    politics: { adj: ['Civic', 'Concerned', 'Organised', 'Vocal'], noun: ['Assembly', 'Committee', 'Front', 'Party'], icon: '📢' },
  };

  // Mayoral policies. `stance` is the belief position the policy expresses;
  // `likes` / `hates` name interests that react strongly.
  const POLICIES = [
    { id: 'herb_ban', name: 'ban herb in public parks', stance: { order: 0.7, roots: 0.4 }, hates: ['weed', 'nature'], likes: ['religion'], tension: 6 },
    { id: 'herb_legal', name: 'declare the Green Room a "cultural heritage site"', stance: { order: -0.7, roots: -0.4 }, likes: ['weed', 'philosophy'], hates: ['religion', 'order'], tension: 3 },
    { id: 'curfew', name: 'impose a 11pm curfew on Nightmarket', stance: { order: 0.9 }, hates: ['music', 'booze', 'gambling'], likes: ['religion'], tension: 8 },
    { id: 'stadium', name: 'pour money into the Arena', stance: { pride: 0.5, share: 0.2 }, likes: ['sports'], hates: ['art', 'philosophy'], tension: 2 },
    { id: 'gallery_fund', name: 'fund a giant abstract sculpture in Pigeon Plaza', stance: { roots: -0.6, share: 0.3 }, likes: ['art', 'status'], hates: ['sports', 'gym'], tension: 3 },
    { id: 'tax_uptown', name: 'tax the Uptown villas', stance: { share: 0.8 }, likes: ['politics', 'nature'], hates: ['status'], tension: 7 },
    { id: 'tax_cut', name: 'cut taxes on the Peregrine Club', stance: { share: -0.8 }, likes: ['status', 'gambling'], hates: ['politics'], tension: 6 },
    { id: 'temple_day', name: 'make St. Pebble\'s Day a paid holiday', stance: { faith: 0.7, roots: 0.5 }, likes: ['religion'], hates: ['philosophy', 'conspiracy'], tension: 3 },
    { id: 'secular', name: 'remove the Temple bell (it\'s too loud)', stance: { faith: -0.8 }, likes: ['philosophy', 'music'], hates: ['religion'], tension: 8 },
    { id: 'open_docks', name: 'open the docks to foreign traders', stance: { pride: -0.8, roots: -0.3 }, likes: ['food', 'art'], hates: ['pride'], tension: 6 },
    { id: 'local_only', name: 'require "Pebbleton-born" stickers on all shops', stance: { pride: 0.9 }, likes: ['pride'], hates: ['food', 'philosophy'], tension: 7 },
    { id: 'patrols', name: 'double the Peace Officer patrols', stance: { order: 0.8 }, likes: ['order'], hates: ['weed', 'music', 'conspiracy'], tension: 5 },
    { id: 'disband_patrols', name: 'replace patrols with "community vibes coordinators"', stance: { order: -0.8, roots: -0.5 }, likes: ['weed', 'art'], hates: ['order', 'gym'], tension: 6 },
    { id: 'free_noodles', name: 'subsidise noodles for all', stance: { share: 0.6 }, likes: ['food', 'weed', 'booze'], hates: ['status'], tension: -3 },
    { id: 'cat_census', name: 'commission an official cat census', stance: { order: 0.3 }, likes: ['cats', 'gossip'], hates: [], tension: -2 },
    { id: 'gambling_ban', name: 'shutter Lucky Otto\'s Betting', stance: { order: 0.6, faith: 0.3 }, likes: ['religion'], hates: ['gambling', 'sports'], tension: 6 },
    { id: 'wage_raise', name: 'raise the minimum wage at the Bolt Works', stance: { share: 0.7 }, likes: ['gym', 'politics'], hates: ['status'], tension: 4 },
    { id: 'festival', name: 'throw a city-wide festival', stance: { share: 0.2, order: -0.2 }, likes: ['music', 'food', 'booze'], hates: [], tension: -8 },
    { id: 'amnesty', name: 'declare a general amnesty', stance: { order: -0.4 }, likes: [], hates: [], tension: -12, crisisOnly: true },
  ];

  // Rumour templates. {A} = subject, {B} = a second citizen, {G} = a group.
  const RUMOURS = [
    { t: '{A} secretly voted for the other side', tone: -1, about: 'citizen', needs: null },
    { t: '{A} has been seen leaving {B}\'s place at dawn', tone: -0.5, about: 'pair' },
    { t: '{A} owes money to half the Nightmarket', tone: -1, about: 'citizen' },
    { t: '{A} once said {G} were "basically a cult"', tone: -1, about: 'citizen_group' },
    { t: '{A} cried during the match', tone: -0.3, about: 'citizen' },
    { t: '{A} is planning to run for mayor', tone: 0.3, about: 'citizen' },
    { t: '{A} kicked a pigeon', tone: -1, about: 'citizen' },
    { t: '{A} gave their whole paycheque to the Temple', tone: 0.2, about: 'citizen' },
    { t: '{G} are hoarding noodles for the coming troubles', tone: -1, about: 'group' },
    { t: '{G} have a secret handshake and it is embarrassing', tone: -0.5, about: 'group' },
    { t: '{G} are plotting to take over Pigeon Plaza', tone: -1, about: 'group' },
    { t: '{G} paid the mayor in cheese', tone: -1, about: 'group' },
    { t: '{A} doesn\'t actually like {B}, they just pretend', tone: -0.7, about: 'pair' },
    { t: '{A} talks to the cats and the cats talk back', tone: 0.1, about: 'citizen' },
    { t: '{A} has never once paid for a round', tone: -0.6, about: 'citizen' },
    { t: '{A} is a spy for {G}', tone: -1, about: 'citizen_group' },
    { t: '{A} secretly agrees with {G} about everything', tone: -0.8, about: 'citizen_group' },
    { t: '{G} let a goose into the Town Hall on purpose', tone: -0.6, about: 'group' },
  ];

  // Random incidents that stir the pot. Effects are applied by the world.
  const INCIDENTS = [
    { id: 'goose', text: 'A goose has occupied the Town Hall. Negotiations are ongoing.', mood: 0.2, tension: -2, where: 'townhall', weight: 3 },
    { id: 'rain', text: 'It rains all day. Everyone is slightly damp and philosophical.', mood: -0.1, tension: -3, weight: 4 },
    { id: 'match_win', text: 'Pebbleton FC wins! The Arena erupts. The Nightmarket runs out of noodles.', mood: 0.5, tension: -2, interest: 'sports', weight: 3 },
    { id: 'match_loss', text: 'Pebbleton FC loses 0-4. The referee is blamed, then the mayor, then the weather.', mood: -0.5, tension: 4, interest: 'sports', weight: 3 },
    { id: 'blackout', text: 'A blackout hits the city. Candles are lit. Someone plays an accordion.', mood: 0, tension: 3, weight: 2 },
    { id: 'fire', text: 'A small fire at Warehouse 9 destroys forty crates of pickled herring.', mood: -0.2, tension: 5, where: 'warehouse', blameable: true, weight: 2 },
    { id: 'lottery', text: '{A} wins the city lottery and immediately becomes insufferable.', mood: 0, tension: 2, targetEffect: 'rich', weight: 2 },
    { id: 'statue', text: 'The statue of St. Pebble has been dressed in a football kit overnight.', mood: 0.2, tension: 4, blameable: true, weight: 2 },
    { id: 'mascot', text: 'The Arena mascot costume has gone missing. Suspicion falls on everyone.', mood: 0, tension: 3, blameable: true, weight: 2 },
    { id: 'heatwave', text: 'A heatwave. The bars are packed and tempers are short.', mood: -0.1, tension: 4, weight: 3 },
    { id: 'harvest', text: 'The Community Garden produces a courgette the size of a canoe. There is a parade.', mood: 0.3, tension: -3, weight: 2 },
    { id: 'stranger', text: 'A stranger arrives on the morning ferry with strong opinions and a pamphlet.', mood: 0, tension: 3, spawn: true, weight: 2 },
    { id: 'gazette', text: 'The Gazette publishes an exposé titled "WHO REALLY RUNS PEBBLETON?" It is mostly about geese.', mood: 0, tension: 2, weight: 2 },
    { id: 'pothole', text: 'A pothole on Commons Terraces achieves sentience, or at least a nickname.', mood: 0.1, tension: 1, weight: 2 },
    { id: 'meteor', text: 'A small meteorite lands in Dandelion Park. Three groups claim it as a sign.', mood: 0.1, tension: 5, weight: 1 },
    { id: 'cat', text: 'A cat named Chairman is elected honorary mayor of the Fish Market.', mood: 0.3, tension: -2, weight: 2 },
    { id: 'tax_letter', text: 'Everyone receives a confusing letter from the Town Hall about bins.', mood: -0.2, tension: 3, weight: 3 },
    { id: 'concert', text: 'A surprise concert at the Neon Goat goes on until 5am. Uptown files a complaint.', mood: 0.3, tension: 3, weight: 2 },
  ];

  const CHAT_TOPICS = ['the weather', 'the price of noodles', 'the mayor', 'the match', 'a dream they had', 'whether pigeons have feelings', 'the old days', 'the new bus route', 'bins', 'the meaning of it all', 'their landlord', 'a recipe', 'who left the gate open', 'the moon', 'tax'];

  const JOKES = ['a joke about a goose and a lawyer', 'an impression of the mayor', 'a pun so bad it loops back to good', 'a story about a courgette', 'a bit about how the Temple bell sounds like a burp', 'the one about three philosophers in a rowboat', 'a joke that\'s mostly just the word "bins"'];

  const ARGUMENT_STARTERS = ['who should really be running things', 'whether the old ways were better', 'whether the Temple bell is too loud', 'the docks', 'taxes', 'the definition of "a fair share"', 'the offside rule', 'whether the city is going to the dogs', 'whether the dogs would do a better job'];

  const MOODS = [
    [-1, 'despairing'], [-0.7, 'miserable'], [-0.45, 'grumpy'], [-0.2, 'uneasy'], [0.1, 'fine'], [0.35, 'cheerful'], [0.6, 'delighted'], [0.85, 'euphoric'],
  ];

  return { FIRST, LAST, DISTRICTS, JOBS, AXES, INTERESTS, NICKNAMES, GROUP_NAMES, POLICIES, RUMOURS, INCIDENTS, CHAT_TOPICS, JOKES, ARGUMENT_STARTERS, MOODS };
})();
