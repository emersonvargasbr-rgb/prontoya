import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/services/supabase.service';
import { UI, mensajeAmigable, moneda, uno } from '../../../core/utils/helpers';
import { Ciclo, calcularPrecioCiclo, formatoPrecio } from '../../../core/utils/planes';
import { IconComponent } from '../../../shared/components/icon.component';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { TabItem, TabsComponent } from '../../../shared/components/tabs.component';
import { Aviso, ToastComponent } from '../../../shared/components/toast.component';

type Pestana = 'pendientes' | 'activas' | 'historial';

interface Verificacion {
  estado: 'coincide' | 'no_coincide' | 'no_encontrado' | 'no_disponible';
  mensaje: string;
  monto_recibido?: number; moneda?: string; monto_esperado?: number;
  moneda_ok?: boolean; monto_ok?: boolean; pagador_ok?: boolean | null;
  verificado_en?: string;
}

/**
 * Gestión de suscripciones (sólo administradores).
 * Ruta: /admin/suscripciones (protegida con adminGuard)
 */
@Component({
  selector: 'app-admin-suscripciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, AvatarComponent, TabsComponent, ToastComponent],
  templateUrl: './admin-suscripciones.component.html',
})
export class AdminSuscripcionesComponent implements OnInit {
  readonly ui = UI;
  readonly moneda = moneda;
  readonly formatoPrecio = formatoPrecio;

  cargando = signal(true);
  aviso = signal<Aviso | null>(null);
  pestana = signal<Pestana>('pendientes');
  busqueda = signal('');
  lista = signal<any[]>([]);

  /** id de la suscripción con una acción en curso, para bloquear doble clic */
  procesando = signal<string | null>(null);
  verificando = signal<string | null>(null);
  rechazando = signal<string | null>(null);
  motivo = '';
  copiado = signal('');

