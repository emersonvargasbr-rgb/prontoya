/**
 * Utilidades y catálogos compartidos por todos los paneles.
 * Cambiar un color o un botón aquí lo cambia en toda la app.
 */

/** Supabase devuelve las relaciones a veces como objeto y a veces como array. */
export const uno = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

/** Abre WhatsApp con un mensaje. Devuelve false si no hay teléfono. Solo llamar desde el navegador (clic). */
export function abrirWhatsApp(telefono: string | null | undefined, nombre: string, concepto: string): boolean {
  if (!telefono) return false;
  let n = telefono.replace(/\D/g, '');
  if (n.length <= 11) n = '55' + n; // Brasil por defecto
  const msg = `Hola ${nombre}, te escribo desde CosturaPronta por: "${concepto}".`;
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  return true;
}

export const moneda = (n: number | string | null | undefined): string =>
  'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function claseEstado(estado: string): string {
  switch (estado) {
    case 'Pendiente':     return 'bg-amber-50 text-amber-800';
    case 'Asignado':      return 'bg-slate-100 text-slate-700';
    case 'En Confección':
    case 'Aceptado':
    case 'En Proceso':    return 'bg-sky-50 text-sky-700';
    case 'Terminado':     return 'bg-amber-50 text-amber-800';
    case 'Cerrado':       return 'bg-teal-50 text-teal-800';
    case 'Rechazado':     return 'bg-rose-50 text-rose-700';
    default:              return 'bg-slate-100 text-slate-700';
  }
}

export const ZONAS = ['Brás', 'Bom Retiro', 'Pari', 'Guarulhos', 'Zona Leste', 'Zona Norte', 'Zona Sul', 'Osasco'];

export const MAQUINAS = [
  { id: 'RETA', nombre: 'Reta (Recta)' },
  { id: 'OVERLOCK', nombre: 'Overlock' },
  { id: 'GALONEIRA', nombre: 'Galoneira' },
  { id: 'BOTONEIRA', nombre: 'Botoneira' },
  { id: 'CASEADEIRA', nombre: 'Caseadeira' },
  { id: 'TRAVETE', nombre: 'Travete' },
];

export const OPERACIONES = ['Overlock', 'Reta', 'Galoneira', 'Botoneira', 'Caseadeira', 'Travete', 'Plancha y acabados'];

export const ROL_ETIQUETA: Record<string, { txt: string; icono: string }> = {
  tienda:      { txt: 'Tienda',                icono: 'bag' },
  oficina:     { txt: 'Oficina de confección', icono: 'building' },
  funcionario: { txt: 'Operario',              icono: 'user' },
};

export const ROL_PANEL: Record<string, string> = {
  tienda: '/panel-tienda',
  oficina: '/panel-oficina',
  funcionario: '/panel-funcionario',
};

export const TIPO_PUBLICACION: Record<string, { txt: string; icono: string; clase: string }> = {
  busco_oficina:     { txt: 'Lote de tienda',      icono: 'store',     clase: 'bg-sky-50 text-sky-800' },
  busco_corte:       { txt: 'Taller disponible',    icono: 'scissors',  clase: 'bg-teal-50 text-teal-800' },
  busco_funcionario: { txt: 'Vacante',              icono: 'user',      clase: 'bg-amber-50 text-amber-800' },
  busco_trabajo:     { txt: 'Operario disponible',  icono: 'briefcase', clase: 'bg-violet-50 text-violet-800' },
};

/** Traduce errores técnicos de Supabase/PostgreSQL/red en mensajes claros para el usuario. */
export function mensajeAmigable(err: any, defecto = 'Ocurrió un error inesperado. Inténtalo de nuevo.'): string {
  const raw = String(err?.message ?? err?.details ?? err ?? '').toLowerCase();
  const code = String(err?.code ?? '');

  if (code === '23503' || raw.includes('foreign key') || raw.includes('violates foreign key')) {
    if (raw.includes('postulaciones') || raw.includes('lote') || raw.includes('publicacion')) {
      return 'Este anuncio ya tiene postulaciones o trabajos vinculados, por lo que no se puede eliminar. Si no quieres recibir más interesados, páusalo.';
    }
    return 'No se puede completar esta acción porque este registro ya está asociado a otro movimiento.';
  }

  if (code === '23505' || raw.includes('duplicate key') || raw.includes('unique')) {
    return 'Este registro ya existe o ya fue enviado anteriormente.';
  }

  if (code === '23514' || raw.includes('check constraint')) {
    return 'Uno de los valores ingresados no cumple las reglas permitidas.';
  }

  if (code === '42501' || raw.includes('permission denied') || raw.includes('row-level security')) {
    return 'No tienes permiso para realizar esta acción en este momento o alcanzaste el límite de tu plan.';
  }

  if (code === 'P0001' && err?.message) {
    return String(err.message);
  }

  if (raw.includes('failed to fetch') || raw.includes('network') || raw.includes('err_internet')) {
    return 'Parece que hay un problema de conexión. Revisa tu internet e inténtalo de nuevo.';
  }

  if (err?.message && !raw.includes('pgrst') && !raw.includes('column ') && !raw.includes('relation ')) {
    return String(err.message);
  }

  return defecto;
}

/** Clases Tailwind reutilizables (literales completos para que Tailwind las detecte). */
export const UI = {
  card: 'rounded-xl border border-stone-200 bg-white',
  vacio: 'rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center',
  etiqueta: 'block text-xs font-medium text-slate-700',
  input: 'mt-1 w-full rounded-md border border-stone-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20',
  inputGrande: 'mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20',
  btnPrimario: 'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50',
  btnOscuro: 'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50',
  btnSecundario: 'inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-50',
  btnPeligro: 'inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-600',
  chip: 'inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700',
};
