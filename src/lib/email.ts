import { Resend } from 'resend'

let resendClient: Resend | null = null

function getResend(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY
    if (!key) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }
    resendClient = new Resend(key)
  }
  return resendClient
}

function getFrom(): string {
  return process.env.EMAIL_FROM || 'GameBuddi <noreply@gamebuddi.com>'
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://gamebuddi.com'
}

function emailShell(title: string, bodyContent: string): string {
  const appUrl = getAppUrl()
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin: 0; padding: 0; background-color: #0a0a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 520px; margin: 0 auto; padding: 32px 16px;">

    <!-- Header -->
    <div style="text-align: center; padding: 24px 0;">
      <div style="font-size: 12px; letter-spacing: 4px; color: #8b5cf6; text-transform: uppercase; margin-bottom: 8px;">GameBuddi</div>
      <h1 style="margin: 0; font-size: 22px; font-weight: bold; background: linear-gradient(135deg, #a855f7, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
        ${title}
      </h1>
    </div>

    <!-- Glowing divider -->
    <div style="height: 2px; background: linear-gradient(90deg, transparent, #8b5cf6, #06b6d4, #ec4899, transparent); margin: 8px 0 24px;"></div>

    ${bodyContent}

    <!-- Footer -->
    <div style="text-align: center; padding: 16px 0; border-top: 1px solid #1e293b; margin-top: 24px;">
      <p style="margin: 0; font-size: 11px; color: #475569;">
        Sent by GameBuddi &mdash; Family Arcade Fun
      </p>
      <p style="margin: 4px 0 0; font-size: 11px;">
        <a href="${appUrl}/settings/notifications" style="color: #64748b; text-decoration: underline;">Unsubscribe</a>
        &nbsp;&middot;&nbsp;
        <a href="${appUrl}/settings" style="color: #64748b; text-decoration: underline;">Manage preferences</a>
      </p>
    </div>

  </div>
</body>
</html>`
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const resend = getResend()

  const body = `
    <div style="text-align: center; padding: 20px 0;">
      <p style="color: #94a3b8; font-size: 15px; margin: 0 0 20px;">Your verification code is:</p>
      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 24px; display: inline-block; margin: 0 auto;">
        <span style="font-size: 36px; font-weight: bold; color: #06b6d4; letter-spacing: 10px; font-family: 'Courier New', monospace;">${code}</span>
      </div>
      <p style="color: #64748b; font-size: 13px; margin-top: 20px;">This code expires in 10 minutes.</p>
      <p style="color: #475569; font-size: 12px; margin-top: 8px;">If you didn't request this, you can safely ignore this email.</p>
    </div>`

  const html = emailShell('Verification Code', body)

  await resend.emails.send({
    from: getFrom(),
    to: [to],
    subject: `Your GameBuddi verification code: ${code}`,
    html,
  })
}

export interface RankingEntry {
  name: string
  avatar: string
  crowns: number
  totalPoints: number
  gamesPlayed: number
}

export async function sendWeeklyRankings(
  to: string,
  familyName: string,
  rankings: RankingEntry[],
  type: 'daily' | 'weekly' = 'weekly'
): Promise<void> {
  const resend = getResend()
  const appUrl = getAppUrl()
  const medals = ['\u{1F451}', '\u{1F948}', '\u{1F949}']

  const topThreeHtml = rankings.slice(0, 3).map((p, i) => `
    <div style="display: inline-block; text-align: center; margin: 0 12px; vertical-align: top;">
      <div style="font-size: 28px; margin-bottom: 4px;">${medals[i] || ''}</div>
      <div style="font-size: 32px; margin-bottom: 4px;">${p.avatar}</div>
      <div style="font-size: 14px; font-weight: bold; color: ${i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#cd7f32'};">${p.name}</div>
      <div style="font-size: 11px; color: #06b6d4; margin-top: 2px;">${p.totalPoints.toLocaleString()} pts</div>
      <div style="font-size: 10px; color: #64748b;">${p.crowns} crown${p.crowns !== 1 ? 's' : ''}</div>
    </div>
  `).join('')

  const tableRowsHtml = rankings.map((p, i) => `
    <tr style="border-bottom: 1px solid #1e293b;">
      <td style="padding: 10px 12px; color: #94a3b8; font-size: 14px; font-weight: bold;">#${i + 1}</td>
      <td style="padding: 10px 8px; font-size: 20px;">${p.avatar}</td>
      <td style="padding: 10px 8px; color: #e2e8f0; font-size: 14px; font-weight: 600;">${p.name}</td>
      <td style="padding: 10px 8px; color: #fbbf24; font-size: 13px; text-align: center;">${p.crowns}</td>
      <td style="padding: 10px 8px; color: #06b6d4; font-size: 13px; text-align: right;">${p.totalPoints.toLocaleString()}</td>
      <td style="padding: 10px 12px; color: #64748b; font-size: 12px; text-align: right;">${p.gamesPlayed}</td>
    </tr>
  `).join('')

  const body = `
    <div style="text-align: center; margin-bottom: 8px;">
      <div style="font-size: 14px; color: #64748b;">${familyName}</div>
    </div>

    <!-- Top 3 Podium -->
    <div style="text-align: center; padding: 20px 0 28px; background: linear-gradient(180deg, #1e1b4b20, transparent); border-radius: 16px;">
      ${topThreeHtml}
    </div>

    <!-- Full Rankings Table -->
    <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid #334155;">
            <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Rank</th>
            <th style="padding: 12px 8px; width: 36px;"></th>
            <th style="padding: 12px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Player</th>
            <th style="padding: 12px 8px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Crowns</th>
            <th style="padding: 12px 8px; text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Points</th>
            <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Games</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Play Now Button -->
    <div style="text-align: center; padding: 24px 0;">
      <a href="${appUrl}" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: white; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 12px; letter-spacing: 1px;">
        Play Now
      </a>
    </div>`

  const label = type === 'daily' ? 'Daily' : 'Weekly'
  const html = emailShell(`${label} Rankings`, body)

  await resend.emails.send({
    from: getFrom(),
    to: [to],
    subject: `${label} Rankings - ${familyName} | GameBuddi`,
    html,
  })
}

export async function sendTournamentInvite(
  to: string,
  tournamentName: string,
  familyName: string,
  joinLink: string
): Promise<void> {
  const resend = getResend()

  const body = `
    <div style="text-align: center; padding: 20px 0;">
      <div style="font-size: 40px; margin-bottom: 12px;">\u{1F3C6}</div>
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 8px;">You've been invited to a tournament!</p>
      <div style="background: #0f172a; border: 1px solid #8b5cf6; border-radius: 16px; padding: 24px; margin: 20px 0;">
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #a855f7;">${tournamentName}</h2>
        <p style="margin: 0; font-size: 14px; color: #64748b;">Hosted by ${familyName}</p>
      </div>
      <a href="${joinLink}" style="display: inline-block; padding: 14px 48px; background: linear-gradient(135deg, #8b5cf6, #06b6d4); color: white; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 12px; letter-spacing: 1px; margin-top: 16px;">
        Join Tournament
      </a>
      <p style="color: #475569; font-size: 12px; margin-top: 16px;">Or copy this link: <span style="color: #06b6d4;">${joinLink}</span></p>
    </div>`

  const html = emailShell('Tournament Invite', body)

  await resend.emails.send({
    from: getFrom(),
    to: [to],
    subject: `You're invited: ${tournamentName} | GameBuddi`,
    html,
  })
}

