'use client';

import { useState, useEffect, useCallback } from 'react';
import { playSound } from '@/lib/audio';

interface WordleGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

// 300 answer words - common, well-known 5-letter words
const ANSWERS_5 = [
  'ABOUT','ABOVE','AFTER','AGAIN','AGREE','AHEAD','ALARM','ALLOW','ALONE','ALONG',
  'AMONG','ANGEL','ANGER','ANGLE','ANGRY','ANIME','APART','APPLE','ARENA','ARGUE',
  'ARISE','ASIDE','AVOID','AWAKE','AWARD','AWARE','BASIC','BEACH','BEGIN','BEING',
  'BELOW','BENCH','BLACK','BLADE','BLAME','BLANK','BLAST','BLAZE','BLEED','BLEND',
  'BLIND','BLOCK','BLOOM','BLOWN','BOARD','BONUS','BOOST','BOUND','BRAIN','BRAND',
  'BRAVE','BREAD','BREAK','BREED','BRIEF','BRING','BROAD','BROKE','BROWN','BRUSH',
  'BUILD','BUILT','BUNCH','BURST','BUYER','CABIN','CANDY','CARRY','CATCH','CAUSE',
  'CHAIN','CHAIR','CHEAP','CHECK','CHEER','CHESS','CHEST','CHIEF','CHILD','CHINA',
  'CLAIM','CLASS','CLEAN','CLEAR','CLICK','CLIMB','CLOCK','CLOSE','CLOTH','CLOUD',
  'COACH','COAST','COLOR','CORAL','COULD','COUNT','COURT','COVER','CRACK','CRAFT',
  'CRANE','CRASH','CRAZY','CREAM','CRIME','CROSS','CROWD','CROWN','CRUSH','CURVE',
  'CYCLE','DAILY','DANCE','DEATH','DEBUT','DELAY','DEPTH','DEVIL','DIRTY','DOUBT',
  'DOUGH','DRAFT','DRAIN','DRAMA','DRANK','DRAWN','DREAM','DRESS','DRIED','DRIFT',
  'DRINK','DRIVE','DROPS','DROVE','DRUNK','DYING','EAGER','EARLY','EARTH','EIGHT',
  'ELECT','ELITE','EMPTY','ENEMY','ENJOY','ENTER','EQUAL','ERROR','EVENT','EVERY',
  'EXACT','EXIST','EXTRA','FAINT','FAITH','FALSE','FANCY','FATAL','FAULT','FEAST',
  'FENCE','FEVER','FIELD','FIGHT','FINAL','FIRST','FIXED','FLAME','FLASH','FLEET',
  'FLESH','FLIES','FLOAT','FLOCK','FLOOD','FLOOR','FLOUR','FLUID','FLUSH','FOCUS',
  'FORCE','FORGE','FORTH','FOUND','FRAME','FRESH','FRONT','FROST','FROZE','FRUIT',
  'FULLY','FUNNY','GHOST','GIANT','GIVEN','GLASS','GLOBE','GLOVE','GOING','GRACE',
  'GRADE','GRAIN','GRAND','GRANT','GRAPE','GRAPH','GRASP','GRASS','GRAVE','GREAT',
  'GREEN','GREED','GRIND','GROUP','GROWN','GUARD','GUESS','GUEST','GUIDE','GUILT',
  'HAPPY','HARSH','HAVEN','HEART','HEAVY','HELLO','HOBBY','HONOR','HORSE','HOTEL',
  'HOUSE','HUMAN','HUMOR','HURRY','IDEAL','IMAGE','INDEX','INNER','INPUT','IVORY',
  'JEWEL','JOINT','JUDGE','JUICE','KNOWN','LABEL','LABOR','LARGE','LASER','LATER',
  'LAUGH','LAYER','LEARN','LEASE','LEAVE','LEGAL','LEMON','LEVEL','LIGHT','LIMIT',
  'LIVER','LOCAL','LOGIC','LOOSE','LOVER','LOWER','LOYAL','LUCKY','LUNCH','MAGIC',
  'MAJOR','MAKER','MANGE','MANOR','MARCH','MATCH','MAYOR','MEDIA','MERCY','METAL',
  'MIGHT','MINOR','MINUS','MODEL','MONEY','MONTH','MORAL','MOTOR','MOUNT','MOUSE',
  'MOUTH','MOVIE','MUSIC','NASTY','NERVE','NEVER','NIGHT','NOBLE','NOISE','NORTH',
  'NOTED','NOVEL','NURSE','OCCUR','OCEAN','OFFER','OFTEN','OLIVE','ORDER','OTHER',
  'OUGHT','OUTER','OWNER','PAINT','PANEL','PAPER','PARTY','PASTA','PATCH','PAUSE',
  'PEACE','PEARL','PHASE','PHONE','PHOTO','PIANO','PIECE','PILOT','PITCH','PIXEL',
  'PIZZA','PLACE','PLAIN','PLANE','PLANT','PLATE','PLAZA','PLEAD','PLUMB','POINT',
  'POLAR','POUND','POWER','PRESS','PRICE','PRIDE','PRIME','PRINT','PRIOR','PRIZE',
  'PROOF','PROUD','PROVE','PUPIL','QUEEN','QUEST','QUEUE','QUICK','QUIET','QUITE',
  'QUOTA','QUOTE','RADAR','RADIO','RAISE','RALLY','RANCH','RANGE','RAPID','REACH',
  'REACT','READY','REALM','REBEL','REIGN','RELAX','RIDER','RIDGE','RIGHT','RIGID',
  'RISEN','RIVAL','RIVER','ROBIN','ROBOT','ROCKY','ROGER','ROMAN','ROUGE','ROUGH',
  'ROUND','ROUTE','ROYAL','RUGBY','RURAL','SAINT','SALAD','SAUCE','SCALE','SCARE',
  'SCENE','SCOPE','SCORE','SENSE','SERVE','SEVEN','SHALL','SHAME','SHAPE','SHARE',
  'SHARP','SHEET','SHELF','SHELL','SHIFT','SHINE','SHIRT','SHOCK','SHOOT','SHORT',
  'SHOUT','SIGHT','SILLY','SINCE','SIXTH','SIXTY','SIZED','SKILL','SKULL','SLASH',
  'SLAVE','SLEEP','SLICE','SLIDE','SMALL','SMART','SMELL','SMILE','SMOKE','SNAKE',
  'SOLAR','SOLID','SOLVE','SORRY','SOUND','SOUTH','SPACE','SPARE','SPARK','SPEAK',
  'SPEED','SPEND','SPENT','SPICE','SPINE','SPLIT','SPOKE','SPOON','SPORT','SQUAD',
  'STAFF','STAGE','STAIN','STAKE','STALE','STAND','STARE','START','STATE','STEAK',
  'STEAL','STEAM','STEEL','STEEP','STEER','STICK','STILL','STOCK','STONE','STOOD',
  'STORM','STORY','STOVE','STRIP','STUCK','STUDY','STUFF','STYLE','SUGAR','SUITE',
  'SUNNY','SUPER','SWAMP','SWEAR','SWEAT','SWEEP','SWEET','SWEPT','SWIFT','SWING',
  'SWORD','SWORE','SWORN','TABLE','TASTE','TEACH','TEETH','THANK','THEME','THERE',
  'THICK','THIEF','THING','THINK','THIRD','THOSE','THREE','THREW','THROW','THUMB',
  'TIGHT','TIMER','TIRED','TITLE','TODAY','TOKEN','TOTAL','TOUCH','TOUGH','TOWER',
  'TOXIC','TRACE','TRACK','TRADE','TRAIL','TRAIN','TRAIT','TRASH','TREAT','TREND',
  'TRIAL','TRIBE','TRICK','TRIED','TRUCK','TRULY','TRUMP','TRUNK','TRUST','TRUTH',
  'TWICE','TWIST','ULTRA','UNCLE','UNDER','UNION','UNITE','UNITY','UNTIL','UPPER',
  'UPSET','URBAN','USUAL','VALID','VALUE','VIDEO','VIGOR','VIRAL','VIRUS','VISIT',
  'VITAL','VIVID','VOCAL','VOICE','VOTER','WAGON','WASTE','WATCH','WATER','WEIGH',
  'WEIRD','WHALE','WHEAT','WHEEL','WHERE','WHICH','WHILE','WHINE','WHITE','WHOLE',
  'WHOSE','WOMAN','WORLD','WORRY','WORSE','WORST','WORTH','WOULD','WOUND','WRIST',
  'WRITE','WRONG','WROTE','YIELD','YOUNG','YOUTH',
];

