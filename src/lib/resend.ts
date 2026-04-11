/**
 * Resend email client — convenience re-export from email-config.
 *
 * Usage:
 *   import { getResend, sendVerificationCode } from '@/lib/resend'
 */
export {
  getResend,
  requireResend,
  getFromAddress,
  getAppUrl,
  sendVerificationCode,
  sendRankingsEmail,
  sendTournamentInvite,
  sendTournamentResult,
} from '@/lib/email-config'
export type { RankingEntry, TournamentStanding } from '@/lib/email-config'
