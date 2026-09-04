import { Cog } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

type GearConfig = {
  id: number;
  top: string;
  left: string;
  size: number;
  duration: number;
  direction: 1 | -1;
  delay: number;
};

const GEARS: GearConfig[] = [
  {
    id: 1,
    top: '6%',
    left: '4%',
    size: 32,
    duration: 14,
    direction: 1,
    delay: 0,
  },
  {
    id: 2,
    top: '12%',
    left: '82%',
    size: 40,
    duration: 20,
    direction: -1,
    delay: 0.04,
  },
  {
    id: 3,
    top: '28%',
    left: '10%',
    size: 24,
    duration: 11,
    direction: -1,
    delay: 0.08,
  },
  {
    id: 4,
    top: '22%',
    left: '72%',
    size: 28,
    duration: 16,
    direction: 1,
    delay: 0.02,
  },
  {
    id: 5,
    top: '44%',
    left: '3%',
    size: 36,
    duration: 18,
    direction: 1,
    delay: 0.06,
  },
  {
    id: 6,
    top: '52%',
    left: '88%',
    size: 30,
    duration: 13,
    direction: -1,
    delay: 0.1,
  },
  {
    id: 7,
    top: '68%',
    left: '14%',
    size: 22,
    duration: 10,
    direction: 1,
    delay: 0.05,
  },
  {
    id: 8,
    top: '74%',
    left: '78%',
    size: 38,
    duration: 22,
    direction: -1,
    delay: 0.03,
  },
  {
    id: 9,
    top: '84%',
    left: '42%',
    size: 26,
    duration: 15,
    direction: 1,
    delay: 0.07,
  },
  {
    id: 10,
    top: '36%',
    left: '92%',
    size: 20,
    duration: 9,
    direction: -1,
    delay: 0.09,
  },
  {
    id: 11,
    top: '58%',
    left: '58%',
    size: 18,
    duration: 12,
    direction: 1,
    delay: 0.11,
  },
];

type LoginGearFieldProps = {
  visible: boolean;
};

export function LoginGearField({ visible }: LoginGearFieldProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className='pointer-events-none absolute inset-0 z-[1] overflow-hidden'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          aria-hidden
        >
          {GEARS.map((gear) => (
            <motion.div
              key={gear.id}
              className='absolute'
              style={{
                top: gear.top,
                left: gear.left,
                color: 'hsl(var(--foreground) / 0.60)',
              }}
              initial={{ opacity: 0, scale: 0.35, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.35, rotate: 20 }}
              transition={{
                duration: 0.35,
                delay: gear.delay,
                ease: 'easeOut',
              }}
            >
              <Cog
                size={gear.size}
                strokeWidth={1.25}
                style={{
                  animation: `spin ${gear.duration}s linear infinite`,
                  animationDirection:
                    gear.direction === -1 ? 'reverse' : 'normal',
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
