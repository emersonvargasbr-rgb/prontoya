import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-panel-funcionario',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './panel-funcionario.component.html'
})
export class PanelFuncionarioComponent implements OnInit {
  usuarioId: string = '';
  perfil: any = null;
  cargando = true;
  cambiandoEstado = false;

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef // 👈 Inyección para forzar render
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioId = user.id;
      await this.cargarPerfil();
    }
  }

  async cargarPerfil() {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('perfiles')
        .select('*')
        .eq('id', this.usuarioId)
        .single();

      if (error) throw error;
      this.perfil = data;
    } catch (error) {
      console.error('Error al cargar el perfil:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); // 👈 Rompe el bloqueo de ciclo de vida
    }
  }

  async toggleEstadoLaboral() {
    const nuevoEstado = this.perfil.estado_laboral === 'Disponible' ? 'Ocupado' : 'Disponible';
    this.cambiandoEstado = true;

    try {
      const { error } = await this.supabaseService.supabase
        .from('perfiles')
        .update({ estado_laboral: nuevoEstado })
        .eq('id', this.usuarioId);

      if (error) throw error;
      this.perfil.estado_laboral = nuevoEstado;
    } catch (error) {
      console.error('No se pudo actualizar el estado:', error);
      alert('Error al actualizar tu estado laboral.');
    } finally {
      this.cambiandoEstado = false;
      this.cdr.detectChanges(); // 👈 Refresco inmediato
    }
  }
}