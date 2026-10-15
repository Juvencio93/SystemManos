import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RbInventoryView } from '../../src/components/app/rb-inventory-view';
import type { InventoryData } from '../../src/lib/rb-inventory';
import '../../src/styles.css';

async function api(path:string,body?:unknown) {
  const r=await fetch('/local-api/'+path, body===undefined ? {} : {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json(); if(!r.ok)throw Error(data.error);return data;
}
function App() {
  const [data,setData]=useState<InventoryData>();const [error,setError]=useState('');
  const refresh=async()=>setData(await api('inventory'));
  useEffect(()=>{void refresh().catch(e=>setError(e.message));const t=setInterval(()=>void refresh().catch(e=>setError(e.message)),5000);return()=>clearInterval(t);},[]);
  async function simulate(step:string) {try {setError('');await api('simulate',{step});await refresh();}catch(e){setError((e as Error).message);}}
  return <><header className="border-b px-8 py-5 font-bold">Manos Tech <span className="ml-3 text-xs font-normal text-cyan-300">PRÉVIA LOCAL</span></header>
    <main className="mx-auto max-w-5xl space-y-6 p-6"><div><h1 className="text-3xl font-bold">Hotspot</h1><p className="mt-2 text-muted-foreground">Estoque e transferência de equipamentos</p></div>
    <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm"><strong>Ambiente de teste isolado</strong><p>Esta tela usa o componente real e a migração em PostgreSQL local, com empresas fictícias. Os botões abaixo simulam a comunicação da RB e o check-in RADIUS. Nenhum equipamento ou dado de produção é alterado.</p></div>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    <RbInventoryView data={data} refresh={refresh} action={async a=>{await api('action',a);await refresh();}} download={async()=>{throw Error('A prévia não emite credenciais reais. Os downloads estarão disponíveis na instalação integrada.');}} />
    <section className="rounded-xl border p-4"><h2 className="font-bold">Simulador da RB 001 — somente nesta prévia</h2><div className="mt-3 flex flex-wrap gap-3">
      <button className="rounded-lg border px-4 py-2" onClick={()=>void simulate('ack')}>Simular confirmação da RB</button>
      <button className="rounded-lg border px-4 py-2" onClick={()=>void simulate('radius')}>Simular check-in RADIUS</button>
      <button className="rounded-lg border px-4 py-2" onClick={()=>void simulate('offline')}>Simular RB offline</button>
      <button className="rounded-lg border px-4 py-2" onClick={()=>void simulate('online')}>Simular RB online</button>
    </div></section></main></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
