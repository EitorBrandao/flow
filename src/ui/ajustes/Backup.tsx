import { useRef, useState } from 'react';
import { gerarBackup, mesclar, validarBackup } from '../../backup/backup';
import * as repo from '../../db/repo';
import { hojeISO } from '../../domain/dates';
import { useApp } from '../../state/store';

export default function Backup() {
  const { dados, recarregar } = useApp();
  const [modo, setModo] = useState<'substituir' | 'mesclar'>('substituir');
  const [msg, setMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  if (!dados) return null;

  async function exportar() {
    const atuais = await repo.carregarTudo();
    const json = JSON.stringify(gerarBackup(atuais), null, 2);
    const nome = `flow-backup-${hojeISO()}.json`;
    const arquivo = new File([json], nome, { type: 'application/json' });
    if (navigator.share && navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: nome });
      } catch {
        return; // usuário cancelou o share
      }
    } else {
      const url = URL.createObjectURL(arquivo);
      const a = document.createElement('a');
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
    }
    await repo.salvarConfig({ ultimoBackupEm: new Date().toISOString(), mudancasDesdeBackup: false });
    await recarregar();
    setMsg('Backup exportado.');
  }

  async function restaurar(file: File) {
    const aviso = modo === 'substituir'
      ? 'Substituir TODOS os dados pelo backup?'
      : 'Mesclar o backup com os dados atuais?';
    if (!window.confirm(aviso)) return;
    try {
      const backup = validarBackup(JSON.parse(await file.text()));
      const finais = modo === 'substituir'
        ? backup.dados
        : mesclar(await repo.carregarTudo(), backup.dados);
      await repo.substituirTudo(finais);
      await recarregar();
      setMsg('Backup restaurado.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao ler o backup.');
    }
  }

  return (
    <div className="tela">
      <h2>Backup</h2>
      <p className="sub">
        Último backup: {dados.config.ultimoBackupEm ? new Date(dados.config.ultimoBackupEm).toLocaleString('pt-BR') : 'nunca'}
        {dados.config.mudancasDesdeBackup && ' · há mudanças não salvas em backup'}
      </p>
      <button className="botao botao-primario" onClick={exportar}>Exportar backup (.json)</button>
      <h2>Restaurar</h2>
      <div className="linha" role="radiogroup" aria-label="Modo de restauração">
        <label className="linha"><input type="radio" checked={modo === 'substituir'} onChange={() => setModo('substituir')} /> substituir tudo</label>
        <label className="linha"><input type="radio" checked={modo === 'mesclar'} onChange={() => setModo('mesclar')} /> mesclar</label>
      </div>
      <input
        ref={inputRef} type="file" accept="application/json,.json" aria-label="Arquivo de backup"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void restaurar(f); e.target.value = ''; }}
      />
      {msg && <p className="aviso">{msg}</p>}
    </div>
  );
}