export interface TournamentStanding {
  rank: number
  name: string
  avatar: string
  score: number
}

export async function sendTournamentResult(
  to: string,
  tournamentName: string,
  winner: { name: string; avatar: string },
  standings: TournamentStanding[]
): Promise<void> {
  const resend = getResend()
  const appUrl = getAppUrl()

  const standingsHtml = standings.map((s) => `
    <tr style="border-bottom: 1px solid #1e293b;">
      <td style="padding: 10px 12px; color: ${s.rank === 1 ? '#fbbf24' : '#94a3b8'}; font-size: 14px; font-weight: bold;">#${s.rank}</td>
      <td style="padding: 10px 8px; font-size: 20px;">${s.avatar}</td>
      <td style="padding: 10px 8px; color: #e2e8f0; font-size: 14px; font-weight: 600;">${s.name}</td>
      <td style="padding: 10px 12px; color: #06b6d4; font-size: 13px; text-align: right;">${s.score.toLocaleString()}</td>
    </tr>
  `).join('')

  const body = `
    <div style="text-align: center; padding: 20px 0;">
      <div style="font-size: 40px; margin-bottom: 12px;">\u{1F3C6}</div>
      <p style="color: #64748b; font-size: 14px; margin: 0 0 4px;">Tournament Complete</p>
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #a855f7;">${tournamentName}</h2>

      <!-- Winner highlight -->
      <div style="background: linear-gradient(135deg, #1e1b4b, #0f172a); border: 2px solid #fbbf24; border-radius: 16px; padding: 24px; margin: 16px 0;">
        <div style="font-size: 48px; margin-bottom: 8px;">${winner.avatar}</div>
        <p style="margin: 0; font-size: 12px; color: #fbbf24; text-transform: uppercase; letter-spacing: 2px;">Champion</p>
        <p style="margin: 4px 0 0; font-size: 18px; color: #e2e8f0; font-weight: bold;">${winner.name}</p>
      </div>
    </div>

    <!-- Standings Table -->
    <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid #334155;">
            <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Rank</th>
            <th style="padding: 12px 8px; width: 36px;"></th>
            <th style="padding: 12px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Player</th>
            <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Score</th>
          </tr>
        </thead>
        <tbody>
          ${standingsHtml}
        </tbody>
      </table>
    </div>

    <!-- View Details Button -->
    <div style="text-align: center; padding: 24px 0;">
      <a href="${appUrl}/tournaments" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: white; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 12px; letter-spacing: 1px;">
        View Details
      </a>
    </div>`

  const html = emailShell('Tournament Results', body)

  await resend.emails.send({
    from: getFrom(),
    to: [to],
    subject: `Results: ${tournamentName} | GameBuddi`,
    html,
  })
}
