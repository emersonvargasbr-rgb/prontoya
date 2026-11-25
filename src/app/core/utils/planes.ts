import { Rol } from './gamificacion';

/**
 * Catálogo de planes SEPARADO por tipo de cuenta.
 * Enfocado en planes trimestrales (3 meses) y anuales (12 meses) con precios accesibles.
 *
 * AUTORIDAD: los precios y los límites reales viven en la tabla `planes` y se hacen cumplir en backend.
 */
export type PlanId = 'basico' | 'pro' | 'gold' | 'operario_pro';
export type Ciclo = 'mensual' | 'trimestral' | 'anual';
export type Grupo = 'empresa' | 'operario';

export interface Beneficio {
  txt: string;
  /** true = todavía no está construido en la app; se muestra como "Próximamente". */
  proximamente?: boolean;
}

export interface Limites {
  max_operarios?: number | null;
  anuncios_activos_max?: number | null;
  anuncios_vip_mes?: number | null;
  erp_completo?: boolean;
  reportes?: boolean;
  registro_manual?: boolean;
  cosmeticos?: 'basico' | 'pro' | 'gold';
}

export interface Plan {
  id: PlanId;
  nombre: string;
  grupo: Grupo;
  /** en centavos de real */
  mensual: number;
  trimestral: number;
  anual: number;
  popular?: boolean;
  resumen: string;
  limites: Limites;
  beneficios: Beneficio[];
  apariencia: string[];
}

export interface FuentePlanPerfil {
  plan?: string | null;
  plan_vigente_hasta?: string | null;
}

export interface FuenteSuscripcion {
  plan_id?: string | null;
  estado?: string | null;
  expira_el?: string | null;
  created_at?: string | null;
}

export const DESCUENTO_CICLO: Record<Ciclo, number> = {
  mensual: 0,
  trimestral: 0.11,
  anual: 0.22,
};

export const MESES_CICLO: Record<Ciclo, number> = {
  mensual: 1,
  trimestral: 3,
  anual: 12,
};

export const ETIQUETA_CICLO: Record<Ciclo, string> = {
  mensual: 'Mensual',
  trimestral: 'Trimestral (3 meses)',
  anual: 'Anual (12 meses)',
};

/** Limita los decimales a un rango seguro de 2 a 3 lugares después del punto. */
export const redondearDecimales = (valor: number, decimales: number = 2): number => {
  const digitos = Math.min(3, Math.max(2, Math.trunc(decimales)));
  const factor = Math.pow(10, digitos);
  return Number((Math.round((Number(valor) || 0) * factor) / factor).toFixed(digitos));
};

/** Formatea un número o porcentaje con 2 o 3 decimales limpios. */
export const formatoNumeroCorto = (valor: number, decimales: number = 2): string => {
  const digitos = Math.min(3, Math.max(2, Math.trunc(decimales)));
  const limpio = redondearDecimales(valor, digitos);
  return limpio.toLocaleString('pt-BR', {
    minimumFractionDigits: digitos,
    maximumFractionDigits: digitos,
  });
};

export const calcularPrecioCiclo = (mensualCentavos: number, ciclo: Ciclo): number => {
  const meses = MESES_CICLO[ciclo] ?? 1;
  const desc = DESCUENTO_CICLO[ciclo] ?? 0;
  return Math.round(mensualCentavos * meses * (1 - desc));
};

