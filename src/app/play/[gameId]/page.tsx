import { GAMES } from '@/lib/games'
import PlayClient from './PlayClient'

export function generateStaticParams() {
  return GAMES.map(game => ({ gameId: game.id }))
}

export default async function PlayPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params
  return <PlayClient gameId={gameId} />
}