  private filtradas = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.lista();
    return this.lista().filter(s =>
      [s.perfil?.nombre_completo, s.referencia_pago, s.perfil?.telefono, s.plan?.nombre]
        .some(v => (v ?? '').toLowerCase().includes(q)));
  });

  pendientes = computed(() =>
    this.filtradas().filter(s => s.estado === 'Pendiente').sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  );
  activas = computed(() =>
    this.filtradas().filter(s => s.estado === 'Activa').sort((a, b) => (a.expira_el ?? '').localeCompare(b.expira_el ?? ''))
  );
  historial = computed(() => this.filtradas().filter(s => !['Pendiente', 'Activa'].includes(s.estado)));

  porVencer = computed(() => this.activas().filter(s => this.diasRestantes(s) <= 7).length);

  tabs = computed<TabItem[]>(() => [
    { id: 'pendientes', txt: 'Por revisar', icono: 'inbox',    n: this.pendientes().length, alerta: true },
    { id: 'activas',    txt: 'Activas',     icono: 'verified', n: this.activas().length },
    { id: 'historial',  txt: 'Historial',   icono: 'archive',  n: this.historial().length },
  ]);

  constructor(private supabaseService: SupabaseService) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() { await this.cargar(); }

  async cargar() {
    this.cargando.set(true);
    try {
      const { data, error } = await this.db
        .from('suscripciones')
        .select(`
          id, ciclo, estado, inicia_el, expira_el, metodo_pago, comprobante_url, referencia_pago, created_at,
          perfil:perfil_id (id, nombre_completo, rol, telefono, correo, zona_ubicacion, verificado, plan, plan_vigente_hasta, avatar_svg_id, avatar_icono, avatar_color, avatar_marco),
          plan:plan_id (id, nombre, grupo, mensual, anual)
        `)
        .order('created_at', { ascending: false })
        .limit(400);

      if (error) throw error;

      this.lista.set(
        (data ?? []).map((s: any) => ({
          ...s,
          perfil: uno(s.perfil),
          plan: uno(s.plan),
        }))
      );
    } catch (e: any) {
      console.error(e);
      this.notificar(mensajeAmigable(e, 'No se pudieron cargar las suscripciones.'), 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  montoSuscripcion(s: any): string {
    const mensual = Number(s.plan?.mensual || 0);
    if (!mensual) return formatoPrecio(0);
    const ciclo = (s.ciclo || 'mensual') as Ciclo;
    if (ciclo === 'anual' && s.plan?.anual) return formatoPrecio(Number(s.plan.anual));
    return formatoPrecio(calcularPrecioCiclo(mensual, ciclo));
  }

  diasRestantes(s: any): number {
    if (!s.expira_el) return 0;
    return Math.ceil((new Date(s.expira_el).getTime() - Date.now()) / 86_400_000);
  }

  async verificar(s: any) {
    if (this.verificando()) return;
    this.verificando.set(s.id);
    try {
      const { data, error } = await this.db.functions.invoke('verificar-suscripcion', { body: { suscripcion_id: s.id } });
      if (error) throw new Error(await this.mensajeDe(error, 'No se pudo verificar.'));
      this.lista.update(l => l.map(x => x.id === s.id ? { ...x, verificacion: data.verificacion } : x));
      if (data.aprobada) { this.notificar('Pago verificado y suscripción aprobada automáticamente.'); await this.cargar(); }
    } catch (e: any) {
      this.notificar(e.message, 'error');
    } finally {
      this.verificando.set(null);
    }
  }

  async aprobar(s: any) {
    const v = s.verificacion as Verificacion | null;
    const aviso = v?.estado === 'coincide' ? '' : '\n\nAtención: el pago NO está confirmado por Binance. Asegúrate de haberlo revisado a mano.';
    if (!confirm(`Aprobar el plan ${s.plan?.nombre} (${s.ciclo}) de ${s.perfil?.nombre_completo}?${aviso}`)) return;
    await this.ejecutar(s.id, () => this.db.rpc('aprobar_suscripcion', { sid: s.id, nota: null }), 'Suscripción aprobada. El plan ya está activo.');
  }

  abrirRechazo(s: any) { this.rechazando.set(s.id); this.motivo = ''; }

  async confirmarRechazo(s: any) {
    if (!this.motivo.trim()) return this.notificar('Escribe el motivo del rechazo.', 'error');
    await this.ejecutar(s.id, () => this.db.rpc('rechazar_suscripcion', { sid: s.id, motivo: this.motivo.trim() }), 'Solicitud rechazada.');
    this.rechazando.set(null);
  }

  async cancelar(s: any) {
    const motivo = prompt(`Cancelar el plan de ${s.perfil?.nombre_completo}. Motivo (opcional):`);
    if (motivo === null) return;
    await this.ejecutar(s.id, () => this.db.rpc('cancelar_suscripcion', { sid: s.id, motivo }), 'Suscripción cancelada.');
  }

  async expirarVencidas() {
    const { data, error } = await this.db.rpc('expirar_suscripciones');
    if (error) return this.notificar(mensajeAmigable(error, 'No se pudieron expirar las suscripciones.'), 'error');
    this.notificar(`${data ?? 0} suscripción(es) marcada(s) como expirada(s).`);
    await this.cargar();
  }

  async verComprobante(s: any) {
    const ruta: string | null = s.comprobante_url;
    if (!ruta) return;
    if (/^https?:\/\//.test(ruta)) { window.open(ruta, '_blank', 'noopener'); return; }
    const { data, error } = await this.db.storage.from('comprobantes').createSignedUrl(ruta, 300);
    if (error || !data?.signedUrl) return this.notificar('No se pudo abrir el comprobante.', 'error');
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async copiar(texto: string, etiqueta: string) {
    try {
      await navigator.clipboard.writeText(texto);
      this.copiado.set(etiqueta);
      setTimeout(() => this.copiado.set(''), 1800);
    } catch { /* sin permiso de portapapeles */ }
  }

  private async ejecutar(id: string, accion: () => PromiseLike<{ error: any }>, ok: string) {
    if (this.procesando()) return;
    this.procesando.set(id);
    try {
      const { error } = await accion();
      if (error) throw error;
      this.notificar(ok);
      await this.cargar();
    } catch (e: any) {
      this.notificar(mensajeAmigable(e, 'No se pudo completar la acción.'), 'error');
    } finally {
      this.procesando.set(null);
    }
  }

  private async mensajeDe(error: any, defecto: string): Promise<string> {
    if (error instanceof FunctionsHttpError) {
      try { return (await error.context.json()).error ?? defecto; } catch { /* sin JSON */ }
    }
    return defecto;
  }

  claseVerificacion(v: Verificacion | null | undefined): string {
    switch (v?.estado) {
      case 'coincide':      return 'border-teal-200 bg-teal-50 text-teal-900';
      case 'no_coincide':   return 'border-rose-200 bg-rose-50 text-rose-800';
      case 'no_encontrado': return 'border-amber-200 bg-amber-50 text-amber-900';
      default:              return 'border-stone-200 bg-stone-50 text-slate-700';
    }
  }

  iconoVerificacion(v: Verificacion | null | undefined): string {
    return v?.estado === 'coincide' ? 'check' : v?.estado === 'no_coincide' ? 'x' : 'alert';
  }

  claseEstado(estado: string): string {
    switch (estado) {
      case 'Activa':    return 'bg-teal-50 text-teal-800';
      case 'Pendiente': return 'bg-amber-50 text-amber-800';
      case 'Rechazada': return 'bg-rose-50 text-rose-700';
      default:          return 'bg-slate-100 text-slate-600';
    }
  }

  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 4000);
  }
}
