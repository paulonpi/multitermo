import { useState } from 'react'

interface WaitingScreenProps {
  code: string
  playerName: string
}

export function WaitingScreen({ code, playerName }: WaitingScreenProps) {
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 p-4">
      <h1 className="text-4xl font-bold tracking-[0.3em]">TERMO</h1>

      <div className="text-center">
        <p className="text-sm mb-5" style={{ color: '#8a7880' }}>Compartilhe o código com seu adversário</p>
        <div className="flex items-center justify-center gap-4">
          <span className="text-5xl sm:text-6xl font-bold tracking-[0.35em]">{code}</span>
          <button
            onClick={copyCode}
            className="btn-outline"
            style={{ width: 'auto', padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
          >
            {copied ? '✓' : 'Copiar'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3" style={{ color: '#8a7880' }}>
        <div
          className="w-4 h-4 border-2 rounded-full animate-spin"
          style={{ borderColor: '#4c4347', borderTopColor: '#8a7880' }}
        />
        <span className="text-sm">Aguardando adversário...</span>
      </div>

      <p className="text-xs" style={{ color: '#4c4347' }}>
        Jogando como <span style={{ color: '#8a7880' }}>{playerName}</span>
      </p>
    </div>
  )
}