// 2000+ valid guess words (includes answers + more)
const VALID_GUESSES_5 = new Set([
  ...ANSWERS_5,
  'ABBOT','ABIDE','ABORT','ABUSE','ABYSS','ACIDS','ACORN','ACRES','ACTED','ACTOR',
  'ACUTE','ADAPT','ADDED','ADEPT','ADMIN','ADMIT','ADOBE','ADOPT','ADULT','AEGIS',
  'AGENT','AGING','AGONY','AIMED','AISLE','ALBUM','ALDER','ALERT','ALGAE','ALIBI',
  'ALIEN','ALIGN','ALIKE','ALIVE','ALLAY','ALLEY','ALLOT','ALTER','AMBER','AMEND',
  'AMPLE','AMUSE','ANKLE','ANNEX','ANVIL','AORTA','APNEA','APPLY','APTLY','ARBOR',
  'ARISE','ARMOR','AROMA','ARRAY','ARROW','ARSON','ASSET','ATTIC','AUDIO','AUDIT',
  'AUGUR','AUNTS','AURAL','AVERT','AVIAN','AVION','AXIOM','BABEL','BADGE','BADLY',
  'BAGEL','BAKER','BALLS','BANDS','BANJO','BANKS','BARON','BASIN','BASIS','BATCH',
  'BATON','BEADS','BEAMS','BEANS','BEARD','BEARS','BEAST','BEARS','BEECH','BEGUN',
  'BELLS','BELLY','BERRY','BESET','BIKES','BILLS','BINGE','BIRCH','BIRDS','BIRTH',
  'BISON','BITTY','BLADE','BLARE','BLISS','BLITZ','BLOAT','BLOGS','BLOOD','BLOSS',
  'BLOTS','BLUES','BLUFF','BLUNT','BLURS','BLURT','BOATS','BOGUS','BOLTS','BOMBS',
  'BONDS','BONES','BOOKS','BOOTS','BOSSY','BOTCH','BOUND','BOUGH','BOWEL',
  'BOWLS','BOXER','BRACE','BRAID','BRAKE','BRASS','BRAVO','BRAWL','BRAZE','BRICK',
  'BRIDE','BRINK','BRINY','BRISK','BROOD','BROOK','BROTH','BRUSH','BRUTE','BUDDY',
  'BUDGE','BUGGY','BUGLE','BULGE','BULKY','BULLY','BUMPS','BUNNY','BURNS','BURRO',
  'BUSES','BUYER','BYLAW','BYTES','CABAL','CABLE','CADET','CALLS','CAMEL','CAMEO',
  'CAMPS','CANAL','CANES','CANOE','CANON','CAPER','CARDS','CARGO','CAROL','CASES',
  'CASTE','CEDAR','CELLS','CHARM','CHARS','CHART','CHASE','CHEAP','CHEAT','CHEEK',
  'CHEFS','CHESS','CHICK','CHILI','CHIME','CHIPS','CHOIR','CHORD','CHOSE','CHUNK',
  'CHURN','CIDER','CIGAR','CINCH','CIRCA','CITED','CITES','CIVIC','CIVIL','CLACK',
  'CLADS','CLAMP','CLAMS','CLANG','CLANK','CLANS','CLASH','CLASP','CLAWS','CLERK',
  'CLIFF','CLING','CLIPS','CLOAK','CLONE','CLUBS','CLUCK','CLUED','CLUES','CLUMP',
  'CLUNG','COALS','COATS','COBRA','COILS','COINS','COMET','COMIC','COMBO','COMMA',
  'CONDO','CONES','COOPS','COPED','CORAL','CORDS','CORES','CORPS','COSTS','COUCH',
  'COUGH','COUPE','COUPS','COVET','CRACK','CRANE','CRAMP','CRASH','CRATE',
  'CRAVE','CRAWL','CREAK','CREWS','CRISP','CROPS','CRUEL','CRUMB','CRUST','CUBIC',
  'CURLS','CURRY','DARES','DATED','DATES','DAWNS','DEALS','DEALT','DEANS','DEBIT',
  'DECAL','DECAY','DECKS','DECOR','DECOY','DECRY','DEEDS','DEITY','DELTA','DELVE',
  'DEMON','DENIM','DENSE','DEPOT','DERBY','DEUCE','DIARY','DICED','DIGIT','DIMLY',
  'DINER','DISKS','DITCH','DITTO','DIZZY','DODGE','DOING','DOLLS','DONOR','DOORS',
  'DOSES','DOTES','DOWDY','DOWNS','DRAGS','DRAPE','DRAWS','DREAD','DROOL','DROOP',
  'DRYER','DRYLY','DUCTS','DUDES','DULLS','DUMMY','DUMPS','DUNCE','DUNES','DUSKY',
  'DUSTY','DWARF','DWELL','DWELT','EAGER','EASEL','EATEN','EATER','EAVES','EBBED',
  'EBONY','EDGED','EDGES','EDICT','EERIE','EIGHT','ELBOW','ELDER','ELFIN','EMBER',
  'EMERY','EMITS','EMOJI','ENDOW','ENDED','ENNUI','ENVOY','EPOCH','EQUIP','ERASE',
  'ERODE','ESSAY','ETHER','ETHIC','EUROS','EVADE','EVILS','EVOKE','EXALT','EXAMS',
  'EXCEL','EXERT','EXILE','EXPAT','EXPEL','EXUDE','EYING','FABLE','FACED','FACES',
  'FACET','FACTS','FAILS','FAIRY','FALLS','FAMED','FANCY','FANGS','FARMS','FARCE',
  'FATAL','FAUNA','FAVOR','FEAST','FEATS','FEEDS','FEIGN','FEELS','FELON','FEMUR',
  'FERAL','FERRY','FETCH','FETID','FETUS','FEWER','FIBRE','FIERY','FIFTH','FIFTY',
  'FILTH','FINCH','FINDS','FINED','FINER','FIRES','FIRMS','FISTS','FIZZY','FLACK',
  'FLAGS','FLAIR','FLAKE','FLAKY','FLANK','FLAPS','FLARE','FLASH','FLASK','FLATS',
  'FLAWS','FLEAS','FLECK','FLESH','FLICK','FLIER','FLING','FLINT','FLIPS','FLIRT',
  'FLITS','FLORA','FLOWS','FLOWN','FLUFF','FLUKE','FLUNG','FLUNK','FLUTE','FOAMS',
  'FOCAL','FOGGY','FOLDS','FOLIO','FOLKS','FONTS','FOODS','FOOLS','FORAY','FORGE',
  'FORGO','FORKS','FORMS','FORTE','FORTY','FORUM','FOULS','FOWLS','FOXES','FOYER',
  'FRAIL','FRANK','FRAUD','FRAYS','FREED','FREER','FREES','FREUD','FRIAR',
  'FRIED','FRILL','FRISK','FRITZ','FRIZZ','FROCK','FROGS','FROZE','FUDGE',
  'FUELS','FUGAL','FUNGI','FUNKY','FURRY','FUSSY','FUZZY','GAILY','GAINS','GAITS',
  'GALES','GAMMA','GANGS','GAPED','GASES','GAUGE','GAUNT','GAUZE','GAVEL','GAWKY',
  'GEARS','GEESE','GENIE','GENRE','GENUS','GETUP','GIDDY','GIFTS','GILLS','GIVEN',
  'GIVER','GIVES','GLAND','GLARE','GLEAM','GLEAN','GLIDE','GLINT','GLITZ','GLOAT',
  'GLOOM','GLORY','GLOSS','GLUED','GLUES','GNOME','GOATS','GODLY','GOING','GOLLY',
  'GOODS','GOODY','GOOSE','GORGE','GOTTA','GOUGE','GOURD','GOWNS','GRABS','GRAFT',
  'GRAIL','GRAMS','GRATE','GRAVY','GRAYS','GRAZE','GREEK','GREET','GRIEF','GRILL',
  'GRIME','GRIMY','GRIPE','GRIPS','GRIST','GRITS','GROAN','GROIN','GROOM','GROPE',
  'GROSS','GROVE','GROWL','GROWS','GRUEL','GRUFF','GRUNT','GUIDE','GUILD','GUISE',
  'GULCH','GULLS','GULPS','GUMMY','GURUS','GUSTS','GUSTY','GYPSY','HABIT','HAIRY',
  'HALLS','HALTS','HALVE','HANDS','HANDY','HANGS','HASTE','HASTY','HATCH','HATED',
  'HATER','HATES','HAUNT','HAWKS','HAZEL','HEADS','HEALS','HEAPS','HEARD','HEAVE',
  'HEDGE','HEELS','HEFTY','HEIRS','HELIX','HELPS','HENCE','HERBS','HERDS','HERON',
  'HINGE','HINTS','HIRED','HITCH','HIVES','HOARD','HOARY','HOLDS','HOLES','HOLLY',
  'HOMES','HONED','HONEY','HOODS','HOOKS','HOPED','HOPES','HORDE','HORNS','HOSTS',
  'HOUND','HOURS','HOWLS','HUFFY','HULKS','HUNKS','HUNTS','HURTS','HUSKS','HYENA',
  'HYMNS','ICING','IMAGE','IMAGO','IMMUN','IMPEL','IMPLY','INCUR','INDIE','INEPT',
  'INERT','INFER','INGOT','INKED','INLAY','INLET','INSET','INTER','INTRO','IONIC',
  'IRATE','IRONY','ISSUE','ITEMS','IVORY','JACKS','JADED','JAILS','JAMBS','JAPAN',
  'JAUNT','JEANS','JELLY','JERKS','JERKY','JIFFY','JOINS','JOKER','JOKES','JOLLY',
  'JOLTS','JOUST','JUICY','JUMBO','JUMPS','JUMPY','JUROR','KARMA','KAYAK','KEELS',
  'KEEPS','KEYED','KICKS','KILLS','KINDS','KINGS','KIOSK','KITES','KNACK','KNEAD',
  'KNEED','KNEEL','KNEES','KNELT','KNIFE','KNOCK','KNOLL','KNOTS','LACED','LACES',
  'LADEN','LADLE','LAGER','LAKES','LAMBS','LAMPS','LANCE','LANDS','LANES','LAPSE',
  'LARVA','LASER','LATCH','LATEX','LATHE','LATIN','LAUDS','LAWNS','LEADS','LEAFY',
  'LEAKS','LEAKY','LEANS','LEAPS','LEAPT','LEDGE','LEFTS','LEGAL','LEMMA','LENDS',
  'LEPER','LEVER','LIENS','LIFTS','LIKED','LIKEN','LIKES','LILAC','LIMBO','LIMBS',
  'LIMED','LIMES','LINED','LINEN','LINER','LINES','LINGO','LINKS','LIONS','LISTS',
  'LITER','LITRE','LIVED','LIVEN','LIVES','LIVID','LLAMA','LOADS','LOAFS','LOAMS',
  'LOANS','LOBBY','LOBES','LOCKS','LOCUS','LODGE','LOFTS','LOFTY','LOGIC','LOGOS',
  'LONER','LOOKS','LOOPS','LOPED','LORDS','LORRY','LOTUS','LOUSY',
  'LOVED','LUCID','LUMPS','LUMPY','LUNAR','LUNCH','LUNGE','LUNGS','LURED','LURES',
  'LURKS','LYING','LYNCH','LYRIC','MACHO','MACRO','MADAM','MAGIC','MAGMA','MAIDS',
  'MAILS','MAIZE','MALES','MALLS','MANGA','MANGO','MANIA','MANIC','MAPLE','MASKS',
  'MASON','MATES','MAXIM','MAYOR','MAZES','MEALY','MEANS','MEANT','MEATS','MEDAL',
  'MELEE','MELON','MELTS','MEMOS','MENDS','MENUS','MERGE','MERIT','MERRY','MESSY',
  'METER','METRE','MICRO','MIDST','MILLS','MIMIC','MINCE','MINDS','MINED','MINER',
  'MINES','MINTS','MINUS','MIRTH','MISER','MISTY','MITES','MIXED','MIXER','MOANS',
  'MOATS','MOCKS','MOIST','MOLAR','MOLDS','MOLDY','MOLTS','MONKS','MOODS','MOODY',
  'MOONS','MOOSE','MORAL','MORPH','MOSSY','MOTEL','MOTHS','MOTIF','MOTTO','MOUND',
  'MOURN','MOVES','MOVIE','MOWED','MOWER','MUCUS','MUDDY','MULES','MULTI','MUMPS',
  'MURAL','MURKY','MUSED','MUSES','MUSHY','MUTED','MUTES','MYTHS','NADIR','NAIVE',
  'NAMED','NAMES','NANNY','NASAL','NATAL','NAVAL','NAVEL','NECKS','NERDS','NERDY',
  'NESTS','NEWER','NEWLY','NEXUS','NICER','NICHE','NIFTY','NIMBY','NINJA','NINES',
  'NINTH','NODAL','NODES','NOISY','NOMAD','NORMS','NOTCH','NOTED','NOTES','NOUNS',
  'NUDGE','NULLS','NURGE','OAKEN','OASIS','OATHS','OBESE','OBEYS','OCCUR','OCEAN',
  'ODDLY','ODORS','OFFAL','OKAPI','OLDER','OLIVE','OMEGA','ONSET','OPERA','OPTED',
  'OPTIC','ORBIT','ORGAN','OTTER','OUNCE','OVALS','OVENS','OVERT','OWNED','OXIDE',
  'OZONE','PACED','PACES','PACKS','PADDY','PAGAN','PAGED','PAGES','PAILS','PAINS',
  'PAIRS','PALMS','PALSY','PANDA','PANES','PANGS','PANIC','PANTS','PAPAL','PARKS',
  'PARSE','PARTS','PASTY','PATHS','PATIO','PAUSE','PAVED','PAVES','PAWED','PAWNS',
  'PEACH','PEAKS','PEARS','PECAN','PEDAL','PEELS','PEERS','PENAL','PENCE','PENNY',
  'PERCH','PERIL','PERKS','PERKY','PESTO','PETAL','PETTY','PICKS','PICKY','PIERS',
  'PIGGY','PILES','PILLS','PILOT','PIMPS','PINTS','PIOUS','PIPES','PIPED',
  'PIVOT','PIXEL','PLAID','PLANK','PLANS','PLEAS','PLIED','PLIER','PLODS','PLOTS',
  'PLOWS','PLUCK','PLUGS','PLUMS','PLUMP','PLUMS','PLUNK','PLUSH','PLUTO','POACH',
  'POISE','POKED','POKER','POKES','POLES','POLLS','POLYP','PONDS','POOLS','PORES',
  'POSED','POSER','POSES','POSTS','POUCH','POULT','POURS','POUTS','PRAWN',
  'PRAYS','PREYS','PRICK','PRIED','PRIES','PRIMP','PRISM','PRIVY','PROBE',
  'PRODS','PRONG','PRONE','PRONG','PROPS','PROSE','PROWL','PRUDE','PRUNE','PSALM',
  'PUBIC','PUFFS','PUFFY','PULLS','PULPS','PULPY','PULSE','PUMPS','PUNCH','PUNKS',
  'PUNNY','PUPPY','PUREE','PURGE','PURRS','PURSE','PUSHY','PUTTS','PYGMY','PYLON',
  'QUACK','QUAFF','QUAIL','QUALM','QUART','QUASI','QUAYS','QUERY','QUITS','QUOTA',
  'RABBI','RABID','RACED','RACER','RACES','RACKS','RAFTS','RAGED','RAGES','RAIDS',
  'RAILS','RAINS','RAINY','RALLY','RAMPS','RANCH','RANKS','RANTS','RATED','RATES',
  'RATIO','RAVEN','RAYON','RAZOR','READS','REAMS','REAPS','REARS','REBUS','RECAP',
  'RECON','RECTO','REEDS','REEFS','REEKS','REFIT','REGAL','REHAB','REINS','RENAL',
  'RENEW','REPAY','REPEL','REPLY','RERUN','RESET','RESIN','RESTS','RETRY','REUSE',
  'REVEL','REVUE','RHINO','RHYME','RIDES','RIFLE','RIFTS','RIGID','RIGOR','RINDS',
  'RINGS','RINSE','RIOTS','RIPEN','RISKS','RISKY','RITES','RITZY','ROADS','ROAMS',
  'ROARS','ROAST','ROBES','ROCKS','ROCKY','RODEO','ROGUE','ROLES','ROLLS','ROMAN',
  'ROMPS','ROOFS','ROOMS','ROOMY','ROOTS','ROPED','ROPES','ROSES','ROTOR','ROUGE',
  'ROUTE','ROVER','ROWDY','ROYAL','RUINS','RULED','RULER','RULES','RUMBA','RUMOR',
  'RUNGS','RURAL','RUSTY','SACKS','SADLY','SAFES','SAFER','SAILS','SALTY','SALVE',
  'SAMBA','SANDS','SANDY','SATIN','SAUNA','SAVED','SAVER','SAVES','SAVOR',
  'SAVVY','SCALD','SCALY','SCAMS','SCANS','SCANT','SCARY','SCENT','SCOFF','SCOLD',
  'SCONE','SCOOP','SCOPE','SCORN','SCOTS','SCOUT','SCOWL','SCRAM','SCRAP','SCREW',
  'SCRUB','SEALS','SEAMS','SEATS','SEEDS','SEIZE','SELLS','SEMIS','SENDS','SERIF',
  'SERUM','SETUP','SEVER','SEWER','SHADE','SHADY','SHAFT','SHAKY','SHALE','SHANK',
  'SHAVE','SHAWL','SHEDS','SHEEN','SHEER','SHORE','SHOWN','SHOWS','SHRUB','SHRUG',
  'SHUTS','SIDED','SIDES','SIEGE','SIEVE','SIGHS','SIGNS','SILKS','SILKY','SILLS',
  'SILTS','SIREN','SITES','SIXTH','SIZED','SIZES','SKATE','SKIDS','SKILL','SKIMP',
  'SKINS','SKIPS','SKIRT','SKULL','SLABS','SLACK','SLAIN','SLANG','SLANT','SLAPS',
  'SLASH','SLATE','SLAIN','SLAYS','SLEDS','SLEEK','SLEET','SLEPT','SLICK','SLIME',
  'SLIMY','SLING','SLINK','SLIPS','SLITS','SLOPE','SLOTS','SLOTH','SLUGS','SLUMP',
  'SLUMS','SLUNG','SLUNK','SLURP','SMACK','SMELL','SMELT','SMITH','SMOCK','SMOGS',
  'SNACK','SNAGS','SNAIL','SNARE','SNARL','SNEAK','SNEER','SNIFF','SNORE','SNOUT',
  'SNOWY','SNUBS','SNUCK','SNUFF','SOAPS','SOAPY','SOARS','SOBER','SOCKS','SOFAS',
  'SOFTY','SOILS','SONAR','SONGS','SONIC','SORTS','SOULS','SOURS','SOUTH',
  'SOWED','SOWER','SPANS','SPARE','SPARS','SPAWN','SPEAR','SPECS','SPELL','SPELT',
  'SPICY','SPIED','SPIEL','SPIES','SPIKE','SPILL','SPINS','SPINY','SPIRE','SPITE',
  'SPLAT','SPOKE','SPOOF','SPOOK','SPOOL','SPORE','SPOTS','SPOUT','SPRAY','SPREE',
  'SPRIG','SPRIT','SPUDS','SPUNK','SPURN','SPURS','SQUAB','SQUAT','SQUID',
  'STABS','STACK','STAGS','STAID','STALL','STAMP','STANK','STAPH','STARE',
  'STARK','STARS','STAYS','STEAD','STEMS','STEPS','STERN','STEWS','STICK','STIFF',
  'STING','STINK','STINT','STIRS','STOIC','STOKE','STOLE','STOMP','STOOD','STOOL',
  'STOOP','STOPS','STORE','STORK','STOUT','STRAP','STRAW','STRAY','STRUT','STUBS',
  'STUDS','STUMP','STUNG','STUNK','STUNT','STYLE','SUING','SULKS','SULKY','SUMAC',
  'SUMMA','SUMPS','SUNNY','SURGE','SURLY','SWABS','SWAMP','SWANS','SWAPS','SWARM',
  'SWAYS','SWEET','SWELL','SWELT','SWIMS','SWINE','SWIPE','SWIRL','SWOON','SWOOP',
  'SYRUP','TABBY','TACKS','TACKY','TAFFY','TAILS','TAKEN','TAKER','TAKES','TALES',
  'TALKS','TALLY','TALON','TAMED','TAMER','TAMES','TANGO','TANKS','TAPER','TAPES',
  'TARDY','TASKS','TAUNT','TAXES','TAXED','TEARS','TEASE','TEDDY','TEENS','TEMPO',
  'TENDS','TENOR','TENSE','TENTH','TENTS','TEPID','TERMS','TERNS','TERRA','TESTS',
  'TEXTS','THANE','THAWS','THEFT','THEIR','THESE','THIGH','THORN','THOSE','THUMB',
  'THUMP','TIDAL','TIERS','TIGER','TILES','TILTS','TIMID','TINGE','TIPPY','TIPSY',
  'TOAST','TODDY','TOKEN','TOLLS','TOMBS','TONED','TONER','TONES','TONGS','TONIC',
  'TOOLS','TOOTH','TOPIC','TOPAZ','TORCH','TORSO','TOTAL','TOTEM','TOURS','TOWED',
  'TOWEL','TOWNS','TRACE','TRACT','TRAIT','TRAMP','TRANS','TRAPS','TRAWL','TRAYS',
  'TREAT','TREES','TREKS','TRESS','TRIAD','TRICE','TRIED','TRIGS','TRIMS',
  'TRIOS','TRIPS','TRITE','TROLL','TROOP','TROTS','TROUT','TRUCE','TRULY','TUBED',
  'TUBES','TUCKS','TULIP','TUMOR','TUNED','TUNER','TUNES','TURBO','TURFS','TURNS',
  'TUTOR','TWANG','TWEED','TWEET','TWIGS','TWILL','TWINE','TWINS','TWIRL','TYPED',
  'TYPES','ULCER','UNCUT','UNDID','UNDUE','UNFED','UNFIT','UNIFY','UNITE','UNITS',
  'UNITY','UNLIT','UNMET','UNTIE','UNWED','URGED','URGES','USAGE','USHER','USING',
  'UTTER','VAGUE','VALET','VALOR','VALVE','VAULT','VEERS','VEILS','VEINS','VENOM',
  'VENUE','VERBS','VERGE','VERSE','VEXED','VIBES','VICAR','VIDEO','VIEWS','VIGOR',
  'VILLA','VINES','VINYL','VIOLA','VIPER','VISOR','VISTA','VIVID','VOGUE','VOILA',
  'VOLTS','VOTED','VOTER','VOTES','VOUCH','VOWED','VOWEL','VYING','WADED','WADER',
  'WADES','WAFER','WAGED','WAGER','WAGES','WAGON','WAIFS','WAILS','WAIST','WAITS',
  'WAKED','WAKEN','WAKES','WALKS','WALLS','WALTZ','WANDS','WANES','WARDS','WARES',
  'WARNS','WARPS','WARTY','WATTS','WAVED','WAVER','WAVES','WAXED','WAXES','WEARY',
  'WEAVE','WEDGE','WEEDS','WEEDY','WEEKS','WELLS','WENCH','WHEAT','WHICH','WHIFF',
  'WHIMS','WHINE','WHINY','WHIPS','WHIRL','WHISK','WHITE','WICKS','WIDEN','WIDER',
  'WIDOW','WIDTH','WIELD','WIMPY','WINCE','WINCH','WINDS','WINDY','WINES','WINGS',
  'WINKS','WIPED','WIPER','WIPES','WIRED','WIRES','WISPS','WISPY','WITCH','WIVES',
  'WOKEN','WOLFS','WOMAN','WOMEN','WOODS','WOODY','WORDS','WORDY','WORKS','WORMS',
  'WORMY','WORRY','WRACK','WRAPS','WRATH','WREAK','WRECK','WRENS','WRING','WRIST',
  'WRITS','WRONG','YACHT','YARDS','YARNS','YAWNS','YEARN','YEARS','YEAST','YELLS',
  'YIELD','YODEL','YOURS','ZEBRA','ZEROS','ZESTY','ZILCH','ZIPPY','ZONAL','ZONES',
]);

