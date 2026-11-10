/**
 * Motor de gamificación de CosturaPronta.
 *
 * Es una función PURA del registro de `perfiles` (las métricas las mantienen
 * triggers en la base de datos, ver 003_gamificacion_perfiles.sql). Por eso
 * funciona igual para el propio usuario y para cualquiera que vea su perfil,
 * y no hace falta ninguna consulta extra.
 *
 * Para agregar una insignia nueva: añade una entrada a LOGROS. Nada más.
 * Para agregar un nivel: añade un valor a NIVEL_UMBRAL, NIVEL_ESTILO y NIVEL_NOMBRE.
 */

export type Rol = 'tienda' | 'oficina' | 'funcionario';
export type Categoria = 'confianza' | 'produccion' | 'comunidad' | 'perfil';

export const CATEGORIAS: { id: Categoria; txt: string; icono: string }[] = [
  { id: 'confianza',  txt: 'Confianza',  icono: 'verified' },
  { id: 'produccion', txt: 'Producción', icono: 'layers' },
  { id: 'comunidad',  txt: 'Comunidad',  icono: 'users' },
  { id: 'perfil',     txt: 'Perfil',     icono: 'user' },
];

// ============================================================ COMPLETITUD
export interface Completitud { pct: number; faltan: { id: string; etq: string }[]; }

/** Sólo usa campos públicos, para dar el mismo resultado al verlo desde otra cuenta. */
export function completitud(p: any): Completitud {
  const rol = p?.rol as Rol;
  const checks: { id: string; etq: string; ok: boolean }[] = [
    { id: 'bio',   etq: 'Escribe tu descripción',  ok: !!p?.bio_taller?.trim() },
    { id: 'lema',  etq: 'Agrega un lema',          ok: !!p?.lema?.trim() },
    { id: 'esp',   etq: 'Elige tu especialidad',   ok: !!p?.especialidad_principal && p.especialidad_principal !== 'Taller de Costura General' },
    { id: 'zona',  etq: 'Indica tu zona',          ok: !!p?.zona_ubicacion },
  ];
  if (rol === 'oficina') {
    checks.push(
      { id: 'maq',  etq: 'Indica cuántas máquinas tienes',  ok: Number(p?.cantidad_maquinas) > 0 },
      { id: 'oper', etq: 'Indica cuántos operarios tienes', ok: Number(p?.cantidad_operarios) > 0 },
      { id: 'tipos', etq: 'Marca tus máquinas',             ok: (p?.maquinas_maneja ?? []).length > 0 },
    );
  } else if (rol === 'tienda') {
    checks.push({ id: 'tipo', etq: 'Indica si eres firma o feirinha', ok: !!p?.tipo_tienda });
  } else if (rol === 'funcionario') {
    checks.push(
      { id: 'tipos', etq: 'Marca las máquinas que manejas', ok: (p?.maquinas_maneja ?? []).length > 0 },
      { id: 'mod',   etq: 'Indica cómo trabajas',           ok: !!p?.modalidad_trabajo },
    );
  }
  const ok = checks.filter(c => c.ok).length;
  return { pct: Math.round((ok / checks.length) * 100), faltan: checks.filter(c => !c.ok).map(({ id, etq }) => ({ id, etq })) };
}

// ================================================================= LOGROS
interface LogroDef {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  categoria: Categoria;
  roles: Rol[];
  xp: number;
  meta: number;
  decimal?: boolean;
  valor: (p: any, c: Completitud) => number;
}

const TODOS: Rol[] = ['tienda', 'oficina', 'funcionario'];
const EMPLEADORES: Rol[] = ['tienda', 'oficina'];
const num = (v: any) => Number(v) || 0;
const dias = (p: any) => (p?.created_at ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000) : 0);

