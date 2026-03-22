'use client';

import { useState, useEffect, useCallback } from 'react';

interface WordleGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

// 50 answer words - common, well-known 5-letter words
const ANSWERS_5 = [
  'APPLE','BEACH','BRAIN','BREAD','BRUSH','CANDY','CHAIR','CHEAP','CHESS','CHIEF',
  'CHILD','CLEAN','CLIMB','CLOUD','COACH','CORAL','CRANE','CREAM','DANCE','DREAM',
  'EARTH','FEAST','FLAME','FLASH','FLOAT','FRAME','FRESH','FROST','GHOST','GIANT',
  'GLOBE','GRACE','GRAIN','GRAPE','GRASS','GREEN','GUARD','HAPPY','HEART','HOUSE',
  'JUICE','LAUGH','LIGHT','MAGIC','MUSIC','NIGHT','OCEAN','PAINT','PEARL','PIANO',
];

// 200+ valid guess words (includes answers + more)
const VALID_GUESSES_5 = new Set([
  ...ANSWERS_5,
  'ABOUT','ABOVE','ABUSE','ACUTE','ADMIT','ADOPT','ADULT','AFTER','AGAIN','AGENT',
  'AGREE','AHEAD','ALARM','ALBUM','ALERT','ALIEN','ALIGN','ALIVE','ALLOW','ALONE',
  'ALTER','AMONG','ANGEL','ANGER','ANGLE','ANGRY','APART','ARENA','ARGUE','ARISE',
  'ARMOR','AROMA','ASIDE','ASSET','AVOID','AWAKE','AWARD','AWARE','BADLY','BASIC',
  'BASIN','BASIS','BEGIN','BEING','BENCH','BLACK','BLADE','BLAME','BLANK','BLAST',
  'BLAZE','BLEED','BLEND','BLESS','BLIND','BLOCK','BLOOM','BLOWN','BOARD','BOOST',
  'BOUND','BRAVE','BRIEF','BRING','BROAD','BROKE','BROWN','BUILD','BUILT','BUNCH',
  'BURST','BUYER','CABIN','CARGO','CARRY','CATCH','CAUSE','CHAIN','CHARM','CHART',
  'CHASE','CHECK','CHEER','CHINA','CLAIM','CLASS','CLEAR','CLICK','CLIFF','CLOSE',
  'CLOTH','COLOR','COMBO','COMET','COUNT','COURT','COVER','CRACK','CRAFT','CRASH',
  'CRAZY','CREEK','CRIME','CROSS','CROWD','CRUSH','CURVE','CYCLE','DAILY','DEALT',
  'DEATH','DEBUT','DECAY','DELAY','DELTA','DENSE','DEPOT','DEPTH','DERBY','DEVIL',
  'DIARY','DIRTY','DITCH','DOUBT','DOUGH','DRAFT','DRAIN','DRAMA','DRANK','DRAWN',
  'DRESS','DRIED','DRIFT','DRILL','DRINK','DRIVE','DROPS','DROVE','DRUNK','DRYER',
  'DWARF','DYING','EAGER','EARLY','EIGHT','ELECT','ELITE','EMPTY','ENEMY','ENJOY',
  'ENTER','EQUAL','ERROR','EVENT','EVERY','EXACT','EXIST','EXTRA','FAINT','FAITH',
  'FALSE','FANCY','FATAL','FAVOR','FENCE','FETCH','FEVER','FIBER','FIELD','FIFTY',
  'FIGHT','FINAL','FIRST','FIXED','FLEET','FLESH','FLIES','FLOCK','FLOOD','FLOOR',
  'FLOUR','FLUID','FLUSH','FOCUS','FORCE','FORGE','FORTH','FOUND','FRAIL','FRAUD',
  'FREED','FRONT','FRUIT','FULLY','FUNNY','GIVEN','GLEAM','GLIDE','GLORY','GLOVE',
  'GOING','GRAND','GRANT','GRASP','GRAVE','GREAT','GREED','GRILL','GRIND','GROAN',
  'GROOM','GROUP','GROWN','GUEST','GUIDE','GUILT','HARSH','HASN','HAVEN','HEAVY',
  'HELLO','HENCE','HIKER','HITCH','HOBBY','HONOR','HOPED','HORSE','HOTEL','HUMAN',
  'HUMOR','HURRY','IDEAL','IMAGE','IMPLY','INDEX','INDIE','INNER','INPUT','ISSUE',
  'IVORY','JEWEL','JOINT','JUDGE','JUICE','LABEL','LABOR','LANCE','LARGE','LASER',
  'LATER','LAYER','LEARN','LEASE','LEGAL','LEVEL','LEVER','LIMIT','LINEN','LIVER',
  'LOCAL','LODGE','LOGIC','LOOSE','LOVER','LOWER','LOYAL','LUCKY','LUNCH','MAKER',
]);