export const PLANES: Plan[] = [
  {
    id: 'basico',
    nombre: 'Básico',
    grupo: 'empresa',
    mensual: 1490,
    trimestral: 3990,
    anual: 13990,
    resumen: 'Ideal para empezar por 3 o 12 meses con costo accesible para tu oficina o tienda.',
    limites: {
      max_operarios: 3,
      anuncios_activos_max: 8,
      anuncios_vip_mes: 2,
      erp_completo: false,
      reportes: false,
      registro_manual: false,
      cosmeticos: 'basico',
    },
    beneficios: [
      { txt: 'Perfil verificado para tu oficina o tienda' },
      { txt: 'Hasta 8 anuncios activos simultáneos' },
      { txt: '2 anuncios destacados al mes' },
      { txt: 'Hasta 3 operarios en tu equipo' },
    ],
    apariencia: ['Fondo de color sólido para tu portada'],
  },
  {
    id: 'pro',
    nombre: 'Taller Pro',
    grupo: 'empresa',
    mensual: 2990,
    trimestral: 7990,
    anual: 27990,
    popular: true,
    resumen: 'Para talleres y tiendas con movimiento continuo en planes de 3 o 12 meses.',
    limites: {
      max_operarios: 12,
      anuncios_activos_max: null,
      anuncios_vip_mes: 8,
      erp_completo: true,
      reportes: true,
      registro_manual: true,
      cosmeticos: 'pro',
    },
    beneficios: [
      { txt: 'Todo lo del plan Básico' },
      { txt: 'Anuncios activos en el feed' },
      { txt: '8 anuncios destacados al mes' },
      { txt: 'Hasta 12 operarios en tu equipo' },
      { txt: 'Control de cortes, piezas y liquidación' },
    ],
    apariencia: ['Patrones vectoriales para la portada', 'Iconos y avatares SVG'],
  },
  {
    id: 'gold',
    nombre: 'Élite / Gold',
    grupo: 'empresa',
    mensual: 4990,
    trimestral: 12990,
    anual: 44990,
    resumen: 'Mayor alcance y prioridad por trimestre o año a medida que sumamos funciones.',
    limites: {
      max_operarios: null,
      anuncios_activos_max: null,
      anuncios_vip_mes: null,
      erp_completo: true,
      reportes: true,
      registro_manual: true,
      cosmeticos: 'gold',
    },
    beneficios: [
      { txt: 'Todo lo del Taller Pro' },
      { txt: 'Sin límite de operarios ni anuncios activos' },
      { txt: 'Destacados prioritarios' },
      { txt: 'Nuevas herramientas a medida que se habiliten', proximamente: true },
    ],
    apariencia: ['Colección Gold: avatares destacados', 'Marco especial', 'Patrones de portada'],
  },
  {
    id: 'operario_pro',
    nombre: 'Operario Pro',
    grupo: 'operario',
    mensual: 790,
    trimestral: 1990,
    anual: 6990,
    popular: true,
    resumen: 'Planes trimestrales y anuales económicos para operarios que recién empiezan.',
    limites: {
      max_operarios: 0,
      anuncios_activos_max: 6,
      anuncios_vip_mes: 0,
      erp_completo: false,
      reportes: true,
      registro_manual: true,
      cosmeticos: 'pro',
    },
    beneficios: [
      { txt: 'Perfil verificado ante oficinas y tiendas' },
      { txt: 'Hasta 6 anuncios activos de disponibilidad' },
      { txt: 'Registro de cortes manuales y trabajos por tu cuenta' },
      { txt: 'Historial simple de tus pagos y vales' },
    ],
    apariencia: ['Iconos SVG y colores personalizados'],
  },
];

/** Lo que incluye el plan gratis de cada tipo de cuenta (máx. 3 anuncios activos, sin VIP). */
export const INCLUYE_GRATIS: Record<Grupo, string[]> = {
  empresa: ['Hasta 3 anuncios activos', '1 operario en tu equipo', 'Fondo de color básico para tu portada'],
  operario: ['Hasta 3 anuncios activos', 'Postularte y recibir trabajos asignados', 'Historial básico de tus trabajos'],
};

/** Colores del sello por plan (clases completas para Tailwind). */
export const PLAN_ESTILO: Record<PlanId, { texto: string; fondo: string }> = {
  basico:       { texto: 'text-sky-600',    fondo: 'bg-sky-50 text-sky-800' },
  pro:          { texto: 'text-teal-600',   fondo: 'bg-teal-50 text-teal-800' },
  gold:         { texto: 'text-amber-500',  fondo: 'bg-amber-50 text-amber-800' },
  operario_pro: { texto: 'text-teal-600',   fondo: 'bg-teal-50 text-teal-800' },
};

