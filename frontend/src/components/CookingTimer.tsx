import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CookingTimerProps {
  seconds: number;
  stepNumber: number;
  onComplete?: () => void;
}

export default function CookingTimer({ seconds, stepNumber, onComplete }: CookingTimerProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const playChime = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioRef.current = ctx;

      const frequencies = [523, 659, 784]; // C, E, G
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.5);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.5);
      });
    } catch {
      // Audio not supported
    }
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            setIsDone(true);
            playChime();
            onComplete?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, playChime, onComplete]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = ((seconds - timeLeft) / seconds) * 100;

  const handleToggle = () => {
    if (isDone) {
      setTimeLeft(seconds);
      setIsDone(false);
      setIsRunning(false);
    } else {
      setIsRunning(!isRunning);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl mt-2"
      style={{
        background: isDone ? '#D1FAE5' : isRunning ? '#FEF3C7' : '#F9FAFB',
        border: `2px solid ${isDone ? '#10B981' : isRunning ? '#F59E0B' : '#e5e7eb'}`,
      }}
    >
      {/* Progress ring */}
      <div className="relative w-12 h-12 flex-shrink-0">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <motion.circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={isDone ? '#10B981' : isRunning ? '#F59E0B' : 'var(--primary)'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 20}`}
            strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
            animate={{ strokeDashoffset: `${2 * Math.PI * 20 * (1 - progress / 100)}` }}
            transition={{ duration: 0.5 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold" style={{ color: isDone ? '#10B981' : '#1C1917' }}>
            {isDone ? '✓' : stepNumber}
          </span>
        </div>
      </div>

      {/* Time display */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {isDone ? (
            <motion.p
              key="done"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-bold"
              style={{ color: '#10B981' }}
            >
              ✅ 완료!
            </motion.p>
          ) : (
            <motion.p
              key="time"
              className={`text-xl font-bold font-mono ${isRunning ? 'timer-active' : ''}`}
              style={{ color: isRunning ? '#D97706' : 'var(--text)' }}
            >
              {formatTime(timeLeft)}
            </motion.p>
          )}
        </AnimatePresence>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          총 {formatTime(seconds)}
        </p>
      </div>

      {/* Control button */}
      <button
        onClick={handleToggle}
        className="w-11 h-11 rounded-xl font-semibold text-sm transition-all"
        style={{
          background: isDone ? '#D1FAE5' : isRunning ? '#FEF3C7' : 'var(--primary)',
          color: isDone ? '#10B981' : isRunning ? '#D97706' : 'white',
          border: `2px solid ${isDone ? '#10B981' : isRunning ? '#F59E0B' : 'transparent'}`,
        }}
        aria-label={isDone ? '다시 시작' : isRunning ? '일시정지' : '시작'}
      >
        {isDone ? '↺' : isRunning ? '⏸' : '▶'}
      </button>
    </motion.div>
  );
}