// 50 answer words - common 4-letter words (for easy mode)
const ANSWERS_4 = [
  'BACK','BALL','BAND','BANK','BASE','BATH','BEAR','BEAT','BELL','BEST',
  'BIRD','BLUE','BOAT','BODY','BOLD','BONE','BOOK','BORN','BOWL','BURN',
  'CAGE','CAKE','CALL','CALM','CAMP','CARD','CART','CASE','CASH','CAVE',
  'CHIP','CITY','CLAP','CLAY','CLIP','CLUB','COAL','COAT','CODE','COIN',
  'COLD','COOK','COOL','CORD','CORE','CORN','COST','CREW','CROP','CURE',
];

// 150+ valid 4-letter guess words (includes answers + more)
const VALID_GUESSES_4 = new Set([
  ...ANSWERS_4,
  'ABLE','ACID','AGED','ALSO','ARCH','AREA','ARMY','AWAY','BABY','BARE',
  'BARN','BEAM','BEEN','BEER','BEND','BIKE','BILL','BIND','BITE','BLOW',
  'BLUR','BOOM','BOOT','BOSS','BOTH','BULK','BUMP','BURY','BUSY','CALM',
  'CAME','CAMP','CAPS','CARE','CAST','CHAR','CHEF','CHIN','CHOP','CITE',
  'CLAN','CLAW','COME','COPE','COPY','COZY','CUBE','CURL','DARE','DARK',
  'DASH','DATA','DAWN','DEAD','DEAF','DEAL','DEAR','DEBT','DECK','DEED',
  'DEEM','DEEP','DEER','DINE','DIRT','DISH','DOCK','DOME','DONE','DOOM',
  'DOOR','DOSE','DOWN','DRAG','DRAW','DROP','DRUM','DUAL','DULL','DUMB',
  'DUMP','DUST','DUTY','EACH','EARN','EASE','EAST','EASY','EDGE','EDIT',
  'ELSE','EMIT','EPIC','EVEN','EVER','EVIL','EXAM','FACE','FACT','FADE',
  'FAIL','FAIR','FAKE','FALL','FAME','FARM','FAST','FATE','FEAR','FEED',
  'FEEL','FILE','FILL','FILM','FIND','FINE','FIRE','FIRM','FISH','FLAG',
  'FLAT','FLED','FLEW','FLIP','FLOW','FOAM','FOLD','FOLK','FOND','FOOD',
  'FOOL','FOOT','FORK','FORM','FORT','FOUL','FOUR','FREE','FROM','FUEL',
  'FULL','FUND','FURY','FUSE','GAIN','GAME','GANG','GATE','GAVE','GEAR',
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
        const score = (MAX_GUESSES + 1 - newGuesses.length) * 20;
        showMessage(`Brilliant! +${score} pts`, 3000);
        setTimeout(() => onGameOver(score), 2500);
      } else if (isLoss) {
        setGameOver(true);
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
