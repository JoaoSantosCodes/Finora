// ─────────────────────────────────────────────────────────────────────────────
// TELA DE LOGIN E CADASTRO (E-MAIL/SENHA) — GATE 2A
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Modo = 'entrar' | 'cadastrar'
type Provider = 'google' | 'github'

export function Login() {
  const [modo, setModo] = useState<Modo>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [provedorCarregando, setProvedorCarregando] = useState<Provider | null>(null)
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

  const handleOAuth = async (provider: Provider) => {
    setErro(null)
    setProvedorCarregando(provider)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      })
      // Em caso de sucesso o navegador é redirecionado para o provedor;
      // este código só continua a rodar se a chamada falhar antes disso.
      if (error) throw error
    } catch (e) {
      setErro(traduzirErro(e))
      setProvedorCarregando(null)
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
                  <label htmlFor="login-nome" className="block text-xs font-semibold text-slate-500 mb-1">
                    Nome (opcional)
                  </label>
                  <input
                    id="login-nome"
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
                <label htmlFor="login-email" className="block text-xs font-semibold text-slate-500 mb-1">
                  E-mail
                </label>
                <input
                  id="login-email"
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
                <label htmlFor="login-senha" className="block text-xs font-semibold text-slate-500 mb-1">
                  Senha
                </label>
                <input
                  id="login-senha"
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
                  <label htmlFor="login-confirmar-senha" className="block text-xs font-semibold text-slate-500 mb-1">
                    Confirmar senha
                  </label>
                  <input
                    id="login-confirmar-senha"
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

          {!avisoConfirmacao && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">ou continue com</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleOAuth('google')}
                  disabled={provedorCarregando !== null}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
                >
                  <IconGoogle />
                  {provedorCarregando === 'google' ? 'Aguarde…' : 'Google'}
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuth('github')}
                  disabled={provedorCarregando !== null}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
                >
                  <IconGithub />
                  {provedorCarregando === 'github' ? 'Aguarde…' : 'GitHub'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function IconGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.89c2.27-2.09 3.56-5.17 3.56-8.76Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.89-3.02c-1.08.72-2.46 1.15-4.04 1.15-3.1 0-5.73-2.1-6.67-4.92H1.3v3.09C3.26 21.3 7.3 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.33 14.3a7.2 7.2 0 0 1 0-4.6V6.61H1.3a12 12 0 0 0 0 10.78l4.03-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.6 4.6 1.79l3.45-3.45C17.94 1.19 15.24 0 12 0 7.3 0 3.26 2.7 1.3 6.61l4.03 3.09C6.27 6.88 8.9 4.77 12 4.77Z"
      />
    </svg>
  )
}

function IconGithub() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.7-3.87-1.54-3.87-1.54-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.67.8.56A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

function traduzirErro(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)

  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (msg.includes('User already registered')) return 'Já existe uma conta com este e-mail. Tente entrar.'
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (msg.includes('Password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (msg.includes('Unsupported provider') || msg.includes('provider is not enabled'))
    return 'Este método de login ainda não foi habilitado no projeto. Configure o provedor no painel do Supabase.'

  return msg
}
