
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Language, ScreenId, PetType, PetMood, Goal, PetGender, RecurrenceFrequency } from './types';
import { UI_STRINGS, PET_STYLES, GOAL_BANK, FEEDBACK_MESSAGES } from './constants';
// Claude API used instead of Gemini

// --- X Factor Calculation Functions ---
interface XFactorParams {
  consistency: 'Beginner' | 'Regular' | 'Active';
  previousDayStatus: 'All completed' | 'Partial' | 'None';
  streak: number;
}

const calculateXFactor = (categoryId: number, params: XFactorParams): number | string => {
  const { consistency, previousDayStatus, streak } = params;
  
  // Baseline values by consistency
  const baselines = {
    Beginner: { running: 1.5, walking: 10, warmup: 5, cooldown: 5, recovery: 15, hydration: 2 },
    Regular: { running: 3.5, walking: 20, warmup: 5, cooldown: 5, recovery: 15, hydration: 2 },
    Active: { running: 5, walking: 30, warmup: 5, cooldown: 5, recovery: 15, hydration: 2 }
  };
  
  // Determine category for the challenge ID
  const getCategory = (id: number): string => {
    if (id >= 1 && id <= 15) return 'running';
    if (id >= 16 && id <= 25) return 'walking';
    if (id >= 26 && id <= 35) return (id <= 28 || id === 33 || id === 34) ? 'warmup' : 'cooldown';
    if (id >= 36 && id <= 43) return 'recovery';
    if (id >= 44 && id <= 50) return 'hydration';
    return 'walking';
  };
  
  const category = getCategory(categoryId);
  let baseValue = baselines[consistency][category as keyof typeof baselines[typeof consistency]];
  
  // Apply progression or regression based on previous day
  if (previousDayStatus === 'All completed') {
    const multiplier = consistency === 'Active' ? 1.15 : 1.10;
    baseValue = baseValue * multiplier;
  } else if (previousDayStatus === 'None' && category === 'running') {
    baseValue = Math.max(1, baseValue * 0.8); // 20% regression
  }
  
  // Streak bonus (3+ streak gets +15%)
  if (streak >= 3) {
    const streakBonus = consistency === 'Active' ? 1.20 : 1.15;
    baseValue = baseValue * streakBonus;
  }
  
  // Round appropriately
  if (category === 'running' || category === 'walking') {
    // Running: round to nearest 0.5km
    if (category === 'running') {
      baseValue = Math.round(baseValue * 2) / 2;
    }
    // Walking: round to nearest 5 minutes
    if (category === 'walking') {
      baseValue = Math.round(baseValue / 5) * 5;
    }
  }
  
  // Apply minimums
  if (category === 'running') baseValue = Math.max(1, baseValue);
  if (category === 'walking') baseValue = Math.max(5, baseValue);
  
  // Special case for steps
  if (categoryId === 17) return Math.round(baseValue * 1000); // Convert to steps
  
  return baseValue;
};

// --- Types for Shop ---
interface ShopItem {
  id: string;
  nameEn: string;
  nameEs: string;
  price?: number;
  icon: string;
  isPremium?: boolean;
  category: 'cosmetic' | 'real';
}

const SHOP_ITEMS: ShopItem[] = [
  { id: 'hat', nameEn: 'Party Hat', nameEs: 'Gorrito de Fiesta', price: 50, icon: '🎩', category: 'cosmetic' },
  { id: 'bone', nameEn: 'Tasty Bone', nameEs: 'Hueso Sabroso', price: 25, icon: '🦴', category: 'cosmetic' },
  { id: 'ball', nameEn: 'Bouncy Ball', nameEs: 'Pelota Saltarina', price: 20, icon: '🎾', category: 'cosmetic' },
  { id: 'plant', nameEn: 'Desk Plant', nameEs: 'Planta de Escritorio', price: 40, icon: '🪴', category: 'cosmetic' },
  { id: 'console', nameEn: 'Next-Gen Console', nameEs: 'Consola Pro', icon: '🎮', category: 'cosmetic', isPremium: true },
  { id: 'amazon', nameEn: '$5 Amazon Gift Card', nameEs: '$5 Tarjeta Amazon', icon: '🛍️', category: 'real', isPremium: true },
  { id: 'coffee', nameEn: '$10 Coffee Card', nameEs: '$10 Tarjeta Café', icon: '☕', category: 'real', isPremium: true },
];

// --- Types for Animations ---
interface RewardParticle {
  id: number;
  x: number;
  y: number;
  type: 'xp' | 'pts';
  value: string;
}

// --- Pet Environment Background ---

const PetEnvironment: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => {
  return (
    <div className={`relative w-full overflow-hidden bg-[#F8F9FF] ${className}`}>
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4A3728 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
      
      {/* The Window */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 w-32 h-40 bg-white rounded-t-full border-[6px] border-[#E8E1D5] shadow-inner overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#DDD6F3] to-[#F8F9FF]">
          <div className="absolute top-4 right-4 w-8 h-8 bg-yellow-100 rounded-full blur-sm animate-pulse"></div>
          <div className="absolute -bottom-2 -left-4 w-40 h-20 bg-[#BBF7D0] rounded-full opacity-60"></div>
          <div className="absolute -bottom-6 -right-4 w-40 h-24 bg-[#86EFAC] rounded-full opacity-80"></div>
        </div>
        <div className="absolute inset-0 border-t-[3px] border-[#E8E1D5] top-1/2"></div>
        <div className="absolute inset-0 border-l-[3px] border-[#E8E1D5] left-1/2"></div>
      </div>

      {/* Floor */}
      <div className="absolute bottom-0 w-full h-[35%] bg-[#E8EAF6] border-t-2 border-[#E8E1D5]">
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-[2px] bg-[#4A3728] w-full mb-6" style={{ transform: `scaleX(${1 + i * 0.1})` }}></div>
          ))}
        </div>
      </div>

      {/* Rug */}
      <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[70%] h-16 bg-[#DDD6F3] rounded-[100%] opacity-40 blur-[2px] border-2 border-[#5D4DC0]/20"></div>

      <div className="relative z-10 flex flex-col items-center justify-center h-full pt-12">
        {children}
      </div>
    </div>
  );
};

// --- Animated Pixel Pet Engine ---

const AnimatedPixelPet: React.FC<{ 
  type: PetType; 
  styleId: string; 
  mood: PetMood; 
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isLevelingUp?: boolean;
  hasCrown?: boolean;
  speechBubble?: string | null;
  static?: boolean;
  purchasedIds?: string[];
}> = ({ type, styleId, mood, size = 'md', className = '', isLevelingUp = false, hasCrown = false, speechBubble = null, static: isStatic = false, purchasedIds = [] }) => {
  const style = PET_STYLES[type].find(s => s.id === styleId) || PET_STYLES[type][0];
  const sizeMap = { xs: 'w-8 h-8', sm: 'w-12 h-12', md: 'w-24 h-24', lg: 'w-32 h-32', xl: 'w-44 h-44' };
  const isDog = type === 'dog';
  const outlineColor = "#111827";
  const shadowColor = "rgba(0,0,0,0.12)";
  const isShepherd = styleId === 'shepherd';

  const [animState, setAnimState] = useState<'idle' | 'approach' | 'interact' | 'return'>('idle');

  useEffect(() => {
    if (isStatic) return;
    
    const hasSeenApproach = sessionStorage.getItem('hasSeenPetApproach');
    
    if (!hasSeenApproach) {
      const sequence = async () => {
        await new Promise(r => setTimeout(r, 800));
        setAnimState('approach');
        await new Promise(r => setTimeout(r, 2000));
        setAnimState('interact');
        await new Promise(r => setTimeout(r, 2500));
        setAnimState('return');
        await new Promise(r => setTimeout(r, 1500));
        setAnimState('idle');
        sessionStorage.setItem('hasSeenPetApproach', 'true');
      };
      sequence();
    }
  }, [isStatic]);

  const renderPattern = (area: 'body' | 'head') => {
    if (style.pattern === 'solid') return null;
    if (style.pattern === 'saddle' && area === 'body') return <path d="M38 50 q12 -5 24 0 v15 q-12 5 -24 0 Z" fill={style.secondary} opacity="0.8" />;
    if (style.pattern === 'spots') return (
      <g opacity="0.6" fill={style.secondary}>
        {area === 'body' ? (<><circle cx="45" cy="55" r="4" /><circle cx="55" cy="65" r="3" /><circle cx="42" cy="72" r="2.5" /></>) : (<><circle cx="45" cy="32" r="2.5" /><circle cx="55" cy="38" r="2" /></>)}
      </g>
    );
    if (style.pattern === 'points' && area === 'head') return <circle cx="50" cy="45" r="10" fill={style.secondary} opacity="0.9" />;
    return null;
  };

  const hasItem = (id: string) => purchasedIds.includes(id);

  // Variants
  const containerVariants = {
    idle: { scale: 1, y: 0 },
    approach: { scale: 1.4, y: -20, transition: { duration: 1.5, ease: "circOut" } },
    interact: { scale: 1.4, y: -20 },
    return: { scale: 1, y: 0, transition: { duration: 1.2, ease: "easeInOut" } }
  };

  const headVariants = {
    idle: { 
      rotate: [0, -3, 3, 0, 8, 0, -8, 0],
      transition: { 
        repeat: Infinity, 
        duration: 10, 
        times: [0, 0.1, 0.2, 0.3, 0.5, 0.7, 0.8, 1],
        ease: "easeInOut" 
      }
    },
    interact: isDog ? {
      y: [0, 4, 0, 4, 0],
      scale: 1.1,
      transition: { duration: 1, repeat: 2 }
    } : {
      rotate: [0, 10, -10, 10, -10, 0],
      transition: { duration: 0.5, repeat: 4 }
    }
  };

  const tailVariants = {
    idle: {
      rotate: isDog ? [-15, 15, -15] : [-8, 8, -8],
      transition: { 
        repeat: Infinity, 
        duration: mood === PetMood.HAPPY ? (isDog ? 0.4 : 1.2) : (isDog ? 0.8 : 2.5), 
        ease: "easeInOut" 
      }
    }
  };

  const bodyVariants = {
    idle: {
      scale: [1, 1.04, 1],
      transition: { repeat: Infinity, duration: 3, ease: "easeInOut" }
    }
  };

  const eyeVariants = {
    idle: {
      scaleY: [1, 1, 0, 1, 1],
      transition: { 
        repeat: Infinity, 
        duration: 4, 
        times: [0, 0.85, 0.9, 0.95, 1],
        ease: "easeInOut"
      }
    }
  };

  const pawVariants = {
    idle: { y: 0, x: 0 },
    interact: !isDog ? {
      y: [0, -15, 0],
      x: [0, 8, 0],
      transition: { duration: 0.5, repeat: 4 }
    } : { y: 0 }
  };

  return (
    <motion.div 
      variants={containerVariants}
      animate={isStatic ? "idle" : animState}
      className={`relative flex items-center justify-center ${sizeMap[size]} ${className} ${!isStatic && isLevelingUp ? 'animate-bounce' : ''}`}
    >
      {speechBubble && !isStatic && (
        <div className="absolute -top-16 z-[60] w-48 animate-in fade-in zoom-in slide-in-from-bottom-2 duration-300 pointer-events-none">
          <div className="bg-white px-4 py-3 rounded-[2rem] shadow-2xl border-[3px] border-[#111827] relative">
             <p className="text-[11px] font-black text-gray-900 leading-tight text-center">{speechBubble}</p>
             <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b-[3px] border-r-[3px] border-[#111827] rotate-45"></div>
          </div>
        </div>
      )}
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl overflow-visible">
        <ellipse cx="50" cy="92" rx="35" ry="5" fill={shadowColor} />
        
        {/* Background Items */}
        {hasItem('plant') && <text x="75" y="85" fontSize="16">🪴</text>}
        {hasItem('console') && <text x="10" y="85" fontSize="16">🎮</text>}

        <motion.g 
          variants={tailVariants} 
          animate={isStatic ? "" : "idle"} 
          style={{ transformOrigin: "68px 80px" }}
        >
          <path d={isDog ? "M68 80 Q85 85 85 70" : "M68 80 Q95 75 75 55"} stroke={outlineColor} strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d={isDog ? "M68 80 Q85 85 85 70" : "M68 80 Q95 75 75 55"} stroke={style.secondary || style.primary} fill="none" strokeWidth="4" strokeLinecap="round" />
        </motion.g>

        <motion.g variants={bodyVariants} animate={isStatic ? "" : "idle"} style={{ originX: "50px", originY: "80px" }}>
          <ellipse cx="35" cy="78" rx="10" ry="12" fill={style.primary} stroke={outlineColor} strokeWidth="2.5" />
          <ellipse cx="65" cy="78" rx="10" ry="12" fill={style.primary} stroke={outlineColor} strokeWidth="2.5" />
          <ellipse cx="32" cy="88" rx="5" ry="3" fill={style.primary} stroke={outlineColor} strokeWidth="2" />
          <ellipse cx="68" cy="88" rx="5" ry="3" fill={style.primary} stroke={outlineColor} strokeWidth="2" />
          
          <path d="M32 82 Q32 38 50 38 Q68 38 68 82 Z" fill={style.primary} stroke={outlineColor} strokeWidth="3" />
          {renderPattern('body')}
        </motion.g>

        {/* Floor Items */}
        {hasItem('ball') && <text x="25" y="90" fontSize="14" className="animate-bounce">🎾</text>}
        {hasItem('bone') && <text x="65" y="90" fontSize="14">🦴</text>}

        <motion.g variants={pawVariants} animate={isStatic ? "" : animState} style={{ originX: "50px", originY: "70px" }}>
          <rect x="42" y="65" width="6" height="23" rx="3" fill={style.primary} stroke={outlineColor} strokeWidth="2" />
          <rect x="52" y="65" width="6" height="23" rx="3" fill={style.primary} stroke={outlineColor} strokeWidth="2" />
          <circle cx="45" cy="88" r="4" fill={style.primary} stroke={outlineColor} strokeWidth="2" />
          <circle cx="55" cy="88" r="4" fill={style.primary} stroke={outlineColor} strokeWidth="2" />
        </motion.g>

        <motion.g variants={headVariants} animate={isStatic ? "" : animState} style={{ originX: "50px", originY: "50px" }}>
          <circle cx="50" cy="40" r="18" fill={style.primary} stroke={outlineColor} strokeWidth="3" />
          <ellipse cx="50" cy="48" rx={isDog ? 10 : 8} ry={isDog ? 8 : 6} fill={style.secondary || style.primary} stroke={outlineColor} strokeWidth="2" />
          {renderPattern('head')}
          
          <motion.g variants={eyeVariants} animate={isStatic ? "" : "idle"} style={{ originX: "50px", originY: "38px" }}>
            <circle cx="42" cy="38" r="2.5" fill={outlineColor} />
            <circle cx="58" cy="38" r="2.5" fill={outlineColor} />
          </motion.g>

          <rect x="48" y="46" width="4" height="3" rx="1.5" fill={outlineColor} />
          <path d="M47 51 q3 2 6 0" stroke={outlineColor} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          
          <g stroke={outlineColor} strokeWidth="2.5" strokeLinejoin="round">
            {isDog ? (isShepherd ? (<><path d="M36 26 L40 5 L48 26" fill={style.secondary || style.primary} /><path d="M64 26 L60 5 L52 26" fill={style.secondary || style.primary} /></>) : (<><path d="M36 28 Q24 24 24 48 Q24 62 36 60 Q40 55 36 28 Z" fill={style.secondary || style.primary} stroke={outlineColor} strokeWidth="2.5" /><path d="M64 28 Q76 24 76 48 Q76 62 64 60 Q60 55 64 28 Z" fill={style.secondary || style.primary} stroke={outlineColor} strokeWidth="2.5" /></>)) : (<><path d="M36 30 L40 8 L50 25 Z" fill={style.primary} /></>)}
          </g>
          {/* Hat Accessory */}
          {hasItem('hat') && <text x="40" y="25" fontSize="20" className="animate-pulse">🎩</text>}
        </motion.g>
        {hasCrown && <text x="38" y="15" fontSize="18" className="animate-bounce">👑</text>}
      </svg>
    </motion.div>
  );
};

// --- Helper Components ---

const Button: React.FC<{ onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'premium'; className?: string; children: React.ReactNode }> = ({ onClick, disabled, variant = 'primary', className = '', children }) => {
  const variants = {
    primary: "bg-[#5D4DC0] text-white shadow-[#5D4DC0]/30 shadow-xl",
    secondary: "bg-gray-50 text-gray-700 border-2 border-gray-200",
    premium: "bg-gradient-to-r from-[#5D4DC0] to-purple-500 text-white shadow-[#5D4DC0]/30 shadow-lg"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`w-full py-5 px-6 rounded-full font-black transition-all active:scale-95 flex items-center justify-center text-xl ${variants[variant]} ${disabled ? 'opacity-30 grayscale cursor-not-allowed' : ''} ${className}`}>
      {children}
    </button>
  );
};

const ScreenWrapper: React.FC<{ children: React.ReactNode; bgColor?: string }> = ({ children, bgColor = "bg-white" }) => {
  return (
    <div className={`fixed inset-0 flex flex-col ${bgColor} overflow-hidden max-w-md mx-auto border-x-2 border-gray-100 shadow-2xl font-sans`}>
      {children}
    </div>
  );
};

// --- Modal Component ---
const BottomModal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose}></div>
      <div className="bg-white w-full max-w-md rounded-t-[3rem] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom-full duration-300 relative border-t-2 border-gray-100 z-[210] max-h-[85vh] flex flex-col">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 shrink-0"></div>
        <h3 className="text-xl font-black text-gray-900 mb-6 text-center shrink-0">{title}</h3>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Level Up Celebration ---
