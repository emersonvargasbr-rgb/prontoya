import { Component, OnInit, signal, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-panel-oficina',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './panel-oficina.component.html'
})
export class PanelOficinaComponent implements OnInit {
  usuarioId: string = '';
  
  cargando = signal<boolean>(true);
  acordeonActivo = signal<'produccion' | 'propuestas' | 'candidatos' | 'anuncios' | 'funcionarios' | 'historial' | null>('produccion');

  perfil = signal<any>(null);
  lotesEnProduccion = signal<any[]>([]);
  propuestasPendientesB2B = signal<any[]>([]);
  misPostulacionesEnEspera = signal<any[]>([]);
  historialLotes = signal<any[]>([]);
  misPublicaciones = signal<any[]>([]);
  candidatosEmpleo = signal<any[]>([]);

  // 🚀 MÓDULO ESCALABLE: ASIGNACIÓN A FUNCIONARIOS / OPERARIOS INTERNOS
  cortesAsignadosFuncionarios = signal<any[]>([]);
  historialCortesFuncionarios = signal<any[]>([]);

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit() {
    const { data: { session } } = await this.supabaseService.supabase.auth.getSession();
    
    if (session?.user) {
      this.usuarioId = session.user.id;
      setTimeout(() => {
        this.cargarDatosOficina();
      }, 0);
    } else {
      this.router.navigate(['/login']);
    }
  }

  async cargarDatosOficina() {
    this.cargando.set(true);
    try {
      // 1. Cargar datos del perfil
      const { data: perfData } = await this.supabaseService.supabase
        .from('perfiles')
        .select('*')
        .eq('id', this.usuarioId)
        .single();

      if (perfData) this.perfil.set(perfData);

      // 2. Cargar mis publicaciones
      const { data: pubs } = await this.supabaseService.supabase
        .from('publicaciones')
        .select('*')
        .eq('creador_id', this.usuarioId)
        .order('created_at', { ascending: false });

      this.misPublicaciones.set(pubs || []);
      const misPubsIds = (pubs || []).map(p => p.id);

      // 3. Cargar postulaciones_lotes (P2P Tienda <-> Oficina)
      const { data: todosLotes, error: errLotes } = await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .select(`
          id,
          descripcion_corte,
          cantidad_piezas,
          estado,
          created_at,
          pago_por_pieza,
          tipo_tejido,
          logistica_entrega,
          taller_id,
          publicacion_id,
          publicacion:publicacion_id (
            id,
            titulo,
            tipo_publicacion,
            creador_id,
            creador:creador_id (id, nombre_completo, zona_ubicacion, telefono, verificado)
          )
        `)
        .eq('taller_id', this.usuarioId)
        .order('created_at', { ascending: false });

      if (errLotes) console.error('Error al consultar postulaciones_lotes:', errLotes);

      const lotesMapeados = (todosLotes || []).map((p: any) => {
        const pub = Array.isArray(p.publicacion) ? p.publicacion[0] : p.publicacion;
        const tiendaInfo = pub?.creador ? (Array.isArray(pub.creador) ? pub.creador[0] : pub.creador) : null;
        
        return {
          ...p,
          publicacion: pub,
          tienda_info: tiendaInfo || { nombre_completo: 'Tienda Colaboradora', zona_ubicacion: 'São Paulo', telefono: '' }
        };
      });

      this.propuestasPendientesB2B.set(
        lotesMapeados.filter(l => l.estado === 'Pendiente' && l.publicacion?.tipo_publicacion === 'busco_corte')
      );

      this.misPostulacionesEnEspera.set(
        lotesMapeados.filter(l => l.estado === 'Pendiente' && (l.publicacion?.tipo_publicacion === 'busco_oficina' || !l.publicacion?.tipo_publicacion))
      );

      this.lotesEnProduccion.set(
        lotesMapeados.filter(l => l.estado === 'Aceptado' || l.estado === 'En Proceso' || l.estado === 'Terminado')
      );

      // 4. Historial P2P
      const { data: historial } = await this.supabaseService.supabase
        .from('historial_operaciones')
        .select(`
          *,
          tienda:tienda_id (nombre_completo, zona_ubicacion, telefono)
        `)
        .eq('oficina_id', this.usuarioId)
        .order('fecha_cierre', { ascending: false });

      this.historialLotes.set(historial || []);

      // 5. Candidatos de empleo
      const funcPubsIds = (pubs || []).filter(p => p.tipo_publicacion === 'busco_funcionario').map(p => p.id);
      if (funcPubsIds.length > 0) {
        const { data: cands } = await this.supabaseService.supabase
          .from('postulaciones_lotes')
          .select(`
            id,
            estado,
            created_at,
            publicacion:publicacion_id (id, titulo, puesto_trabajo),
            postulante:taller_id (id, nombre_completo, telefono, zona_ubicacion, promedio_estrellas, verificado)
          `)
          .in('publicacion_id', funcPubsIds)
          .order('created_at', { ascending: false });

        this.candidatosEmpleo.set((cands || []).map((c: any) => ({
          ...c,
          publicacion_info: Array.isArray(c.publicacion) ? c.publicacion[0] : c.publicacion,
          postulante_info: Array.isArray(c.postulante) ? c.postulante[0] : c.postulante
        })));
      }

      // 6. Cargar módulo de funcionarios internos
      await this.cargarCortesFuncionarios();

    } catch (e) {
      console.error('Error general cargando panel de oficina:', e);
    } finally {
      this.cargando.set(false);
      this.cdr.detectChanges();
    }
  }