// 200 answer words - common 4-letter words (for easy mode)
const ANSWERS_4 = [
  'ABLE','ACHE','AGED','ALSO','ARCH','AREA','ARMY','AWAY','BACK','BAKE',
  'BALL','BAND','BANK','BARE','BARN','BASE','BATH','BEAD','BEAM','BEAN',
  'BEAR','BEAT','BEEN','BEER','BELL','BELT','BEND','BEST','BIKE','BILL',
  'BIND','BIRD','BITE','BLOW','BLUE','BLUR','BOAT','BODY','BOLD','BOLT',
  'BOMB','BOND','BONE','BOOK','BOOM','BOOT','BORE','BORN','BOSS','BOTH',
  'BOWL','BULK','BUMP','BURN','BURY','BUSY','CAFE','CAGE','CAKE','CALL',
  'CALM','CAME','CAMP','CAPE','CARD','CARE','CART','CASE','CASH','CAST',
  'CAVE','CHAR','CHEF','CHIN','CHIP','CHOP','CITY','CLAP','CLAW','CLAY',
  'CLIP','CLUB','CLUE','COAL','COAT','CODE','COIL','COIN','COLD','COME',
  'COOK','COOL','COPE','COPY','CORD','CORE','CORN','COST','COZY','CREW',
  'CROP','CROW','CUBE','CURE','CURL','CUTE','DALE','DARE','DARK','DASH',
  'DATA','DATE','DAWN','DEAD','DEAF','DEAL','DEAR','DEBT','DECK','DEED',
  'DEEM','DEEP','DEER','DIET','DINE','DIRT','DISH','DOCK','DOES','DOME',
  'DONE','DOOM','DOOR','DOSE','DOWN','DRAG','DRAW','DREW','DROP','DRUM',
  'DUAL','DULL','DUMB','DUMP','DUST','DUTY','EACH','EARN','EASE','EAST',
  'EASY','EDGE','EDIT','ELSE','EMIT','EPIC','EVEN','EVER','EVIL','EXAM',
  'FACE','FACT','FADE','FAIL','FAIR','FAKE','FALL','FAME','FARM','FAST',
  'FATE','FEAR','FEAT','FEED','FEEL','FELL','FELT','FILE','FILL','FILM',
  'FIND','FINE','FIRE','FIRM','FISH','FIST','FLAG','FLAT','FLED','FLEW',
  'FLIP','FLOW','FOAM','FOLD','FOLK','FOND','FOOD','FOOL','FOOT','FORD',
  'FORE','FORK','FORM','FORT','FOUL','FOUR','FREE','FROM','FUEL','FULL',
  'FUND','FURY','FUSE','GAIN','GAME','GANG','GATE','GAVE','GEAR','GIFT',
  'GIRL','GIVE','GLAD','GLOW','GLUE','GOAL','GOAT','GOES','GOLD','GOLF',
  'GONE','GOOD','GRAB','GRAY','GREW','GRID','GRIM','GRIN','GRIP','GROW',
  'GULF','GUST','GUYS','HACK','HAIR','HAIL','HALF','HALL','HALT','HAND',
  'HANG','HARD','HARM','HATE','HAUL','HAVE','HAZE','HEAD','HEAL','HEAP',
  'HEAR','HEAT','HEEL','HELD','HELP','HERB','HERD','HERE','HERO','HIGH',
  'HIKE','HILL','HINT','HIRE','HOLD','HOLE','HOME','HOOD','HOOK','HOPE',
  'HORN','HOST','HOUR','HOWL','HUGE','HUNG','HUNT','HURT','HYMN','ICON',
  'IDEA','INTO','IRON','ITEM',
];