const LOGROS: LogroDef[] = [
  // ---- Confianza
  { id: 'verificado', nombre: 'Identidad verificada', icono: 'verified', categoria: 'confianza', roles: TODOS, xp: 300, meta: 1,
    descripcion: 'CosturaPronta confirmó tus datos.', valor: p => (p?.verificado ? 1 : 0) },
  { id: 'resenas_5', nombre: 'Con reputación', icono: 'star', categoria: 'confianza', roles: TODOS, xp: 100, meta: 5,
    descripcion: 'Recibe 5 reseñas.', valor: p => num(p?.total_evaluaciones) },
  { id: 'resenas_25', nombre: 'Referente de la zona', icono: 'star', categoria: 'confianza', roles: TODOS, xp: 300, meta: 25,
    descripcion: 'Recibe 25 reseñas.', valor: p => num(p?.total_evaluaciones) },
  { id: 'cinco_estrellas', nombre: 'Calidad cinco estrellas', icono: 'star', categoria: 'confianza', roles: TODOS, xp: 250, meta: 4.8, decimal: true,
    descripcion: 'Promedio de 4.8 o más con al menos 3 reseñas.',
    valor: p => (num(p?.total_evaluaciones) >= 3 ? num(p?.promedio_estrellas) : 0) },

  // ---- Producción
  { id: 'primer_trato', nombre: 'Primer trato', icono: 'check', categoria: 'produccion', roles: TODOS, xp: 100, meta: 1,
    descripcion: 'Cierra tu primer trabajo en la plataforma.', valor: p => num(p?.operaciones_cerradas) },
  { id: 'diez_tratos', nombre: 'Productor constante', icono: 'layers', categoria: 'produccion', roles: TODOS, xp: 300, meta: 10,
    descripcion: 'Cierra 10 trabajos.', valor: p => num(p?.operaciones_cerradas) },
  { id: 'cincuenta_tratos', nombre: 'Motor del polo textil', icono: 'flag', categoria: 'produccion', roles: TODOS, xp: 800, meta: 50,
    descripcion: 'Cierra 50 trabajos.', valor: p => num(p?.operaciones_cerradas) },
  { id: 'piezas_mil', nombre: 'Mil piezas', icono: 'scissors', categoria: 'produccion', roles: TODOS, xp: 150, meta: 1000,
    descripcion: 'Acumula 1.000 piezas producidas.', valor: p => num(p?.piezas_totales) },
  { id: 'piezas_diez_mil', nombre: 'Diez mil piezas', icono: 'scissors', categoria: 'produccion', roles: TODOS, xp: 500, meta: 10000,
    descripcion: 'Acumula 10.000 piezas producidas.', valor: p => num(p?.piezas_totales) },
  { id: 'cero_defectos', nombre: 'Cero defectos', icono: 'check', categoria: 'produccion', roles: ['funcionario'], xp: 250, meta: 5,
    descripcion: 'Liquida 5 cortes sin piezas defectuosas.', valor: p => num(p?.operaciones_sin_defectos) },
  { id: 'multi_maquina', nombre: 'Multi-máquina', icono: 'cog', categoria: 'produccion', roles: ['funcionario', 'oficina'], xp: 120, meta: 3,
    descripcion: 'Declara 3 o más máquinas.', valor: p => (p?.maquinas_maneja ?? []).length },
  { id: 'primer_operario', nombre: 'Primer operario', icono: 'users', categoria: 'produccion', roles: EMPLEADORES, xp: 150, meta: 1,
    descripcion: 'Suma a tu primer operario al equipo.', valor: p => num(p?.equipo_count) },
  { id: 'equipo_5', nombre: 'Equipo consolidado', icono: 'users', categoria: 'produccion', roles: EMPLEADORES, xp: 400, meta: 5,
    descripcion: 'Ten 5 operarios activos.', valor: p => num(p?.equipo_count) },
  { id: 'en_equipo', nombre: 'En equipo', icono: 'users', categoria: 'produccion', roles: ['funcionario'], xp: 150, meta: 1,
    descripcion: 'Forma parte del equipo de un taller o tienda.', valor: p => num(p?.equipo_count) },

  // ---- Comunidad
  { id: 'seguidores_10', nombre: 'Se corre la voz', icono: 'users', categoria: 'comunidad', roles: TODOS, xp: 100, meta: 10,
    descripcion: 'Llega a 10 seguidores.', valor: p => num(p?.seguidores_count) },
  { id: 'seguidores_100', nombre: 'Perfil influyente', icono: 'users', categoria: 'comunidad', roles: TODOS, xp: 400, meta: 100,
    descripcion: 'Llega a 100 seguidores.', valor: p => num(p?.seguidores_count) },
  { id: 'conexiones_5', nombre: 'Bien conectado', icono: 'user-plus', categoria: 'comunidad', roles: TODOS, xp: 100, meta: 5,
    descripcion: 'Consigue 5 conexiones.', valor: p => num(p?.conexiones_count) },
  { id: 'conexiones_25', nombre: 'Red sólida', icono: 'user-plus', categoria: 'comunidad', roles: TODOS, xp: 300, meta: 25,
    descripcion: 'Consigue 25 conexiones.', valor: p => num(p?.conexiones_count) },

  // ---- Perfil
  { id: 'perfil_completo', nombre: 'Perfil completo', icono: 'user', categoria: 'perfil', roles: TODOS, xp: 200, meta: 100,
    descripcion: 'Completa todos los datos de tu perfil.', valor: (_p, c) => c.pct },
  { id: 'veterano', nombre: 'Veterano', icono: 'clock', categoria: 'perfil', roles: TODOS, xp: 150, meta: 180,
    descripcion: 'Seis meses en la plataforma.', valor: p => dias(p) },
];

