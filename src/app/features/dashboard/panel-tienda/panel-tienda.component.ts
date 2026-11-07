import { Component, OnInit, signal, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-panel-tienda',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './panel-tienda.component.html'
})
export class PanelTiendaComponent implements OnInit {
  usuarioId: string = '';
  
  cargando = signal<boolean>(true);
  
  // Acordeón ampliado con la sección 'funcionarios'
  acordeonActivo = signal<'solicitudes' | 'produccion' | 'anuncios' | 'funcionarios' | 'historial' | null>('produccion');

  perfil = signal<any>(null);
  solicitudesPendientes = signal<any[]>([]);
  lotesEnProceso = signal<any[]>([]);
  historialLotes = signal<any[]>([]);
  misPublicaciones = signal<any[]>([]);

  // 🚀 MÓDULO ESCALABLE: ASIGNACIÓN A FUNCIONARIOS / OPERARIOS INTERNOS DE LA TIENDA
  cortesAsignadosFuncionarios = signal<any[]>([]);
  historialCortesFuncionarios = signal<any[]>([]);

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioId = user.id;
      setTimeout(() => {
        this.cargarDatosPanel();
      }, 0);
    } else {
      this.router.navigate(['/login']);
    }
  }

  async cargarDatosPanel() {
    this.cargando.set(true);
    try {
      // 1. Cargar perfil de la tienda
      const { data: perfData } = await this.supabaseService.supabase
        .from('perfiles')
        .select('*')
        .eq('id', this.usuarioId)
        .single();

      if (perfData) this.perfil.set(perfData);

      // 2. Cargar publicaciones propias de la tienda
      const { data: pubs } = await this.supabaseService.supabase
        .from('publicaciones')
        .select('*')
        .eq('creador_id', this.usuarioId)
        .order('created_at', { ascending: false });

      this.misPublicaciones.set(pubs || []);
      const misPubsIds = (pubs || []).map(p => p.id);

      // 3. Cargar solicitudes/postulaciones pendientes
      let querySolicitudes = this.supabaseService.supabase
        .from('postulaciones_lotes')
        .select(`
          id,
          created_at,
          estado,
          descripcion_corte,
          cantidad_piezas,
          pago_por_pieza,
          publicacion:publicacion_id (id, titulo, cantidad_piezas, pago_por_pieza, creador_id),
          taller:taller_id (id, nombre_completo, zona_ubicacion, verificado, promedio_estrellas, telefono, avatar_svg_id)
        `)
        .eq('estado', 'Pendiente');

      const { data: postulaciones } = await querySolicitudes;

      const filtradas = (postulaciones || []).filter((p: any) => {
        const pub = Array.isArray(p.publicacion) ? p.publicacion[0] : p.publicacion;
        return pub && pub.creador_id === this.usuarioId;
      }).map((p: any) => ({
        id: p.id,
        created_at: p.created_at,
        descripcion_corte: p.descripcion_corte || p.publicacion?.titulo,
        cantidad_piezas: p.cantidad_piezas || p.publicacion?.cantidad_piezas,
        pago_por_pieza: p.pago_por_pieza || p.publicacion?.pago_por_pieza,
        publicacion: Array.isArray(p.publicacion) ? p.publicacion[0] : p.publicacion,
        taller: Array.isArray(p.taller) ? p.taller[0] : p.taller
      }));

      this.solicitudesPendientes.set(filtradas);

      // 4. Cargar lotes activos en producción (Aceptado, En Proceso, Terminado)
      let queryActivos = this.supabaseService.supabase
        .from('postulaciones_lotes')
        .select(`
          id,
          descripcion_corte,
          cantidad_piezas,
          estado,
          created_at,
          pago_por_pieza,
          publicacion_id,
          publicacion:publicacion_id (id, titulo, creador_id),
          taller:taller_id (id, nombre_completo, zona_ubicacion, telefono, promedio_estrellas, avatar_svg_id, verificado)
        `)
        .in('estado', ['Aceptado', 'En Proceso', 'Terminado']);

      if (misPubsIds.length > 0) {
        queryActivos = queryActivos.or(`publicacion_id.in.(${misPubsIds.join(',')})`);
      }

      const { data: postulacionesActivas } = await queryActivos;

      const activasFiltradas = (postulacionesActivas || []).map((p: any) => {
        const pub = Array.isArray(p.publicacion) ? p.publicacion[0] : p.publicacion;
        const tallerInfo = Array.isArray(p.taller) ? p.taller[0] : p.taller;
        return {
          ...p,
          oficina_info: tallerInfo || { nombre_completo: 'Oficina / Taller', zona_ubicacion: 'São Paulo', telefono: '' }
        };
      });

      this.lotesEnProceso.set(activasFiltradas);

      // 5. Cargar Historial P2P definitivo desde historial_operaciones
      const { data: historial } = await this.supabaseService.supabase
        .from('historial_operaciones')
        .select(`
          *,
          oficina:oficina_id (nombre_completo, zona_ubicacion, telefono)
        `)
        .eq('tienda_id', this.usuarioId)
        .order('fecha_cierre', { ascending: false });

      this.historialLotes.set(historial || []);

      // 6. 🛠️ CARGAR MÓDULO DE FUNCIONARIOS / OPERARIOS INTERNOS DE LA TIENDA
      await this.cargarCortesFuncionarios();

    } catch (e) {
      console.error('Error cargando panel de tienda:', e);
    } finally {
      this.cargando.set(false);
      this.cdr.detectChanges();
    }
  }

  // =========================================================================
  // MÓDULO DE ASIGNACIÓN A FUNCIONARIOS / OPERARIOS INTERNOS
  // =========================================================================
  async cargarCortesFuncionarios() {
    try {
      const { data: activos } = await this.supabaseService.supabase
        .from('asignaciones_funcionarios')
        .select(`
          *,
          funcionario:funcionario_id (nombre_completo, telefono, avatar_svg_id, especialidad_principal)
        `)
        .eq('empleador_id', this.usuarioId)
        .in('estado', ['Asignado', 'En Confección']);

      this.cortesAsignadosFuncionarios.set(activos || []);

      const { data: historialFunc } = await this.supabaseService.supabase
        .from('asignaciones_funcionarios')
        .select(`
          *,
          funcionario:funcionario_id (nombre_completo, telefono)
        `)
        .eq('empleador_id', this.usuarioId)
        .eq('estado', 'Cerrado')
        .order('fecha_cierre', { ascending: false });

      this.historialCortesFuncionarios.set(historialFunc || []);
    } catch (e) {
      console.log('Módulo de funcionarios para tienda inicializado:', e);
    }
  }

  async asignarCorteAFuncionario(funcionarioId: string, descripcion: string, piezas: number, tarifaPorPieza: number) {
    if (!funcionarioId || piezas <= 0) {
      alert('Por favor selecciona un funcionario y una cantidad de piezas válida.');
      return;
    }

    try {
      const montoTotal = piezas * tarifaPorPieza;
      const { error } = await this.supabaseService.supabase
        .from('asignaciones_funcionarios')
        .insert({
          empleador_id: this.usuarioId,
          funcionario_id: funcionarioId,
          descripcion_corte: descripcion,
          cantidad_piezas: piezas,
          pago_por_pieza: tarifaPorPieza,
          monto_total: montoTotal,
          estado: 'Asignado',
          fecha_inicio: new Date().toISOString()
        });

      if (error) throw error;

      alert('¡Lote asignado con éxito al funcionario interno!');
      await this.cargarCortesFuncionarios();
    } catch (e: any) {
      alert('Error al asignar al funcionario: ' + e?.message);
    }
  }

  async cerrarCorteFuncionario(asignacionId: string) {
    if (!confirm('¿Confirmas que el funcionario interno entregó la producción completa y se liquidó el pago?')) return;

    try {
      const { error } = await this.supabaseService.supabase
        .from('asignaciones_funcionarios')
        .update({
          estado: 'Cerrado',
          fecha_cierre: new Date().toISOString()
        })
        .eq('id', asignacionId);

      if (error) throw error;

      alert('¡Corte completado y archivado en el historial de la tienda!');
      await this.cargarCortesFuncionarios();
    } catch (e: any) {
      alert('Error al cerrar corte del funcionario: ' + e?.message);
    }
  }

  toggleAcordeon(seccion: 'solicitudes' | 'produccion' | 'anuncios' | 'funcionarios' | 'historial') {
    if (this.acordeonActivo() === seccion) {
      this.acordeonActivo.set(null);
    } else {
      this.acordeonActivo.set(seccion);
    }
  }

  async aceptarSolicitud(solicitud: any) {
    if (!confirm(`¿Deseas aprobar este lote para el taller ${solicitud.taller?.nombre_completo}?`)) return;

    this.cargando.set(true);
    try {
      await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .update({ estado: 'Aceptado' })
        .eq('id', solicitud.id);

      await this.cargarDatosPanel();
    } catch (e: any) {
      alert('Error al aceptar: ' + e?.message);
    } finally {
      this.cargando.set(false);
      this.cdr.detectChanges();
    }
  }

  async rechazarSolicitud(solicitudId: string) {
    if (!confirm('¿Deseas rechazar esta solicitud?')) return;
    try {
      await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .update({ estado: 'Rechazado' })
        .eq('id', solicitudId);

      await this.cargarDatosPanel();
    } catch (e: any) {
      alert('Error al rechazar: ' + e?.message);
    }
  }

  async confirmarCierreYRecepcion(lote: any) {
    if (!confirm('¿Confirmas que has recibido el lote conforme? Esto cerrará la transacción e inscribirá el comprobante P2P en el historial.')) return;

    this.cargando.set(true);
    try {
      const montoCalculado = Number(lote.cantidad_piezas || 0) * Number(lote.pago_por_pieza || 0);

      const { error: errorHistorial } = await this.supabaseService.supabase
        .from('historial_operaciones')
        .insert({
          lote_id: lote.id,
          tienda_id: this.usuarioId,
          oficina_id: lote.oficina_info?.id,
          descripcion_corte: lote.descripcion_corte || lote.publicacion?.titulo || 'Lote de Confección',
          cantidad_piezas: lote.cantidad_piezas,
          pago_por_pieza: lote.pago_por_pieza || 0,
          monto_total: montoCalculado,
          fecha_inicio: lote.created_at,
          fecha_cierre: new Date().toISOString(),
          estado_final: 'Completado'
        });

      if (errorHistorial) throw errorHistorial;

      await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .update({ estado: 'Cerrado' })
        .eq('id', lote.id);

      await this.cargarDatosPanel();
      alert('¡Comprobante generado con éxito!');
    } catch (e: any) {
      alert('Error al cerrar el lote: ' + e?.message);
    } finally {
      this.cargando.set(false);
      this.cdr.detectChanges();
    }
  }

  async cambiarEstadoAnuncio(pub: any) {
    const nuevoEstado = pub.estado === 'Activo' ? 'Pausado' : 'Activo';
    await this.supabaseService.supabase.from('publicaciones').update({ estado: nuevoEstado }).eq('id', pub.id);
    pub.estado = nuevoEstado;
    this.cdr.detectChanges();
  }

  async eliminarAnuncio(id: string) {
    if (!confirm('¿Deseas eliminar este anuncio?')) return;
    await this.supabaseService.supabase.from('publicaciones').delete().eq('id', id);
    this.misPublicaciones.update(list => list.filter(p => p.id !== id));
    this.cdr.detectChanges();
  }

  getAvatarEmoji(id: string): string {
    const mapa: any = { tigre: '🐯', leon: '🦁', oso: '🐻', zorro: '🦊', aguila: '🦅', buho: '🦉' };
    return mapa[id] || '🧵';
  }

  irAEvaluacion(usuarioIdObjetivo: string) {
    this.router.navigate(['/dejar-evaluacion', usuarioIdObjetivo]);
  }

  contactarWhatsApp(telefono: string, nombre: string, concepto: string) {
    if (!telefono) {
      alert('El usuario no posee teléfono registrado.');
      return;
    }
    const limpio = telefono.replace(/\D/g, '');
    window.open(`https://wa.me/${limpio}?text=${encodeURIComponent(`Hola ${nombre}, me pongo en contacto desde CosturaPronta respecto al lote: "${concepto}".`)}`, '_blank');
  }
}