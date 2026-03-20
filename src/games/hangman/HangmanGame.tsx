'use client';

import { useState, useCallback, useEffect } from 'react';

interface HangmanGameProps {
  onGameOver: (score: number) => void;
}

const MAX_WRONG = 6;

const WORD_CATEGORIES: { topic: string; emoji: string; words: string[] }[] = [
  { topic: 'Animal', emoji: '🐾', words: ['cat', 'dog', 'fish', 'bird', 'bear', 'lion', 'tiger', 'whale', 'eagle', 'shark', 'horse', 'mouse', 'snake', 'frog', 'duck', 'deer', 'wolf', 'zebra', 'panda', 'koala', 'rabbit', 'turtle', 'dolphin', 'penguin', 'monkey'] },
  { topic: 'Food', emoji: '🍕', words: ['apple', 'bread', 'candy', 'grape', 'lemon', 'mango', 'olive', 'peach', 'pizza', 'salad', 'taco', 'toast', 'pasta', 'rice', 'soup', 'cake', 'cookie', 'banana'] },
  { topic: 'Color', emoji: '🎨', words: ['red', 'blue', 'green', 'gold', 'pink', 'white', 'black', 'brown', 'orange', 'purple'] },
  { topic: 'Nature', emoji: '🌿', words: ['tree', 'flower', 'river', 'ocean', 'cloud', 'star', 'moon', 'rain', 'snow', 'stone'] },
  { topic: 'Object', emoji: '🏠', words: ['book', 'chair', 'table', 'clock', 'phone', 'lamp', 'piano', 'brush', 'crown', 'sword', 'house', 'train', 'boat', 'kite', 'drum'] },
  { topic: 'Sport', emoji: '⚽', words: ['soccer', 'tennis', 'hockey', 'golf', 'rugby', 'boxing', 'skiing', 'surfing', 'diving', 'karate'] },
  { topic: 'Country', emoji: '🌍', words: ['canada', 'brazil', 'france', 'japan', 'india', 'egypt', 'mexico', 'italy', 'spain', 'china'] },
  { topic: 'Music', emoji: '🎵', words: ['guitar', 'piano', 'drums', 'violin', 'flute', 'trumpet', 'banjo', 'harp', 'cello', 'organ'] },
  { topic: 'Weather', emoji: '🌤️', words: ['sunny', 'rainy', 'foggy', 'windy', 'storm', 'frost', 'sleet', 'humid', 'misty', 'snowy'] },
  { topic: 'Job', emoji: '👷', words: ['doctor', 'nurse', 'pilot', 'baker', 'chef', 'judge', 'actor', 'coach', 'mayor', 'artist'] },
];

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