const LevelUpCelebration: React.FC<{ 
  level: number; 
  dialogue: string; 
  petType: PetType; 
  petStyleId: string; 
  onClose: () => void;
  lang: Language;
  purchasedIds?: string[];
}> = ({ level, dialogue, petType, petStyleId, onClose, lang, purchasedIds = [] }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-[#5D4DC0]/95 backdrop-blur-2xl"
    >
      <div className="flex flex-col items-center text-center max-w-sm w-full gap-8">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, delay: 0.2 }}
          className="relative"
        >
          <div className="absolute -inset-8 bg-white/20 blur-3xl rounded-full animate-pulse"></div>
          <AnimatedPixelPet type={petType} styleId={petStyleId} mood={PetMood.HAPPY} size="lg" purchasedIds={purchasedIds} />
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-12 -right-4 text-6xl"
          >
            ✨
          </motion.div>
          <motion.div 
            animate={{ y: [0, -15, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, delay: 0.5 }}
            className="absolute -top-8 -left-8 text-5xl"
          >
            ⭐
          </motion.div>
        </motion.div>

        <div className="space-y-4">
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-5xl font-black text-white tracking-tighter"
          >
            {lang === 'en' ? 'LEVEL UP!' : '¡NUEVO NIVEL!'}
          </motion.h2>
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="inline-block bg-white text-[#5D4DC0] px-8 py-3 rounded-full font-black text-2xl shadow-2xl"
          >
            L{level}
          </motion.div>
        </div>

        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-white/90 font-bold text-xl italic leading-relaxed px-4"
        >
          “{dialogue}”
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1 }}
          className="w-full"
        >
          <button 
            onClick={onClose}
            className="w-full bg-white text-[#5D4DC0] hover:bg-white/90 shadow-xl py-6 rounded-[2rem] text-xl font-black transition-all active:scale-95"
          >
            {lang === 'en' ? 'Keep Going' : 'Continuar'}
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('es'); 
  const [activeScreen, setActiveScreen] = useState<ScreenId>('INITIAL_SPLASH');
  const [userName, setUserName] = useState('');
  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState<PetType>('dog');
  const [petStyleId, setPetStyleId] = useState('golden');
  const [petGender, setPetGender] = useState<PetGender>(null);
  const [userAge, setUserAge] = useState('');
  const [userGenderSelection, setUserGenderSelection] = useState('');
  const [userActivitySelection, setUserActivitySelection] = useState('');
  const [userMainGoal, setUserMainGoal] = useState('');
  const [userMoodSelection, setUserMoodSelection] = useState('');
  const [xp, setXp] = useState(0);
  const [pts, setPts] = useState(0);
  const [level, setLevel] = useState(1);
  const [dailyGoals, setDailyGoals] = useState<Goal[]>([]);
  const [completedGoalIds, setCompletedGoalIds] = useState<number[]>([]);
  const [hiddenGoalIds, setHiddenGoalIds] = useState<number[]>([]);
  const [userEnergy, setUserEnergy] = useState<number>(3);
  const [userTimeInvestment, setUserTimeInvestment] = useState('');
  const [totalSystemQuestsCompleted, setTotalSystemQuestsCompleted] = useState(0);
  const [dailyManualXp, setDailyManualXp] = useState(0);
  const [dailyManualPts, setDailyManualPts] = useState(0);
  const [previousDayStats, setPreviousDayStats] = useState<{ tasks: Goal[], completedIds: number[] } | null>(null);
  const [streak, setStreak] = useState(0);
  const [selectedGoalForDetail, setSelectedGoalForDetail] = useState<Goal | null>(null);
  const [hasCrown, setHasCrown] = useState(false);
  const [petSpeech, setPetSpeech] = useState<string | null>(null);
  const [isWelcomeBack, setIsWelcomeBack] = useState(false);
  const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ level: number; dialogue: string }>({ level: 1, dialogue: '' });

  // --- Custom Goal State ---
  const [customGoalName, setCustomGoalName] = useState('');
  const [customGoalCategory, setCustomGoalCategory] = useState('None');
  const [customGoalInstructionsEn, setCustomGoalInstructionsEn] = useState<string | undefined>(undefined);
  const [customGoalInstructionsEs, setCustomGoalInstructionsEs] = useState<string | undefined>(undefined);
  const [customGoalRepeat, setCustomGoalRepeat] = useState(false);
  const [customGoalFrequency, setCustomGoalFrequency] = useState<RecurrenceFrequency>(null);
  const [customGoalEndDate, setCustomGoalEndDate] = useState<string | null>(null);
  
  // --- Modals State ---
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isFreqModalOpen, setIsFreqModalOpen] = useState(false);
  const [libraryActiveCategory, setLibraryActiveCategory] = useState('Gym');
  const [isPremiumTrialModalOpen, setIsPremiumTrialModalOpen] = useState(false);
  
  // --- Particle State ---
  const [particles, setParticles] = useState<RewardParticle[]>([]);

  // --- Shop Interaction State ---
  const [purchasedIds, setPurchasedIds] = useState<string[]>([]);
  const [shopFeedback, setShopFeedback] = useState<string | null>(null);

  const t = UI_STRINGS[lang];
  const navigateTo = (next: ScreenId) => setActiveScreen(next);

  const getXpThreshold = (lvl: number): number => {
    if (lvl === 1) return 5; // Quests for Level 2
    const thresholds: Record<number, number> = {
      2: 150, 3: 250, 4: 370, 5: 510, 6: 670, 7: 850, 8: 1050, 9: 1270,
      10: 1510, 11: 1770, 12: 2050, 13: 2350, 14: 2670, 15: 3010,
      16: 3370, 17: 3750, 18: 4150, 19: 4570
    };
    if (thresholds[lvl]) return thresholds[lvl];
    if (lvl >= 20) {
      return 4570 + (lvl - 19) * 500;
    }
    return 100;
  };

  const addXp = (amount: number) => {
    if (level === 1) {
      // Level 1 logic is handled by totalSystemQuestsCompleted in handleGoalCompletion
      // But for check-in or other sources, we might want to add to XP if it's not system quests?
      // Actually, prompt says Level 1 to 2 is ONLY via 5 system quests.
      // "If the user completes fewer than 5 quests on their first day they do not reach Level 2 until they complete the remaining quests across the following days."
      // So check-in XP at Level 1 should probably be ignored or stored for later?
      // Let's assume it's ignored for Level 1 to keep the "5 quests" rule strict.
      return;
    }

    setXp(prevXp => {
      const totalXp = prevXp + amount;
      const threshold = getXpThreshold(level);
      if (totalXp >= threshold) {
        const nextLevel = level + 1;
        setLevel(nextLevel);
        if (nextLevel === 5) setHasCrown(true);
        
        // Level up dialogue
        let dialogue = lang === 'en' ? "We did this together. Keep going." : "Lo logramos juntos. Sigamos adelante.";
        if (nextLevel % 5 === 0) {
          dialogue = lang === 'en' ? "Look how far we have come. I am proud of us." : "Mira lo lejos que hemos llegado. Estoy orgulloso de nosotros.";
        }
        if (nextLevel === 10) {
          dialogue = lang === 'en' ? "Level 10. You have been showing up and it shows." : "Nivel 10. Has estado aquí y se nota.";
        }
        if (nextLevel === 20) {
          dialogue = lang === 'en' ? "Level 20. Most people never make it here. You did." : "Nivel 20. La mayoría nunca llega aquí. Tú lo lograste.";
        }
        
        // Trigger celebration modal
        setLevelUpData({ level: nextLevel, dialogue });
        setIsLevelUpModalOpen(true);
        setPetSpeech(dialogue);
        
        return totalXp - threshold;
      }
      return totalXp;
    });
  };

  const handleGoalCompletion = (goal: Goal, e: React.MouseEvent | null, isPartial: boolean = false) => {
    if (completedGoalIds.includes(goal.id)) return;
    
    let addedXpVal = 0;
    let addedPtsVal = 0;
    const isSystem = goal.type === 'primary' || goal.type === 'support';

    if (isSystem) {
      if (isPartial) {
        addedXpVal = 5;
        addedPtsVal = 0;
      } else {
        addedXpVal = goal.type === 'primary' ? 15 : 10;
        addedPtsVal = goal.type === 'primary' ? 5 : 3;
        if (goal.category === 'Hydration' || goal.category === 'Running') {
          addedPtsVal += 2;
        }
      }
      setTotalSystemQuestsCompleted(prev => prev + 1);
    } else {
      // Manual quest
      const xpToGive = isPartial ? 4 : 8;
      const ptsToGive = isPartial ? 0 : 2;
      
      const remainingXpCap = 40 - dailyManualXp;
      const remainingPtsCap = 10 - dailyManualPts;
      
      addedXpVal = Math.max(0, Math.min(xpToGive, remainingXpCap));
      addedPtsVal = Math.max(0, Math.min(ptsToGive, remainingPtsCap));
      
      setDailyManualXp(prev => prev + addedXpVal);
      setDailyManualPts(prev => prev + addedPtsVal);
    }

    if (e) {
      const newParticles: RewardParticle[] = [
        { id: Date.now() + 1, x: e.clientX, y: e.clientY, type: 'xp', value: `+${addedXpVal} XP` },
        { id: Date.now() + 2, x: e.clientX, y: e.clientY, type: 'pts', value: `+${addedPtsVal} 🪙` }
      ];
      setParticles(prev => [...prev, ...newParticles]);

      // Cleanup particles after animation (match duration in CSS - 2.5s)
      setTimeout(() => {
        setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
        // Disappear goal after particles finish
        setHiddenGoalIds(prev => [...prev, goal.id]);
      }, 2500);
    } else {
      setHiddenGoalIds(prev => [...prev, goal.id]);
    }

    // Show motivational feedback bubble
    const randomMsg = FEEDBACK_MESSAGES[Math.floor(Math.random() * FEEDBACK_MESSAGES.length)];
    setPetSpeech(randomMsg[lang]);

    // Cleanup feedback bubble after 3.5s
    setTimeout(() => {
        setPetSpeech(null);
    }, 3500);

    setCompletedGoalIds(prev => [...prev, goal.id]);
    
    if (level === 1) {
      // Fast track logic
      const currentTotal = isSystem ? totalSystemQuestsCompleted + 1 : totalSystemQuestsCompleted;
      if (currentTotal >= 5) {
        const nextLevel = 2;
        const dialogue = lang === 'en' ? "We did it. This is just the beginning." : "Lo logramos. Esto es solo el comienzo.";
        setLevel(nextLevel);
        setXp(0);
        setLevelUpData({ level: nextLevel, dialogue });
        setIsLevelUpModalOpen(true);
        setPetSpeech(dialogue);
      } else {
        if (isSystem) setXp(currentTotal);
      }
    } else {
      // Normal progression
      addXp(addedXpVal);
    }

    setPts(prev => prev + addedPtsVal);
  };

  const handleSaveCustomGoal = () => {
    const newGoal: Goal = {
      id: Date.now(),
      category: customGoalCategory,
      en: customGoalName,
      es: customGoalName,
      type: 'custom',
      exampleEn: customGoalInstructionsEn,
      exampleEs: customGoalInstructionsEs,
      repeat: customGoalRepeat,
      frequency: customGoalFrequency,
      endDate: customGoalEndDate
    };
    setDailyGoals(prev => [...prev, newGoal]);
    // Reset form
    setCustomGoalName('');
    setCustomGoalCategory('None');
    setCustomGoalInstructionsEn(undefined);
    setCustomGoalInstructionsEs(undefined);
    setCustomGoalRepeat(false);
    setCustomGoalFrequency(null);
    setCustomGoalEndDate(null);
    navigateTo('DASHBOARD');
  };

  const generateQuests = async () => {
    navigateTo('THINKING');
    try {

      const consistency = userActivitySelection === 'level3' ? 'Active' : userActivitySelection === 'level2' ? 'Regular' : 'Beginner';
      const prevStatus = previousDayStats 
        ? (previousDayStats.completedIds.length === previousDayStats.tasks.length ? 'All completed' : previousDayStats.completedIds.length > 0 ? 'Partial' : 'None') 
        : 'None';

      // Calculate X factors for each challenge ID
      const xFactors: Record<number, number | string> = {};
      for (let i = 1; i <= 50; i++) {
        xFactors[i] = calculateXFactor(i, {
          consistency,
          previousDayStatus: prevStatus,
          streak: streak || 0
        });
      }

      // Create an enriched goal bank with pre-calculated X values
      const enrichedGoalBank = GOAL_BANK.map(goal => ({
        ...goal,
        calculatedX: xFactors[goal.id],
        en: goal.en.replace('{X}', String(xFactors[goal.id])),
        es: goal.es.replace('{X}', String(xFactors[goal.id]))
      }));

      const prompt = `
      LANGUAGE RULE:
      If the user selected Spanish (lang: 'es'), respond ENTIRELY in Spanish — all task names, pet dialogue, and copy. 
      If English (lang: 'en') was selected, respond in English. Never mix languages.

      CORE IDENTITY:
      You are the AI challenge generator for HealthQuest, a running and wellness companion app for joggers and walkers. Every challenge you generate must be scoped to the running community. You do not generate generic wellness tasks. Every primary challenge must relate to running, jogging, walking, warm-up, cool-down, or running-specific recovery.

      INPUTS:
      1. CONSISTENCY: ${consistency}
      2. MOOD: ${userMoodSelection}
      3. ENERGY: ${userEnergy} (1-5 scale)
      4. TIME: ${userTimeInvestment}
      5. PREVIOUS DAY completion status: ${prevStatus}
      6. STREAK: ${streak || 0}
      7. PREVIOUS TASKS: ${previousDayStats ? JSON.stringify(previousDayStats.tasks.map(t => ({ text: lang === 'en' ? t.en : t.es, completed: previousDayStats.completedIds.includes(t.id) }))) : 'None'}

      IMPORTANT NOTE:
      The X values have been PRE-CALCULATED based on the user's consistency level, previous day performance, and streak.
      The challenge bank below contains the EXACT challenges to suggest with X values already filled in.
      DO NOT recalculate or change these X values - they are personalized and correct.

      BASELINE BY CONSISTENCY LEVEL:
      - BEGINNER (1-2x per week): Jog 1-2km, Walk 10-15 min. Max 3km.
      - REGULAR (3-4x per week): Jog 3-4km, Walk 20-25 min.
      - ACTIVE (5-7x per week): Jog 5km+, Walk 30 min. Progression multiplier is 15%.

      TASK SELECTION MATRIX:
      - ALWAYS suggest 3 to 4 tasks in total.
      - AT LEAST ONE task MUST be from the 'Recovery' category (IDs 36-43).
      - Energetic / High Energy (4-5) / 30+ min: Tier 3 (Main) + 2-3 Support (including 1 Recovery)
      - Calm / Medium Energy (3) / 20 min: Tier 2 (Main) + 2-3 Support (including 1 Recovery)
      - Tired / Low Energy (1-2) / 10 min: Tier 1 (Main) + 2 Support (including 1 Recovery)
      - Stressed: Tier 1 (Walking/Recovery only) + 1 Hydration + 1-2 Recovery

      HARD RULES:
      - ALWAYS include exactly 3 or 4 tasks.
      - ALWAYS include at least one task from the 'Recovery' category.
      - NEVER suggest running to Stressed users or if energy is 1-2.
      - NEVER suggest running if energy is 1-2, regardless of mood.
      - NEVER suggest running challenges if previous day status is 'None'.
      - Always frame challenges positively.
      - Use the challenge text AS-IS from the bank below - do not modify the X values.

      PET DIALOGUE BY MOOD:
      - Energetic: "You've got great energy today. Let's make the most of it together."
      - Calm: "Today feels steady. A good pace is all you need."
      - Tired: "Your body needs care today. Let's keep it gentle."
      - Stressed: "No pressure today. Just a little movement and some rest."
      - Energy 1-2: "Rest is progress too. Take care of yourself today."
      - Full Completion Celebration: "You showed up and gave everything today. That is what it is all about."

      CHALLENGE BANK (IDs 1-50) - X values are pre-calculated:
      ${JSON.stringify(enrichedGoalBank.map(g => ({
        id: g.id,
        category: g.category,
        en: g.en,
        es: g.es
      })))}

      Return JSON ONLY with no markdown, no backticks, no explanation:
      {
        "tasks": [
          {
            "id": number (1-50),
            "text": "string (Use EXACTLY as provided in the challenge bank)",
            "category": "string"
          }
        ],
        "petDialogue": "string"
      }`;

      const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const claudeData = await claudeResponse.json();
      const rawText = claudeData.content?.map((b: any) => b.type === 'text' ? b.text : '').join('') || '{}';
      const clean = rawText.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);

      const selectedTasks = result.tasks || [];
      setPetSpeech(result.petDialogue || null);
      
      const newGoals = selectedTasks.map((selection: any, idx: number) => {
        const baseGoal = GOAL_BANK.find(g => g.id === selection.id) || GOAL_BANK[0];
        const xValue = xFactors[selection.id];
        return { 
          ...baseGoal, 
          type: idx < 3 ? 'primary' : 'support', 
          xValue: xValue,
          en: lang === 'en' ? selection.text : baseGoal.en.replace('{X}', String(xValue)),
          es: lang === 'es' ? selection.text : baseGoal.es.replace('{X}', String(xValue)),
          category: selection.category || baseGoal.category
        };
      });
      setDailyGoals(newGoals);
      setHiddenGoalIds([]);
      setCompletedGoalIds([]);
      setTimeout(() => navigateTo('MOTIVATION'), 1500);
    } catch (e) {
      console.error("[v0] Error generating quests:", e);
      // Fallback: 3 regular tasks + 1 recovery task with basic X values
      const consistency = userActivitySelection === 'level3' ? 'Active' : userActivitySelection === 'level2' ? 'Regular' : 'Beginner';
      const fallbackXFactors: Record<number, number | string> = {};
      for (let i = 1; i <= 50; i++) {
        fallbackXFactors[i] = calculateXFactor(i, {
          consistency,
          previousDayStatus: 'Partial',
          streak: streak || 0
        });
      }
      
      const regularTasks = GOAL_BANK.slice(0, 3);
      const recoveryTask = GOAL_BANK.find(g => g.category === 'Recovery') || GOAL_BANK[35];
      const fallbackTasks = [...regularTasks, recoveryTask].map((g, i) => ({
        ...g,
        type: i < 3 ? 'primary' : 'support',
        xValue: fallbackXFactors[g.id],
        en: g.en.replace('{X}', String(fallbackXFactors[g.id])),
        es: g.es.replace('{X}', String(fallbackXFactors[g.id]))
      }));
      setDailyGoals(fallbackTasks);
      setHiddenGoalIds([]);
      setCompletedGoalIds([]);
      setTimeout(() => navigateTo('MOTIVATION'), 1500);
    }
  };

  const handlePurchase = (item: ShopItem) => {
    if (item.isPremium) {
      setIsPremiumTrialModalOpen(true);
      return;
    }

    const price = item.price || 0;
    if (pts >= price) {
      setPts(prev => prev - price);
      setPurchasedIds(prev => [...prev, item.id]);
      setShopFeedback(lang === 'en' ? `Bought ${item.nameEn}! ✨` : `¡Compraste ${item.nameEs}! ✨`);
      setTimeout(() => setShopFeedback(null), 2000);
    } else {
      setShopFeedback(lang === 'en' ? 'Not enough points! 🪙' : '¡Puntos insuficientes! 🪙');
      setTimeout(() => setShopFeedback(null), 2000);
    }
  };

  const getInterpolatedGoalText = (goal: Goal) => {
    const template = lang === 'en' ? goal.en : goal.es;
    let text = template;
    if (goal.xValue !== undefined) text = text.replace('{X}', goal.xValue.toString());
    if (goal.yValue !== undefined) text = text.replace('{Y}', goal.yValue.toString());
    return text;
  };

  const getGoalEmoji = (category: string) => {
    if (category === 'Running') return '🏃';
    if (category === 'Walking') return '🚶';
    if (category === 'Warm-up') return '🤸';
    if (category === 'Cool-down') return '🧘';
    if (category === 'Recovery') return '😴';
    if (category === 'Hydration') return '💧';
    return '✨';
  };

  const libraryGoals = useMemo(() => {
    const filtered = GOAL_BANK.filter(g => g.category === libraryActiveCategory);
    // Rough scaling logic based on energy
    const energyMult = userEnergy / 3; // 0.33 to 1.66
    
    return filtered.map(g => {
        let xVal = g.baseValue ? Math.round(g.baseValue * energyMult) : undefined;
        let yVal = undefined;

        // Specialized scaling for the new categories
        if (g.category === 'Running') {
            xVal = Math.max(1, Math.round((g.baseValue || 2) * energyMult)); // km
        } else if (g.category === 'Walking') {
            xVal = Math.max(1000, Math.round((g.baseValue || 3000) * energyMult)); // steps
            xVal = Math.round(xVal / 500) * 500; // Round to nearest 500
        } else if (g.category === 'Warm-up' || g.category === 'Cool-down' || g.category === 'Recovery' || g.category === 'Hydration') {
            xVal = g.baseValue; // Keep base values for these
        }

        return {
            ...g,
            xValue: xVal,
            yValue: yVal
        };
    });
  }, [libraryActiveCategory, userEnergy]);

  const renderGoalItem = (goal: Goal) => {
    const goalText = getInterpolatedGoalText(goal);
    const isComplete = completedGoalIds.includes(goal.id);
    const isHidden = hiddenGoalIds.includes(goal.id);
    const hasInstructions = lang === 'en' ? !!goal.exampleEn : !!goal.exampleEs;

    return (
      <div 
        key={goal.id} 
        className={`w-full flex justify-center transition-all duration-300 ${isHidden ? 'opacity-0 scale-95 h-0 overflow-hidden !m-0 !p-0 pointer-events-none' : 'h-auto mb-3'}`}
      >
        <div 
          onClick={(e) => handleGoalCompletion(goal, e)} 
          className={`w-full max-w-[340px] py-3 px-4 rounded-[2.5rem] border-2 flex flex-row items-center gap-3 transition-all shadow-md cursor-pointer active:scale-95 ${isComplete ? 'bg-gray-50 border-gray-100 grayscale opacity-60' : goal.type === 'primary' ? 'border-indigo-50 bg-white' : goal.type === 'custom' ? 'border-purple-50 bg-white' : 'border-blue-50 bg-white'}`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-inner ${goal.type === 'primary' ? 'bg-indigo-50' : goal.type === 'custom' ? 'bg-purple-50' : 'bg-blue-50'}`}>
            <span>{getGoalEmoji(goal.category)}</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className={`font-black text-gray-800 leading-tight ${goalText.length > 30 ? 'text-[11px]' : 'text-xs'}`}>
               {goalText}
            </p>
            {!isComplete && hasInstructions && (
               <button 
                 onClick={(e) => { e.stopPropagation(); setSelectedGoalForDetail(goal); }} 
                 className="text-[10px] font-black text-blue-600 hover:text-blue-700 underline mt-0.5 block transition-colors text-left"
               >
                 {t.howToDoit}
               </button>
            )}
          </div>
          <div className="shrink-0">
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isComplete ? 'bg-blue-50 border-blue-200' : 'border-gray-100 bg-gray-50/50'}`}>
              {isComplete && <span className="text-blue-500 text-lg font-black">✓</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSimulateNextDay = () => {
    // Save previous day stats
    setPreviousDayStats({
      tasks: dailyGoals,
      completedIds: completedGoalIds
    });

    // Update streak
    const primaryTasks = dailyGoals.filter(g => g.type === 'primary');
    const completedPrimaryCount = primaryTasks.filter(g => completedGoalIds.includes(g.id)).length;
    if (completedPrimaryCount === primaryTasks.length && primaryTasks.length > 0) {
      setStreak(prev => prev + 1);
    } else {
      setStreak(0);
    }

    setCompletedGoalIds([]);
    setHiddenGoalIds([]);
    setDailyManualXp(0);
    setDailyManualPts(0);
    
    // Check-in reward
    addXp(2);
    setPts(prev => prev + 1);

    setIsWelcomeBack(true);
    navigateTo('INITIAL_SPLASH');
    setTimeout(() => {
      navigateTo('MOOD_CHECK');
    }, 2000);
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'INITIAL_SPLASH':
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center" onClick={() => !isWelcomeBack && navigateTo('LANGUAGE')}>
            <div className="w-24 h-24 bg-[#5D4DC0] rounded-[2.5rem] flex items-center justify-center shadow-2xl mb-8">
              <span className="text-4xl">🤍</span>
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tighter mb-4">HealthQuest</h1>
            {!isWelcomeBack && <p className="text-gray-300 font-black text-xs animate-bounce uppercase">Press to Start</p>}
          </div>
        );
      case 'LANGUAGE':
        return (
          <div className="flex-1 flex flex-col justify-center p-8 gap-6 overflow-y-auto custom-scrollbar">
            <h2 className="text-3xl font-black text-gray-900 text-center mb-4">Choose Language<br/><span className="text-[#5D4DC0] text-xl">Elige tu idioma</span></h2>
            <Button onClick={() => { setLang('en'); navigateTo('INTRO_1'); }}>English</Button>
            <Button onClick={() => { setLang('es'); navigateTo('INTRO_1'); }}>Español</Button>
          </div>
        );
      case 'INTRO_1':
      case 'INTRO_2':
      case 'INTRO_3':
        const introData = {
          INTRO_1: { title: t.intro1Title, text: t.intro1Text, icon: '🤖', next: 'INTRO_2' as ScreenId },
          INTRO_2: { title: t.intro2Title, text: t.intro2Text, icon: '🤝', next: 'INTRO_3' as ScreenId },
          INTRO_3: { title: t.intro3Title, text: t.intro3Text, icon: '🛡️', next: 'PET_SELECTION' as ScreenId }
        }[activeScreen as 'INTRO_1' | 'INTRO_2' | 'INTRO_3'];
        return (
          <div className="flex-1 flex flex-col p-6 text-center justify-center gap-4 overflow-y-auto custom-scrollbar">
            <h2 className="text-xl font-black text-gray-900">{introData.title}</h2>
            <div className="bg-white border-2 border-gray-100 rounded-[2.5rem] p-6 shadow-xl space-y-4 flex flex-col items-center">
              <span className="text-5xl">{introData.icon}</span>
              <p className="text-slate-600 font-bold text-base italic leading-relaxed">{introData.text}</p>
            </div>
            <Button className="py-4" onClick={() => navigateTo(introData.next)}>{activeScreen === 'INTRO_3' ? t.start : t.continue}</Button>
          </div>
        );
      case 'PET_SELECTION':
        return (
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="mb-2 text-center">
               <h2 className="text-lg font-black text-gray-900">{t.chooseCompanion}</h2>
               <p className="text-slate-500 font-bold italic text-[10px]">{t.petGrowSub}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3 px-2 shrink-0">
              <button onClick={() => setPetType('dog')} className={`p-2 rounded-[1.5rem] border-4 transition-all flex flex-col items-center ${petType === 'dog' ? 'border-[#5D4DC0] bg-white shadow-xl' : 'border-gray-100 bg-white/50'}`}>
                <AnimatedPixelPet type="dog" styleId="golden" mood={PetMood.HAPPY} size="sm" static />
                <p className="font-black mt-1 text-xs text-gray-900">{t.dog}</p>
              </button>
              <button onClick={() => setPetType('cat')} className={`p-2 rounded-[1.5rem] border-4 transition-all flex flex-col items-center ${petType === 'cat' ? 'border-[#5D4DC0] bg-white shadow-xl' : 'border-gray-100 bg-white/50'}`}>
                <AnimatedPixelPet type="cat" styleId="siamese" mood={PetMood.HAPPY} size="sm" static />
                <p className="font-black mt-1 text-xs text-gray-900">{t.cat}</p>
              </button>
            </div>
            <div className="space-y-1.5 px-2 mb-3 overflow-y-auto custom-scrollbar">
              {PET_STYLES[petType].map(style => (
                <button key={style.id} onClick={() => setPetStyleId(style.id)} className={`w-full p-1.5 rounded-full border-2 flex items-center gap-3 transition-all ${petStyleId === style.id ? 'border-[#5D4DC0] bg-white shadow-md' : 'border-gray-100 bg-white/80'}`}>
                   <AnimatedPixelPet type={petType} styleId={style.id} mood={PetMood.CALM} size="sm" static />
                   <p className="font-black text-sm text-gray-800">{lang === 'en' ? style.labelEn : style.labelEs}</p>
                </button>
              ))}
            </div>
            <div className="mt-auto pt-2 shrink-0">
              <Button className="py-3 text-lg" onClick={() => navigateTo('PET_GENDER')}>{t.continue}</Button>
            </div>
          </div>
        );
      case 'PET_GENDER':
        return (
          <div className="flex-1 flex flex-col p-6 items-center justify-center text-center gap-4 overflow-y-auto custom-scrollbar">
            <AnimatedPixelPet type={petType} styleId={petStyleId} mood={PetMood.HAPPY} size="md" />
            <div className="space-y-4 w-full">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-gray-900">{t.whatGender}</h2>
                <p className="text-xs text-slate-500 font-bold italic">{t.petGenderDialogue}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 w-full px-4">
                {[
                  { id: 'male', label: t.male, symbol: '♂', active: 'bg-blue-500 border-blue-600 shadow-blue-100' },
                  { id: 'female', label: t.female, symbol: '♀', active: 'bg-pink-400 border-pink-500 shadow-pink-100' },
                  { id: 'other', label: t.other, symbol: '⚥', active: 'bg-slate-500 border-slate-600 shadow-slate-100' }
                ].map(g => (
                  <button 
                    key={g.id} 
                    onClick={() => setPetGender(g.id as PetGender)} 
                    className={`p-3 rounded-full font-black border-2 transition-all flex items-center justify-center gap-2 ${petGender === g.id ? `${g.active} text-white shadow-xl` : 'bg-white border-gray-100 text-gray-700'}`}
                  >
                    <span className="text-xl">{g.symbol}</span>
                    <span className="text-sm">{g.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <Button className="py-4" onClick={() => navigateTo('PET_NAMING')} disabled={!petGender}>{t.continue}</Button>
          </div>
        );
      case 'PET_NAMING':
      case 'USER_NAMING':
        const isUser = activeScreen === 'USER_NAMING';
        return (
          <div className="flex-1 flex flex-col p-6 items-center justify-center text-center gap-6 overflow-y-auto custom-scrollbar">
            <AnimatedPixelPet type={petType} styleId={petStyleId} mood={PetMood.HAPPY} size="lg" />
            <div className="space-y-4 w-full">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-gray-900">{isUser ? t.whatIsYourName : t.nameYourPet}</h2>
                <p className="text-xs text-slate-500 font-bold italic">{isUser ? t.userNameDialogue : t.petNamingDialogue}</p>
              </div>
              <input type="text" value={isUser ? userName : petName} onChange={(e) => isUser ? setUserName(e.target.value) : setPetName(e.target.value)} placeholder="..." className="w-full p-4 rounded-2xl bg-gray-50 border-2 border-gray-100 text-center font-black text-xl outline-none focus:border-[#5D4DC0] transition-all text-gray-900" />
            </div>
            <Button className="py-4" onClick={() => navigateTo(isUser ? 'USER_AGE' : 'USER_NAMING')} disabled={isUser ? !userName : !petName}>{t.continue}</Button>
          </div>
        );
      case 'USER_AGE':
        const ageOptions = [
          { id: 'u18', label: lang === 'en' ? 'Younger than 18' : 'Menor de 18' },
          { id: '18-24', label: lang === 'en' ? '18 to 24' : '18 a 24' },
          { id: '25-34', label: lang === 'en' ? '25 to 34' : '25 a 34' },
          { id: '35-44', label: lang === 'en' ? '35 to 44' : '35 a 44' },
          { id: '45-54', label: lang === 'en' ? '45 to 54' : '45 a 54' },
          { id: '55plus', label: lang === 'en' ? '55 or older' : '55 o más' }
        ];
        return (
          <div className="flex-1 flex flex-col p-6 items-center text-center gap-4 overflow-y-auto custom-scrollbar">
            <h2 className="text-xl font-black text-gray-900">{t.userAgeTitle}</h2>
            <AnimatedPixelPet type={petType} styleId={petStyleId} mood={PetMood.HAPPY} size="md" />
            <p className="text-xs text-slate-500 font-bold italic leading-relaxed px-4">{t.userAgeDialogue}</p>
            <div className="grid grid-cols-1 gap-2 w-full px-4 mb-2">
              {ageOptions.map(age => (
                <button 
                   key={age.id} 
                   onClick={() => setUserAge(age.id)} 
                   className={`p-3 rounded-full font-black border-2 transition-all text-sm ${userAge === age.id ? 'bg-[#5D4DC0] text-white border-[#5D4DC0]/30 shadow-lg' : 'bg-white border-gray-100 text-gray-700'}`}
                >
                  {age.label}
                </button>
              ))}
            </div>
            <Button className="py-4" onClick={() => navigateTo('USER_GENDER')} disabled={!userAge}>{t.continue}</Button>
          </div>
        );
      case 'USER_GENDER':
        return (
          <div className="flex-1 flex flex-col p-6 items-center text-center gap-4 overflow-y-auto custom-scrollbar">
            <h2 className="text-xl font-black text-gray-900">{t.userGenderTitle}</h2>
            <AnimatedPixelPet type={petType} styleId={petStyleId} mood={PetMood.HAPPY} size="md" />
            <p className="text-xs text-slate-500 font-bold italic leading-relaxed px-4">{t.userGenderDialogue}</p>
            <div className="grid grid-cols-1 gap-3 w-full px-4 mb-2">
              {[
                { id: 'male', label: t.userMale, symbol: '♂', active: 'bg-blue-500 border-blue-600 shadow-blue-100' },
                { id: 'female', label: t.userFemale, symbol: '♀', active: 'bg-pink-400 border-pink-500 shadow-pink-100' },
                { id: 'other', label: t.other, symbol: '⚥', active: 'bg-slate-500 border-slate-600 shadow-slate-100' }
              ].map(g => (
                <button 
                  key={g.id} 
                  onClick={() => setUserGenderSelection(g.id)} 
                  className={`p-4 rounded-full font-black border-2 flex items-center justify-center gap-2 transition-all ${userGenderSelection === g.id ? `${g.active} text-white shadow-xl` : 'bg-white border-gray-100 text-gray-700'}`}
                >
                  <span className="text-xl">{g.symbol}</span>
                  <span className="text-sm">{g.label}</span>
                </button>
              ))}
            </div>
            <Button className="py-4" onClick={() => navigateTo('USER_ACTIVITY')} disabled={!userGenderSelection}>{t.continue}</Button>
          </div>
        );
      case 'USER_ACTIVITY':
        const activityOptions = [
          { id: 'level1', label: t.activityLevel1, emoji: '🐾' },
          { id: 'level2', label: t.activityLevel2, emoji: '🏃' },
          { id: 'level3', label: t.activityLevel3, emoji: '⚡' }
        ];
        return (
          <div className="flex-1 flex flex-col p-5 items-center text-center gap-4 overflow-y-auto custom-scrollbar">
            <h2 className="text-xl font-black text-gray-900">{t.userActivityTitle}</h2>
            <AnimatedPixelPet type={petType} styleId={petStyleId} mood={PetMood.HAPPY} size="md" />
            <p className="text-xs text-slate-500 font-bold italic leading-relaxed px-4">{t.userActivityDialogue}</p>
            <div className="space-y-3 px-4 w-full mb-2">
              {activityOptions.map(lvl => (
                <button 
                  key={lvl.id} 
                  onClick={() => setUserActivitySelection(lvl.id)} 
                  className={`w-full p-3 rounded-[2rem] text-left font-black border-2 transition-all flex items-center gap-3 ${userActivitySelection === lvl.id ? 'bg-[#5D4DC0] text-white border-[#5D4DC0]/30 shadow-lg' : 'bg-white border-gray-100 text-gray-700'}`}
                >
                   <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-xl ${userActivitySelection === lvl.id ? 'bg-white/20' : 'bg-gray-50'}`}>
                     {lvl.emoji}
                   </div>
                   <span className="flex-1 leading-tight text-xs">
                     {lvl.label}
                   </span>
                </button>
              ))}
            </div>
            <Button className="py-4" onClick={() => navigateTo('MAIN_GOAL')} disabled={!userActivitySelection}>{t.continue}</Button>
          </div>
        );
      case 'MAIN_GOAL':
        const goalOptions = [
          { id: 'weight', label: t.loseWeight, emoji: '⚖️' },
          { id: 'routine', label: t.createRoutine, emoji: '📅' },
          { id: 'stress', label: t.reduceStress, emoji: '🧘' },
          { id: 'health', label: t.becomeHealthier, emoji: '🍎' }
        ];
        return (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
            <div className="shrink-0 p-4 pt-6 flex flex-col items-center text-center gap-3 border-b border-gray-50 bg-white shadow-sm z-10">
              <h2 className="text-xl font-black text-gray-900 leading-tight">
                {lang === 'en' ? 'What is your main goal?' : '¿Cuál es tu objetivo principal?'}
              </h2>
              <AnimatedPixelPet type={petType} styleId={petStyleId} mood={PetMood.HAPPY} size="md" />
              <p className="text-xs text-slate-500 font-bold italic leading-relaxed px-4">
                {t.mainGoalDialogue}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-4 pb-24">
              <div className="space-y-3 px-4 w-full mb-6">
                {goalOptions.map(g => (
                  <button 
                    key={g.id} 
                    onClick={() => setUserMainGoal(g.id)} 
                    className={`w-full p-4 rounded-[2rem] text-left font-black border-2 transition-all flex items-center gap-3 ${userMainGoal === g.id ? 'bg-[#5D4DC0] text-white border-[#5D4DC0]/30 shadow-lg scale-[1.02]' : 'bg-white border-gray-100 text-gray-700'}`}
                  >
                     <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-xl ${userMainGoal === g.id ? 'bg-white/20' : 'bg-gray-50'}`}>
                       {g.emoji}
                     </div>
                     <span className="flex-1 leading-tight text-xs">
                       {g.label}
                     </span>
                     {userMainGoal === g.id && (
                       <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                         <span className="text-white text-xs">✓</span>
                       </div>
                     )}
                  </button>
                ))}
              </div>

              <div className="px-4 pb-8">
                <Button className="py-4" onClick={() => navigateTo('SHARE_INTEREST')} disabled={!userMainGoal}>
                  {t.continue}
                </Button>
              </div>
            </div>
          </div>
        );
      case 'SHARE_INTEREST':
        return (
          <div className="flex-1 flex flex-col p-6 items-center justify-center text-center gap-6 overflow-y-auto custom-scrollbar">
             <AnimatedPixelPet type={petType} styleId={petStyleId} mood={PetMood.HAPPY} size="md" />
             <div className="space-y-3">
                <h2 className="text-xl font-black text-gray-900">{t.shareTitle.replace('{petName}', petName)}</h2>
                <p className="text-xs text-slate-400 font-bold italic">{t.shareSub}</p>
             </div>
             <div className="flex flex-col gap-3 w-full px-6">
                <Button className="py-4" onClick={() => navigateTo('MOOD_CHECK')}>{t.justMe}</Button>
                <Button className="py-4" variant="secondary" onClick={() => navigateTo('SHARE_LINK')}>{t.shareMyPet}</Button>
             </div>
          </div>
        );
      case 'SHARE_LINK':
        return (
          <div className="flex-1 flex flex-col p-8 items-center justify-center text-center gap-10">
            <span className="text-7xl">🔗</span>
            <h2 className="text-2xl font-black text-gray-900">{t.inviteShared}</h2>
            <div className="p-6 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 break-all font-mono text-[10px] text-gray-400 shadow-inner px-10">healthquest.app/invite?id={Math.random().toString(36).substring(7)}</div>
            <Button onClick={() => navigateTo('MOOD_CHECK')}>{t.continue}</Button>
          </div>
        );
      case 'MOOD_CHECK':
        const moods = [
          { id: 'Energetic', label: t.moodEnergetic, emoji: '⚡ ' },
          { id: 'Calm', label: t.moodCalm, emoji: '🧘 ' },
          { id: 'Tired', label: t.moodTired, emoji: '😴 ' },
          { id: 'Stressed', label: t.moodStressed, emoji: '😰 ' }
        ];
        return (
          <div className="flex-1 flex flex-col p-6 items-center justify-center gap-6 bg-indigo-50/30 overflow-y-auto custom-scrollbar">
            <AnimatedPixelPet type={petType} styleId={petStyleId} mood={PetMood.HAPPY} size="md" />
            <h2 className="text-xl font-black text-gray-900 text-center">
              {isWelcomeBack 
                ? t.userAgeToday
                : t.howFeelingToday
              } <span className="text-[#5D4DC0]">{userName}</span>?
            </h2>
            <div className="grid grid-cols-1 gap-3 w-full">
              {moods.map(m => (
                <button key={m.id} onClick={() => { setUserMoodSelection(m.id); navigateTo('ENERGY_CHECK'); }} className="w-full p-4 rounded-full font-black border-2 bg-white border-white shadow-sm hover:shadow-md transition-all text-gray-800 text-sm">
                  {m.emoji}{m.label}
                </button>
              ))}
            </div>
          </div>
        );
      case 'ENERGY_CHECK':
        return (
          <div className="flex-1 flex flex-col p-6 items-center justify-center gap-8 bg-white overflow-y-auto custom-scrollbar">
            <h2 className="text-xl font-black text-gray-900">{t.userEnergyToday}</h2>
            <div className="flex justify-between w-full max-w-xs gap-2">
              {[1, 2, 3, 4, 5].map(lvl => (
                <button key={lvl} onClick={() => { setUserEnergy(lvl); navigateTo('TIME_CHECK'); }} className={`w-12 h-12 rounded-full font-black flex items-center justify-center text-lg transition-all ${userEnergy === lvl ? 'bg-[#5D4DC0] text-white shadow-lg scale-110' : 'bg-gray-50 text-gray-300 border-2 border-gray-100'}`}>{lvl}</button>
              ))}
            </div>
            <p className="text-xs text-slate-400 font-bold italic">1: {t.energyLow} / 5: {t.energyHigh}</p>
          </div>
        );
      case 'TIME_CHECK':
        const timeOptions = [
          { id: '10min', label: t.time10min, emoji: '⏱️' },
          { id: '20min', label: t.time20min, emoji: '⏲️' },
          { id: '30minplus', label: t.time30minplus, emoji: '⏳' }
        ];
        return (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
            <div className="shrink-0 p-4 pt-6 flex flex-col items-center text-center gap-3 border-b border-gray-50 bg-white shadow-sm z-10">
              <h2 className="text-xl font-black text-gray-900 leading-tight">
                {t.userTimeToday}
              </h2>
              <AnimatedPixelPet type={petType} styleId={petStyleId} mood={PetMood.HAPPY} size="md" />
              <p className="text-xs text-slate-500 font-bold italic leading-relaxed px-4">
                {t.timeDialogue}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-4 pb-24">
              <div className="space-y-3 px-4 w-full mb-6">
                {timeOptions.map(tOption => (
                  <button 
                    key={tOption.id} 
                    onClick={() => { setUserTimeInvestment(tOption.id); generateQuests(); }} 
                    className={`w-full p-4 rounded-[2rem] text-left font-black border-2 transition-all flex items-center gap-3 bg-white border-gray-100 text-gray-700 hover:border-[#5D4DC0]/40 active:scale-95 shadow-sm`}
                  >
                     <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-xl bg-gray-50`}>
                       {tOption.emoji}
                     </div>
                     <span className="flex-1 leading-tight text-sm">
                       {tOption.label}
                     </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 'THINKING':
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <h2 className="text-3xl font-black text-gray-900 mb-10">{t.thinkingTitle.replace('{petName}', petName)}</h2>
            <div className="bg-white border-2 border-gray-100 rounded-[3rem] p-12 shadow-2xl flex flex-col items-center space-y-10 w-full max-w-sm aspect-square relative justify-center">
              <div className="absolute top-0 left-0 w-full h-2 bg-gray-50 overflow-hidden rounded-t-[3rem]">
                <div className="h-full bg-[#5D4DC0] animate-[loading_2s_infinite]"></div>
              </div>
              <AnimatedPixelPet type={petType} styleId={petStyleId} mood={PetMood.CALM} size="lg" purchasedIds={purchasedIds} />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t.thinkingText}</p>
            </div>
          </div>
        );
      case 'MOTIVATION':
        return (
          <div className="flex-1 flex flex-col bg-white overflow-y-auto custom-scrollbar p-6">
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-4">
              <AnimatedPixelPet type={petType} styleId={petStyleId} mood={PetMood.HAPPY} size="md" purchasedIds={purchasedIds} />
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-gray-900 leading-tight">
                  {t.readyMission}
                </h2>
                <p className="text-slate-500 font-bold italic text-base leading-relaxed px-4">
                  “{petSpeech || t.defaultPetSpeech}”
                </p>
              </div>
              
              <div className="w-full space-y-2 mt-2">
                {dailyGoals.filter(g => g.type === 'primary').map((goal, idx) => (
                  <div key={idx} className="bg-indigo-50/50 p-4 rounded-[2rem] border-2 border-indigo-100 flex items-center gap-3">
                    <span className="text-2xl">{getGoalEmoji(goal.category)}</span>
                    <p className="text-left font-black text-gray-800 text-sm leading-tight flex-1">
                      {getInterpolatedGoalText(goal)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="shrink-0 pt-4 pb-2">
              <Button onClick={() => navigateTo('DASHBOARD')}>
                {t.letsGo}
              </Button>
            </div>
          </div>
        );
      case 'DASHBOARD':
        const aiGoals = dailyGoals.filter(g => g.type !== 'custom');
        const customGoals = dailyGoals.filter(g => g.type === 'custom');

        const visibleAiGoals = aiGoals.filter(g => !hiddenGoalIds.includes(g.id));
        const visibleCustomGoals = customGoals.filter(g => !hiddenGoalIds.includes(g.id));

        return (
          <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
            {/* Animation Overlay Layer */}
            <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
              {particles.map(p => (
                <div 
                  key={p.id} 
                  className={`absolute font-black whitespace-nowrap drop-shadow-lg reward-anim-${p.type}`}
                  style={{ left: p.x, top: p.y }}
                >
                  <div className={`px-3 py-1.5 rounded-full text-white text-sm ${p.type === 'xp' ? 'bg-[#5D4DC0]' : 'bg-sky-500'} shadow-lg`}>
                    {p.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 px-8 flex items-center justify-between z-20 bg-white/95 backdrop-blur-md border-b border-gray-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#5D4DC0] rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-xl">L{level}</div>
                <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#5D4DC0] transition-all duration-1000" style={{width: `${(xp / getXpThreshold(level)) * 100}%`}}></div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-yellow-50 px-4 py-1.5 rounded-full border border-yellow-100 flex items-center gap-2 shadow-sm">
                   <span className="text-lg">🪙</span>
                   <span className="font-black text-gray-700 text-sm">{pts}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <PetEnvironment className="h-[260px] shrink-0">
                <AnimatedPixelPet 
                  type={petType} 
                  styleId={petStyleId} 
                  mood={completedGoalIds.length >= 3 ? PetMood.HAPPY : PetMood.CALM} 
                  size="lg" 
                  hasCrown={hasCrown} 
                  speechBubble={petSpeech} 
                  purchasedIds={purchasedIds}
                />
              </PetEnvironment>

              <div className="bg-[#FAF9F6] rounded-t-[3.5rem] px-6 pb-6 pt-2 shadow-inner flex flex-col min-h-screen -mt-12 relative z-10 border-t border-white">
                <div className="flex flex-col mb-2 shrink-0 pt-2 px-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t.todayGoals}</h3>
                        <div className="bg-white text-gray-600 px-4 py-1.5 rounded-full border border-gray-100 shadow-sm font-black text-xs">{completedGoalIds.length}/{dailyGoals.length}</div>
                    </div>
                </div>

                <div className="flex flex-col items-center px-4 pb-40">
                    {/* Suggested Section */}
                    {visibleAiGoals.length > 0 && (
                      <div className="w-full mb-6">
                        <div className="w-full flex items-center gap-2 px-4 mb-4">
                            <h4 className="shrink-0 text-[9px] font-black text-gray-300 uppercase tracking-widest leading-none">
                              {t.suggestedBy.replace('{petName}', petName)}
                            </h4>
                            <div className="flex-1 border-b border-dashed border-gray-200 h-[1px]"></div>
                            <button 
                              onClick={() => navigateTo('CREATE_CUSTOM_GOAL')}
                              className="text-[14px] font-black text-gray-400 border-2 border-gray-100 hover:border-[#5D4DC0]/40 hover:text-[#5D4DC0] transition-all w-7 h-7 flex items-center justify-center rounded-full active:scale-90 leading-none shadow-sm bg-white shrink-0"
                            >
                              +
                            </button>
                        </div>
                        {aiGoals.map(renderGoalItem)}
                      </div>
                    )}

                    {/* Custom Section */}
                    {visibleCustomGoals.length > 0 && (
                      <div className="w-full mb-6">
                        <div className="w-full flex items-center gap-2 px-4 mb-4">
                            <h4 className="shrink-0 text-[9px] font-black text-gray-300 uppercase tracking-widest leading-none">
                              {t.myOwnGoals}
                            </h4>
                            <div className="flex-1 border-b border-dashed border-gray-200 h-[1px]"></div>
                            <button 
                              onClick={() => navigateTo('CREATE_CUSTOM_GOAL')}
                              className="text-[14px] font-black text-gray-400 border-2 border-gray-100 hover:border-[#5D4DC0]/40 hover:text-[#5D4DC0] transition-all w-7 h-7 flex items-center justify-center rounded-full active:scale-90 leading-none shadow-sm bg-white shrink-0"
                            >
                              +
                            </button>
                        </div>
                        {customGoals.map(renderGoalItem)}
                      </div>
                    )}

                    {/* Create CTA Bubble - Only shown if not many visible goals */}
                    {(visibleAiGoals.length + visibleCustomGoals.length < 5) && (
                      <div 
                        onClick={() => navigateTo('CREATE_CUSTOM_GOAL')}
                        className="w-full max-w-[340px] py-4 px-4 rounded-[2.5rem] border-2 border-dashed border-gray-200 flex flex-row items-center gap-3 transition-all cursor-pointer active:scale-95 bg-white/50 hover:bg-white mt-2"
                      >
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 bg-gray-50 text-gray-300">+</div>
                          <p className="font-black text-gray-300 text-xs italic">
                             {lang === 'en' ? 'Create your own mission...' : 'Crea tu propia misión...'}
                          </p>
                      </div>
                    )}

                    <button onClick={handleSimulateNextDay} className="text-gray-300 font-black py-12 text-[9px] uppercase tracking-[0.2em] hover:text-[#5D4DC0]/60 transition-colors">Simulate Next Day</button>
                </div>
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-50 p-3.5 flex justify-around items-center z-50">
               {['Stats', 'Home', 'Shop'].map((btn, idx) => (
                 <button key={btn} onClick={() => navigateTo(idx === 0 ? 'HEALTH_STATS' : idx === 1 ? 'DASHBOARD' : 'SHOP')} className={`flex flex-col items-center gap-0.5 transition-all ${((activeScreen as string) === 'DASHBOARD' && idx === 1) || ((activeScreen as string) === 'SHOP' && idx === 2) || ((activeScreen as string) === 'HEALTH_STATS' && idx === 0) ? 'scale-105 opacity-100' : 'opacity-30 grayscale'}`}>
                   <span className="text-xl">{idx === 0 ? '📊' : idx === 1 ? '🏠' : '🛍️'}</span>
                   <span className="text-[8px] font-black uppercase text-gray-700 tracking-wider">{btn}</span>
                 </button>
               ))}
            </div>

            {selectedGoalForDetail && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedGoalForDetail(null)}></div>
                <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl animate-in fade-in zoom-in duration-300 relative border-2 border-gray-50 z-[110]">
                  <button 
                    onClick={() => setSelectedGoalForDetail(null)} 
                    className="absolute top-6 right-6 w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors active:scale-90"
                  >
                    <span className="text-2xl font-light">×</span>
                  </button>

                  <div className="flex flex-col items-center text-center gap-4 mb-6 pt-4">
                    <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center text-5xl shadow-inner">
                      {getGoalEmoji(selectedGoalForDetail.category)}
                    </div>
                    <h3 className="text-xl font-black text-gray-900 leading-tight px-4">
                      {getInterpolatedGoalText(selectedGoalForDetail)}
                    </h3>
                  </div>

                  <div className="bg-slate-50 rounded-[2rem] p-6 border-2 border-slate-100 shadow-inner overflow-y-auto max-h-[40vh]">
                    <p className="text-slate-600 font-bold text-base leading-relaxed italic text-center">
                      “{lang === 'en' ? selectedGoalForDetail.exampleEn : selectedGoalForDetail.exampleEs}”
                    </p>
                  </div>
                  
                  <div className="mt-8">
                    <Button onClick={() => setSelectedGoalForDetail(null)} className="w-full py-4 text-sm uppercase tracking-widest">
                      {t.close}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'SHOP':
        const cosmetics = SHOP_ITEMS.filter(i => i.category === 'cosmetic');
        const rewards = SHOP_ITEMS.filter(i => i.category === 'real');

        return (
          <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
            <div className="p-8 pb-4 flex flex-col gap-1 shrink-0 bg-white shadow-sm z-10">
               <div className="flex justify-between items-center mb-2">
                 <h2 className="text-3xl font-black text-gray-900 tracking-tight">{t.marketPlace}</h2>
                 <div className="bg-yellow-50 px-4 py-2 rounded-2xl border border-yellow-100 flex items-center gap-2 shadow-sm">
                   <span className="text-xl">🪙</span>
                   <span className="font-black text-gray-700 text-lg">{pts}</span>
                 </div>
               </div>
               <p className="text-sm text-slate-400 font-bold italic">{t.spendEffortOnJoy}</p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10 pb-32">
               {/* Cosmetics Section */}
               <section>
                 <div className="flex items-center gap-3 mb-6 px-2">
                   <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{t.forCompanion}</h3>
                   <div className="flex-1 border-b border-gray-100"></div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   {cosmetics.map(item => {
                     const isOwned = purchasedIds.includes(item.id);
                     return (
                       <div 
                         key={item.id} 
                         onClick={() => !isOwned && handlePurchase(item)}
                         className={`relative p-3.5 rounded-[1.5rem] border-2 transition-all flex flex-col items-center gap-2 text-center cursor-pointer active:scale-95 group ${item.isPremium ? 'border-[#5D4DC0]/20 bg-[#5D4DC0]/5' : 'border-gray-50 bg-white hover:border-[#5D4DC0]/20'}`}
                       >
                          {item.isPremium && (
                            <div className="absolute top-2 right-2 bg-[#5D4DC0] text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter">{t.premium}</div>
                          )}
                          {isOwned && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-[1.5rem] flex items-center justify-center z-10">
                               <span className="text-green-500 font-black text-[10px] uppercase rotate-12 border-2 border-green-500 px-2 py-0.5 rounded-lg">{t.owned}</span>
                            </div>
                          )}
                          <div className="w-12 h-12 rounded-[1rem] bg-gray-50 flex items-center justify-center text-3xl group-hover:bg-indigo-50 transition-colors shrink-0">
                            {item.icon}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-black text-gray-800 leading-tight line-clamp-1 px-1">{lang === 'en' ? item.nameEn : item.nameEs}</p>
                            {!item.isPremium && (
                              <p className="text-[9px] font-black text-[#5D4DC0] flex items-center justify-center gap-0.5">
                                <span>🪙</span>
                                <span>{item.price}</span>
                              </p>
                            )}
                          </div>
                       </div>
                     );
                   })}
                 </div>
               </section>

               {/* Real Rewards Section */}
               <section>
                 <div className="flex items-center gap-3 mb-6 px-2">
                   <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{t.forReality}</h3>
                   <div className="flex-1 border-b border-gray-100"></div>
                 </div>
                 <div className="space-y-4">
                    {rewards.map(item => (
                      <div 
                        key={item.id}
                        onClick={() => handlePurchase(item)}
                        className="p-5 rounded-[2.5rem] border-2 border-[#5D4DC0]/10 bg-gradient-to-br from-white to-[#5D4DC0]/5 flex items-center gap-5 cursor-pointer active:scale-[0.98] relative overflow-hidden group"
                      >
                         <div className="absolute top-0 right-0 bg-[#5D4DC0] text-white text-[9px] font-black px-6 py-1 rounded-bl-[2rem] uppercase tracking-widest shadow-lg">{t.premium}</div>
                         <div className="w-16 h-16 rounded-[1.5rem] bg-white shadow-sm flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">
                           {item.icon}
                         </div>
                         <div className="flex-1">
                           <p className="text-sm font-black text-gray-900 mb-1">{lang === 'en' ? item.nameEn : item.nameEs}</p>
                           <p className="text-[10px] font-bold text-slate-400">{t.redeemableReward}</p>
                         </div>
                         <span className="text-2xl text-[#5D4DC0]/40">💎</span>
                      </div>
                    ))}
                 </div>
               </section>
            </div>

            {/* Premium Trial Modal */}
            {isPremiumTrialModalOpen && (
              <div className="fixed inset-0 z-[300] flex items-end justify-center">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsPremiumTrialModalOpen(false)}></div>
                <div className="bg-white w-full max-w-md rounded-t-[4rem] p-10 pb-12 shadow-2xl animate-in slide-in-from-bottom-full duration-500 relative border-t-4 border-[#5D4DC0] max-h-[90vh] flex flex-col">
                   {/* Background Gradient Detail */}
                   <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#5D4DC0]/10 rounded-full blur-3xl"></div>
                   
                   <div className="relative z-10 flex flex-col items-center overflow-y-auto custom-scrollbar pr-2">
                     <div className="w-20 h-20 bg-gradient-to-br from-[#5D4DC0] to-purple-600 rounded-[2.5rem] flex items-center justify-center text-4xl shadow-xl shadow-[#5D4DC0]/30 mb-8 animate-bounce shrink-0">
                        💎
                     </div>
                     
                     <h3 className="text-2xl font-black text-gray-900 text-center mb-2 shrink-0">
                        {t.tryPremium}
                     </h3>
                     <p className="text-sm font-bold text-slate-500 text-center mb-10 px-6 shrink-0">
                        {t.premiumTrialSub}
                     </p>
                     
                     <div className="w-full space-y-6 mb-12 shrink-0">
                        {[
                          { icon: '🚫', label: t.noAds },
                          { icon: '🎁', label: t.unlockRewards },
                          { icon: '❤️', label: t.supportDev }
                        ].map((benefit, i) => (
                          <div key={i} className="flex items-center gap-4 group">
                             <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                               {benefit.icon}
                             </div>
                             <p className="text-sm font-black text-gray-700">{benefit.label}</p>
                          </div>
                        ))}
                     </div>
                     
                     <Button 
                        variant="premium" 
                        className="py-6 mb-4 shrink-0"
                        onClick={() => setIsPremiumTrialModalOpen(false)}
                      >
                        {t.tryForFree}
                     </Button>
                     
                     <button 
                        onClick={() => setIsPremiumTrialModalOpen(false)}
                        className="text-slate-400 font-black text-sm hover:text-[#5D4DC0] transition-colors uppercase tracking-widest mt-2 mb-4 shrink-0"
                      >
                        {t.maybeLater}
                     </button>
                   </div>
                </div>
              </div>
            )}

            {/* Shop Feedback Overlay */}
            {shopFeedback && (
              <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] animate-in fade-in zoom-in duration-300">
                <div className="bg-gray-900 text-white px-8 py-4 rounded-full font-black text-sm shadow-2xl text-center">
                   {shopFeedback}
                </div>
              </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-50 p-3.5 flex justify-around items-center z-50">
               {[
                 { id: 'HEALTH_STATS', label: t.stats, icon: '📊' },
                 { id: 'DASHBOARD', label: t.home, icon: '🏠' },
                 { id: 'SHOP', label: t.shop, icon: '🛍️' }
               ].map((btn) => (
                 <button key={btn.id} onClick={() => navigateTo(btn.id as ScreenId)} className={`flex flex-col items-center gap-0.5 transition-all ${activeScreen === btn.id ? 'scale-105 opacity-100' : 'opacity-30 grayscale'}`}>
                   <span className="text-xl">{btn.icon}</span>
                   <span className="text-[8px] font-black uppercase text-gray-700 tracking-wider">{btn.label}</span>
                 </button>
               ))}
            </div>
          </div>
        );
      case 'HEALTH_STATS':
        const petStyle = PET_STYLES[petType].find(s => s.id === petStyleId);
        const breed = petStyle?.[lang === 'en' ? 'labelEn' : 'labelEs'];

        const WellnessCard: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = "" }) => (
          <div className={`p-6 border-2 border-gray-100 rounded-[2.5rem] flex flex-col items-center justify-center text-center bg-white/50 backdrop-blur-sm shadow-sm transition-all hover:border-[#5D4DC0]/20 group ${className}`}>
            {children}
          </div>
        );

        return (
          <div className="flex-1 flex flex-col bg-[#F8F9FF] overflow-hidden">
            <div className="flex-1 flex flex-col items-center p-6 space-y-6 overflow-y-auto no-scrollbar pb-32">
              
              {/* Pet ID Card Design */}
              <div className="w-full max-w-[340px] bg-white rounded-[2rem] border-2 border-gray-100 shadow-2xl overflow-hidden relative shrink-0">
                <div className="bg-[#5D4DC0] h-4 w-full"></div>
                <div className="p-6">
                  <div className="flex gap-6">
                    {/* Pet Image - Still */}
                    <div className="w-24 h-24 bg-[#F9F8F6] rounded-2xl border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                      <AnimatedPixelPet type={petType} styleId={petStyleId} mood={PetMood.CALM} size="sm" static={true} purchasedIds={purchasedIds} />
                    </div>
                    
                    {/* Pet Data Fields */}
                    <div className="flex-1 space-y-2.5">
                      <div>
                        <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">{t.name}</p>
                        <p className="text-sm font-black text-gray-800 uppercase leading-none">{petName || 'Companion'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">{t.type}</p>
                        <p className="text-[10px] font-black text-gray-600 uppercase leading-none">{petType === 'dog' ? t.dog : t.cat}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">{t.breed}</p>
                        <p className="text-[10px] font-black text-gray-600 uppercase leading-none">{breed}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">{t.age}</p>
                        <p className="text-[10px] font-black text-gray-600 leading-none">
                          {t.dayActive.replace('{X}', '1')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Official Chip Detail */}
                <div className="absolute top-8 right-6 w-7 h-9 bg-yellow-50 rounded-md border-2 border-yellow-100 flex flex-col gap-1 p-1 items-center justify-center opacity-30">
                  <div className="w-full h-0.5 bg-yellow-200 rounded-full"></div>
                  <div className="w-full h-0.5 bg-yellow-200 rounded-full"></div>
                  <div className="w-full h-0.5 bg-yellow-200 rounded-full"></div>
                </div>
              </div>

              {/* Minimalist Wellness Stats Grid */}
              <div className="w-full max-w-[340px] space-y-4">
                
                {/* Row 1: Presence & Care Balance */}
                <div className="grid grid-cols-2 gap-4 w-full">
                  {/* 1️⃣ Presence */}
                  <WellnessCard>
                    <span className="text-3xl mb-3 group-hover:scale-110 transition-transform block">🌱</span>
                    <p className="text-[10px] font-black text-gray-800 leading-tight">
                      {t.showedUpToday}
                    </p>
                  </WellnessCard>

                  {/* 2️⃣ Care Balance */}
                  <WellnessCard>
                    <div className="flex gap-1 mb-3 group-hover:-translate-y-1 transition-transform">
                      <span className="text-xl">🌿</span>
                      <span className="text-xl">🧠</span>
                      <span className="text-xl">💧</span>
                    </div>
                    <p className="text-[10px] font-black text-gray-800 leading-tight">
                      {t.tookCareOfYourself}
                    </p>
                  </WellnessCard>
                </div>

                {/* Row 2: Pet Wellbeing */}
                <div className="flex justify-center w-full">
                  {/* 3️⃣ Pet Wellbeing */}
                  <WellnessCard className="w-full">
                    <span className="text-3xl mb-3 group-hover:scale-110 transition-transform block">🐾</span>
                    <p className="text-[10px] font-black text-gray-800 leading-tight">
                      {t.petFeelsSupported}
                    </p>
                  </WellnessCard>
                </div>

              </div>

              {/* Share Section */}
              <div className="w-full max-w-[340px] mt-4 mb-4 bg-white/40 backdrop-blur-sm rounded-[2.5rem] p-6 border-2 border-dashed border-gray-200 flex flex-col items-center gap-4 shadow-sm">
                <div className="flex -space-x-3 mb-1">
                  <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center font-black text-gray-500 shadow-sm text-sm">L</div>
                  <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center font-black text-gray-500 shadow-sm text-sm">T</div>
                  <div className="w-10 h-10 rounded-full bg-gray-100/40 border-2 border-white/60 shadow-sm"></div>
                  <div className="w-10 h-10 rounded-full bg-gray-100/40 border-2 border-white/60 shadow-sm"></div>
                  <div className="w-10 h-10 rounded-full bg-gray-100/40 border-2 border-white/60 shadow-sm"></div>
                </div>
                <p className="text-[11px] font-black text-gray-600 leading-tight text-center px-4">
                  {t.sharePetWithLovedOnes.replace('{petName}', petName || (lang === 'en' ? 'your companion' : 'tu mascota'))}
                </p>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`https://healthquest.app/invite/${petName || 'companion'}`);
                    setShopFeedback(t.linkCopied);
                    setTimeout(() => setShopFeedback(null), 2000);
                  }}
                  className="bg-white px-8 py-3 rounded-full border-2 border-gray-100 font-black text-[11px] text-gray-500 hover:border-[#5D4DC0]/40 hover:text-[#5D4DC0] transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                >
                  <span className="text-sm">🔗</span>
                  {t.copyLink}
                </button>
              </div>

            </div>

            {/* Bottom Nav Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-50 p-3.5 flex justify-around items-center z-50">
               {[
                 { id: 'HEALTH_STATS', label: t.stats, icon: '📊' },
                 { id: 'DASHBOARD', label: t.home, icon: '🏠' },
                 { id: 'SHOP', label: t.shop, icon: '🛍️' }
               ].map((btn) => (
                 <button key={btn.id} onClick={() => navigateTo(btn.id as ScreenId)} className={`flex flex-col items-center gap-0.5 transition-all ${activeScreen === btn.id ? 'scale-105 opacity-100' : 'opacity-30 grayscale'}`}>
                   <span className="text-xl">{btn.icon}</span>
                   <span className="text-[8px] font-black uppercase text-gray-700 tracking-wider">{btn.label}</span>
                 </button>
               ))}
            </div>
          </div>
        );
      case 'CREATE_CUSTOM_GOAL':
        const categories = ['None', 'Running', 'Walking', 'Warm-up', 'Cool-down', 'Recovery', 'Hydration'];
        const frequencies = [
          { id: 'none', en: 'Does not repeat', es: 'No se repite' },
          { id: 'daily', en: 'Every Day', es: 'Cada día' },
          { id: 'weekday', en: 'Every Weekday', es: 'Días laborales' },
          { id: 'weekly', en: 'Every Week', es: 'Cada semana' },
          { id: 'monthly', en: 'Every Month', es: 'Cada mes' }
        ];

        return (
          <div className="flex-1 flex flex-col bg-white overflow-hidden p-6 relative">
            <div className="flex items-center justify-between mb-4 shrink-0">
               <h2 className="text-2xl font-black text-gray-900">
                 {t.newMission}
               </h2>
               <button onClick={() => navigateTo('DASHBOARD')} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center font-black text-xl text-gray-400">×</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pb-20">
               {/* Goal Name Input Bubble */}
               <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t.whatIsGoal}
                  </p>
                  <input 
                    type="text" 
                    value={customGoalName} 
                    onChange={(e) => {
                      setCustomGoalName(e.target.value);
                      // Clear instructions if the user is typing manually
                      setCustomGoalInstructionsEn(undefined);
                      setCustomGoalInstructionsEs(undefined);
                    }}
                    placeholder={t.goalPlaceholder}
                    className="w-full p-4 bg-gray-50 rounded-[1.5rem] border-2 border-gray-100 font-black text-sm outline-none focus:border-[#5D4DC0]/40 transition-all text-gray-800"
                  />
               </div>

               {/* Simple Selection Row */}
               <div className="flex gap-2">
                 <button 
                  onClick={() => setIsCatModalOpen(true)}
                  className="flex-1 p-4 rounded-3xl border-2 border-gray-50 bg-gray-50/50 text-left font-black"
                 >
                   <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-1">{t.category}</p>
                   <p className="text-xs text-gray-700 flex items-center gap-1">
                     <span className="text-lg">{getGoalEmoji(customGoalCategory)}</span>
                     {customGoalCategory}
                   </p>
                 </button>
                 <button 
                  onClick={() => setIsFreqModalOpen(true)}
                  className="flex-1 p-4 rounded-3xl border-2 border-gray-50 bg-gray-50/50 text-left font-black"
                 >
                   <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-1">{t.repeats}</p>
                   <p className="text-xs text-gray-700 flex items-center gap-1">
                     <span className="text-lg">🔁</span>
                     {frequencies.find(f => f.id === (customGoalFrequency || 'none'))?.[lang]}
                   </p>
                 </button>
               </div>

               {/* Goal Library Train */}
               <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {t.chooseFromLibrary}
                    </h3>
                  </div>
                  
                  {/* Category Train */}
                  <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2">
                    {categories.filter(c => c !== 'None').map(cat => (
                      <button 
                        key={cat}
                        onClick={() => setLibraryActiveCategory(cat)}
                        className={`px-5 py-3 rounded-full font-black text-xs shrink-0 transition-all border-2 ${libraryActiveCategory === cat ? 'bg-[#5D4DC0] border-[#5D4DC0] text-white shadow-md' : 'bg-white border-gray-100 text-gray-400'}`}
                      >
                        {getGoalEmoji(cat)} {cat}
                      </button>
                    ))}
                  </div>

                  {/* Goal List for Library Category */}
                  <div className="space-y-2">
                    {libraryGoals.map(libGoal => {
                      const libText = getInterpolatedGoalText(libGoal);
                      return (
                        <button 
                          key={libGoal.id}
                          onClick={() => {
                            setCustomGoalName(libText);
                            setCustomGoalCategory(libGoal.category);
                            // Populate instructions from the library goal
                            setCustomGoalInstructionsEn(libGoal.exampleEn);
                            setCustomGoalInstructionsEs(libGoal.exampleEs);
                          }}
                          className="w-full p-4 rounded-3xl border-2 border-gray-50 bg-white hover:border-[#5D4DC0]/20 flex items-center gap-3 transition-all text-left group active:scale-[0.98]"
                        >
                          <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-xl shrink-0 group-hover:bg-indigo-50 transition-colors">
                            {getGoalEmoji(libGoal.category)}
                          </div>
                          <p className="text-xs font-black text-gray-700 leading-tight flex-1">{libText}</p>
                          <span className="text-gray-300 text-lg">+</span>
                        </button>
                      );
                    })}
                  </div>
               </div>
            </div>

            <div className="shrink-0 pt-4">
               <Button onClick={handleSaveCustomGoal} disabled={!customGoalName.trim()}>
                 {t.addMission}
               </Button>
            </div>

            {/* Category Modal */}
            <BottomModal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} title={lang === 'en' ? 'Select Category' : 'Selecciona Categoría'}>
               <div className="grid grid-cols-2 gap-3">
                 {categories.map(cat => (
                   <button 
                    key={cat} 
                    onClick={() => { setCustomGoalCategory(cat); setIsCatModalOpen(false); }}
                    className={`p-4 rounded-[2rem] border-2 font-black text-sm flex flex-col items-center gap-2 transition-all ${customGoalCategory === cat ? 'bg-[#5D4DC0]/10 border-[#5D4DC0] text-[#5D4DC0]' : 'bg-gray-50 border-gray-50 text-gray-500'}`}
                   >
                     <span className="text-2xl">{getGoalEmoji(cat)}</span>
                     <span>{cat}</span>
                   </button>
                 ))}
               </div>
            </BottomModal>

            {/* Frequency Modal */}
            <BottomModal isOpen={isFreqModalOpen} onClose={() => setIsFreqModalOpen(false)} title={lang === 'en' ? 'Repeat Mission' : 'Repetir Misión'}>
               <div className="space-y-3">
                 {frequencies.map(f => (
                   <button 
                    key={f.id} 
                    onClick={() => { 
                      setCustomGoalRepeat(f.id !== 'none'); 
                      setCustomGoalFrequency(f.id === 'none' ? null : f.id as RecurrenceFrequency);
                      setIsFreqModalOpen(false); 
                    }}
                    className={`w-full p-5 rounded-[2rem] border-2 font-black text-sm text-left px-8 flex justify-between items-center transition-all ${((customGoalFrequency || 'none') === f.id) ? 'bg-[#5D4DC0]/10 border-[#5D4DC0] text-[#5D4DC0]' : 'bg-gray-50 border-gray-50 text-gray-500'}`}
                   >
                     <span>{f[lang]}</span>
                     {((customGoalFrequency || 'none') === f.id) && <span>✓</span>}
                   </button>
                 ))}
               </div>
            </BottomModal>
          </div>
        );
      default:
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-8">
            <h2 className="text-2xl font-black text-gray-900">Redirecting...</h2>
            <Button onClick={() => navigateTo('INITIAL_SPLASH')}>Restart</Button>
          </div>
        );
    }
  };

  return (
    <ScreenWrapper>
      {renderScreen()}
      <AnimatePresence>
        {isLevelUpModalOpen && (
          <LevelUpCelebration 
            level={levelUpData.level}
            dialogue={levelUpData.dialogue}
            petType={petType}
            petStyleId={petStyleId}
            onClose={() => setIsLevelUpModalOpen(false)}
            lang={lang}
            purchasedIds={purchasedIds}
          />
        )}
      </AnimatePresence>
      <style>{`
        @keyframes breathe { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.02); } }
        @keyframes head-tilt { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(2deg); } }
        @keyframes tail-idle { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(8deg); } }
        @keyframes loading { 0% { width: 0; left: 0; } 50% { width: 100%; left: 0; } 100% { width: 0; left: 100%; } }
        
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* Reward Animations - slowed down to 2.5s with moderate scaling and fade out */
        @keyframes flyToXP {
          0% { opacity: 0; transform: translate(0, 0) scale(0.8); }
          15% { opacity: 1; transform: translate(0, -40px) scale(1.3); }
          30% { opacity: 1; transform: translate(0, -40px) scale(1.2); }
          85% { opacity: 1; transform: translate(-120px, -240px) scale(0.8); }
          100% { opacity: 0; transform: translate(-150px, -280px) scale(0.4); }
        }
        @keyframes flyToPts {
          0% { opacity: 0; transform: translate(0, 0) scale(0.8); }
          15% { opacity: 1; transform: translate(0, -40px) scale(1.3); }
          30% { opacity: 1; transform: translate(0, -40px) scale(1.2); }
          85% { opacity: 1; transform: translate(120px, -240px) scale(0.8); }
          100% { opacity: 0; transform: translate(150px, -280px) scale(0.4); }
        }

        .reward-anim-xp {
          animation: flyToXP 2.5s cubic-bezier(0.1, 0.7, 0.1, 1) forwards;
        }
        .reward-anim-pts {
          animation: flyToPts 2.5s cubic-bezier(0.1, 0.7, 0.1, 1) forwards;
        }

        .animate-breathe { animation: breathe 4s ease-in-out infinite; transform-origin: bottom; }
        .animate-head-tilt { animation: head-tilt 6s ease-in-out infinite; transform-origin: 50% 60%; }
        .animate-tail-idle { animation: tail-idle 3s ease-in-out infinite; transform-origin: 50px 80px; }
      `}</style>
    </ScreenWrapper>
  );
};