// 1500+ valid 4-letter guess words (includes answers + more)
const VALID_GUESSES_4 = new Set([
  ...ANSWERS_4,
  'ABBE','ABET','ABIT','ACID','ACME','ACNE','ACRE','ADZE','AEON','AFAR',
  'AHEM','AIDE','AILS','AIMS','AIRS','AIRY','AJAR','AKIN','ALAS',
  'ALLY','ALMS','ALOE','ALTO','AMID','AMOK','AMPS','ANKH','ANNA','ANTE',
  'ANTI','ANTS','APES','APEX','APPS','AQUA','ARCS','ARID','ARMS','ARTS',
  'ARTY','ASKS','ATOM','ATOP','AUNT','AUTO','AVID','AVOW','AWES','AWLS',
  'AXED','AXES','AXIS','AXLE','BABE','BABY','BAIL','BAIT','BALD','BALE',
  'BALM','BANE','BANG','BANS','BARB','BARD','BARK','BARS','BASH','BASK',
  'BASS','BATS','BAWL','BAYS','BEDS','BEEF','BEEP','BEES','BEGS','BENT',
  'BETA','BETS','BIAS','BIBS','BIDS','BINS','BITS','BLAB','BLED','BLEW',
  'BLIP','BLOB','BLOC','BLOG','BLOT','BOBS','BOCK','BODE','BOGS','BOIL',
  'BONY','BOOS','BOUT','BOWS','BOYS','BRAG','BRAN','BRAS','BRAT','BRAY',
  'BRED','BREW','BRIM','BROW','BUDS','BUFF','BUGS','BULB','BULL','BUMS',
  'BUNK','BUNS','BUOY','BURP','BURR','BURS','BUSH','BUST','BUTS','BUTT',
  'BUYS','BUZZ','CABS','CALF','CAMS','CANE','CANS','CAPS','CARB','CARP',
  'CARS','CATS','CELL','CHEW','CHIC','CITE','CLAN','CLAM','CLEF',
  'CLUB','CLOD','CLOG','COCK','CODS','COED','COGS','COLA','COLT','COMA',
  'COMB','CONE','COOP','COPS','CORK','COUP','COVE','COWL','COWS','COZY',
  'CRAB','CRAM','CRIB','CUPS','CURB','CURD','CURS','CUSP','CUTS','CYAN',
  'DABS','DAFT','DAME','DAMP','DAMS','DANK','DART','DAZE','DEAN','DENY',
  'DENT','DENY','DESK','DEWY','DIAL','DICE','DIGS','DILL','DIME','DIMS',
  'DINT','DIPS','DIRE','DISC','DIVE','DOCK','DODO','DOER','DOGS','DOLE',
  'DOLT','DONS','DOPE','DORK','DORM','DOTS','DOTE','DOUR','DOVE','DOZE',
  'DOZY','DRAB','DRIP','DRUB','DRUG','DUBS','DUCK','DUDE','DUDS','DUEL',
  'DUES','DUET','DUFF','DUKE','DUNE','DUNG','DUNK','DUPE','DUSK','DYED',
  'DYER','DYES','EACH','EARL','EARS','EATS','EAVE','EBBS','EBON','ECHO',
  'EDDY','EELS','EGGS','EGOS','EKED','ELKS','ELMS','EMIT','EMUS',
  'ENDS','ENVY','EONS','ERGO','ERRS','EURO','EVES','EWER','EWES','EXEC',
  'EXES','EXPO','EYED','EYED','EYES','FABS','FACE','FADS','FAGS',
  'FAIN','FANG','FANS','FARO','FART','FATS','FAWN','FAZE','FEAT','FEUD',
  'FERN','FEST','FETA','FIAT','FIBS','FIEF','FIGS','FILM','FIND','FINS',
  'FIZZ','FLAG','FLAK','FLAN','FLAP','FLAW','FLAX','FLAY','FLEA','FLED',
  'FLEE','FLEW','FLEX','FLIT','FLOG','FLOP','FLUB','FLUE','FLUX','FOAL',
  'FOBS','FOES','FOGS','FOIL','FOND','FONT','FOPS','FORD','FORE','FORM',
  'FORT','FOWL','FOXY','FRAY','FRET','FROG','FROW','FRUG','FUME',
  'FUNC','FUNK','FURL','FURS','FURY','FUZZ','GABS','GADS','GAGA',
  'GAGE','GAGS','GAIT','GALE','GALL','GALS','GAPE','GAPS','GARB','GASH',
  'GASP','GAWK','GAZE','GELS','GEMS','GENE','GENT','GERM','GETS','GIBE',
  'GIGS','GILD','GILL','GILT','GIMP','GINS','GIRD','GIST','GLEN','GLIB',
  'GLOB','GLOP','GLUM','GLUT','GNAT','GNAW','GOAD','GOBS','GOES','GOOF',
  'GORE','GORY','GOSH','GOUT','GOWN','GRAB','GRAM','GRAY','GRIT','GROG',
  'GRUB','GUFF','GULL','GULP','GUMS','GUNK','GUNS','GURU','GUSH',
  'GUST','GUTS','GUYS','GYMS','GYRO','HACK','HAIL','HALE','HALO','HAMS',
  'HANK','HARE','HARP','HASH','HASP','HAST','HATS','HAWK','HAYS',
  'HAZE','HAZY','HEAT','HEED','HELM','HEMP','HENS','HERD','HEWN','HEWS',
  'HICK','HIDE','HILT','HIND','HIPS','HISS','HITS','HIVE','HOAX','HOBS',
  'HOCK','HOED','HOES','HOGS','HOOP','HOPS','HORN','HOSE','HOST','HOVE',
  'HUBS','HUED','HUES','HUFF','HUGS','HULK','HULL','HUMP','HUMS','HUNK',
  'HURL','HUSH','HUSK','HUTS','IBIS','ICED','ICES','IFFY','ILLS','IMPS',
  'INCH','INKS','INKY','INNS','IONS','IRED','IRIS','IRKS','ISLE','ISMS',
  'ITCH','JABS','JACK','JADE','JAGS','JAIL','JAMS','JAPE','JARS','JAVA',
  'JAWS','JAYS','JAZZ','JEAN','JEEP','JEER','JELL','JERK','JEST','JETS',
  'JIBE','JIGS','JILT','JINX','JIVE','JOBS','JOCK','JOGS','JOIN','JOKE',
  'JOLT','JOSH','JOTS','JOWL','JOYS','JUDO','JUGS','JUMP','JUNE','JUNK',
  'JURY','JUST','JUTS','KALE','KEEL','KEEN','KEEP','KEGS','KELP','KEPT',
  'KEYS','KICK','KIDS','KILL','KILN','KILT','KINA','KIND','KING','KISS',
  'KITE','KITS','KNAB','KNAP','KNEE','KNEW','KNIT','KNOB','KNOT','KNOW',
  'LACE','LACK','LACY','LADS','LAGS','LAID','LAIR','LAKE','LAME','LAMP',
  'LAMS','LAND','LANE','LANK','LAPS','LARD','LARK','LARS','LASH','LASS',
  'LAST','LATE','LATH','LAUD','LAVA','LAWN','LAWS','LAYS','LAZY','LEAD',
  'LEAF','LEAK','LEAN','LEAP','LEFT','LEGS','LEND','LENS','LENT','LESS',
  'LEVY','LIAR','LICE','LICK','LIDS','LIED','LIEU','LIFE','LIFT','LIKE',
  'LILY','LIMB','LIME','LIMP','LINE','LINK','LINT','LION','LISP','LIST',
  'LIVE','LOAD','LOAF','LOAM','LOAN','LOBE','LOCK','LODE','LOFT','LOGE',
  'LOGO','LOGS','LONE','LONG','LOOK','LOOM','LOON','LOOP','LOOT','LORD',
  'LORE','LORN','LOSE','LOSS','LOST','LOTS','LOUD','LOVE','LOWS','LUCK',
  'LULL','LUMP','LUNG','LURE','LURK','LUSH','LUST','LUTE','LYNX','LYRE',
  'MACE','MACH','MADE','MAID','MAIL','MAIM','MAIN','MAKE','MALE','MALL',
  'MALT','MANE','MANY','MAPS','MARE','MARK','MARS','MART','MASH','MASK',
  'MASS','MAST','MATE','MATH','MATS','MAUL','MAZE','MEAD','MEAL','MEAN',
  'MEAT','MEEK','MEET','MELD','MELT','MEMO','MEND','MENU','MERE','MESH',
  'MESS','MICA','MICE','MILD','MILE','MILK','MILL','MIME','MIND','MINE',
  'MINI','MINK','MINT','MIRE','MISS','MIST','MITE','MITT','MOAN','MOAT',
  'MOCK','MODE','MOLD','MOLE','MOLT','MONK','MOOD','MOON','MOOR',
  'MOPE','MOPS','MORE','MORN','MOSS','MOST','MOTH','MOVE','MUCH','MUCK',
  'MUDS','MUFF','MUGS','MULE','MULL','MUMM','MUMS','MUNG','MURK','MUSE',
  'MUSH','MUSK','MUST','MUTE','MUTT','MYTH','NABS','NAGS','NAIL','NAME',
  'NAPE','NAPS','NAVY','NEAR','NEAT','NECK','NEED','NEST','NETS','NEWS',
  'NEWT','NEXT','NICE','NICK','NINE','NIPS','NODE','NODS','NONE','NOOK',
  'NOON','NORM','NOSE','NOSY','NOTE','NOUN','NUDE','NULL','NUMB','NUNS',
  'NUTS','OAFS','OAKS','OARS','OAST','OATH','OATS','OBEY','ODDS','ODOR',
  'OFFS','OGLE','OGRE','OGLE','OILS','OILY','OKAY','OMEN','OMIT','ONCE',
  'ONES','ONLY','ONTO','OOHS','OOZE','OOZY','OPAL','OPEN','OPTS','OPUS',
  'ORAL','ORCA','ORES','OURS','OUST','OUTS','OVAL','OVEN','OVER','OWED',
  'OWES','OWLS','OWNS','OXEN','PACE','PACK','PACT','PADS','PAGE','PAID',
  'PAIL','PAIN','PAIR','PALE','PALL','PALM','PALS','PANE','PANG','PANS',
  'PANT','PARA','PARE','PARK','PART','PASS','PAST','PATH','PAVE','PAWN',
  'PAWS','PAYS','PEAK','PEAL','PEAR','PEAS','PEAT','PECK','PEEL','PEEP',
  'PEER','PEGS','PELT','PEND','PENS','PENT','PEON','PEPS','PERK','PERM',
  'PERT','PESO','PEST','PETS','PEWS','PICK','PIED','PIER','PIES','PIGS',
  'PIKE','PILE','PILL','PINE','PING','PINK','PINS','PINT','PINY','PIPE',
  'PISS','PITS','PITY','PLAN','PLAY','PLEA','PLED','PLOD','PLOP','PLOT',
  'PLOW','PLOY','PLUG','PLUM','PLUS','POCK','PODS','POEM','POET','POKE',
  'POLE','POLL','POLO','POMP','POND','PONY','POOL','POOP','POOR','POPE',
  'POPS','PORE','PORK','PORT','POSE','POSH','POST','POSY','POUR','POUT',
  'POUR','PRAY','PREP','PREY','PRIG','PRIM','PROD','PROM','PROP','PROS',
  'PROW','PRYS','PUBS','PUCK','PUFF','PUGS','PULL','PULP','PUMP','PUNS',
  'PUPS','PURE','PURR','PUSH','PUTS','PUTT','QUIZ','RACE','RACK','RAFT',
  'RAGE','RAGS','RAID','RAIL','RAIN','RAKE','RAMP','RAMS','RANG','RANK',
  'RANT','RAPS','RARE','RASH','RASP','RATE','RATS','RAVE','RAYS','RAZE',
  'READ','REAL','REAM','REAP','REAR','REDO','REED','REEF','REEK','REEL',
  'REFS','REIN','RELY','REND','RENT','REST','RIBS','RICE','RICH','RIDE',
  'RIDS','RIFT','RIGS','RILE','RILL','RIME','RIMS','RIND','RING','RINK',
  'RIOT','RIPE','RIPS','RISE','RISK','RITE','ROAD','ROAM','ROAR','ROBE',
  'ROBS','ROCK','RODE','RODS','ROLE','ROLL','ROMP','ROOF','ROOK','ROOM',
  'ROOT','ROPE','ROSE','ROSY','ROTE','ROTS','ROUT','ROVE','ROWS','RUBS',
  'RUDE','RUED','RUES','RUFF','RUGS','RUIN','RULE','RUMP','RUMS','RUNE',
  'RUNG','RUNS','RUNT','RUSE','RUSH','RUST','RUTS','SACK','SAFE','SAGA',
  'SAGE','SAGS','SAID','SAIL','SAKE','SALE','SALT','SAME','SAND','SANE',
  'SANG','SANK','SARI','SASH','SAVE','SAWS','SAYS','SCAB','SCAM','SCAN',
  'SCAR','SEAL','SEAM','SEAR','SEAS','SEAT','SECT','SEED','SEEK','SEEM',
  'SEEN','SEEP','SEER','SELF','SELL','SEMI','SEND','SENT','SEPT','SETS',
  'SEWN','SEWS','SHAG','SHAM','SHED','SHIN','SHIP','SHOD','SHOE','SHOO',
  'SHOP','SHOT','SHOW','SHUN','SHUT','SICK','SIDE','SIFT','SIGH','SIGN',
  'SILK','SILL','SILO','SILT','SING','SINK','SIPS','SIRE','SIRS','SITE',
  'SITS','SIZE','SKEW','SKID','SKIM','SKIN','SKIP','SKIT','SKIS','SLAB',
  'SLAG','SLAM','SLAP','SLAT','SLAW','SLAY','SLED','SLEW','SLID','SLIM',
  'SLIP','SLIT','SLOB','SLOE','SLOG','SLOP','SLOT','SLOW','SLUG','SLUM',
  'SLUR','SMOG','SNAP','SNAG','SNIP','SNIT','SNOB','SNOT','SNOW','SNUB',
  'SNUG','SOAK','SOAP','SOAR','SOBS','SOCK','SODA','SODS','SOFA','SOFT',
  'SOIL','SOLD','SOLE','SOLO','SOME','SONG','SOON','SOOT','SORE','SORT',
  'SOUL','SOUP','SOUR','SPAN','SPAR','SPAT','SPEC','SPED','SPEW','SPIN',
  'SPIT','SPOT','SPRY','SPUD','SPUN','SPUR','STAB','STAG','STAR','STAY',
  'STEM','STEP','STEW','STIR','STOP','STOW','STUB','STUD','STUN','SUCH',
  'SUCK','SUDS','SUED','SUES','SUIT','SULK','SUMS','SUNG','SUNK','SUNS',
  'SURE','SURF','SWAB','SWAM','SWAN','SWAP','SWAY','SWIM','SWUM','TABS',
  'TACK','TACT','TAGS','TAIL','TAKE','TALE','TALK','TALL','TAME','TAMP',
  'TANS','TAPE','TAPS','TARN','TARP','TARS','TART','TASK','TAUT','TAXI',
  'TEAK','TEAL','TEAM','TEAR','TEAS','TEEN','TELL','TEMP','TEND','TENS',
  'TENT','TERM','TERN','TEST','TEXT','THAN','THAT','THAW','THEM','THEN',
  'THEY','THIN','THIS','THOU','THUD','THUG','THUS','TICK','TIDE','TIDY',
  'TIED','TIER','TIES','TILE','TILL','TILT','TIME','TINE','TING','TINY',
  'TIPS','TIRE','TOAD','TOED','TOES','TOFU','TOGA','TOGS','TOIL','TOLD',
  'TOLL','TOMB','TOME','TONE','TONS','TONY','TOOK','TOOL','TOOT','TOPS',
  'TORE','TORN','TORT','TOSS','TOTS','TOUR','TOWN','TOYS','TRAP','TRAY',
  'TREE','TREK','TRIM','TRIO','TRIP','TROD','TROT','TROY','TRUE','TSAR',
  'TUBA','TUBE','TUBS','TUCK','TUFT','TUGS','TULP','TUNA','TUNE','TURF',
  'TURN','TUSK','TUTU','TWIN','TWIT','TYPE','UGLY','UNDO','UNIT','UNTO',
  'UPON','URGE','URNS','USED','USER','USES','VAIN','VALE','VANE','VANS',
  'VARY','VASE','VAST','VATS','VEAL','VEER','VEIL','VEIN','VENT','VERB',
  'VERY','VEST','VETO','VIAL','VICE','VIED','VIES','VIEW','VILE','VINE',
  'VOID','VOLT','VOTE','WADE','WAGE','WAIL','WAIT','WAKE','WALK','WALL',
  'WAND','WANE','WANT','WARD','WARM','WARN','WARP','WARS','WART','WARY',
  'WASH','WASP','WAVE','WAVY','WAXY','WAYS','WEAK','WEAN','WEAR','WEBS',
  'WEDS','WEED','WEEK','WEEP','WELD','WELL','WELT','WENT','WEPT','WERE',
  'WEST','WHAT','WHEN','WHOM','WICK','WIDE','WIFE','WIGS','WILD','WILL',
  'WILT','WILY','WIMP','WIND','WINE','WING','WINK','WINS','WIPE','WIRE',
  'WISE','WISH','WISP','WITH','WITS','WOES','WOKE','WOLF','WOMB','WONT',
  'WOOD','WOOF','WOOL','WORD','WORE','WORK','WORM','WORN','WOVE','WRAP',
  'WREN','YACK','YAMS','YANK','YAPS','YARD','YARN','YAWL','YAWN','YEAR',
  'YELL','YELP','YOGA','YOKE','YOLK','YOUR','YOWL','YULE','ZANY','ZEAL',
  'ZERO','ZEST','ZINC','ZING','ZONE','ZOOM',
]);

