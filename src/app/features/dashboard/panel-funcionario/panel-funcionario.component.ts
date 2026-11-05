import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-panel-funcionario',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './panel-funcionario.component.html'
})
export class PanelFuncionarioComponent implements OnInit {
  usuarioId: string = '';
  cargando = true;
  perfil: any = null;
  misPostulaciones: any[] = [];
  evaluacionesRecibidas: any[] = [];
  pestanaActiva: 'empleos' | 'reputacion' = 'empleos';

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioId = user.id;
      await this.cargarDatosFuncionario();
    } else {
      this.router.navigate(['/login']);
    }
  }

  async cargarDatosFuncionario() {
    this.cargando = true;
    try {
      // 1. Cargar perfil del operario
      const { data: perfilData, error: errPerfil } = await this.supabaseService.supabase
        .from('perfiles')
        .select('*')
        .eq('id', this.usuarioId)
        .single();

      if (errPerfil) throw errPerfil;
      this.perfil = perfilData;

      // 2. Cargar postulaciones del operario a vacantes de talleres/oficinas
      const { data: posts, error: errPosts } = await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .select(`
          id,
          estado,
          created_at,
          publicacion:publicacion_id (id, titulo, cantidad_piezas, pago_por_pieza, creador:creador_id (nombre_completo, zona_ubicacion, telefono))
        `)
        .eq('taller_id', this.usuarioId);

      if (errPosts) throw errPosts;

      this.misPostulaciones = (posts || []).map((p: any) => ({
        ...p,
        publicacion_info: Array.isArray(p.publicacion) ? p.publicacion[0] : p.publicacion
      }));

      // 3. Cargar evaluaciones o calificaciones recibidas
      const { data: evals, error: errEvals } = await this.supabaseService.supabase
        .from('evaluaciones')
        .select(`
          id,
          estrellas,
          comentario,
          created_at,
          evaluador:evaluador_id (nombre_completo)
        `)
        .eq('evaluado_id', this.usuarioId)
        .order('created_at', { ascending: false });

      if (!errEvals) {
        this.evaluacionesRecibidas = (evals || []).map((e: any) => ({
          ...e,
          evaluador_nombre: Array.isArray(e.evaluador) ? e.evaluador[0]?.nombre_completo : e.evaluador?.nombre_completo
        }));
      }

    } catch (e) {
      console.error('Error cargando panel de funcionario:', e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async cambiarEstadoLaboral() {
    const nuevoEstado = this.perfil.estado_laboral === 'Disponible' ? 'Ocupado' : 'Disponible';
    try {
      const { error } = await this.supabaseService.supabase
        .from('perfiles')
        .update({ estado_laboral: nuevoEstado })
        .eq('id', this.usuarioId);

      if (error) throw error;
      this.perfil.estado_laboral = nuevoEstado;
      alert(`Estado actualizado a: ${nuevoEstado}`);
    } catch (e) {
      console.error('Error al actualizar estado:', e);
    } finally {
      this.cdr.detectChanges();
    }
  }
}