export const grupoDeRol = (rol: string): Grupo => (rol === 'funcionario' ? 'operario' : 'empresa');

/** Cada tipo de cuenta ve sólo sus planes. */
export const planesPara = (rol: string): Plan[] => PLANES.filter(p => p.grupo === grupoDeRol(rol));

export const precio = (p: Plan, ciclo: Ciclo): number => {
  if (ciclo === 'trimestral') return p.trimestral;
  if (ciclo === 'anual') return p.anual;
  return p.mensual;
};

/** "R$ 14,90" (soporta 2 o 3 decimales si se indican) */
export const formatoPrecio = (centavos: number, decimales: number = 2): string => {
  const digitos = Math.min(3, Math.max(2, Math.trunc(decimales)));
  const valorReales = redondearDecimales((Number(centavos) || 0) / 100, digitos);
  return (
    'R$ ' +
    valorReales.toLocaleString('pt-BR', {
      minimumFractionDigits: digitos,
      maximumFractionDigits: digitos,
    })
  );
};

/** Cuánto se ahorra pagando el ciclo frente a meses sueltos. */
export const ahorroCiclo = (p: Plan, ciclo: Ciclo): number => {
  const sinDescuento = p.mensual * (MESES_CICLO[ciclo] ?? 1);
  return Math.max(0, sinDescuento - precio(p, ciclo));
};

export const ahorroAnual = (p: Plan): number => ahorroCiclo(p, 'anual');

/** ¿El plan sigue vigente hoy? */
export const planVigente = (plan?: string | null, hasta?: string | null): PlanId | null => {
  if (!plan) return null;
  const normalizado = plan.toLowerCase().trim();
  if (['free', 'gratis'].includes(normalizado)) return null;
  if (hasta && new Date(hasta).getTime() <= Date.now()) return null;
  const match = PLANES.find(p => p.id === normalizado);
  return match ? match.id : null;
};

/** Resuelve el plan vigente combinando suscripción activa y perfil. */
export const resolverEstadoPlan = (
  perfil: FuentePlanPerfil | null | undefined,
  suscripciones: FuenteSuscripcion[] = []
): { planId: PlanId | null; vigenteHasta: string | null } => {
  const ahora = Date.now();

  const subActiva = [...suscripciones]
    .filter(s => (s.estado ?? '').toLowerCase().trim() === 'activa')
    .filter(s => !s.expira_el || new Date(s.expira_el).getTime() > ahora)
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0];

  if (subActiva?.plan_id) {
    const idSub = planVigente(subActiva.plan_id, subActiva.expira_el);
    if (idSub) {
      return {
        planId: idSub,
        vigenteHasta: subActiva.expira_el ?? perfil?.plan_vigente_hasta ?? null,
      };
    }
  }

  const idPerfil = planVigente(perfil?.plan, perfil?.plan_vigente_hasta);
  if (idPerfil) {
    return {
      planId: idPerfil,
      vigenteHasta: perfil?.plan_vigente_hasta ?? null,
    };
  }

  return {
    planId: null,
    vigenteHasta: perfil?.plan_vigente_hasta ?? null,
  };
};

export const nombreDePlan = (id: string | null | undefined): string => {
  if (!id) return 'Gratis';
  const normalizado = id.toLowerCase().trim();
  if (['free', 'gratis'].includes(normalizado)) return 'Gratis';
  return PLANES.find(p => p.id === normalizado)?.nombre ?? id.toUpperCase();
};

export const esPlanPagoId = (id: string | null | undefined): boolean => {
  if (!id) return false;
  const normalizado = id.toLowerCase().trim();
  return !['', 'free', 'gratis'].includes(normalizado);
};

/** Rango del cosmético que cada plan desbloquea: 1 gratis/básico, 2 pro, 3 gold. */
export const rangoCosmeticos = (l: Limites | null | undefined): number =>
  l?.cosmeticos === 'gold' ? 3 : l?.cosmeticos === 'pro' ? 2 : 1;