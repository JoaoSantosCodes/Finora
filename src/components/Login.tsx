// ─────────────────────────────────────────────────────────────────────────────
// TELA DE LOGIN E CADASTRO (E-MAIL/SENHA) — GATE 2A
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Modo = 'entrar' | 'cadastrar'

export function Login() {
  const [modo, setModo] = useState<Modo>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [avisoConfirmacao, setAvisoConfirmacao] = useState(false)

  const trocarModo = (novoModo: Modo) => {
    setModo(novoModo)
    setErro(null)
    setAvisoConfirmacao(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErro(null)
    setAvisoConfirmacao(false)

    if (modo === 'cadastrar' && senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }
    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    setCarregando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            data: nome.trim() ? { display_name: nome.trim() } : undefined,
          },
        })
        if (error) throw error

        if (!data.session) {
          // Projeto exige confirmação por e-mail antes de liberar a sessão.
          setAvisoConfirmacao(true)
        }
      }
    } catch (e) {
      setErro(traduzirErro(e))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white font-extrabold flex items-center justify-center shadow-sm text-xl">
            F
          </div>
          <p className="mt-3 font-bold text-slate-800 text-lg">Finora</p>
          <p className="text-sm text-slate-400">Controle financeiro</p>
        </div>

        <div className="card p-6">
          <div className="flex mb-5 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => trocarModo('entrar')}
              className={`flex-1 rounded-lg py-2 transition ${
                modo === 'entrar' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => trocarModo('cadastrar')}
              className={`flex-1 rounded-lg py-2 transition ${
                modo === 'cadastrar' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
              }`}
            >
              Criar conta
            </button>
          </div>

          {avisoConfirmacao ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Conta criada! Enviamos um link de confirmação para <strong>{email}</strong>. Confirme seu
              e-mail e depois faça login.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {modo === 'cadastrar' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nome (opcional)</label>
                  <input
                    className="input"
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    autoComplete="name"
                    placeholder="Seu nome"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">E-mail</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="voce@email.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Senha</label>
                <input
                  className="input"
                  type="password"
                  required
                  minLength={6}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                />
              </div>

              {modo === 'cadastrar' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Confirmar senha</label>
                  <input
                    className="input"
                    type="password"
                    required
                    minLength={6}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                </div>
              )}

              {erro && (
                <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {erro}
                </p>
              )}

              <button type="submit" disabled={carregando} className="btn-primary w-full mt-1">
                {carregando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function traduzirErro(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)

  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (msg.includes('User already registered')) return 'Já existe uma conta com este e-mail. Tente entrar.'
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (msg.includes('Password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.'

  return msg
}
