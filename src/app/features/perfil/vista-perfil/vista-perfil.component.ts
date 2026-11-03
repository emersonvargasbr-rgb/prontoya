import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { StarRatingComponent } from '../../../shared/components/star-rating/star-rating.component';

@Component({
  selector: 'app-vista-perfil',
  standalone: true,
  imports: [CommonModule, RouterModule, StarRatingComponent],
  templateUrl: './vista-perfil.component.html'
})
export class VistaPerfilComponent implements OnInit {
  perfil: any = null;
  evaluaciones: any[] = [];
  cargando = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef // 👈 Inyección
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cargarPerfil(id);
    }
  }

  async cargarPerfil(id: string) {
    try {
      const { data: perfilData, error: perfilError } = await this.supabaseService.supabase
        .from('perfiles')
        .select('*')
        .eq('id', id)
        .single();

      if (perfilError) throw perfilError;
      this.perfil = perfilData;

      const { data: evalData, error: evalError } = await this.supabaseService.supabase
        .from('evaluaciones')
        .select(`
          estrellas, 
          comentario, 
          etiquetas, 
          created_at,
          evaluador:evaluador_id (nombre_completo)
        `)
        .eq('evaluado_id', id)
        .order('created_at', { ascending: false });

      if (!evalError && evalData) {
        this.evaluaciones = evalData.map((e: any) => {
          const evaluador = Array.isArray(e.evaluador) ? e.evaluador[0] : e.evaluador;
          return {
            ...e,
            evaluador_nombre: evaluador?.nombre_completo || 'Usuario de la plataforma',
            fecha: new Date(e.created_at).toLocaleDateString()
          };
        });
      }

    } catch (e) {
      this.error = 'No se pudo cargar la información de este usuario.';
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); // 👈 Render inmediato
    }
  }
}