import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-historial-lotes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './historial-lotes.component.html',
  styleUrls: ['./historial-lotes.component.css']
})
export class HistorialLotesComponent implements OnInit {
  usuarioId: string = '';
  rolUsuario: string = '';
  lotesFinalizados: any[] = [];
  cargando = true;

  constructor(private supabaseService: SupabaseService) {}

  async ngOnInit() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioId = user.id;
      await this.obtenerRolUsuario();
      await this.cargarHistorial();
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

  async cargarHistorial() {
    try {
      this.cargando = true;
      const columnaFiltro = this.rolUsuario === 'tienda' ? 'tienda_id' : 'oficina_id';

      // Consultamos los lotes que ya tengan estado 'finalizado'
      const { data, error } = await this.supabaseService.supabase
        .from('lotes_asignados')
        .select(`
          id, estado, cantidad_asignada, fecha_entrega, updated_at,
          publicaciones ( titulo, pago_por_pieza )
        `)
        .eq(columnaFiltro, this.usuarioId)
        .eq('estado', 'finalizado')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      this.lotesFinalizados = data || [];
    } catch (error) {
      console.error('Error al cargar historial:', error);
    } finally {
      this.cargando = false;
    }
  }
}