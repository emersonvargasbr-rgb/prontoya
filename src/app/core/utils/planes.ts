import { Rol } from './gamificacion';

/**
 * Catálogo de planes, SEPARADO por tipo de cuenta.
 *
 *   empresa  (tienda y oficina):  Verificado Básico · Taller Pro (el más popular) · Élite / Gold
 *   operario (funcionario):       Operario Pro      (el plan base es gratis)
 *
 * AUTORIDAD: los precios y los límites reales viven en la tabla `planes` (migración 009) y se
 * hacen cumplir con triggers. Esto es sólo la parte visible: debe coincidir con esa tabla.
 */
export type PlanId = 'basico' | 'pro' | 'gold' | 'operario_pro';
export type Ciclo = 'mensual' | 'anual';
export type Grupo = 'empresa' | 'operario';

export interface Beneficio {
  txt: string;
  /** true = todavía no está construido en la app; se muestra como "Próximamente". */
  proximamente?: boolean;
}

export interface Plan {
  id: PlanId;
  nombre: string;
  grupo: Grupo;
  /** en centavos de real */
  mensual: number;
  anual: number;
  popular?: boolean;
  resumen: string;
  beneficios: Beneficio[];
  apariencia: string[];
}

/** Anual = 10 meses (dos de regalo). Propuesta: cámbiala aquí y en la tabla `planes`. */
const anual = (mensual: number) => mensual * 10;

export const PLANES: Plan[] = [
  {
    id: 'basico', nombre: 'Verificado Básico', grupo: 'empresa', mensual: 3990, anual: anual(3990),
    resumen: 'Identidad verificada y visibilidad para tu negocio.',
    beneficios: [
      { txt: 'Insignia de identidad verificada' },
      { txt: 'Publicaciones ilimitadas en el feed' },
      { txt: '3 anuncios VIP destacados al mes' },
      { txt: 'Gestión de hasta 3 operarios' },
    ],
    apariencia: ['Colores sólidos para tu portada'],
  },
  {
    id: 'pro', nombre: 'Taller Pro', grupo: 'empresa', mensual: 7990, anual: anual(7990), popular: true,
    resumen: 'Gestión completa de producción para talleres y tiendas.',
    beneficios: [
      { txt: 'Todo lo del Verificado Básico' },
      { txt: '15 anuncios VIP al mes' },
      { txt: 'Gestión de hasta 15 operarios' },
      { txt: 'Lotes directos en producción' },
      { txt: 'Sub-cortes por máquina (Overlock, Galoneira, Recta, Botonera)' },
      { txt: 'Control de piezas defectuosas y descuentos' },
      { txt: 'Caja, vales y adelantos', proximamente: true },
      { txt: 'Carrito de liquidación rápida', proximamente: true },
    ],
    apariencia: ['Patrones vectoriales para la portada', 'Iconos y avatares SVG'],
  },
  {
    id: 'gold', nombre: 'Élite / Gold', grupo: 'empresa', mensual: 19990, anual: anual(19990),
    resumen: 'Todo ilimitado y máxima visibilidad.',
    beneficios: [
      { txt: 'Todo lo del Taller Pro' },
      { txt: 'Operarios ilimitados' },
      { txt: 'Anuncios VIP ilimitados' },
      { txt: 'Soporte prioritario' },
      { txt: 'Reportes avanzados', proximamente: true },
    ],
    apariencia: ['Colección exclusiva Gold: avatares legendarios', 'Marco dorado animado', 'Patrones de portada de alta gama'],
  },
  {
    id: 'operario_pro', nombre: 'Operario Pro', grupo: 'operario', mensual: 1490, anual: anual(1490),
    resumen: 'Verificado y con control de tus propios ingresos.',
    beneficios: [
      { txt: 'Insignia de identidad verificada ante los talleres' },
      { txt: 'Registro de cortes manuales: trabajos particulares que consigas por tu cuenta' },
      { txt: 'Desglose de tus operaciones por máquina' },
      { txt: 'Historial financiero mensual con control de pagos' },
    ],
    apariencia: ['Iconos SVG y patrones de portada personalizados'],
  },
];

/** Lo que incluye el plan gratis de cada tipo de cuenta (para mostrarlo como "tu plan actual"). */
export const INCLUYE_GRATIS: Record<Grupo, string[]> = {
  empresa: ['Hasta 3 anuncios activos', '1 operario en tu equipo', 'Colores sólidos para tu portada'],
  operario: ['Buscar empleos y lotes en el feed', 'Postularte y aceptar trabajos asignados', 'Historial automático de tus cortes liquidados', 'Avatares básicos y colores planos'],
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

export const precio = (p: Plan, ciclo: Ciclo): number => (ciclo === 'mensual' ? p.mensual : p.anual);

/** "R$ 39,90" */
export const formatoPrecio = (centavos: number): string =>
  'R$ ' + (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Cuánto se ahorra pagando el año completo frente a 12 meses sueltos. */
export const ahorroAnual = (p: Plan): number => Math.max(0, p.mensual * 12 - p.anual);

/** ¿El plan sigue vigente hoy? */
export const planVigente = (plan?: string | null, hasta?: string | null): PlanId | null =>
  plan && hasta && new Date(hasta).getTime() > Date.now() ? (plan as PlanId) : null;

export const nombreDePlan = (id: string | null | undefined): string =>
  PLANES.find(p => p.id === id)?.nombre ?? 'Gratis';

// ------------------------------------------------------------------ límites
/** Permisos efectivos de un perfil (los entrega la función limites_de() de la base de datos). null = ilimitado. */
export interface Limites {
  max_operarios?: number | null;
  anuncios_activos_max?: number | null;
  anuncios_vip_mes?: number | null;
  erp_completo?: boolean;
  reportes?: boolean;
  registro_manual?: boolean;
  cosmeticos?: 'basico' | 'pro' | 'gold';
}

/** Rango del cosmético que cada plan desbloquea: 1 gratis/básico, 2 pro, 3 gold. */
export const rangoCosmeticos = (l: Limites | null | undefined): number =>
  l?.cosmeticos === 'gold' ? 3 : l?.cosmeticos === 'pro' ? 2 : 1;
