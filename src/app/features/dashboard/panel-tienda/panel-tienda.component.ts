import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-panel-tienda',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './panel-tienda.component.html'
})
export class PanelTiendaComponent implements OnInit {
  usuarioId: string = '';
  perfilTienda: any = null;
  lotesActivos: any[] = [];
  historialLotes: any[] = [];
  totalPiezasEnProceso = 0;
  totalPiezasTerminadas = 0;
  cargando = true;

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef // 👈 Inyección
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioId = user.id;
      await this.cargarInventario();
    }
  }

  async cargarInventario() {
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
          id,
          descripcion_corte,
          cantidad_piezas,
          estado,
          fecha_asignacion,
          fecha_finalizacion,
          oficina:oficina_id (nombre_completo, zona_ubicacion)
        `)
        .eq('tienda_id', this.usuarioId)
        .order('fecha_asignacion', { ascending: false });

      const [resPerfil, resLotes] = await Promise.all([perfilReq, lotesReq]);

      if (resPerfil.error) throw resPerfil.error;
      if (resLotes.error) throw resLotes.error;

      this.perfilTienda = resPerfil.data;
      const dataLotes = resLotes.data || [];

      this.lotesActivos = dataLotes.filter(lote => lote.estado === 'En Proceso');
      this.historialLotes = dataLotes.filter(lote => lote.estado === 'Entregado' || lote.estado === 'Pagado' || lote.estado === 'Finalizado');

      this.totalPiezasEnProceso = this.lotesActivos.reduce((sum, lote) => sum + lote.cantidad_piezas, 0);
      this.totalPiezasTerminadas = this.historialLotes.reduce((sum, lote) => sum + lote.cantidad_piezas, 0);

    } catch (error) {
      console.error('Error al cargar inventario de tienda:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); // 👈 Render inmediato
    }
  }

  async marcarComoEntregado(idLote: string) {
    if (!confirm('¿Confirmas que la oficina entregó este lote completo y conforme?')) return;

    try {
      const { error } = await this.supabaseService.supabase
        .from('lotes_asignados')
        .update({ 
          estado: 'Entregado',
          fecha_finalizacion: new Date().toISOString()
        })
        .eq('id', idLote);

      if (error) throw error;
      await this.cargarInventario();
    } catch (error) {
      alert('Hubo un error al actualizar el estado del lote.');
    }
  }
}