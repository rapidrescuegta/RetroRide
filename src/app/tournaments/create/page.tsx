import { Suspense } from 'react'
import CreateTournamentClient from './CreateTournamentClient'

export default function TournamentsCreatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
        </div>
      }
    >
      <CreateTournamentClient />
    </Suspense>
  )
}