// Hard mode confirmed letters tracking is handled at runtime

type LetterStatus = 'correct' | 'present' | 'absent' | 'empty' | 'tbd';

interface TileState {
  letter: string;
  status: LetterStatus;
  isRevealing: boolean;
}

export default function WordleGame({ onGameOver, level }: WordleGameProps) {
  const WORD_LENGTH = level === 'easy' ? 4 : 5;
  const MAX_GUESSES = level === 'easy' ? 7 : level === 'hard' ? 5 : 6;
  const ANSWERS = WORD_LENGTH === 4 ? ANSWERS_4 : ANSWERS_5;
  const VALID_GUESSES = WORD_LENGTH === 4 ? VALID_GUESSES_4 : VALID_GUESSES_5;

  const [answer] = useState(() => ANSWERS[Math.floor(Math.random() * ANSWERS.length)]);
  const [guesses, setGuesses] = useState<TileState[][]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState('');
  const [revealingRow, setRevealingRow] = useState(-1);
  const [keyboardStatus, setKeyboardStatus] = useState<Record<string, LetterStatus>>({});
  const [confirmedLetters, setConfirmedLetters] = useState<{ letter: string; position: number; status: 'correct' | 'present' }[]>([]);

  const showMessage = useCallback((msg: string, duration = 1500) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), duration);
  }, []);

  const evaluateGuess = useCallback((guess: string): TileState[] => {
    const result: TileState[] = guess.split('').map(l => ({ letter: l, status: 'absent' as LetterStatus, isRevealing: false }));
    const answerArr = answer.split('');
    const used = new Array(WORD_LENGTH).fill(false);

    // First pass: correct positions
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guess[i] === answerArr[i]) {
        result[i].status = 'correct';
        used[i] = true;
      }
    }

    // Second pass: present but wrong position
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i].status === 'correct') continue;
      for (let j = 0; j < WORD_LENGTH; j++) {
        if (!used[j] && guess[i] === answerArr[j]) {
          result[i].status = 'present';
          used[j] = true;
          break;
        }
      }
    }

    return result;
  }, [answer, WORD_LENGTH]);

  const submitGuess = useCallback(() => {
    if (currentGuess.length !== WORD_LENGTH) {
      setShake(true);
      showMessage('Not enough letters');
      setTimeout(() => setShake(false), 600);
      return;
    }

    if (!VALID_GUESSES.has(currentGuess)) {
      setShake(true);
      showMessage('Not in word list');
      setTimeout(() => setShake(false), 600);
      return;
    }

    // Hard mode: must use confirmed letters in subsequent guesses
    if (level === 'hard' && confirmedLetters.length > 0) {
      for (const cl of confirmedLetters) {
        if (cl.status === 'correct' && currentGuess[cl.position] !== cl.letter) {
          setShake(true);
          showMessage(`${cl.letter} must be in position ${cl.position + 1}`);
          setTimeout(() => setShake(false), 600);
          return;
        }
        if (cl.status === 'present' && !currentGuess.includes(cl.letter)) {
          setShake(true);
          showMessage(`Guess must contain ${cl.letter}`);
          setTimeout(() => setShake(false), 600);
          return;
        }
      }
    }

    const evaluated = evaluateGuess(currentGuess);
    const newGuesses = [...guesses, evaluated];
    const rowIdx = newGuesses.length - 1;

    // Track confirmed letters for hard mode
    if (level === 'hard') {
      const newConfirmed = [...confirmedLetters];
      evaluated.forEach((tile, i) => {
        if (tile.status === 'correct') {
          if (!newConfirmed.some(c => c.position === i && c.status === 'correct')) {
            newConfirmed.push({ letter: tile.letter, position: i, status: 'correct' });
          }
        } else if (tile.status === 'present') {
          if (!newConfirmed.some(c => c.letter === tile.letter && c.status === 'present')) {
            newConfirmed.push({ letter: tile.letter, position: i, status: 'present' });
          }
        }
      });
      setConfirmedLetters(newConfirmed);
    }

    // Start reveal animation
    setRevealingRow(rowIdx);
    setGuesses(newGuesses);
    setCurrentGuess('');

    // Update keyboard status after reveal
    setTimeout(() => {
      setRevealingRow(-1);
      const newKbStatus = { ...keyboardStatus };
      evaluated.forEach(tile => {
        const prev = newKbStatus[tile.letter];
        if (tile.status === 'correct') {
          newKbStatus[tile.letter] = 'correct';
        } else if (tile.status === 'present' && prev !== 'correct') {
          newKbStatus[tile.letter] = 'present';
        } else if (!prev) {
          newKbStatus[tile.letter] = 'absent';
        }
      });
      setKeyboardStatus(newKbStatus);

      const isWin = currentGuess === answer;
      const isLoss = newGuesses.length >= MAX_GUESSES && !isWin;

      if (isWin) {
        setWon(true);
        setGameOver(true);
        playSound('wordle_win');
        const score = (MAX_GUESSES + 1 - newGuesses.length) * 20;
        showMessage(`Brilliant! +${score} pts`, 3000);
        setTimeout(() => onGameOver(score), 2500);
      } else if (isLoss) {
        setGameOver(true);
        playSound('wordle_game_over');
        showMessage(`The word was ${answer}`, 4000);
        setTimeout(() => onGameOver(0), 3000);
      }
    }, WORD_LENGTH * 300 + 100); // Wait for all tiles to flip

  }, [currentGuess, guesses, answer, evaluateGuess, keyboardStatus, onGameOver, showMessage, WORD_LENGTH, MAX_GUESSES, VALID_GUESSES, level, confirmedLetters]);

  const handleKey = useCallback((key: string) => {
    if (gameOver || revealingRow >= 0) return;

    if (key === 'ENTER') {
      submitGuess();
    } else if (key === 'BACK') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
      setCurrentGuess(prev => prev + key);
      playSound('wordle_type');
    }
  }, [gameOver, revealingRow, currentGuess, submitGuess]);

  // Physical keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleKey('ENTER');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKey('BACK');
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKey(e.key.toUpperCase());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKey]);

  const getTileStyle = (status: LetterStatus, isRevealing: boolean, delay: number) => {
    const base = 'w-[52px] h-[52px] sm:w-[62px] sm:h-[62px] flex items-center justify-center text-2xl sm:text-3xl font-bold uppercase border-2 select-none transition-colors';

    const colorMap: Record<LetterStatus, string> = {
      correct: 'bg-green-500 border-green-500 text-white',
      present: 'bg-yellow-500 border-yellow-500 text-white',
      absent: 'bg-zinc-700 border-zinc-700 text-white',
      tbd: 'border-zinc-500 text-white',
      empty: 'border-zinc-700 text-white',
    };

    const flipStyle = isRevealing
      ? { animation: `flipIn 0.5s ease ${delay}ms both`, transformStyle: 'preserve-3d' as const }
      : {};

    return { className: `${base} ${colorMap[status]}`, style: flipStyle };
  };

  const getKeyStyle = (letter: string) => {
    const status = keyboardStatus[letter];
    const base = 'rounded font-bold text-sm sm:text-base select-none active:scale-95 transition-all duration-100 flex items-center justify-center';
    if (status === 'correct') return `${base} bg-green-500 text-white`;
    if (status === 'present') return `${base} bg-yellow-500 text-white`;
    if (status === 'absent') return `${base} bg-zinc-700 text-zinc-400`;
    return `${base} bg-zinc-500 text-white hover:bg-zinc-400`;
  };

  const KEYBOARD_ROWS = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['ENTER','Z','X','C','V','B','N','M','BACK'],
];

  const renderGrid = () => {
    const rows = [];
    for (let r = 0; r < MAX_GUESSES; r++) {
      const tiles = [];
      const isCurrentRow = r === guesses.length;
      const isRevealRow = r === revealingRow || (r < guesses.length && r !== revealingRow);

      for (let c = 0; c < WORD_LENGTH; c++) {
        let letter = '';
        let status: LetterStatus = 'empty';
        let isRevealing = false;

        if (r < guesses.length) {
          letter = guesses[r][c].letter;
          status = r === revealingRow ? 'tbd' : guesses[r][c].status;
          isRevealing = r === revealingRow;
          if (isRevealing) status = guesses[r][c].status;
        } else if (isCurrentRow && c < currentGuess.length) {
          letter = currentGuess[c];
          status = 'tbd';
        }

        const { className, style } = getTileStyle(
          isRevealing ? guesses[r][c].status : status,
          isRevealing,
          c * 300
        );

        tiles.push(
          <div
            key={c}
            className={className}
            style={{
              ...style,
              ...(isCurrentRow && c === currentGuess.length - 1 && letter ? { animation: 'popIn 0.1s ease' } : {}),
            }}
          >
            {letter}
          </div>
        );
      }

      rows.push(
        <div
          key={r}
          className={`flex gap-1.5 ${isCurrentRow && shake ? 'animate-shake' : ''}`}
        >
          {tiles}
        </div>
      );
    }
    return rows;
  };

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4 w-full max-w-lg mx-auto select-none">
      <style>{`
        @keyframes flipIn {
          0% { transform: rotateX(0deg); }
          50% { transform: rotateX(90deg); }
          100% { transform: rotateX(0deg); }
        }
        @keyframes popIn {
          0% { transform: scale(1); }
          50% { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        .animate-shake {
          animation: shake 0.5s ease;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>

      {/* Message toast */}
      {message && (
        <div className="absolute top-4 z-50 bg-white text-black font-bold px-5 py-2.5 rounded-lg text-sm shadow-lg animate-[fadeIn_0.15s_ease]">
          {message}
        </div>
      )}

      {/* Title */}
      <h2 className="text-xl font-bold text-white tracking-wider">WORDLE</h2>

      {/* Grid */}
      <div className="flex flex-col gap-1.5">
        {renderGrid()}
      </div>

      {/* Keyboard */}
      <div className="flex flex-col gap-1.5 w-full max-w-[500px] mt-2">
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-1 sm:gap-1.5">
            {row.map(key => (
              <button
                key={key}
                className={`${getKeyStyle(key)} ${
                  key === 'ENTER' || key === 'BACK'
                    ? 'px-2 sm:px-3 h-[50px] sm:h-[58px] text-xs sm:text-sm min-w-[50px] sm:min-w-[65px]'
                    : 'w-[30px] sm:w-[43px] h-[50px] sm:h-[58px]'
                }`}
                onClick={() => handleKey(key)}
                aria-label={key === 'BACK' ? 'Backspace' : key}
              >
                {key === 'BACK' ? '⌫' : key}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
