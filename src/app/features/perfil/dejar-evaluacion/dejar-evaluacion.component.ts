import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-dejar-evaluacion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './dejar-evaluacion.component.html'
})
export class DejarEvaluacionComponent implements OnInit {
  usuarioActualId: string = '';
  usuarioEvaluadoId: string = '';
  usuarioEvaluado: any = null;
  
  estrellas: number = 5;
  comentario: string = '';
  cargando = false;
  cargandoPerfil = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.usuarioEvaluadoId = this.route.snapshot.paramMap.get('id') || '';
    
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioActualId = user.id;
      if (this.usuarioActualId === this.usuarioEvaluadoId) {
        this.error = 'No puedes evaluarte a ti mismo.';
      } else {
        await this.cargarUsuarioEvaluado();
      }
    } else {
      this.router.navigate(['/login']);
    }
  }

  async cargarUsuarioEvaluado() {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('perfiles')
        .select('id, nombre_completo, rol, zona_ubicacion, avatar_svg_id, color_portada')
        .eq('id', this.usuarioEvaluadoId)
        .single();

      if (error) throw error;
      this.usuarioEvaluado = data;
    } catch (e) {
      this.error = 'No se encontró el perfil del usuario a evaluar.';
      console.error(e);
    } finally {
      this.cargandoPerfil = false;
      this.cdr.detectChanges();
    }
  }

  seleccionarEstrellas(n: number) {
    this.estrellas = n;
    this.cdr.detectChanges();
  }

  async enviarEvaluacion() {
    if (!this.comentario.trim()) {
      alert('Por favor escribe un breve comentario sobre tu experiencia laboral.');
      return;
    }

    this.cargando = true;
    try {
      // 1. Insertar la evaluación en la tabla evaluaciones
      const { error: errEval } = await this.supabaseService.supabase
        .from('evaluaciones')
        .insert([{
          evaluador_id: this.usuarioActualId,
          evaluado_id: this.usuarioEvaluadoId,
          estrellas: this.estrellas,
          comentario: this.comentario.trim()
        }]);

      if (errEval) throw errEval;

      // 2. Obtener todas las evaluaciones de este usuario para recalcular el promedio exacto
      const { data: todasEval, error: errList } = await this.supabaseService.supabase
        .from('evaluaciones')
        .select('estrellas')
        .eq('evaluado_id', this.usuarioEvaluadoId);

      if (!errList && todasEval && todasEval.length > 0) {
        const total = todasEval.length;
        const suma = todasEval.reduce((acc, curr) => acc + curr.estrellas, 0);
        const nuevoPromedio = Number((suma / total).toFixed(1));

        // 3. Actualizar el perfil del usuario evaluado con el nuevo promedio y total de reseñas
        await this.supabaseService.supabase
          .from('perfiles')
          .update({
            promedio_estrellas: nuevoPromedio,
            total_evaluaciones: total
          })
          .eq('id', this.usuarioEvaluadoId);
      }

      alert('¡Evaluación publicada con éxito!');
      this.router.navigate(['/feed']);

    } catch (e: any) {
      alert('Error al enviar la evaluación: ' + (e?.message || 'Intente de nuevo.'));
      console.error(e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }
}