function HangmanSVG({ wrongCount }: { wrongCount: number }) {
  return (
    <svg viewBox="0 0 200 220" className="w-40 h-44 sm:w-48 sm:h-52">
      {/* Gallows */}
      <line x1="20" y1="210" x2="180" y2="210" stroke="#6b7280" strokeWidth="4" strokeLinecap="round" />
      <line x1="60" y1="210" x2="60" y2="20" stroke="#6b7280" strokeWidth="4" strokeLinecap="round" />
      <line x1="60" y1="20" x2="130" y2="20" stroke="#6b7280" strokeWidth="4" strokeLinecap="round" />
      <line x1="130" y1="20" x2="130" y2="45" stroke="#6b7280" strokeWidth="4" strokeLinecap="round" />

      {/* Head */}
      {wrongCount >= 1 && (
        <circle cx="130" cy="65" r="20" stroke="#f87171" strokeWidth="3" fill="none" className="hm-draw" />
      )}
      {/* Body */}
      {wrongCount >= 2 && (
        <line x1="130" y1="85" x2="130" y2="145" stroke="#f87171" strokeWidth="3" strokeLinecap="round" className="hm-draw" />
      )}
      {/* Left arm */}
      {wrongCount >= 3 && (
        <line x1="130" y1="100" x2="100" y2="130" stroke="#f87171" strokeWidth="3" strokeLinecap="round" className="hm-draw" />
      )}
      {/* Right arm */}
      {wrongCount >= 4 && (
        <line x1="130" y1="100" x2="160" y2="130" stroke="#f87171" strokeWidth="3" strokeLinecap="round" className="hm-draw" />
      )}
      {/* Left leg */}
      {wrongCount >= 5 && (
        <line x1="130" y1="145" x2="105" y2="185" stroke="#f87171" strokeWidth="3" strokeLinecap="round" className="hm-draw" />
      )}
      {/* Right leg */}
      {wrongCount >= 6 && (
        <line x1="130" y1="145" x2="155" y2="185" stroke="#f87171" strokeWidth="3" strokeLinecap="round" className="hm-draw" />
      )}

      {/* Face when dead */}
      {wrongCount >= 6 && (
        <>
          {/* X eyes */}
          <line x1="120" y1="58" x2="126" y2="64" stroke="#f87171" strokeWidth="2" />
          <line x1="126" y1="58" x2="120" y2="64" stroke="#f87171" strokeWidth="2" />
          <line x1="134" y1="58" x2="140" y2="64" stroke="#f87171" strokeWidth="2" />
          <line x1="140" y1="58" x2="134" y2="64" stroke="#f87171" strokeWidth="2" />
          {/* Sad mouth */}
          <path d="M 122 76 Q 130 70 138 76" stroke="#f87171" strokeWidth="2" fill="none" />
        </>
      )}

      {/* Face when alive and guessing */}
      {wrongCount > 0 && wrongCount < 6 && (
        <>
          <circle cx="123" cy="62" r="2" fill="#fbbf24" />
          <circle cx="137" cy="62" r="2" fill="#fbbf24" />
          <path d="M 124 74 Q 130 78 136 74" stroke="#fbbf24" strokeWidth="2" fill="none" />
        </>
      )}
    </svg>
  );
}

