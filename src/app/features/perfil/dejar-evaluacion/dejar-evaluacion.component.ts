import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ROL_ETIQUETA, ROL_PANEL, UI } from '../../../core/utils/helpers';
import { ETIQUETAS_EVALUACION, Rol, calcularGamificacion } from '../../../core/utils/gamificacion';
import { Aviso, ToastComponent } from '../../../shared/components/toast.component';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { IconComponent } from '../../../shared/components/icon.component';

const TEXTOS_ESTRELLAS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

@Component({
  selector: 'app-dejar-evaluacion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, AvatarComponent, ToastComponent],
  templateUrl: './dejar-evaluacion.component.html',
})
export class DejarEvaluacionComponent implements OnInit {
  readonly ui = UI;
  readonly roles = ROL_ETIQUETA;
  readonly estrellasLista = [1, 2, 3, 4, 5];
  readonly minComentario = 10;
  readonly maxComentario = 400;
  readonly maxEtiquetas = 4;

  usuarioActualId = '';
  miRol = '';
  evaluadoId = '';

  cargando = signal(true);
  enviando = signal(false);
  aviso = signal<Aviso | null>(null);
  error = signal('');
  evaluado = signal<any>(null);

  /** Si ya calificaste antes, se edita esa misma reseña (una por pareja). */
  evaluacionId = signal<string | null>(null);

  estrellas = signal(5);
  hover = signal(0);
  etiquetas = signal<string[]>([]);
  comentario = '';

  textoEstrellas = computed(() => TEXTOS_ESTRELLAS[this.hover() || this.estrellas()]);
  etiquetasDisponibles = computed(() => ETIQUETAS_EVALUACION[(this.evaluado()?.rol ?? 'funcionario') as Rol] ?? []);
  g = computed(() => (this.evaluado() ? calcularGamificacion(this.evaluado()) : null));
  editando = computed(() => !!this.evaluacionId());

  constructor(private route: ActivatedRoute, private router: Router, private supabaseService: SupabaseService) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    this.evaluadoId = this.route.snapshot.paramMap.get('id') || '';
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.usuarioActualId = user.id;

    if (!this.evaluadoId) { this.error.set('Falta indicar a quién quieres calificar.'); this.cargando.set(false); return; }
    if (this.usuarioActualId === this.evaluadoId) { this.error.set('No puedes calificarte a ti mismo.'); this.cargando.set(false); return; }

    try {
      const [perfil, yo, permiso, previa] = await Promise.all([
        this.db.from('perfiles')
          .select('id, nombre_completo, rol, verificado, zona_ubicacion, avatar_icono, avatar_color, promedio_estrellas, total_evaluaciones')
          .eq('id', this.evaluadoId).maybeSingle(),
        this.db.from('perfiles').select('rol').eq('id', user.id).maybeSingle(),
        this.db.rpc('puede_evaluar', { a: this.usuarioActualId, b: this.evaluadoId }),
        this.db.from('evaluaciones').select('id, estrellas, comentario, etiquetas')
          .eq('evaluador_id', this.usuarioActualId).eq('evaluado_id', this.evaluadoId).maybeSingle(),
      ]);

      if (!perfil.data) { this.error.set('No se encontró el perfil que quieres calificar.'); return; }
      this.evaluado.set(perfil.data);
      this.miRol = yo.data?.rol ?? '';

      // sólo se califica a quien tuviste un trato real (lo valida también la base de datos)
      if (permiso.data !== true && !previa.data) {
        this.error.set('Sólo puedes calificar a personas con las que tuviste un trabajo, una postulación aceptada o un equipo en común.');
        return;
      }

      if (previa.data) {
        this.evaluacionId.set(previa.data.id);
        this.estrellas.set(previa.data.estrellas);
        this.etiquetas.set(previa.data.etiquetas ?? []);
        this.comentario = previa.data.comentario ?? '';
      }
    } catch (e) {
      console.error(e);
      this.error.set('No se pudo cargar la información. Intenta de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  elegirEstrellas(n: number) { this.estrellas.set(n); }

  /** Permite elegir con las flechas del teclado (accesibilidad). */
  teclado(ev: KeyboardEvent) {
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') { ev.preventDefault(); this.estrellas.update(n => Math.min(5, n + 1)); }
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') { ev.preventDefault(); this.estrellas.update(n => Math.max(1, n - 1)); }
  }

  toggleEtiqueta(e: string) {
    const lista = this.etiquetas();
    if (lista.includes(e)) { this.etiquetas.set(lista.filter(x => x !== e)); return; }
    if (lista.length >= this.maxEtiquetas) { this.notificar(`Puedes elegir hasta ${this.maxEtiquetas} etiquetas.`, 'error'); return; }
    this.etiquetas.set([...lista, e]);
  }

  get comentarioValido(): boolean {
    const n = this.comentario.trim().length;
    return n >= this.minComentario && n <= this.maxComentario;
  }

  async enviar() {
    if (!this.comentarioValido) {
      this.notificar(`Cuéntanos tu experiencia en al menos ${this.minComentario} caracteres.`, 'error');
      return;
    }
    this.enviando.set(true);
    try {
      const datos = { estrellas: this.estrellas(), comentario: this.comentario.trim(), etiquetas: this.etiquetas() };

      // El promedio y el total del evaluado los recalcula un trigger en el servidor.
      const { error } = this.evaluacionId()
        ? await this.db.from('evaluaciones').update(datos).eq('id', this.evaluacionId()!)
        : await this.db.from('evaluaciones').insert([{ evaluador_id: this.usuarioActualId, evaluado_id: this.evaluadoId, ...datos }]);

      if (error) {
        if (error.code === '23505') throw new Error('Ya calificaste a esta persona. Recarga para editar tu reseña.');
        throw error;
      }

      this.notificar(this.editando() ? 'Reseña actualizada.' : 'Reseña publicada. Gracias por ayudar a la comunidad.');
      setTimeout(() => this.volver(), 1100);
    } catch (e: any) {
      console.error(e);
      this.notificar(e?.message ?? 'No se pudo enviar. Intenta de nuevo.', 'error');
    } finally {
      this.enviando.set(false);
    }
  }

  async eliminar() {
    const id = this.evaluacionId();
    if (!id || !confirm('Eliminar tu reseña?')) return;
    const { error } = await this.db.from('evaluaciones').delete().eq('id', id);
    if (error) return this.notificar(error.message, 'error');
    this.notificar('Reseña eliminada.');
    setTimeout(() => this.volver(), 900);
  }

  volver() { this.router.navigate([ROL_PANEL[this.miRol] ?? '/feed']); }

  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 3500);
  }
}