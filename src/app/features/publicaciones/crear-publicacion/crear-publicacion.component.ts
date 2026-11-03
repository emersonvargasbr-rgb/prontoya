import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  rolUsuario: string = '';
  cargando = false;
  mensajeError = '';
  
  publicacionExitosa = false;
  textoGenerado = '';

  // Catálogo oficial industrial textil (São Paulo standards)
  maquinariaOficial = [
    { id: 'RETA', nombre: 'Máquina Reta (Recta)' },
    { id: 'OVERLOCK', nombre: 'Overlock (Remalladora)' },
    { id: 'GALONEIRA', nombre: 'Galoneira (Collaretera)' },
    { id: 'BOTONEIRA', nombre: 'Botoneira (Botones)' },
    { id: 'CASEADEIRA', nombre: 'Caseadeira (Ojales)' },
    { id: 'TRAVETE', nombre: 'Travete (Presillas)' }
  ];

  publicacion = {
    tipo_publicacion: 'busco_oficina', 
    titulo: '',
    descripcion: '',
    cantidad_piezas: null as number | null,
    pago_por_pieza: null as number | null,
    maquinas_requeridas: [] as string[],
    zona: 'São Paulo - SP' // (Solo visual para el usuario, no va a la BD)
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
      console.log('👤 Usuario autenticado detectado:', this.usuarioId);
      await this.obtenerRolYConfigurarTipo(user.id);
    } else {
      console.warn('⚠️ No hay sesión activa, redirigiendo a login...');
      this.router.navigate(['/login']);
    }
  }

  async obtenerRolYConfigurarTipo(userId: string) {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('perfiles')
        .select('rol')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        this.rolUsuario = data.rol;
        this.publicacion.tipo_publicacion = this.rolUsuario === 'tienda' ? 'busco_oficina' : 'busco_funcionario';
        console.log('🛠️ Rol obtenido de la BD:', this.rolUsuario);
        console.log('📌 Tipo de publicación asignado:', this.publicacion.tipo_publicacion);
      }
    } catch (e) {
      console.error('❌ Error al obtener el rol del perfil:', e);
    } finally {
      this.cdr.detectChanges();
    }
  }

  onMaquinaChange(event: any) {
    const valor = event.target.value;
    if (event.target.checked) {
      if (!this.publicacion.maquinas_requeridas.includes(valor)) {
        this.publicacion.maquinas_requeridas.push(valor);
      }
    } else {
      this.publicacion.maquinas_requeridas = this.publicacion.maquinas_requeridas.filter(m => m !== valor);
    }
    console.log('🧵 Máquinas requeridas actualizadas:', this.publicacion.maquinas_requeridas);
  }

  async onSubmit() {
    if (this.publicacion.maquinas_requeridas.length === 0) {
      this.mensajeError = 'Debes seleccionar al menos una máquina requerida.';
      this.cdr.detectChanges();
      return;
    }

    this.cargando = true;
    this.mensajeError = '';
    this.cdr.detectChanges();

    // Armamos el payload exacto para depuración en consola (F12)
    const payload = {
      creador_id: this.usuarioId,
      tipo_publicacion: this.publicacion.tipo_publicacion,
      titulo: this.publicacion.titulo,
      descripcion: this.publicacion.descripcion || '',
      cantidad_piezas: Number(this.publicacion.cantidad_piezas),
      pago_por_pieza: Number(this.publicacion.pago_por_pieza),
      maquinas_requeridas: this.publicacion.maquinas_requeridas,
      estado: 'Activo'
    };

    console.log('🚀 Payload listo para enviar a Supabase:', payload);

    try {
      const { data, error } = await this.supabaseService.supabase
        .from('publicaciones')
        .insert([payload])
        .select('id')
        .single();

      if (error) {
        console.error('❌ Error devuelto por Supabase:', error);
        throw error;
      }

      console.log('✅ Publicación creada con éxito. ID:', data.id);
      this.generarTextoFacebook(data.id);
      this.publicacionExitosa = true;

    } catch (error: any) {
      this.mensajeError = `Hubo un error al publicar: ${error?.message || 'Revisa los datos.'}`;
      console.error('💥 Excepción atrapada en onSubmit:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  generarTextoFacebook(idPublicacion: string) {
    const baseUrl = window.location.origin;
    const enlace = `${baseUrl}/trabajo/${idPublicacion}`;
    const maquinas = this.publicacion.maquinas_requeridas.join(', ');
    const rolTexto = this.rolUsuario === 'tienda' ? '🏪 Tienda busca Taller / Oficina' : '✂️ Oficina busca Costurero';

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