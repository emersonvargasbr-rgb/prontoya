import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

import { MAQUINAS, ROL_ETIQUETA, ROL_PANEL, UI, ZONAS } from '../../../core/utils/helpers';
import {
  AVATARES_ILUSTRADOS,
  AVATAR_ICONOS,
  AVATAR_MARCOS,
  COLORES_PORTADA,
  ESPECIALIDADES,
  ItemCosmetico,
  NOMBRE_TIER,
  PATRONES_PORTADA,
  Rol,
  calcularGamificacion,
  completitud,
  cosmeticoDesbloqueado,
  estiloPortada,
} from '../../../core/utils/gamificacion';
import { IconComponent } from '../../../shared/components/icon.component';
import { AVATAR_PALETAS, AvatarComponent } from '../../../shared/components/avatar.component';
import { Aviso, ToastComponent } from '../../../shared/components/toast.component';
import { PlanService } from '../../../core/services/plan.service';

/** Lo que cada tipo de cuenta puede editar. Todo lo demás es del servidor. */
const CAMPOS_COMUNES = [
  'nombre_completo', 'lema', 'bio_taller', 'especialidad_principal', 'zona_ubicacion',
  'color_portada', 'color_texto_portada', 'patron_portada', 'avatar_icono', 'avatar_color', 'avatar_marco',
  'insignias_destacadas', 'maquinas_maneja', 'visibilidad_whatsapp', 'visibilidad_direccion', 'visibilidad_cnpj',
];
const CAMPOS_POR_ROL: Record<Rol, string[]> = {
  oficina:     ['cantidad_maquinas', 'cantidad_operarios', 'cep', 'cnpj'],
  tienda:      ['tipo_tienda', 'cep', 'cnpj'],
  funcionario: ['tiene_vehiculo', 'trabaja_en_casal', 'busca_alojamiento', 'alojamiento_propio', 'modalidad_trabajo'],
};

@Component({
  selector: 'app-editar-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, AvatarComponent, ToastComponent],
  templateUrl: './editar-perfil.component.html',
})
export class EditarPerfilComponent implements OnInit {
  readonly ui = UI;
  readonly zonas = ZONAS;
  readonly maquinas = MAQUINAS;
  readonly colores = COLORES_PORTADA;
  readonly patrones = PATRONES_PORTADA;
  readonly iconos: ItemCosmetico[] = AVATAR_ICONOS;
  readonly ilustraciones: ItemCosmetico[] = AVATARES_ILUSTRADOS;
  readonly marcos = AVATAR_MARCOS;
  readonly nombreTier = (n: number) => NOMBRE_TIER[n] ?? 'Pro';
  readonly paletas = AVATAR_PALETAS;
  readonly roles = ROL_ETIQUETA;
  readonly estiloPortada = estiloPortada;

  usuarioId = '';
  cargando = signal(true);
  guardando = signal(false);
  aviso = signal<Aviso | null>(null);
  private timerAviso: ReturnType<typeof setTimeout> | null = null;

  /** Lo que está guardado en la base de datos. */
  base = signal<any>(null);
  suscripcionActiva = signal<any>(null);
  /** Lo que se está editando. */
  form: any = {};
  private original = '';
  errores: Record<string, string> = {};

  docVerificado = computed(() => !!this.base()?.documento_verificado || !!this.base()?.verificado);
  docTipo = computed(() => (this.rol() === 'funcionario' ? 'CPF' : 'CNPJ'));
  rol = computed<Rol>(() => (this.base()?.rol ?? 'funcionario') as Rol);
  seguidoresActuales = computed(() => Number(this.base()?.seguidores_count) || 0);

