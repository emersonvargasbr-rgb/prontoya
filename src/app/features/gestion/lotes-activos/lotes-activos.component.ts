import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-lotes-activos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './lotes-activos.component.html',
  styleUrls: ['./lotes-activos.component.css']
})
export class LotesActivosComponent implements OnInit {
  usuarioId: string = '';
  rolUsuario: string = '';
  lotes: any[] = [];
  cargando = true;

  constructor(private supabaseService: SupabaseService) {}

  async ngOnInit() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioId = user.id;
      await this.obtenerRolUsuario();
      await this.cargarLotes();
    }
  }

  async obtenerRolUsuario() {
    const { data } = await this.supabaseService.supabase
      .from('perfiles')
      .select('rol')
      .eq('id', this.usuarioId)
      .single();
    if (data) {
      this.rolUsuario = data.rol;
    }
  }

  async cargarLotes() {
    try {
      this.cargando = true;
      // Filtramos dependiendo de si es tienda u oficina
      const columnaFiltro = this.rolUsuario === 'tienda' ? 'tienda_id' : 'oficina_id';

      // Traemos el lote y los datos de la publicación asociada
      const { data, error } = await this.supabaseService.supabase
        .from('lotes_asignados')
        .select(`
          id, estado, cantidad_asignada, fecha_entrega,
          publicaciones ( titulo, pago_por_pieza )
        `)
        .eq(columnaFiltro, this.usuarioId)
        .eq('estado', 'en_produccion'); // Solo mostramos los activos

      if (error) throw error;
      this.lotes = data || [];
    } catch (error) {
      console.error('Error al cargar los lotes:', error);
    } finally {
      this.cargando = false;
    }
  }

  async marcarComoEntregado(loteId: string) {
    if(!confirm('¿Confirmas que este lote ha sido finalizado y entregado?')) return;

    try {
      const { error } = await this.supabaseService.supabase
        .from('lotes_asignados')
        .update({ estado: 'finalizado' })
        .eq('id', loteId);

      if (error) throw error;
      
      // Recargamos la lista para que desaparezca de los activos
      await this.cargarLotes();
    } catch (error) {
      alert('Hubo un error al actualizar el estado.');
    }
  }
}