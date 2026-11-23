// Supabase Edge Function (Deno) - SOLO ADMINISTRADORES.
//
// Despliegue:
//   supabase functions deploy verificar-suscripcion
//   supabase secrets set BINANCE_API_KEY=xxxx BINANCE_API_SECRET=yyyy
//
// La clave de Binance debe ser de SOLO LECTURA (sin trading ni retiros), creada en la cuenta que
// recibe los pagos. Nunca la pongas en el código ni en el navegador.
//
// Qué hace: busca el código (referencia_pago) en el historial de Binance Pay de tu cuenta y compara
// existencia, moneda, monto y, si el usuario lo indicó, quién pagó. Guarda el resultado en
// suscripciones.verificacion. NO aprueba, salvo que config_cobro.auto_aprobar = true.
//
// Límites conocidos:
//  * Binance Pay History pesa 3000 por UID: no la llames en bucle (máx. unas pocas veces por minuto).
//  * Si api.binance.com responde 451, la IP de salida de la función está en un país restringido.
//  * La forma exacta de `payerInfo` no se verificó con una transacción real: pruébalo y ajusta pagadorCoincide().
//  * El historial cubre como máximo 90 días.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BINANCE = 'https://api.binance.com';
const MONEDAS = ['USDT', 'USDC'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function firmar(secreto: string, mensaje: string): Promise<string> {
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(mensaje));
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Historial de Binance Pay de la cuenta que cobra. null = no se pudo consultar. */
async function historialPay(desde: number, hasta: number): Promise<any[] | null> {
  const apiKey = Deno.env.get('BINANCE_API_KEY');
  const secreto = Deno.env.get('BINANCE_API_SECRET');
  if (!apiKey || !secreto) return null;
  try {
    const qs = new URLSearchParams({ startTime: String(desde), endTime: String(hasta), limit: '100', recvWindow: '10000', timestamp: String(Date.now()) });
    const firma = await firmar(secreto, qs.toString());
    const r = await fetch(`${BINANCE}/sapi/v1/pay/transactions?${qs}&signature=${firma}`, {
      headers: { 'X-MBX-APIKEY': apiKey }, signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { console.error('Binance respondió', r.status, await r.text()); return null; }
    const cuerpo = await r.json();
    return Array.isArray(cuerpo.data) ? cuerpo.data : [];
  } catch (e) { console.error(e); return null; }
}

/** true / false, o null si la transacción no trae datos del pagador. */
function pagadorCoincide(tx: any, declarado: string | null): boolean | null {
  if (!declarado) return null;
  const info = tx.payerInfo ?? {};
  const candidatos = [info.binanceId, info.accountId, info.email].filter(Boolean).map((v: unknown) => String(v).trim().toLowerCase());
  if (candidatos.length === 0) return null;
  return candidatos.includes(declarado.trim().toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const cliente = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await cliente.auth.getUser();
    if (!user) return json({ error: 'Debes iniciar sesión.' }, 401);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Sólo administradores
    const { data: esAdmin } = await admin.from('administradores').select('perfil_id').eq('perfil_id', user.id).maybeSingle();
    if (!esAdmin) return json({ error: 'No autorizado.' }, 403);

    const { suscripcion_id } = await req.json().catch(() => ({}));
    const { data: s } = await admin.from('suscripciones').select('*').eq('id', suscripcion_id).maybeSingle();
    if (!s) return json({ error: 'La suscripción no existe.' }, 404);
    if (!s.referencia_pago) return json({ error: 'La solicitud no trae código de transacción.' }, 422);

    const { data: config } = await admin.from('config_cobro').select('*').eq('id', true).single();
    const tolerancia = Number(config?.tolerancia ?? 0.01);

    // ---- consulta a Binance
    const ahora = Date.now();
    const desde = Math.max(new Date(s.created_at).getTime() - 10 * 60_000, ahora - 89 * 86_400_000);
    const historial = await historialPay(desde, ahora);

    let v: Record<string, unknown>;
    if (historial === null) {
      v = { estado: 'no_disponible', mensaje: 'No se pudo consultar Binance (sin claves, restricción de región o límite de uso). Revisa el pago a mano.' };
    } else {
      const tx = historial.find((t: any) => String(t.transactionId ?? '').toLowerCase() === String(s.referencia_pago).trim().toLowerCase());
      if (!tx) {
        v = { estado: 'no_encontrado', mensaje: 'Ese código no aparece en el historial de Binance Pay. Puede tardar unos minutos o ser incorrecto.' };
      } else {
        const monto = Number(tx.amount);
        const esperado = Number(s.monto_usdt);
        const monedaOk = MONEDAS.includes(String(tx.currency).toUpperCase());
        const montoOk = monto > 0 && monto >= esperado * (1 - tolerancia);
        const pagador = pagadorCoincide(tx, s.binance_pagador);
        const todoOk = monedaOk && montoOk && pagador !== false;
        v = {
          estado: todoOk ? 'coincide' : 'no_coincide',
          moneda_ok: monedaOk, monto_ok: montoOk, pagador_ok: pagador,
          monto_recibido: monto, moneda: tx.currency, monto_esperado: esperado,
          fecha_tx: tx.transactionTime ?? null,
          mensaje: todoOk
            ? (pagador === null ? 'Pago encontrado y monto correcto. No se pudo comprobar quién lo hizo.' : 'Pago encontrado: monto, moneda y pagador coinciden.')
            : [!monedaOk && 'La moneda no es USDT/USDC.', !montoOk && `El monto recibido (${monto}) es menor al esperado (${esperado}).`, pagador === false && 'El pagador no coincide con el Binance ID declarado.'].filter(Boolean).join(' '),
        };
      }
    }
    v.verificado_en = new Date().toISOString();
    await admin.from('suscripciones').update({ verificacion: v }).eq('id', s.id);

    // ---- aprobación automática (opcional, desactivada por defecto)
    let aprobada = false;
    if (config?.auto_aprobar && v.estado === 'coincide' && v.pagador_ok === true && s.estado === 'Pendiente') {
      const { error } = await admin.rpc('fn_aprobar_suscripcion', { sid: s.id, quien: user.id, nota: 'Aprobada automáticamente tras verificar el pago en Binance.' });
      if (error) console.error(error); else aprobada = true;
    }

    return json({ verificacion: v, aprobada });
  } catch (e) {
    console.error(e);
    return json({ error: 'Error inesperado. Intenta de nuevo.' }, 500);
  }
});
