import { useGame } from './hooks/useGame'
import { HomeScreen } from './screens/HomeScreen'
import { CreateRoomScreen } from './screens/CreateRoomScreen'
import { LobbyScreen } from './screens/LobbyScreen'
import { WaitingScreen } from './screens/WaitingScreen'
import { GameScreen } from './screens/GameScreen'
import { RoundEndScreen } from './screens/RoundEndScreen'
import { MatchEndScreen } from './screens/MatchEndScreen'
import { HowToPlayScreen } from './screens/HowToPlayScreen'

export default function App() {
  const {
    state,
    createRoom, joinRoom,
    openLobby, leaveLobby,
    deleteRoom, goToCreateRoom,
    onKeyPress, playAgain,
    muted, toggleMute, goToHowToPlay,
  } = useGame()

  switch (state.screen) {
    case 'how_to_play':
      return <HowToPlayScreen onBack={() => goToHowToPlay(false)} />

    case 'home':
      return (
        <HomeScreen
          onCreateRoom={name => goToCreateRoom(name)}
          onOpenLobby={openLobby}
          onJoinRoom={joinRoom}
          onHowToPlay={() => goToHowToPlay(true)}
        />
      )

    case 'create_room':
      return (
        <CreateRoomScreen
          playerName={state.myName}
          onBack={() => goToHowToPlay(false)}
          onCreateRoom={createRoom}
        />
      )

    case 'lobby':
      return (
        <LobbyScreen
          playerName={state.myName}
          rooms={state.lobbyRooms}
          onJoin={code => joinRoom(code, state.myName)}
          onCreateRoom={() => goToCreateRoom(state.myName)}
          onBack={leaveLobby}
        />
      )

    case 'waiting':
      return (
        <WaitingScreen
          code={state.roomCode}
          playerName={state.myName}
          players={state.waitingPlayers}
          maxPlayers={state.maxPlayers}
          roundDuration={state.roundDuration}
          isPublic={state.isPublic}
          roomName={state.roomName}
          isHost={state.isHost}
          onDeleteRoom={deleteRoom}
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
