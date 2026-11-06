import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-editar-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editar-perfil.component.html'
})
export class EditarPerfilComponent implements OnInit {
  usuarioId: string = '';
  guardando = false;

  coloresDisponibles = [
    { hex: '#0f172a', nombre: 'Slate Dark' },
    { hex: '#1e3a8a', nombre: 'Azul Real' },
    { hex: '#047857', nombre: 'Verde Esmeralda' },
    { hex: '#7c3aed', nombre: 'Púrpura' },
    { hex: '#c2410c', nombre: 'Terracota' },
    { hex: '#be123c', nombre: 'Bordó' }
  ];

  animalesSvg = [
    { id: 'tigre', emoji: '🐯' },
    { id: 'leon', emoji: '🦁' },
    { id: 'oso', emoji: '🐻' },
    { id: 'zorro', emoji: '🦊' },
    { id: 'aguila', emoji: '🦅' },
    { id: 'buho', emoji: '🦉' }
  ];

  perfil: any = {
    nombre_completo: '',
    especialidad_principal: 'Costura y Confeccion Completa',
    color_portada: '#0f172a',
    color_texto_portada: '#ffffff',
    avatar_svg_id: 'tigre',
    cantidad_maquinas: 0,
    cantidad_operarios: 0,
    cep: '',
    cnpj: '',
    visibilidad_whatsapp: 'publico',
    visibilidad_direccion: 'conectados',
    visibilidad_cnpj: 'privado'
  };

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioId = user.id;
      await this.cargarPerfil();
    } else {
      this.router.navigate(['/login']);
    }
  }

  async cargarPerfil() {
    const { data } = await this.supabaseService.supabase
      .from('perfiles')
      .select('*')
      .eq('id', this.usuarioId)
      .single();

    if (data) {
      this.perfil = { ...this.perfil, ...data };
    }
    this.cdr.detectChanges();
  }

  seleccionarColor(hex: string) {
    this.perfil.color_portada = hex;
    // Cálculo automático de contraste del texto
    this.perfil.color_texto_portada = '#ffffff';
  }

  getAvatarSvg(id: string): string {
    const mapa: any = { tigre: '🐯', leon: '🦁', oso: '🐻', zorro: '🦊', aguila: '🦅', buho: '🦉' };
    return mapa[id] || '🧵';
  }

  async guardarPerfil() {
    this.guardando = true;
    try {
      const { error } = await this.supabaseService.supabase
        .from('perfiles')
        .update(this.perfil)
        .eq('id', this.usuarioId);

      if (error) throw error;
      alert('¡Perfil Pro actualizado con éxito!');
      this.volverAlPanel();
    } catch (e: any) {
      alert('Error al guardar: ' + e?.message);
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  volverAlPanel() {
    this.router.navigate(['/panel-oficina']);
  }
}