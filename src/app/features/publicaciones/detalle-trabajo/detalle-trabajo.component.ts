import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { EstadoVinculo, SocialService } from '../../../core/services/social.service';
import { ROL_PANEL, TIPO_PUBLICACION, UI, abrirWhatsApp, claseEstado, moneda, uno } from '../../../core/utils/helpers';
import { Aviso, ToastComponent } from '../../../shared/components/toast.component';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { IconComponent } from '../../../shared/components/icon.component';

type Accion = 'login' | 'mio' | 'proponer' | 'postular_lote' | 'postular_empleo' | 'contactar_operario' | 'ninguna';

const CAMPOS_CREADOR = `id, nombre_completo, rol, verificado, zona_ubicacion, promedio_estrellas,
  total_evaluaciones, especialidad_principal, visibilidad_whatsapp`;

@Component({
  selector: 'app-detalle-trabajo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, AvatarComponent, ToastComponent],
  templateUrl: './detalle-trabajo.component.html',
})
export class DetalleTrabajoComponent implements OnInit {
  readonly ui = UI;
  readonly tipos = TIPO_PUBLICACION;
  readonly claseEstado = claseEstado;

  trabajoId = '';
  private _usuarioId = signal<string>('');
  get usuarioId(): string { return this._usuarioId(); }
  set usuarioId(v: string) { this._usuarioId.set(v); }
  
  private _rolUsuario = signal<string>('');
  get rolUsuario(): string { return this._rolUsuario(); }
  set rolUsuario(v: string) { this._rolUsuario.set(v); }

  cargando = signal(true);
  enviando = signal(false);
  aviso = signal<Aviso | null>(null);
  trabajo = signal<any>(null);
  miPostulacion = signal<{ id: string; estado: string } | null>(null);
  telefono = signal<string | null>(null);
  vinculo = signal<{ estado: EstadoVinculo; id?: string }>({ estado: 'ninguno' });
  siguiendo = signal(false);

  mostrarModalOferta = signal(false);
  datosOferta = { descripcion_corte: '', cantidad_piezas: 500, pago_por_pieza: 2.5, tipo_tejido: '', logistica_entrega: 'acuerdo_mutuo' };

  // ----------------------------------------------------------------- derivados
  tipo = computed(() => this.trabajo()?.tipo_publicacion as string | undefined);
  esMio = computed(() => !!this.usuarioId && this.trabajo()?.creador_id === this.usuarioId);
  autor = computed(() => this.trabajo()?.creador);

  /** Qué botón de negocio corresponde a este usuario con este anuncio. */
  accion = computed<Accion>(() => {
    const t = this.tipo();
    if (!this.usuarioId) return 'login';
    if (this.esMio()) return 'mio';
    if (t === 'busco_corte' && this.rolUsuario === 'tienda') return 'proponer';
    if (t === 'busco_oficina' && this.rolUsuario === 'oficina') return 'postular_lote';
    if (t === 'busco_funcionario' && this.rolUsuario === 'funcionario') return 'postular_empleo';
    if (t === 'busco_trabajo' && ['tienda', 'oficina'].includes(this.rolUsuario)) return 'contactar_operario';
    return 'ninguna';
  });

  /** Datos técnicos listos para pintar (evita decenas de *ngIf en la vista). */
  hechos = computed(() => {
    const t = this.trabajo();
    if (!t) return [] as { etq: string; val: string }[];
    const esEmpleo = t.tipo_publicacion === 'busco_funcionario' || t.tipo_publicacion === 'busco_trabajo';
    const modalidadPago = t.modalidad_pago === 'salario_mensual' ? 'mensual' : t.modalidad_pago === 'salario_semanal' ? 'semanal' : 'por pieza';
    const logistica: Record<string, string> = { oficina_retira: 'El taller retira', tienda_entrega: 'La tienda entrega', acuerdo_mutuo: 'A combinar' };

    const h: { etq: string; val: string }[] = [];
    if (t.pago_por_pieza > 0) h.push({ etq: esEmpleo ? 'Pago' : 'Tarifa por pieza', val: `${moneda(t.pago_por_pieza)} ${esEmpleo ? modalidadPago : ''}`.trim() });
    if (t.cantidad_piezas > 0) h.push({ etq: 'Volumen', val: `${Number(t.cantidad_piezas).toLocaleString('pt-BR')} piezas` });
    if (t.cantidad_piezas > 0 && t.pago_por_pieza > 0 && !esEmpleo) h.push({ etq: 'Total estimado', val: moneda(t.cantidad_piezas * t.pago_por_pieza) });
    if (t.puesto_trabajo) h.push({ etq: esEmpleo ? 'Puesto' : 'Especialidad', val: t.puesto_trabajo });
    if (t.tipo_publicacion === 'busco_corte') {
      if (t.especialidad_taller) h.push({ etq: 'Especialidad', val: t.especialidad_taller });
      if (t.tipo_tejido) h.push({ etq: 'Tejido', val: t.tipo_tejido });
      if (t.modalidad_trabajo) h.push({ etq: 'Modalidad', val: t.modalidad_trabajo });
      if (t.capacidad_produccion) h.push({ etq: 'Capacidad', val: t.capacidad_produccion });
    }
    if (['busco_oficina', 'busco_corte'].includes(t.tipo_publicacion) && t.logistica_entrega) {
      h.push({ etq: 'Logística', val: logistica[t.logistica_entrega] ?? 'A combinar' });
    }
    return h;
  });

