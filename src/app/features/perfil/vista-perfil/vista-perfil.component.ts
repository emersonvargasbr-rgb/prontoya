import { Component, OnInit, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { SocialService } from '../../../core/services/social.service';
import { StarRatingComponent } from '../../../shared/components/star-rating/star-rating.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { abrirWhatsApp } from '../../../core/utils/helpers';

@Component({
  selector: 'app-vista-perfil',
  standalone: true,
  imports: [CommonModule, RouterModule, StarRatingComponent, IconComponent, AvatarComponent],
  templateUrl: './vista-perfil.component.html'
})
export class VistaPerfilComponent implements OnInit {
  perfilId = '';
  perfil = signal<any>(null);
  evaluaciones = signal<any[]>([]);
  stats = signal({ seguidores: 0, siguiendo: 0 });
  siguiendo = signal(false);
  cargando = signal(true);
  error = signal('');

  constructor(
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private social: SocialService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.perfilId = id;
      await this.cargarPerfil(id);
    } else {
      this.error.set('Identificador de perfil no válido.');
      this.cargando.set(false);
    }
  }

async cargarPerfil(id: string) {
    this.cargando.set(true);
    try {
      // 1. Cargar perfil, reseñas y stats en paralelo
      const [perfilRes, evalRes, statsRes] = await Promise.all([
        this.supabaseService.supabase.from('perfiles').select('*').eq('id', id).single(),
        this.supabaseService.supabase
          .from('evaluaciones')
          .select('estrellas, comentario, etiquetas, created_at, evaluador:evaluador_id (nombre_completo)')
          .eq('evaluado_id', id)
          .order('created_at', { ascending: false }),
        this.social.contar(id)
      ]);

      if (perfilRes.error) throw perfilRes.error;

      this.perfil.set(perfilRes.data);
      this.stats.set(statsRes);

      // 2. Comprobar si el usuario actual ya sigue a este perfil con 1 solo argumento
      const { data: { session } } = await this.supabaseService.supabase.auth.getSession();
      if (session?.user && session.user.id !== id) {
        const yaSigue = await this.social.estaSiguiendo(id);
        this.siguiendo.set(!!yaSigue);
      }

      if (evalRes.data) {
        const evalsFormateadas = evalRes.data.map((e: any) => {
          const evaluador = Array.isArray(e.evaluador) ? e.evaluador[0] : e.evaluador;
          return {
            ...e,
            evaluador_nombre: evaluador?.nombre_completo || 'Usuario de la plataforma',
            fecha: new Date(e.created_at).toLocaleDateString()
          };
        });
        this.evaluaciones.set(evalsFormateadas);
      }

    } catch (e: any) {
      console.error(e);
      this.error.set('No se pudo cargar la información de este usuario.');
    } finally {
      this.cargando.set(false);
      this.cdr.detectChanges();
    }
  }

  async toggleSeguir() {
    const { data: { session } } = await this.supabaseService.supabase.auth.getSession();
    if (!session?.user) {
      alert('Debes iniciar sesión para seguir a este usuario.');
      return;
    }

    if (session.user.id === this.perfilId) return;

    try {
      if (this.siguiendo()) {
        await this.social.dejarDeSeguir(this.perfilId);
        this.siguiendo.set(false);
        this.stats.update(s => ({ ...s, seguidores: Math.max(0, s.seguidores - 1) }));
      } else {
        await this.social.seguir(this.perfilId);
        this.siguiendo.set(true);
        this.stats.update(s => ({ ...s, seguidores: s.seguidores + 1 }));
      }
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Error al cambiar estado de seguimiento:', e);
    }
  }

  whatsapp() {
    const p = this.perfil();
    if (!p?.telefono) return alert('Este usuario no tiene un teléfono de contacto visible.');
    abrirWhatsApp(p.telefono, p.nombre_completo, 'Consulta desde CosturaPronta');
  }
}