import { useGame } from './hooks/useGame'
import { HomeScreen } from './screens/HomeScreen'
import { WaitingScreen } from './screens/WaitingScreen'
import { GameScreen } from './screens/GameScreen'
import { RoundEndScreen } from './screens/RoundEndScreen'
import { MatchEndScreen } from './screens/MatchEndScreen'
import { HowToPlayScreen } from './screens/HowToPlayScreen'

export default function App() {
  const { state, createRoom, joinRoom, onKeyPress, playAgain, muted, toggleMute, goToHowToPlay } = useGame()

  switch (state.screen) {
    case 'how_to_play':
      return <HowToPlayScreen onBack={() => goToHowToPlay(false)} />

    case 'home':
      return <HomeScreen onCreateRoom={createRoom} onJoinRoom={joinRoom} onHowToPlay={() => goToHowToPlay(true)} />

    case 'waiting':
      return (
        <WaitingScreen
          code={state.roomCode}
          playerName={state.myName}
          players={state.waitingPlayers}
          maxPlayers={state.maxPlayers}
        />
      )

    case 'game':
      return <GameScreen state={state} onKeyPress={onKeyPress} muted={muted} onToggleMute={toggleMute} />

    case 'round_end':
      return state.roundEndData ? (
        <RoundEndScreen
          data={state.roundEndData}
          myName={state.myName}
          players={state.players}
        />
      ) : null

    case 'match_end':
      return state.matchEndData ? (
        <MatchEndScreen
          data={state.matchEndData}
          myName={state.myName}
          players={state.players}
          onPlayAgain={playAgain}
        />
      ) : null

    default:
      return null
  }
}