  /** Rango efectivo del plan (1 = gratis/básico, 2 = pro, 3 = gold) sincronizando PlanService, perfil y suscripciones. */
  rangoCosmeticosEfectivo = computed<number>(() => {
    const desdeServicio = Number(this.plan.rangoCosmeticos()) || 1;
    const p = this.base();
    const sub = this.suscripcionActiva();

    const ahora = Date.now();
    const vigentePerfil = p?.plan_vigente_hasta && new Date(p.plan_vigente_hasta).getTime() > ahora;
    const vigenteSub =
      sub?.estado === 'Activa' &&
      (!sub?.expira_el || new Date(sub.expira_el).getTime() > ahora);

    const planId = vigenteSub ? sub.plan_id : vigentePerfil ? p.plan : null;

    let desdeDatos = 1;
    if (planId === 'gold') {
      desdeDatos = 3;
    } else if (planId === 'pro' || planId === 'operario_pro') {
      desdeDatos = 2;
    }

    return Math.max(desdeServicio, desdeDatos);
  });

  /** El nivel se calcula sobre lo guardado. */
  g = computed(() => (this.base() ? calcularGamificacion(this.base()) : null));
  nivel = computed(() => this.g()?.nivel ?? 1);
  ganadas = computed(() => (this.g()?.logros ?? []).filter(l => l.desbloqueada));

  especialidades = computed(() => {
    const lista = ESPECIALIDADES[this.rol()] ?? [];
    const actual = this.base()?.especialidad_principal;
    return actual && !lista.includes(actual) ? [actual, ...lista] : lista;
  });

