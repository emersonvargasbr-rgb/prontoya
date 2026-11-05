import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  cargando = true;
  pestanaActiva: 'lotes_asignados' | 'candidatos_empleo' | 'mis_publicaciones' | 'mis_postulaciones' = 'lotes_asignados';

  lotesAsignados: any[] = [];
  misPublicaciones: any[] = [];
  misPostulaciones: any[] = [];
  candidatosEmpleo: any[] = [];

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioId = user.id;
      await this.cargarDatosOficina();
    } else {
      this.router.navigate(['/login']);
    }
  }

  async cargarDatosOficina() {
    this.cargando = true;
    try {
      // 1. Cargar lotes asignados a esta oficina por las tiendas
      const { data: lotes, error: errLotes } = await this.supabaseService.supabase
        .from('lotes_asignados')
        .select(`
          id,
          descripcion_corte,
          cantidad_piezas,
          estado,
          fecha_asignacion,
          tienda:tienda_id (id, nombre_completo, zona_ubicacion, telefono, verificado)
        `)
        .eq('oficina_id', this.usuarioId)
        .order('fecha_asignacion', { ascending: false });

      if (errLotes) throw errLotes;
      this.lotesAsignados = (lotes || []).map((l: any) => ({
        ...l,
        tienda_info: Array.isArray(l.tienda) ? l.tienda[0] : l.tienda
      }));

      // 2. Cargar publicaciones creadas por la oficina
      const { data: pubs, error: errPubs } = await this.supabaseService.supabase
        .from('publicaciones')
        .select('*')
        .eq('creador_id', this.usuarioId)
        .order('created_at', { ascending: false });

      if (errPubs) throw errPubs;
      this.misPublicaciones = pubs || [];

      // 3. Cargar postulaciones de operarios a las vacantes de empleo de esta oficina
      const misPubsIds = this.misPublicaciones
        .filter(p => p.tipo_publicacion === 'busco_funcionario')
        .map(p => p.id);

      if (misPubsIds.length > 0) {
        const { data: cands, error: errCands } = await this.supabaseService.supabase
          .from('postulaciones_lotes')
          .select(`
            id,
            estado,
            created_at,
            publicacion:publicacion_id (id, titulo, puesto_trabajo),
            postulante:taller_id (id, nombre_completo, telefono, zona_ubicacion, promedio_estrellas, verificado, busca_alojamiento, trabaja_en_casal)
          `)
          .in('publicacion_id', misPubsIds)
          .order('created_at', { ascending: false });

        if (!errCands) {
          this.candidatosEmpleo = (cands || []).map((c: any) => ({
            ...c,
            publicacion_info: Array.isArray(c.publicacion) ? c.publicacion[0] : c.publicacion,
            postulante_info: Array.isArray(c.postulante) ? c.postulante[0] : c.postulante
          }));
        }
      }

      // 4. Cargar postulaciones de la oficina a lotes de tiendas
      const { data: posts, error: errPosts } = await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .select(`
          id,
          estado,
          created_at,
          publicacion:publicacion_id (id, titulo, cantidad_piezas, pago_por_pieza, creador:creador_id (nombre_completo, zona_ubicacion))
        `)
        .eq('taller_id', this.usuarioId);

      if (!errPosts) {
        this.misPostulaciones = (posts || []).map((p: any) => ({
          ...p,
          publicacion_info: Array.isArray(p.publicacion) ? p.publicacion[0] : p.publicacion
        }));
      }

    } catch (e) {
      console.error('Error cargando el panel de oficina:', e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  // ACCIONES DE GESTIÓN PARA CANDIDATOS DE EMPLEO
  async responderPostulacion(idPostulacion: string, nuevoEstado: 'Aceptado' | 'Rechazado') {
    try {
      const { error } = await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .update({ estado: nuevoEstado })
        .eq('id', idPostulacion);

      if (error) throw error;
      alert(`Postulación ${nuevoEstado === 'Aceptado' ? 'aprobada' : 'rechazada'} correctamente.`);
      await this.cargarDatosOficina();
    } catch (e: any) {
      alert('Error al responder postulación: ' + (e?.message || 'Intente de nuevo'));
    }
  }

  // ACCIONES DE GESTIÓN DE MIS PUBLICACIONES
  async cambiarEstadoAnuncio(pub: any) {
    const nuevoEstado = pub.estado === 'Activo' ? 'Pausado' : 'Activo';
    try {
      const { error } = await this.supabaseService.supabase
        .from('publicaciones')
        .update({ estado: nuevoEstado })
        .eq('id', pub.id);

      if (error) throw error;
      pub.estado = nuevoEstado;
    } catch (e: any) {
      alert('Error al cambiar estado del anuncio: ' + (e?.message || 'Intente de nuevo'));
    } finally {
      this.cdr.detectChanges();
    }
  }

  async eliminarAnuncio(idAnuncio: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar este anuncio de forma permanente?')) return;

    try {
      const { error } = await this.supabaseService.supabase
        .from('publicaciones')
        .delete()
        .eq('id', idAnuncio);

      if (error) throw error;
      this.misPublicaciones = this.misPublicaciones.filter(p => p.id !== idAnuncio);
      alert('Anuncio eliminado con éxito.');
    } catch (e: any) {
      alert('Error al eliminar anuncio: ' + (e?.message || 'Intente de nuevo'));
    } finally {
      this.cdr.detectChanges();
    }
  }

  contactarWhatsApp(telefono: string, nombre: string, concepto: string) {
    if (!telefono) {
      alert('El usuario no tiene un teléfono registrado.');
      return;
    }
    const limpio = telefono.replace(/\D/g, '');
    const mensaje = `Hola ${nombre}, me pongo en contacto desde CosturaPronta respecto al anuncio/postulación de "${concepto}".`;
    window.open(`https://wa.me/${limpio}?text=${encodeURIComponent(mensaje)}`, '_blank');
  }
}