// ================================================================= NIVELES
export const NIVEL_UMBRAL = [0, 150, 400, 900, 1800, 3500];

export const NIVEL_NOMBRE: Record<Rol, string[]> = {
  tienda:      ['Marca nueva', 'Marca activa', 'Marca confiable', 'Marca destacada', 'Marca referente', 'Marca élite'],
  oficina:     ['Taller nuevo', 'Taller activo', 'Taller confiable', 'Taller destacado', 'Taller referente', 'Taller élite'],
  funcionario: ['Aprendiz', 'Operario', 'Oficial', 'Especialista', 'Maestro', 'Gran maestro'],
};

/** Clases literales (Tailwind necesita verlas completas). */
export const NIVEL_ESTILO = [
  { badge: 'bg-stone-200 text-stone-700',   anillo: 'ring-stone-300' },
  { badge: 'bg-amber-100 text-amber-800',   anillo: 'ring-amber-500' },
  { badge: 'bg-slate-200 text-slate-700',   anillo: 'ring-slate-400' },
  { badge: 'bg-yellow-100 text-yellow-800', anillo: 'ring-yellow-500' },
  { badge: 'bg-sky-100 text-sky-800',       anillo: 'ring-sky-500' },
  { badge: 'bg-violet-100 text-violet-800', anillo: 'ring-violet-600' },
];

export interface LogroEstado {
  id: string; nombre: string; descripcion: string; icono: string; categoria: Categoria;
  xp: number; meta: number; valor: number; progreso: number; desbloqueada: boolean; texto: string;
}

export interface Gamificacion {
  xp: number;
  nivel: number;          // 1..6
  nivelMax: boolean;
  nombre: string;         // título del nivel según el rol
  siguiente: string | null;
  faltan: number;
  pct: number;
  claseNivel: string;
  claseAnillo: string;
  logros: LogroEstado[];
  desbloqueados: number;
  proximos: LogroEstado[];  // los 3 logros bloqueados más cercanos
  completitud: Completitud;
}

export function calcularGamificacion(p: any): Gamificacion {
  const rol: Rol = (p?.rol as Rol) in NIVEL_NOMBRE ? p.rol : 'funcionario';
  const comp = completitud(p);

  const logros: LogroEstado[] = LOGROS.filter(l => l.roles.includes(rol)).map(l => {
    const valor = num(l.valor(p, comp));
    const desbloqueada = valor >= l.meta;
    const fmt = (n: number) => (l.decimal ? n.toFixed(1) : Math.floor(n).toLocaleString('pt-BR'));
    return {
      id: l.id, nombre: l.nombre, descripcion: l.descripcion, icono: l.icono, categoria: l.categoria,
      xp: l.xp, meta: l.meta, valor, desbloqueada,
      progreso: Math.min(1, valor / l.meta),
      texto: `${fmt(Math.min(valor, l.meta))} / ${fmt(l.meta)}`,
    };
  });

  const xpLogros = logros.filter(l => l.desbloqueada).reduce((t, l) => t + l.xp, 0);
  const xpActividad =
    num(p?.operaciones_cerradas) * 25 +
    num(p?.total_evaluaciones) * 15 +
    Math.floor(num(p?.piezas_totales) / 100) +
    num(p?.seguidores_count) * 2 +
    num(p?.conexiones_count) * 3 +
    comp.pct;
  const xp = Math.round(xpLogros + xpActividad);

  let idx = NIVEL_UMBRAL.length - 1;
  for (let i = 0; i < NIVEL_UMBRAL.length; i++) {
    if (xp < (NIVEL_UMBRAL[i + 1] ?? Infinity)) { idx = i; break; }
  }
  const sig = NIVEL_UMBRAL[idx + 1];
  const nivelMax = sig === undefined;

  return {
    xp,
    nivel: idx + 1,
    nivelMax,
    nombre: NIVEL_NOMBRE[rol][idx],
    siguiente: nivelMax ? null : NIVEL_NOMBRE[rol][idx + 1],
    faltan: nivelMax ? 0 : sig - xp,
    pct: nivelMax ? 100 : Math.min(100, Math.floor(((xp - NIVEL_UMBRAL[idx]) / (sig - NIVEL_UMBRAL[idx])) * 100)),
    claseNivel: NIVEL_ESTILO[idx].badge,
    claseAnillo: NIVEL_ESTILO[idx].anillo,
    logros,
    desbloqueados: logros.filter(l => l.desbloqueada).length,
    proximos: logros.filter(l => !l.desbloqueada).sort((a, b) => b.progreso - a.progreso).slice(0, 3),
    completitud: comp,
  };
}

