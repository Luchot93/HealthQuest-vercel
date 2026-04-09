
export type Language = 'en' | 'es';

export type ScreenId = 
  | 'INITIAL_SPLASH'
  | 'LANGUAGE' 
  | 'INTRO_1' 
  | 'INTRO_2' 
  | 'INTRO_3' 
  | 'PET_SELECTION' 
  | 'PET_GENDER'
  | 'PET_NAMING'
  | 'USER_NAMING'
  | 'USER_AGE'
  | 'USER_GENDER'
  | 'USER_ACTIVITY'
  | 'MAIN_GOAL'
  | 'SHARE_INTEREST' 
  | 'SHARE_LINK'
  | 'THINKING'
  | 'MOOD_CHECK'
  | 'ENERGY_CHECK'
  | 'TIME_CHECK'
  | 'MOTIVATION'
  | 'SHOP'
  | 'HEALTH_STATS'
  | 'DASHBOARD'
  | 'CREATE_CUSTOM_GOAL';

export type PetType = 'dog' | 'cat';
export type PetGender = 'male' | 'female' | 'other' | null;

export interface PetStyle {
  id: string;
  primary: string; 
  secondary: string; 
  accent: string; 
  pattern?: 'saddle' | 'points' | 'spots' | 'solid';
  labelEn: string;
  labelEs: string;
}

export type RecurrenceFrequency = 'daily' | 'weekday' | 'weekly' | 'monthly' | null;

export interface Goal {
  id: number;
  category: string;
  en: string;
  es: string;
  exampleEn?: string;
  exampleEs?: string;
  baseValue?: number;
  isPhysical?: boolean;
  type?: 'primary' | 'support' | 'custom';
  xValue?: number;
  yValue?: number;
  repeat?: boolean;
  frequency?: RecurrenceFrequency;
  endDate?: string | null;
}

export enum PetMood {
  CALM = 'calm',
  HAPPY = 'happy',
  RELAXED = 'relaxed'
}