  beneficios = computed(() => {
    const t = this.trabajo();
    if (!t || !['busco_funcionario', 'busco_trabajo'].includes(t.tipo_publicacion)) return [];
    const b: { txt: string; icono: string }[] = [
      { txt: t.modalidad_alojamiento === 'cama_dentro' ? 'Cama dentro' : t.modalidad_alojamiento === 'opcional' ? 'Alojamiento a convenir' : 'Cama fuera', icono: 'pin' },
      { txt: t.modalidad_contratacion === 'casal' ? 'Casal (pareja)' : t.modalidad_contratacion === 'equipo' ? 'Equipo completo' : 'Individual', icono: 'users' },
    ];
    if (t.ofrece_alojamiento) b.push({ txt: 'Vivienda incluida', icono: 'check' });
    if (t.ofrece_comida) b.push({ txt: 'Comida incluida', icono: 'check' });
    if (t.ofrece_wifi) b.push({ txt: 'Wi-Fi libre', icono: 'check' });
    if (t.ofrece_banio_privado) b.push({ txt: 'Baño privado', icono: 'check' });
    const hijos = Number(t.cantidad_hijos_permitidos) || 0;
    b.push({ txt: t.tipo_publicacion === 'busco_trabajo'
      ? (hijos > 0 ? `${hijos} hijo(s) a cargo` : 'Sin hijos')
      : (hijos > 0 ? `Admite hasta ${hijos} hijo(s)` : 'Solo sin hijos'), icono: 'users' });
    return b;
  });