export default function HangmanGame({ onGameOver }: HangmanGameProps) {
  const [word, setWord] = useState('');
  const [topic, setTopic] = useState('');
  const [topicEmoji, setTopicEmoji] = useState('');
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);

  const wrongGuesses = Array.from(guessed).filter(l => !word.includes(l));
  const wrongCount = wrongGuesses.length;
  const remainingGuesses = MAX_WRONG - wrongCount;
  const isWordComplete = word.split('').every(l => guessed.has(l));

  const pickWord = useCallback(() => {
    const category = WORD_CATEGORIES[Math.floor(Math.random() * WORD_CATEGORIES.length)];
    const w = category.words[Math.floor(Math.random() * category.words.length)];
    return { word: w, topic: category.topic, emoji: category.emoji };
  }, []);

  const startGame = useCallback(() => {
    const pick = pickWord();
    setWord(pick.word);
    setTopic(pick.topic);
    setTopicEmoji(pick.emoji);
    setGuessed(new Set());
    setGameOver(false);
    setWon(false);
    setStarted(true);
  }, [pickWord]);

  const guessLetter = useCallback((letter: string) => {
    if (guessed.has(letter) || gameOver) return;

    const newGuessed = new Set(guessed);
    newGuessed.add(letter);
    setGuessed(newGuessed);

    const newWrong = Array.from(newGuessed).filter(l => !word.includes(l)).length;

    // Check win
    if (word.split('').every(l => newGuessed.has(l))) {
      const remaining = MAX_WRONG - newWrong;
      const score = remaining * 15 + 10;
      setWon(true);
      setGameOver(true);
      setTimeout(() => onGameOver(score), 2000);
      return;
    }

    // Check lose — longer delay so player can see the word
    if (newWrong >= MAX_WRONG) {
      setGameOver(true);
      setTimeout(() => onGameOver(0), 4000);
    }
  }, [guessed, gameOver, word, onGameOver]);

  // Keyboard support
  useEffect(() => {
    if (!started || gameOver) return;
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key.length === 1 && key >= 'a' && key <= 'z') {
        guessLetter(key);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [started, gameOver, guessLetter]);

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-6 min-h-[400px]">
        <div className="text-6xl">🔤</div>
        <h2 className="text-2xl font-bold text-white">Hangman</h2>
        <p className="text-gray-400 text-center max-w-xs">
          Guess the word before the hangman is complete! You get 6 wrong guesses.
        </p>
        <button
          onClick={startGame}
          className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl
            text-lg transition-all active:scale-95 shadow-lg shadow-purple-900/40"
        >
          Start Game
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4 select-none">
      {/* Topic hint */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/20 border border-purple-500/30">
        <span className="text-lg">{topicEmoji}</span>
        <span className="text-sm font-semibold text-purple-300">Hint:</span>
        <span className="text-sm text-purple-200">{topic}</span>
      </div>

      {/* Guesses remaining */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Guesses Left</div>
          <div className="flex gap-1 mt-1">
            {Array.from({ length: MAX_WRONG }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all ${
                  i < remainingGuesses ? 'bg-green-500' : 'bg-red-500/30'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Hangman figure */}
      <HangmanSVG wrongCount={wrongCount} />

      {/* Word blanks */}
      <div className="flex gap-2 sm:gap-3 flex-wrap justify-center px-4">
        {word.split('').map((letter, i) => {
          const revealed = guessed.has(letter) || (gameOver && !won);
          return (
            <div
              key={i}
              className={`
                w-8 h-10 sm:w-10 sm:h-12 flex items-center justify-center
                border-b-3 font-bold text-xl sm:text-2xl uppercase
                transition-all duration-200
                ${revealed
                  ? guessed.has(letter)
                    ? 'text-green-400 border-green-500'
                    : 'text-red-400 border-red-500'
                  : 'text-transparent border-gray-600'
                }
              `}
            >
              {revealed ? letter : '_'}
            </div>
          );
        })}
      </div>

      {/* Game over message */}
      {gameOver && (
        <div className="text-center mt-2">
          {won ? (
            <>
              <p className="text-xl font-bold text-green-400">You got it!</p>
              <p className="text-3xl font-black text-yellow-400 mt-1">{remainingGuesses * 15 + 10} pts</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-red-400">Game Over!</p>
              <p className="text-gray-400 mt-1">
                The word was <span className="text-white font-bold uppercase">{word}</span>
              </p>
              <p className="text-3xl font-black text-gray-600 mt-1">0 pts</p>
            </>
          )}
          <button
            onClick={startGame}
            className="mt-3 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl
              transition-all active:scale-95"
          >
            Play Again
          </button>
        </div>
      )}

      {/* Alphabet keyboard */}
      {!gameOver && (
        <div className="grid grid-cols-9 gap-1.5 sm:gap-2 max-w-sm mt-2">
          {ALPHABET.map(letter => {
            const isGuessed = guessed.has(letter);
            const isCorrect = isGuessed && word.includes(letter);
            const isWrong = isGuessed && !word.includes(letter);
            return (
              <button
                key={letter}
                onClick={() => guessLetter(letter)}
                disabled={isGuessed}
                className={`
                  w-8 h-10 sm:w-9 sm:h-11 rounded-lg font-bold text-sm sm:text-base uppercase
                  transition-all duration-150 active:scale-90
                  ${isCorrect
                    ? 'bg-green-600/40 text-green-400 cursor-default'
                    : isWrong
                    ? 'bg-red-600/20 text-red-400/40 cursor-default'
                    : 'bg-gray-700 hover:bg-gray-600 text-white cursor-pointer shadow-sm'
                  }
                `}
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes hm-draw {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .hm-draw { animation: hm-draw 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}