  constructor(private supabaseService: SupabaseService, private router: Router, readonly plan: PlanService) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.usuarioId = user.id;
    await Promise.all([this.cargar(), this.cargarSuscripcion(), this.plan.cargar()]);
  }

  private async cargar() {
    const { data, error } = await this.db.from('perfiles').select('*').eq('id', this.usuarioId).single();
    if (error || !data) {
      this.notificar('No se pudo cargar tu perfil.', 'error');
      this.cargando.set(false);
      return;
    }
    this.base.set(data);
    this.form = this.extraer(data);
    this.original = JSON.stringify(this.form);
    this.cargando.set(false);
  }

  private async cargarSuscripcion() {
    const { data } = await this.db
      .from('suscripciones')
      .select('plan_id, estado, inicia_el, expira_el')
      .eq('perfil_id', this.usuarioId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    this.suscripcionActiva.set(data ?? null);
  }

  private extraer(src: any): any {
    const rol = (src.rol ?? 'funcionario') as Rol;
    const out: any = {};
    for (const k of [...CAMPOS_COMUNES, ...CAMPOS_POR_ROL[rol]]) out[k] = src[k] ?? null;
    out.lema = out.lema ?? '';
    out.bio_taller = out.bio_taller ?? '';
    out.color_portada = out.color_portada || '#134e4a';
    out.color_texto_portada = '#ffffff';
    out.patron_portada = out.patron_portada || 'liso';
    out.avatar_marco = out.avatar_marco || 'nivel';
    out.insignias_destacadas = [...(out.insignias_destacadas ?? [])];
    out.maquinas_maneja = [...(out.maquinas_maneja ?? [])];
    out.visibilidad_whatsapp = out.visibilidad_whatsapp || 'publico';
    out.visibilidad_direccion = out.visibilidad_direccion || 'conectados';
    out.visibilidad_cnpj = out.visibilidad_cnpj || 'conectados';
    if ('cantidad_maquinas' in out) out.cantidad_maquinas = Number(out.cantidad_maquinas) || 0;
    if ('cantidad_operarios' in out) out.cantidad_operarios = Number(out.cantidad_operarios) || 0;
    if ('cep' in out) out.cep = out.cep ?? '';
    if ('cnpj' in out) out.cnpj = out.cnpj ?? '';
    if ('modalidad_trabajo' in out) out.modalidad_trabajo = out.modalidad_trabajo || 'Individual';
    for (const k of ['tiene_vehiculo', 'trabaja_en_casal', 'busca_alojamiento', 'alojamiento_propio']) {
      if (k in out) out[k] = !!out[k];
    }
    return out;
  }

  get sucio(): boolean { return JSON.stringify(this.form) !== this.original; }

  private compCache: { key: string; val: ReturnType<typeof completitud> } = { key: '', val: { pct: 0, faltan: [] } };
  get comp() {
    const key = JSON.stringify(this.form);
    if (key !== this.compCache.key) {
      this.compCache = { key, val: completitud({ ...this.base(), ...this.form }) };
    }
    return this.compCache.val;
  }

  get esEmpresa(): boolean { return this.rol() === 'tienda' || this.rol() === 'oficina'; }
  get muestraMaquinas(): boolean { return this.rol() === 'oficina' || this.rol() === 'funcionario'; }

  bloqueado(nivelMin: number): boolean { return this.rangoCosmeticosEfectivo() < nivelMin; }

  iconoDesbloqueado(item: ItemCosmetico): boolean {
    return cosmeticoDesbloqueado(item, this.rangoCosmeticosEfectivo(), this.seguidoresActuales());
  }

  progresoSeguidores(meta: number): number {
    if (!meta || meta <= 0) return 100;
    return Math.min(100, Math.round((this.seguidoresActuales() / meta) * 100));
  }

  /** Explica qué necesita exactamente el usuario para desbloquear el avatar. */
  motivoBloqueo(item: ItemCosmetico): string {
    if (this.iconoDesbloqueado(item)) return '';

    const planActual = this.rangoCosmeticosEfectivo();
    const seguidores = this.seguidoresActuales();
    const faltaPlan = planActual < item.nivelMin;
    const metaSeg = item.seguidoresMin ?? 0;
    const faltaSeg = metaSeg > 0 && seguidores < metaSeg;
    const nombrePlanReq = NOMBRE_TIER[item.nivelMin] ?? 'Pro';
    const nombrePlanActual = NOMBRE_TIER[planActual] ?? 'Gratis';

    if (faltaPlan && faltaSeg) {
      const restan = Math.max(0, metaSeg - seguidores);
      return `Requiere plan ${nombrePlanReq} (actual: ${nombrePlanActual}) o ${metaSeg} seguidores (${seguidores}/${metaSeg}, te faltan ${restan}).`;
    }
    if (faltaPlan) {
      return `Requiere plan ${nombrePlanReq} (actual: ${nombrePlanActual}).`;
    }
    if (faltaSeg) {
      const restan = Math.max(0, metaSeg - seguidores);
      return `Te faltan ${restan} seguidores (${seguidores}/${metaSeg}) para desbloquearlo.`;
    }
    return item.pistaDidactica || `Disponible en plan ${nombrePlanReq}.`;
  }

  private avisarBloqueo(nivelMin: number, etiqueta = 'este estilo') {
    const req = NOMBRE_TIER[nivelMin] ?? 'Pro';
    const actual = NOMBRE_TIER[this.rangoCosmeticosEfectivo()] ?? 'Gratis';
    this.notificar(`"${etiqueta}" requiere plan ${req} (tu plan actual es ${actual}).`, 'error');
  }

  elegirColor(c: { hex: string; nombre?: string; nivelMin: number }) {
    if (this.bloqueado(c.nivelMin)) return this.avisarBloqueo(c.nivelMin, c.nombre ?? c.hex);
    this.form.color_portada = c.hex;
  }

  elegirPatron(p: { id: string; nombre?: string; nivelMin: number }) {
    if (this.bloqueado(p.nivelMin)) return this.avisarBloqueo(p.nivelMin, p.nombre ?? p.id);
    this.form.patron_portada = p.id;
  }

  elegirIcono(item: ItemCosmetico | null) {
    if (!item) {
      this.form.avatar_icono = null;
      return;
    }
    if (!this.iconoDesbloqueado(item)) {
      this.notificar(`No puedes usar "${item.nombre}": ${this.motivoBloqueo(item)}`, 'error');
      return;
    }
    this.form.avatar_icono = item.id;
  }

  elegirAvatarColor(id: string | null) { this.form.avatar_color = id; }

  elegirMarco(m: { id: string; nombre?: string; nivelMin: number }) {
    if (this.bloqueado(m.nivelMin)) return this.avisarBloqueo(m.nivelMin, m.nombre ?? m.id);
    this.form.avatar_marco = m.id;
  }

  toggleDestacada(id: string) {
    const lista: string[] = this.form.insignias_destacadas;
    if (lista.includes(id)) { this.form.insignias_destacadas = lista.filter(x => x !== id); return; }
    if (lista.length >= 3) return this.notificar('Puedes destacar hasta 3 insignias.', 'error');
    this.form.insignias_destacadas = [...lista, id];
  }

  toggleMaquina(id: string) {
    const lista: string[] = this.form.maquinas_maneja;
    this.form.maquinas_maneja = lista.includes(id) ? lista.filter(m => m !== id) : [...lista, id];
  }

  opcion(sel: boolean, bloq = false): string {
    const base = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 ';
    if (bloq) return base + 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400';
    return base + (sel ? 'border-teal-700 bg-teal-700 text-white' : 'border-stone-300 bg-white text-slate-700 hover:bg-stone-50 active:scale-95');
  }

  private validar(): boolean {
    const f = this.form, e: Record<string, string> = {};
    if ((f.nombre_completo ?? '').trim().length < 3) e['nombre_completo'] = 'Escribe al menos 3 caracteres.';
    if ((f.lema ?? '').length > 80) e['lema'] = 'Máximo 80 caracteres.';
    if ((f.bio_taller ?? '').length > 280) e['bio_taller'] = 'Máximo 280 caracteres.';
    if ('cep' in f && f.cep && f.cep.replace(/\D/g, '').length !== 8) e['cep'] = 'El CEP tiene 8 dígitos.';
    if ('cantidad_maquinas' in f && f.cantidad_maquinas < 0) e['cantidad_maquinas'] = 'No puede ser negativo.';
    if ('cantidad_operarios' in f && f.cantidad_operarios < 0) e['cantidad_operarios'] = 'No puede ser negativo.';
    this.errores = e;
    return Object.keys(e).length === 0;
  }

  async guardar() {
    if (!this.validar()) {
      this.notificar('Revisa los campos marcados.', 'error');
      return;
    }
    this.guardando.set(true);
    try {
      const payload: any = { ...this.form };
      payload.nombre_completo = payload.nombre_completo.trim();
      payload.lema = (payload.lema ?? '').trim() || null;
      payload.bio_taller = (payload.bio_taller ?? '').trim() || null;
      if ('cep' in payload) payload.cep = payload.cep ? payload.cep.replace(/\D/g, '') : null;
      if ('cnpj' in payload) payload.cnpj = payload.cnpj ? payload.cnpj.replace(/\D/g, '') : null;

      if (payload.avatar_icono) {
        const todos = [...this.iconos, ...this.ilustraciones];
        const encontrado = todos.find(x => x.id === payload.avatar_icono);
        if (encontrado && !this.iconoDesbloqueado(encontrado)) {
          this.notificar(`No puedes guardar "${encontrado.nombre}": ${this.motivoBloqueo(encontrado)}`, 'error');
          this.guardando.set(false);
          return;
        }
      }

      const ganadasSet = new Set(this.ganadas().map(l => l.id));
      payload.insignias_destacadas = payload.insignias_destacadas.filter((id: string) => ganadasSet.has(id));

      const { error } = await this.db.from('perfiles').update(payload).eq('id', this.usuarioId);
      if (error) throw error;

      this.base.update(b => ({ ...b, ...payload }));
      this.form = this.extraer(this.base());
      this.original = JSON.stringify(this.form);
      this.notificar('Perfil actualizado.');
      setTimeout(() => this.router.navigate([ROL_PANEL[this.rol()] ?? '/feed']), 900);
    } catch (e: any) {
      console.error(e);
      this.notificar(e?.message ?? 'No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar() {
    if (this.sucio && !confirm('Tienes cambios sin guardar. Salir de todos modos?')) return;
    this.router.navigate([ROL_PANEL[this.rol()] ?? '/feed']);
  }

  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    if (this.timerAviso) clearTimeout(this.timerAviso);
    this.aviso.set({ texto, tipo });
    this.timerAviso = setTimeout(() => this.aviso.set(null), 3500);
  }
}