  constructor(
    private route: ActivatedRoute, private router: Router,
    private supabaseService: SupabaseService, private social: SocialService,
  ) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    this.trabajoId = this.route.snapshot.paramMap.get('id') || '';
    await this.cargarUsuario();
    await this.cargarDetalle();
  }

  private async cargarUsuario() {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) return;
    this.usuarioId = user.id;
    const { data } = await this.db.from('perfiles').select('rol').eq('id', user.id).single();
    if (data) this.rolUsuario = data.rol;
  }

  async cargarDetalle() {
    this.cargando.set(true);
    try {
      const { data, error } = await this.db.from('publicaciones')
        .select(`*, creador:creador_id (${CAMPOS_CREADOR})`)
        .eq('id', this.trabajoId).single();
      if (error) throw error;
      this.trabajo.set({ ...data, creador: uno(data.creador) });

      if (this.usuarioId && !this.esMio()) {
        await Promise.all([this.cargarMiPostulacion(), this.cargarRelacion(), this.cargarTelefono()]);
      }
    } catch (e) {
      console.error(e);
      this.trabajo.set(null);
    } finally {
      queueMicrotask(() => this.cargando.set(false));
    }
  }

  private async cargarMiPostulacion() {
    const { data } = await this.db.from('postulaciones_lotes').select('id, estado')
      .eq('publicacion_id', this.trabajoId).eq('taller_id', this.usuarioId).maybeSingle();
    this.miPostulacion.set(data ?? null);
  }

  private async cargarRelacion() {
    const autorId = this.autor()?.id;
    if (!autorId) return;
    const [v, s] = await Promise.all([this.social.estadoVinculo(autorId), this.social.estaSiguiendo(autorId)]);
    this.vinculo.set(v);
    this.siguiendo.set(s);
  }

  /** El teléfono sólo se pide si la privacidad del anunciante lo permite. */
  private async cargarTelefono() {
    const a = this.autor();
    if (!a) return;
    const vis = a.visibilidad_whatsapp ?? 'publico';
    const conectado = this.vinculo().estado === 'conectado';
    const aceptado = this.miPostulacion()?.estado === 'Aceptado';
    if (vis === 'privado' && !aceptado) return;
    if (vis === 'conectados' && !conectado && !aceptado) return;
    const { data } = await this.db.from('perfiles').select('telefono').eq('id', a.id).maybeSingle();
    this.telefono.set(data?.telefono ?? null);
  }

  // =================================================================== SOCIAL
  async alternarSeguir() {
    const id = this.autor()?.id;
    if (!id) return;
    try {
      if (this.siguiendo()) await this.social.dejarDeSeguir(id); else await this.social.seguir(id);
      this.siguiendo.update(v => !v);
    } catch (e: any) { this.notificar(e?.message ?? 'No se pudo actualizar.', 'error'); }
  }

  async conectar() {
    const id = this.autor()?.id;
    if (!id) return;
    try {
      await this.social.solicitarVinculo(id);
      this.vinculo.set({ estado: 'enviado' });
      this.notificar('Solicitud de conexión enviada.');
    } catch (e: any) { this.notificar(e?.message ?? 'No se pudo enviar.', 'error'); }
  }

  // ================================================================ NEGOCIO
  irALogin() { this.router.navigate(['/login']); }
  irAMiPanel() { this.router.navigate([ROL_PANEL[this.rolUsuario] ?? '/feed']); }

  abrirModalOferta() {
    const t = this.trabajo();
    this.datosOferta = {
      descripcion_corte: `Lote para ${t?.titulo ?? 'taller'}`,
      cantidad_piezas: 500, pago_por_pieza: 2.5,
      tipo_tejido: t?.tipo_tejido ?? '', logistica_entrega: t?.logistica_entrega ?? 'acuerdo_mutuo',
    };
    this.mostrarModalOferta.set(true);
  }

  /** Tienda -> taller libre. */
  async enviarOferta() {
    const d = this.datosOferta;
    if (!d.descripcion_corte.trim() || !(d.cantidad_piezas > 0) || !(d.pago_por_pieza > 0)) {
      return this.notificar('Completa descripción, piezas y precio por pieza.', 'error');
    }
    const ok = await this.crearPostulacion({
      descripcion_corte: d.descripcion_corte.trim(), cantidad_piezas: d.cantidad_piezas,
      pago_por_pieza: d.pago_por_pieza, tipo_tejido: d.tipo_tejido || null, logistica_entrega: d.logistica_entrega,
    }, 'Propuesta enviada. El taller la revisará.');
    if (ok) this.mostrarModalOferta.set(false);
  }

  /** Oficina -> lote de tienda. */
  async postularOficina() {
    const t = this.trabajo();
    if (!confirm('Postular tu taller a este lote?')) return;
    await this.crearPostulacion({
      descripcion_corte: t.titulo, cantidad_piezas: t.cantidad_piezas || 0, pago_por_pieza: t.pago_por_pieza || 0,
      tipo_tejido: t.tipo_tejido || null, logistica_entrega: t.logistica_entrega || 'acuerdo_mutuo',
    }, 'Postulación enviada. Esperando aprobación de la tienda.');
  }

  /** Operario -> vacante. */
  async postularEmpleo() {
    const t = this.trabajo();
    if (!confirm('Postularte a esta vacante?')) return;
    await this.crearPostulacion({
      descripcion_corte: t.titulo, cantidad_piezas: 0, pago_por_pieza: t.pago_por_pieza || 0,
    }, 'Postulación enviada. El anunciante la revisará.');
  }

  private async crearPostulacion(extra: object, mensajeOk: string): Promise<boolean> {
    this.enviando.set(true);
    try {
      const { data, error } = await this.db.from('postulaciones_lotes')
        .insert([{ publicacion_id: this.trabajoId, taller_id: this.usuarioId, estado: 'Pendiente', ...extra }])
        .select('id, estado').single();
      if (error) {
        if (error.code === '23505') { 
          this.notificar('Ya te postulaste a este anuncio.', 'error'); 
          await this.cargarMiPostulacion(); 
          return false; 
        }
        throw error;
      }
      this.miPostulacion.set(data);
      this.notificar(mensajeOk);
      return true;
    } catch (e: any) {
      console.error(e);
      this.notificar(e?.message ?? 'No se pudo enviar. Intenta de nuevo.', 'error');
      return false;
    } finally {
      this.enviando.set(false);
    }
  }

  contactarWhatsApp() {
    const a = this.autor();
    if (!abrirWhatsApp(this.telefono(), a?.nombre_completo ?? '', this.trabajo()?.titulo ?? '')) {
      this.notificar('El anunciante no comparte su teléfono. Envíale una solicitud de conexión.', 'error');
    }
  }

  compartir() {
    if (navigator.share) {
      navigator.share({
        title: this.trabajo()?.titulo || 'CosturaPronta',
        text: 'Mira esta oferta textil en CosturaPronta:',
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      this.notificar('¡Enlace copiado al portapapeles!');
    }
  }

  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 3500);
  }
}