import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const type = req.nextUrl.searchParams.get('type') || 'weekly'
  if (!['daily', 'weekly'].includes(type)) {
    return NextResponse.json({ error: 'type must be "daily" or "weekly"' }, { status: 400 })
  }

  // Get all families
  const families = await prisma.family.findMany({
    include: {
      members: {
        include: {
          notificationPref: true,
        },
      },
    },
  })

  let emailsSent = 0
  const resendKey = process.env.RESEND_API_KEY
  const emailFrom = process.env.EMAIL_FROM || 'RetroRide <noreply@retroride.app>'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://retroride.app'

  for (const family of families) {
    // Find members who want this type of ranking email
    const recipients = family.members.filter(m => {
      const pref = m.notificationPref
      // Default is "weekly" if no preference set
      const rankingPref = pref?.rankingEmail ?? 'weekly'
      return rankingPref === type && m.emailVerified
    })

    if (recipients.length === 0) continue

    // Build leaderboard data for this family
    const memberIds = family.members.map(m => m.id)
    const allScores = await prisma.score.findMany({
      where: { memberId: { in: memberIds } },
      orderBy: { score: 'desc' },
      include: { member: { select: { name: true, avatar: true } } },
    })

    // Group best score per member per game
    const bestScores = new Map<string, Map<string, number>>()
    for (const s of allScores) {
      if (!bestScores.has(s.gameId)) bestScores.set(s.gameId, new Map())
      const gameMap = bestScores.get(s.gameId)!
      if (!gameMap.has(s.memberId) || s.score > gameMap.get(s.memberId)!) {
        gameMap.set(s.memberId, s.score)
      }
    }

    // Count crowns and total points
    const crowns = new Map<string, number>()
    const totalPoints = new Map<string, number>()

    for (const [, gameMap] of bestScores) {
      let bestMemberId = ''
      let bestScore = -1
      for (const [memberId, score] of gameMap) {
        totalPoints.set(memberId, (totalPoints.get(memberId) || 0) + score)
        if (score > bestScore) {
          bestScore = score
          bestMemberId = memberId
        }
      }
      if (bestMemberId) {
        crowns.set(bestMemberId, (crowns.get(bestMemberId) || 0) + 1)
      }
    }

    const overview = family.members.map(m => ({
      memberId: m.id,
      name: m.name,
      avatar: m.avatar,
      crowns: crowns.get(m.id) || 0,
      totalPoints: totalPoints.get(m.id) || 0,
      gamesPlayed: new Set(
        allScores.filter(s => s.memberId === m.id).map(s => s.gameId)
      ).size,
    })).sort((a, b) => b.crowns - a.crowns || b.totalPoints - a.totalPoints)

    if (overview.length === 0) continue

    // Build the email HTML
    const html = buildRankingEmail(family.name, overview, type, appUrl)

    // Send to each recipient
    for (const member of recipients) {
      if (!resendKey) {
        console.log(`[DEV] Would send ${type} ranking email to ${member.email}`)
        emailsSent++
        continue
      }

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [member.email],
            subject: `${type === 'daily' ? 'Daily' : 'Weekly'} Rankings - ${family.name} | RetroRide`,
            html,
          }),
        })
        emailsSent++
      } catch (err) {
        console.error(`Failed to send ranking email to ${member.email}:`, err)
      }
    }
  }

  return NextResponse.json({ sent: emailsSent, type })
}

function buildRankingEmail(
  familyName: string,
  overview: { name: string; avatar: string; crowns: number; totalPoints: number; gamesPlayed: number }[],
  type: string,
  appUrl: string
): string {
  const medals = ['👑', '🥈', '🥉']

  const topThreeHtml = overview.slice(0, 3).map((p, i) => `
    <div style="display: inline-block; text-align: center; margin: 0 12px; vertical-align: top;">
      <div style="font-size: 28px; margin-bottom: 4px;">${medals[i] || ''}</div>
      <div style="font-size: 32px; margin-bottom: 4px;">${p.avatar}</div>
      <div style="font-size: 14px; font-weight: bold; color: ${i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#cd7f32'};">${p.name}</div>
      <div style="font-size: 11px; color: #06b6d4; margin-top: 2px;">${p.totalPoints.toLocaleString()} pts</div>
      <div style="font-size: 10px; color: #64748b;">${p.crowns} crown${p.crowns !== 1 ? 's' : ''}</div>
    </div>
  `).join('')

  const tableRowsHtml = overview.map((p, i) => `
    <tr style="border-bottom: 1px solid #1e293b;">
      <td style="padding: 10px 12px; color: #94a3b8; font-size: 14px; font-weight: bold;">#${i + 1}</td>
      <td style="padding: 10px 8px; font-size: 20px;">${p.avatar}</td>
      <td style="padding: 10px 8px; color: #e2e8f0; font-size: 14px; font-weight: 600;">${p.name}</td>
      <td style="padding: 10px 8px; color: #fbbf24; font-size: 13px; text-align: center;">${p.crowns}</td>
      <td style="padding: 10px 8px; color: #06b6d4; font-size: 13px; text-align: right;">${p.totalPoints.toLocaleString()}</td>
      <td style="padding: 10px 12px; color: #64748b; font-size: 12px; text-align: right;">${p.gamesPlayed}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin: 0; padding: 0; background-color: #0a0a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 520px; margin: 0 auto; padding: 32px 16px;">

    <!-- Header -->
    <div style="text-align: center; padding: 24px 0;">
      <div style="font-size: 12px; letter-spacing: 4px; color: #8b5cf6; text-transform: uppercase; margin-bottom: 8px;">RetroRide</div>
      <h1 style="margin: 0; font-size: 22px; font-weight: bold; background: linear-gradient(135deg, #a855f7, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
        ${type === 'daily' ? 'Daily' : 'Weekly'} Rankings
      </h1>
      <div style="margin-top: 8px; font-size: 14px; color: #64748b;">${familyName}</div>
    </div>

    <!-- Glowing divider -->
    <div style="height: 2px; background: linear-gradient(90deg, transparent, #8b5cf6, #06b6d4, #ec4899, transparent); margin: 8px 0 24px;"></div>

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
        🎮 Play Now
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 16px 0; border-top: 1px solid #1e293b;">
      <p style="margin: 0; font-size: 11px; color: #475569;">
        You're receiving this because you have ${type} ranking emails enabled.
      </p>
      <p style="margin: 4px 0 0; font-size: 11px; color: #334155;">
        Manage your preferences in the RetroRide app settings.
      </p>
    </div>

  </div>
</body>
</html>
  `
}
