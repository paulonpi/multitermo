import { Tile } from '../components/Tile'

interface HowToPlayScreenProps {
  onBack: () => void
}

function TileRow({ letters, states }: {
  letters: string[]
  states: ('correct' | 'present' | 'absent')[]
}) {
  return (
    <div className="flex gap-1">
      {letters.map((letter, i) => (
        <Tile key={i} letter={letter} state={states[i]} />
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#8a7880' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

export function HowToPlayScreen({ onBack }: HowToPlayScreenProps) {
  return (
    <div className="flex flex-col items-center min-h-screen p-6 pb-10 gap-8 max-w-sm mx-auto">

      <div className="w-full flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          style={{ color: '#8a7880', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          ← Voltar
        </button>
        <h1 className="text-lg font-bold tracking-[0.2em]">COMO JOGAR</h1>
        <div style={{ width: 60 }} />
      </div>

      <Section title="Objetivo">
        <p className="text-sm leading-relaxed" style={{ color: '#c4b5b9' }}>
          Descubra a palavra de 5 letras em até <strong>6 tentativas</strong>.
          Dois jogadores tentam adivinhar a <strong>mesma palavra</strong> ao mesmo tempo,
          cada um no seu próprio tabuleiro.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: '#c4b5b9' }}>
          Baseado no{' '}
          <a
            href="https://term.ooo"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-right)', textDecoration: 'underline' }}
          >
            Termo
          </a>
          {' '}— o Wordle em português.
        </p>
      </Section>

      <Section title="As dicas">
        <p className="text-sm" style={{ color: '#c4b5b9' }}>
          Após cada tentativa, as letras mudam de cor:
        </p>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <TileRow
              letters={['T', 'U', 'R', 'M', 'A']}
              states={['correct', 'absent', 'absent', 'absent', 'absent']}
            />
            <p className="text-sm" style={{ color: '#c4b5b9' }}>
              <span style={{ color: 'var(--color-right)' }}>Verde</span> — letra certa na posição certa
            </p>
          </div>

          <div className="flex items-center gap-4">
            <TileRow
              letters={['V', 'I', 'O', 'L', 'A']}
              states={['absent', 'absent', 'present', 'absent', 'absent']}
            />
            <p className="text-sm" style={{ color: '#c4b5b9' }}>
              <span style={{ color: 'var(--color-place)' }}>Amarelo</span> — existe na palavra, posição errada
            </p>
          </div>

          <div className="flex items-center gap-4">
            <TileRow
              letters={['P', 'U', 'L', 'G', 'A']}
              states={['absent', 'absent', 'absent', 'absent', 'absent']}
            />
            <p className="text-sm" style={{ color: '#c4b5b9' }}>
              <span style={{ color: '#8a7880' }}>Cinza</span> — letra não está na palavra
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1 pt-1" style={{ color: '#8a7880', fontSize: '0.75rem' }}>
          <p>• Acentos são preenchidos automaticamente e não afetam as dicas</p>
          <p>• Palavras podem ter letras repetidas</p>
        </div>
      </Section>

      <Section title="A competição">
        <p className="text-sm leading-relaxed" style={{ color: '#c4b5b9' }}>
          Você vê o progresso do adversário em tempo real — quantas tentativas ele fez e o
          resultado de cada linha — mas <strong>sem revelar as letras</strong>.
        </p>

        <div className="flex flex-col gap-2 text-sm" style={{ color: '#c4b5b9' }}>
          <p><strong style={{ color: '#e0d0d4' }}>Vencer uma rodada:</strong></p>
          <ul className="flex flex-col gap-1 pl-2" style={{ color: '#8a7880', fontSize: '0.8rem' }}>
            <li>• Acerte antes do adversário → você vence a rodada</li>
            <li>• Nenhum dos dois acerta → vence quem teve melhor resultado</li>
            <li>• Ambos acertam no mesmo turno → empate (sem pontos)</li>
          </ul>
        </div>

        <div className="flex flex-col gap-2 text-sm" style={{ color: '#c4b5b9' }}>
          <p><strong style={{ color: '#e0d0d4' }}>A partida:</strong></p>
          <ul className="flex flex-col gap-1 pl-2" style={{ color: '#8a7880', fontSize: '0.8rem' }}>
            <li>• 5 rodadas com palavras diferentes</li>
            <li>• Vence quem ganhar mais rodadas</li>
            <li>• Cada rodada tem um limite de tempo definido pelo host (1–10 min)</li>
          </ul>
        </div>
      </Section>

      <button onClick={onBack} className="btn-primary w-full max-w-xs">
        Jogar
      </button>

    </div>
  )
}
