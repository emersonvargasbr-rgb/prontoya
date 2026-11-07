import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

export interface InsigniaGamificada {
  id: string;
  nombre: string;
  descripcion: string;
  iconoSvg: string;
  desbloqueada: boolean;
  categoria: 'experiencia' | 'calidad' | 'velocidad' | 'verificacion';
}

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
  cortesAsignados: any[] = []; // 👈 Lotes asignados por talleres u oficinas
  pestanaActiva: 'perfil_pro' | 'cortes' | 'empleos' | 'conquistas' | 'reputacion' = 'perfil_pro';

  // Sistema Gamificado (Gamification Engine)
  nivelTexto: string = 'Costurero Pro';
  nivelNumero: number = 1;
  puntosXP: number = 0;
  porcentajeSiguienteNivel: number = 0;
  insignias: InsigniaGamificada[] = [];

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

      // 2. Cargar postulaciones del operario a vacantes
      const { data: posts, error: errPosts } = await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .select(`
          id,
          estado,
          created_at,
          publicacion:publicacion_id (id, titulo, cantidad_piezas, pago_por_pieza, creador:creador_id (nombre_completo, zona_ubicacion, telefono, verificado))
        `)
        .eq('taller_id', this.usuarioId)
        .order('created_at', { ascending: false });

      if (!errPosts) {
        this.misPostulaciones = (posts || []).map((p: any) => ({
          ...p,
          publicacion_info: Array.isArray(p.publicacion) ? p.publicacion[0] : p.publicacion
        }));
      }

      // 3. Cargar cortes asignados directamente al funcionario
      const { data: cortes, error: errCortes } = await this.supabaseService.supabase
        .from('asignaciones_funcionarios')
        .select(`
          *,
          empleador:empleador_id (nombre_completo, telefono, zona_ubicacion)
        `)
        .eq('funcionario_id', this.usuarioId)
        .in('estado', ['Asignado', 'En Confección'])
        .order('fecha_inicio', { ascending: false });

      if (!errCortes) {
        this.cortesAsignados = (cortes || []).map((c: any) => ({
          ...c,
          empleador: Array.isArray(c.empleador) ? c.empleador[0] : c.empleador
        }));
      }

      // 4. Cargar evaluaciones o calificaciones recibidas
      const { data: evals, error: errEvals } = await this.supabaseService.supabase
        .from('evaluaciones')
        .select(`
          id,
          estrellas,
          comentario,
          created_at,
          evaluador:evaluador_id (nombre_completo, avatar_svg_id)
        `)
        .eq('evaluado_id', this.usuarioId)
        .order('created_at', { ascending: false });

      if (!errEvals) {
        this.evaluacionesRecibidas = (evals || []).map((e: any) => ({
          ...e,
          evaluador_nombre: Array.isArray(e.evaluador) ? e.evaluador[0]?.nombre_completo : e.evaluador?.nombre_completo
        }));
      }

      // 5. Calcular Gamificación y Rango Textil
      this.calcularGamificacion();

    } catch (e) {
      console.error('Error cargando panel de funcionario:', e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  // Marcar lote en proceso de confección
  async marcarEnConfeccion(asignacionId: string) {
    try {
      const { error } = await this.supabaseService.supabase
        .from('asignaciones_funcionarios')
        .update({ estado: 'En Confección' })
        .eq('id', asignacionId);

      if (error) throw error;
      await this.cargarDatosFuncionario();
    } catch (e: any) {
      alert('Error al actualizar estado: ' + e?.message);
    }
  }

  // Motor Gamificado de Niveles e Insignias Textil
  calcularGamificacion() {
    const totalEvals = this.evaluacionesRecibidas.length;
    const promedio = this.perfil?.promedio_estrellas || 5.0;
    const postAceptadas = this.misPostulaciones.filter(p => p.estado === 'Aceptado').length;

    // Cálculo de Experiencia XP
    this.puntosXP = (totalEvals * 150) + (postAceptadas * 200) + (this.perfil?.verificado ? 300 : 0);

    // Sistema de Rangos / Niveles Escalables
    if (this.puntosXP < 300) {
      this.nivelNumero = 1;
      this.nivelTexto = 'Operario Bronce';
      this.porcentajeSiguienteNivel = Math.min(100, Math.floor((this.puntosXP / 300) * 100));
    } else if (this.puntosXP < 800) {
      this.nivelNumero = 2;
      this.nivelTexto = 'Operario Plata';
      this.porcentajeSiguienteNivel = Math.min(100, Math.floor(((this.puntosXP - 300) / 500) * 100));
    } else if (this.puntosXP < 1500) {
      this.nivelNumero = 3;
      this.nivelTexto = 'Costurero Gold 🌟';
      this.porcentajeSiguienteNivel = Math.min(100, Math.floor(((this.puntosXP - 800) / 700) * 100));
    } else if (this.puntosXP < 3000) {
      this.nivelNumero = 4;
      this.nivelTexto = 'Especialista Pro Diamond 💎';
      this.porcentajeSiguienteNivel = Math.min(100, Math.floor(((this.puntosXP - 1500) / 1500) * 100));
    } else {
      this.nivelNumero = 5;
      this.nivelTexto = 'Mestre de Costura Master 👑';
      this.porcentajeSiguienteNivel = 100;
    }

    // Catálogo de Insignias Escalables Desbloqueables
    this.insignias = [
      {
        id: 'verificado',
        nombre: 'Identidad Verificada',
        descripcion: 'Documentación técnica y datos confirmados por CosturaPronta.',
        iconoSvg: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        desbloqueada: !!this.perfil?.verificado,
        categoria: 'verificacion'
      },
      {
        id: 'estrella_cinco',
        nombre: 'Calidad 5 Estrellas',
        descripcion: 'Mantener una reputación perfecta en trabajos terminados.',
        iconoSvg: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
        desbloqueada: promedio >= 4.8 && totalEvals > 0,
        categoria: 'calidad'
      },
      {
        id: 'multi_maquina',
        nombre: 'Dominio Multi-Máquinas',
        descripcion: 'Capacidad demostrada en 3 o más máquinas industriales (Overlock, Galoneira, Reta).',
        iconoSvg: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
        desbloqueada: (this.perfil?.maquinas_maneja || []).length >= 3,
        categoria: 'experiencia'
      },
      {
        id: 'primer_contrato',
        nombre: 'Primera Contratación',
        descripcion: 'Completar tu primer trabajo con éxito en la plataforma.',
        iconoSvg: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
        desbloqueada: postAceptadas > 0,
        categoria: 'velocidad'
      }
    ];
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
    } catch (e) {
      console.error('Error al actualizar estado laboral:', e);
    } finally {
      this.cdr.detectChanges();
    }
  }

  contactarWhatsApp(telefono: string, nombre: string) {
    if (!telefono) return;
    const limpio = telefono.replace(/\D/g, '');
    const mensaje = `Hola ${nombre}, me pongo en contacto desde CosturaPronta respecto al trabajo de confección.`;
    window.open(`https://wa.me/${limpio}?text=${encodeURIComponent(mensaje)}`, '_blank');
  }

  getAvatarEmoji(id: string): string {
    const mapa: any = { tigre: '🐯', leon: '🦁', oso: '🐻', zorro: '🦊', aguila: '🦅', buho: '🦉' };
    return mapa[id] || '👤';
  }
}