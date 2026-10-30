import type { LucideIcon } from 'lucide-react'
import { Award, CalendarCheck, Crown, Flame, Gem, Moon, Repeat, Rocket, Shield, Sparkles, Sunrise, Swords, Target, Trophy } from 'lucide-react'

export interface AchievementMeta {
  code: string
  name: string
  desc: string
  icon: LucideIcon
}

/** Display data for the codes awarded by xplan.check_achievements(). */
export const ACHIEVEMENTS: AchievementMeta[] = [
  { code: 'first_quest', name: 'First Quest', desc: 'Complete your first quest', icon: Sparkles },
  { code: 'quests_10', name: 'Adventurer', desc: 'Complete 10 quests', icon: Target },
  { code: 'quests_50', name: 'Veteran', desc: 'Complete 50 quests', icon: Shield },
  { code: 'quests_100', name: 'Centurion', desc: 'Complete 100 quests', icon: Crown },
  { code: 'combo_3', name: 'Combo ×3', desc: 'Clear quests 3 days in a row', icon: Flame },
  { code: 'combo_7', name: 'Combo ×7', desc: 'Clear quests 7 days in a row', icon: Flame },
  { code: 'combo_30', name: 'Unstoppable', desc: 'Clear quests 30 days in a row', icon: Rocket },
  { code: 'level_5', name: 'Rising Star', desc: 'Reach level 5', icon: Award },
  { code: 'level_10', name: 'Elite', desc: 'Reach level 10', icon: Gem },
  { code: 'on_time_10', name: 'Punctual', desc: 'Finish 10 quests on or before their due date', icon: CalendarCheck },
  { code: 'boss_5', name: 'Boss Slayer', desc: 'Complete 5 P1 or P2 quests', icon: Swords },
  { code: 'routine_5', name: 'Creature of Habit', desc: 'Complete 5 repeating quests', icon: Repeat },
  { code: 'early_bird', name: 'Early Bird', desc: 'Complete a quest before 9am', icon: Sunrise },
  { code: 'night_owl', name: 'Night Owl', desc: 'Complete a quest after 10pm', icon: Moon },
]

export const ACHIEVEMENT_BY_CODE = new Map(ACHIEVEMENTS.map((a) => [a.code, a]))
export const TROPHY_ICON = Trophy
