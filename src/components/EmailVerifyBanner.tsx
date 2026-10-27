/**
 * EmailVerifyBanner — aviso com o botão "Confirmar meu e-mail" (Estacionamento item 5, 26/10/2026). Aparece só para
 * quem ainda não confirmou o e-mail no Firebase Auth: as regras novas exigem e-mail confirmado do admin.
 */
import { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Step = 'idle' | 'sending' | 'sent' | 'checking' | 'verified';

export function EmailVerifyBanner() {
  const { firebaseUser } = useAuth();
  const [step, setStep] = useState<Step>('idle');
  const [message, setMessage] = useState('');

  // Só quem o Firebase diz que NÃO confirmou (undefined = desconhecido, não mostra).
  if (!firebaseUser || firebaseUser.emailVerified !== false || step === 'verified') return null;

  const send = async () => {
    setStep('sending');
    setMessage('');
    try {
      await sendEmailVerification(firebaseUser);
      setStep('sent');
    } catch (err) {
      setStep('idle');
      const code = (err as { code?: string })?.code;
      setMessage(
        code === 'auth/too-many-requests'
          ? 'Muitos envios seguidos. Espere alguns minutos e tente de novo.'
          : 'Não foi possível enviar o e-mail. Tente de novo.',
      );
    }
  };

  const check = async () => {
    setStep('checking');
    setMessage('');
    try {
      await firebaseUser.reload();
      if (firebaseUser.emailVerified) {
        // Renova o login para as regras do banco já verem o e-mail confirmado (sem esperar até 1 hora).
        await firebaseUser.getIdToken(true);
        setStep('verified');
        return;
      }
      setMessage('Ainda não aparece como confirmado. Abra o link do e-mail (veja também o spam) e tente de novo.');
    } catch {
      setMessage('Não foi possível conferir agora. Tente de novo.');
    }
    setStep('sent');
  };

  const busy = step === 'sending' || step === 'checking';

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 md:flex-row md:items-center">
      <MailCheck className="h-6 w-6 shrink-0" />
      <div className="flex-1 text-sm">
        {step === 'sent' || step === 'checking' ? (
          <p>
            Enviamos um link para <strong>{firebaseUser.email}</strong>. Abra o link e depois clique em "Já confirmei".
          </p>
        ) : (
          <p>Seu e-mail ainda não foi confirmado.</p>
        )}
        {message && <p className="mt-1 font-semibold">{message}</p>}
      </div>
      <div className="flex gap-2">
        {(step === 'sent' || step === 'checking') && (
          <button
            type="button"
            onClick={check}
            disabled={busy}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            Já confirmei
          </button>
        )}
        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-900 disabled:opacity-60"
        >
          {step === 'sent' || step === 'checking' ? 'Enviar de novo' : 'Confirmar meu e-mail'}
        </button>
      </div>
    </div>
  );
}
