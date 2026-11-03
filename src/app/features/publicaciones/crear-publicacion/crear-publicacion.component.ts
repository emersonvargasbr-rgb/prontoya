import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-crear-publicacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './crear-publicacion.component.html'
})
export class CrearPublicacionComponent implements OnInit {
  usuarioId: string = '';
  rolUsuario: string = ''; // Para saber si es Tienda u Oficina y ajustar los textos
  cargando = false;
  mensajeError = '';
  
  // Estado de éxito para mostrar el copy de Facebook
  publicacionExitosa = false;
  textoGenerado = '';

  // Catálogo oficial estricto para evitar duplicados en la BD (São Paulo standards)
  maquinariaOficial = [
    { id: 'RETA', nombre: 'Máquina Reta (Recta)' },
    { id: 'OVERLOCK', nombre: 'Overlock (Remalladora)' },
    { id: 'GALONEIRA', nombre: 'Galoneira (Collaretera)' },
    { id: 'BOTONEIRA', nombre: 'Botoneira (Botones)' },
    { id: 'CASEADEIRA', nombre: 'Caseadeira (Ojales)' },
    { id: 'TRAVETE', nombre: 'Travete (Presillas)' }
  ];

  publicacion = {
    tipo_publicacion: 'busco_taller', // Por defecto si publica tienda
    titulo: '',
    descripcion: '',
    cantidad_piezas: null as number | null,
    pago_por_pieza: null as number | null,
    maquinas_requeridas: [] as string[],
    zona: 'São Paulo - SP'
  };

  constructor(private supabaseService: SupabaseService, private router: Router) {}

  async ngOnInit() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioId = user.id;
      await this.obtenerRolYConfigurarTipo(user.id);
    } else {
      this.router.navigate(['/login']);
    }
  }

  // Detectamos si el que publica es Tienda u Oficina para ajustar el tipo de oferta
  async obtenerRolYConfigurarTipo(userId: string) {
    const { data } = await this.supabaseService.supabase
      .from('perfiles')
      .select('rol')
      .eq('id', userId)
      .single();

    if (data) {
      this.rolUsuario = data.rol;
      // Si es tienda, busca taller. Si es oficina, busca funcionario (costurero).
      this.publicacion.tipo_publicacion = this.rolUsuario === 'tienda' ? 'busco_taller' : 'busco_funcionario';
    }
  }

  // --- LÓGICA DE SELECCIÓN DE MÁQUINAS (CHECKBOXES) ---
  onMaquinaChange(event: any) {
    const valor = event.target.value;
    if (event.target.checked) {
      if (!this.publicacion.maquinas_requeridas.includes(valor)) {
        this.publicacion.maquinas_requeridas.push(valor);
      }
    } else {
      this.publicacion.maquinas_requeridas = this.publicacion.maquinas_requeridas.filter(m => m !== valor);
    }
  }

  // --- LÓGICA DE GUARDADO EN BASE DE DATOS ---
  async onSubmit() {
    if (this.publicacion.maquinas_requeridas.length === 0) {
      this.mensajeError = 'Debes seleccionar al menos una máquina requerida.';
      return;
    }

    this.cargando = true;
    this.mensajeError = '';

    try {
      const { data, error } = await this.supabaseService.supabase
        .from('publicaciones')
        .insert([{
          creador_id: this.usuarioId,
          tipo_publicacion: this.publicacion.tipo_publicacion,
          titulo: this.publicacion.titulo,
          descripcion: this.publicacion.descripcion,
          cantidad_piezas: this.publicacion.cantidad_piezas,
          pago_por_pieza: this.publicacion.pago_por_pieza,
          maquinas_requeridas: this.publicacion.maquinas_requeridas,
          zona: this.publicacion.zona
        }])
        .select('id')
        .single();

      if (error) throw error;

      this.generarTextoFacebook(data.id);
      this.publicacionExitosa = true;

    } catch (error: any) {
      this.mensajeError = 'Hubo un error al publicar. Intenta de nuevo.';
      console.error(error);
    } finally {
      this.cargando = false;
    }
  }

  // --- COPY PARA FACEBOOK / GRUPOS DE ROPA ---
  generarTextoFacebook(idPublicacion: string) {
    const enlace = `https://tu-app.com/trabajo/${idPublicacion}`;
    const maquinas = this.publicacion.maquinas_requeridas.join(', ');
    const rolTexto = this.rolUsuario === 'tienda' ? '🏪 Tienda busca Taller' : '✂️ Oficina busca Costurero';

    this.textoGenerado = `🚀 NUEVO CORTE DISPONIBLE (${rolTexto}) 🚀\n` +
      `👕 Prenda: ${this.publicacion.titulo}\n` +
      `📦 Cantidad: ${this.publicacion.cantidad_piezas} piezas\n` +
      `🧵 Maquinaria: ${maquinas}\n` +
      `💰 Pago: R$ ${this.publicacion.pago_por_pieza} / pieza\n\n` +
      `📲 Revisa los detalles y contáctanos aquí:\n${enlace}`;
  }

  copiarAlPortapapeles() {
    navigator.clipboard.writeText(this.textoGenerado).then(() => {
      alert('¡Anuncio copiado para Facebook/WhatsApp!');
      const rutaPanel = this.rolUsuario === 'tienda' ? '/panel-tienda' : '/panel-oficina';
      this.router.navigate([rutaPanel]);
    });
  }
}