// ============================================================== COSMÉTICOS
/** Lo que se desbloquea al subir de nivel: personalizar es la recompensa. */
export const COLORES_PORTADA = [
  { hex: '#134e4a', nombre: 'Verde hilo',  nivelMin: 1 },
  { hex: '#0f172a', nombre: 'Tinta',       nivelMin: 1 },
  { hex: '#1e3a8a', nombre: 'Azul real',   nivelMin: 1 },
  { hex: '#047857', nombre: 'Esmeralda',   nivelMin: 2 },
  { hex: '#c2410c', nombre: 'Terracota',   nivelMin: 2 },
  { hex: '#be123c', nombre: 'Bordó',       nivelMin: 2 },
  { hex: '#6d28d9', nombre: 'Púrpura',     nivelMin: 3 },
  { hex: '#3730a3', nombre: 'Índigo',      nivelMin: 3 },
  { hex: '#a16207', nombre: 'Oro viejo',   nivelMin: 4 },
  { hex: '#27272a', nombre: 'Grafito',     nivelMin: 4 },
];

export const PATRONES_PORTADA = [
  { id: 'liso',       nombre: 'Liso',       nivelMin: 1 },
  { id: 'diagonales', nombre: 'Diagonales', nivelMin: 2 },
  { id: 'puntos',     nombre: 'Puntos',     nivelMin: 3 },
  { id: 'costura',    nombre: 'Costura',    nivelMin: 4 },
];

export const AVATAR_ICONOS = [
  { id: 'user',      nombre: 'Persona',  nivelMin: 1 },
  { id: 'scissors',  nombre: 'Tijera',   nivelMin: 1 },
  { id: 'cog',       nombre: 'Máquina',  nivelMin: 1 },
  { id: 'bag',       nombre: 'Tienda',   nivelMin: 2 },
  { id: 'building',  nombre: 'Taller',   nivelMin: 2 },
  { id: 'layers',    nombre: 'Lotes',    nivelMin: 3 },
  { id: 'flag',      nombre: 'Bandera',  nivelMin: 3 },
  { id: 'star',      nombre: 'Estrella', nivelMin: 4 },
];

/** Estilo CSS de la portada (color + patrón), listo para [ngStyle]. */
export function estiloPortada(color?: string | null, patron?: string | null): Record<string, string> {
  const c = color || '#134e4a';
  switch (patron) {
    case 'diagonales':
      return { backgroundColor: c, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.10) 0 6px, transparent 6px 14px)' };
    case 'puntos':
      return { backgroundColor: c, backgroundImage: 'radial-gradient(rgba(255,255,255,.18) 1.5px, transparent 1.5px)', backgroundSize: '14px 14px' };
    case 'costura':
      return {
        backgroundColor: c,
        backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.4) 0 10px, transparent 10px 20px), repeating-linear-gradient(90deg, rgba(255,255,255,.4) 0 10px, transparent 10px 20px)',
        backgroundSize: '100% 2px, 100% 2px',
        backgroundPosition: '0 30%, 10px 70%',
        backgroundRepeat: 'no-repeat',
      };
    default:
      return { backgroundColor: c };
  }
}

// ===================================================== CATÁLOGOS DE FORMULARIO
export const ESPECIALIDADES: Record<Rol, string[]> = {
  oficina: ['Costura y Confeccion Completa', 'Oficina de Corte', 'Caseadeira y Botoneira', 'Estampado y Sublimacion', 'Acabados y Plancha', 'Empaque y Etiquetado'],
  tienda: ['Moda femenina', 'Moda masculina', 'Moda infantil', 'Jeans', 'Moda fitness', 'Ropa de cama y hogar', 'Uniformes', 'Moda íntima'],
  funcionario: ['Costurero(a) Overlock/Reta', 'Costurero(a) Galoneira', 'Casal de Costura', 'Planchador / Acabados', 'Empaque y Ventas', 'Modelista / Corte'],
};

/** Etiquetas rápidas al calificar, según el rol de quien recibe la reseña. */
export const ETIQUETAS_EVALUACION: Record<Rol, string[]> = {
  funcionario: ['Puntual', 'Calidad', 'Rápido', 'Responsable', 'Trabaja en equipo', 'Cero defectos'],
  oficina:     ['Cumple plazos', 'Buena calidad', 'Buena comunicación', 'Honesto', 'Organizado', 'Buen precio'],
  tienda:      ['Paga a tiempo', 'Buena comunicación', 'Lotes claros', 'Respeta acuerdos', 'Buen trato', 'Material en orden'],
};

export function cnpjValido(valor: string): boolean {
  const c = (valor ?? '').replace(/\D/g, '');
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const digito = (base: string, pesos: number[]) => {
    const r = base.split('').reduce((a, d, i) => a + Number(d) * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digito(c.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(c[12]) &&
         digito(c.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(c[13]);
}
