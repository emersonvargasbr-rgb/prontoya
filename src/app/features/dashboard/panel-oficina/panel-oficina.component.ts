import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-panel-oficina',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './panel-oficina.component.html'
})
export class PanelOficinaComponent implements OnInit {
  usuarioId: string = '';
  perfilOficina: any = null;
  lotesAceptados: any[] = [];
  misAvisosCostureros: any[] = [];
  cargando = true;

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef // 👈 Inyección
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioId = user.id;
      await this.cargarDashboard();
    }
  }

  async cargarDashboard() {
    this.cargando = true;
    try {
      const perfilReq = this.supabaseService.supabase
        .from('perfiles')
        .select('*')
        .eq('id', this.usuarioId)
        .single();

      const lotesReq = this.supabaseService.supabase
        .from('lotes_asignados')
        .select(`
          id, descripcion_corte, cantidad_piezas, estado, fecha_asignacion,
          tienda:tienda_id (nombre_completo, zona_ubicacion)
        `)
        .eq('oficina_id', this.usuarioId)
        .eq('estado', 'En Proceso')
        .order('fecha_asignacion', { ascending: false });

      const avisosReq = this.supabaseService.supabase
        .from('publicaciones')
        .select('*')
        .eq('creador_id', this.usuarioId)
        .eq('tipo_publicacion', 'busco_funcionario')
        .eq('estado', 'Activo')
        .order('created_at', { ascending: false });

      const [resPerfil, resLotes, resAvisos] = await Promise.all([perfilReq, lotesReq, avisosReq]);

      if (resPerfil.error) throw resPerfil.error;
      if (resLotes.error) throw resLotes.error;
      if (resAvisos.error) throw resAvisos.error;

      this.perfilOficina = resPerfil.data;
      this.lotesAceptados = resLotes.data;
      this.misAvisosCostureros = resAvisos.data;

    } catch (error) {
      console.error('Error cargando el panel de oficina:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); // 👈 Render inmediato
    }
  }

  async finalizarLote(idLote: string) {
    if (!confirm('¿Confirma que este lote fue terminado y entregado a la tienda?')) return;

    try {
      const { error } = await this.supabaseService.supabase
        .from('lotes_asignados')
        .update({ estado: 'Finalizado', fecha_finalizacion: new Date() })
        .eq('id', idLote);

      if (error) throw error;
      await this.cargarDashboard();
    } catch (error) {
      alert('No se pudo actualizar el estado del lote.');
    }
  }

  async cerrarAviso(idPublicacion: string) {
    if (!confirm('¿Seguro que quieres cerrar esta búsqueda de personal?')) return;

    try {
      const { error } = await this.supabaseService.supabase
        .from('publicaciones')
        .update({ estado: 'Cerrado' })
        .eq('id', idPublicacion);
      
      if (error) throw error;
      await this.cargarDashboard();
    } catch (error) {
      alert('Error al cerrar el aviso.');
    }
  }
}