  // =========================================================================
  // MÓDULO DE FUNCIONARIOS / OPERARIOS
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
      console.log('Módulo de funcionarios cargado', e);
    }
  }

  async asignarCorteAFuncionario(funcionarioId: string, descripcion: string, piezas: number, tarifaPorPieza: number) {
    if (!funcionarioId || piezas <= 0) {
      alert('Selecciona un funcionario y una cantidad válida.');
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
      alert('¡Lote asignado con éxito al funcionario!');
      await this.cargarCortesFuncionarios();
    } catch (e: any) {
      alert('Error: ' + e?.message);
    }
  }

  async cerrarCorteFuncionario(asignacionId: string) {
    if (!confirm('¿Confirmas que el funcionario entregó la producción completa y se liquidó el pago?')) return;
    try {
      const { error } = await this.supabaseService.supabase
        .from('asignaciones_funcionarios')
        .update({ estado: 'Cerrado', fecha_cierre: new Date().toISOString() })
        .eq('id', asignacionId);

      if (error) throw error;
      alert('¡Corte completado y archivado!');
      await this.cargarCortesFuncionarios();
    } catch (e: any) {
      alert('Error: ' + e?.message);
    }
  }

  toggleAcordeon(seccion: 'produccion' | 'propuestas' | 'candidatos' | 'anuncios' | 'funcionarios' | 'historial') {
    if (this.acordeonActivo() === seccion) {
      this.acordeonActivo.set(null);
    } else {
      this.acordeonActivo.set(seccion);
    }
  }

  puedeVerDireccion(): boolean {
    const p = this.perfil();
    if (!p) return false;
    if (p.visibilidad_direccion === 'publico') return true;
    if (p.visibilidad_direccion === 'conectados' && this.lotesEnProduccion().length > 0) return true;
    return false;
  }

  async aceptarLoteDirecto(propId: string) {
    if (!confirm('¿Deseas aceptar esta propuesta de corte y comenzar la producción?')) return;
    try {
      await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .update({ estado: 'Aceptado' })
        .eq('id', propId);
      await this.cargarDatosOficina();
    } catch (e: any) {
      alert('Error: ' + e?.message);
    }
  }

  async marcarComoTerminado(propId: string) {
    if (!confirm('¿Has finalizado este lote? Pasará a estado "En Espera de Confirmación".')) return;
    try {
      await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .update({ estado: 'Terminado' })
        .eq('id', propId);
      await this.cargarDatosOficina();
    } catch (e: any) {
      alert('Error: ' + e?.message);
    }
  }

  async rechazarLoteDirecto(propId: string) {
    if (!confirm('¿Deseas rechazar esta propuesta?')) return;
    try {
      await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .update({ estado: 'Rechazado' })
        .eq('id', propId);
      await this.cargarDatosOficina();
    } catch (e: any) {
      alert('Error: ' + e?.message);
    }
  }

  async cambiarEstadoAnuncio(pub: any) {
    const nuevoEstado = pub.estado === 'Activo' ? 'Pausado' : 'Activo';
    try {
      await this.supabaseService.supabase.from('publicaciones').update({ estado: nuevoEstado }).eq('id', pub.id);
      pub.estado = nuevoEstado;
      this.cdr.detectChanges();
    } catch (e: any) {
      alert('Error: ' + e?.message);
    }
  }

  async eliminarAnuncio(idAnuncio: string) {
    if (!confirm('¿Deseas eliminar este anuncio?')) return;
    try {
      await this.supabaseService.supabase.from('publicaciones').delete().eq('id', idAnuncio);
      this.misPublicaciones.update(list => list.filter(p => p.id !== idAnuncio));
    } catch (e: any) {
      alert('Error: ' + e?.message);
    }
  }

  getAvatarEmoji(id: string): string {
    const mapa: any = { tigre: '🐯', leon: '🦁', oso: '🐻', zorro: '🦊', aguila: '🦅', buho: '🦉' };
    return mapa[id] || '🧵';
  }

  contactarWhatsApp(telefono: string, nombre: string, concepto: string) {
    if (!telefono) {
      alert('El usuario no posee un teléfono registrado.');
      return;
    }
    const limpio = telefono.replace(/\D/g, '');
    window.open(`https://wa.me/${limpio}?text=${encodeURIComponent(`Hola ${nombre}, me pongo en contacto respecto al lote: "${concepto}".`)}`, '_blank');
  }
}