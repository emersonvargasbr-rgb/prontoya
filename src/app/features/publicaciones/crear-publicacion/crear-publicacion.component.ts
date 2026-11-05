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

  maquinariaOficial = [
    { id: 'RETA', nombre: 'Máquina Reta (Recta)' },
    { id: 'OVERLOCK', nombre: 'Overlock (Remalladora)' },
    { id: 'GALONEIRA', nombre: 'Galoneira (Collaretera)' },
    { id: 'BOTONEIRA', nombre: 'Botoneira (Botones)' },
    { id: 'CASEADEIRA', nombre: 'Caseadeira (Ojales)' },
    { id: 'TRAVETE', nombre: 'Travete (Presillas)' }
  ];

  publicacion = {
    tipo_publicacion: 'busco_corte',
    titulo: '',
    descripcion: '',
    cantidad_piezas: null as number | null,
    pago_por_pieza: null as number | null,
    maquinas_requeridas: [] as string[],
    zona_ubicacion: 'Brás',
    logistica_entrega: 'acuerdo_mutuo',
    
    // Campos específicos para Empleo y Funcionarios (Cama dentro/fuera, Casal, etc.)
    puesto_trabajo: 'Costurero(a) Overlock/Reta',
    modalidad_pago: 'por_pieza',
    modalidad_alojamiento: 'cama_fuera',
    modalidad_contratacion: 'individual',
    ofrece_alojamiento: false,
    ofrece_comida: false
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
      await this.obtenerRolYConfigurarTipo(user.id);
    } else {
      this.router.navigate(['/login']);
    }
  }

  async obtenerRolYConfigurarTipo(userId: string) {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('perfiles')
        .select('rol, zona_ubicacion')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        this.rolUsuario = data.rol;
        if (data.zona_ubicacion) {
          this.publicacion.zona_ubicacion = data.zona_ubicacion;
        }

        if (this.rolUsuario === 'tienda') {
          this.publicacion.tipo_publicacion = 'busco_oficina';
        } else if (this.rolUsuario === 'oficina') {
          this.publicacion.tipo_publicacion = 'busco_corte';
        } else if (this.rolUsuario === 'funcionario') {
          this.publicacion.tipo_publicacion = 'busco_trabajo';
        }
      }
    } catch (e) {
      console.error('Error al obtener el rol del perfil:', e);
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
  }

  async onSubmit() {
    if (this.publicacion.maquinas_requeridas.length === 0) {
      this.mensajeError = 'Debes seleccionar al menos una máquina requerida/utilizada.';
      this.cdr.detectChanges();
      return;
    }

    this.cargando = true;
    this.mensajeError = '';
    this.cdr.detectChanges();

    // Armamos el payload con todos los campos nuevos adaptados
    const payload: any = {
      creador_id: this.usuarioId,
      tipo_publicacion: this.publicacion.tipo_publicacion,
      titulo: this.publicacion.titulo,
      descripcion: this.publicacion.descripcion || '',
      cantidad_piezas: Number(this.publicacion.cantidad_piezas) || 0,
      pago_por_pieza: Number(this.publicacion.pago_por_pieza) || 0,
      maquinas_requeridas: this.publicacion.maquinas_requeridas,
      zona_ubicacion: this.publicacion.zona_ubicacion,
      estado: 'Activo'
    };

    // Si es oferta de empleo, incluimos los campos específicos de personal
    if (this.publicacion.tipo_publicacion === 'busco_funcionario') {
      payload.puesto_trabajo = this.publicacion.puesto_trabajo;
      payload.modalidad_pago = this.publicacion.modalidad_pago;
      payload.modalidad_alojamiento = this.publicacion.modalidad_alojamiento;
      payload.modalidad_contratacion = this.publicacion.modalidad_contratacion;
      payload.ofrece_alojamiento = this.publicacion.ofrece_alojamiento;
      payload.ofrece_comida = this.publicacion.ofrece_comida;
      payload.logistica_entrega = 'No aplica';
    } else {
      payload.logistica_entrega = this.publicacion.logistica_entrega;
    }

    try {
      const { data, error } = await this.supabaseService.supabase
        .from('publicaciones')
        .insert([payload])
        .select('id')
        .single();

      if (error) throw error;

      this.generarTextoAnuncio(data.id);
      this.publicacionExitosa = true;

    } catch (error: any) {
      this.mensajeError = `Error al publicar: ${error?.message || 'Revisa los datos.'}`;
      console.error(error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  generarTextoAnuncio(idPublicacion: string) {
    const baseUrl = window.location.origin;
    const enlace = `${baseUrl}/trabajo/${idPublicacion}`;
    const maquinas = this.publicacion.maquinas_requeridas.join(', ');
    
    if (this.publicacion.tipo_publicacion === 'busco_funcionario') {
      const alojamientoTexto = this.publicacion.modalidad_alojamiento === 'cama_dentro' ? '🏠 Cama Dentro (Con vivienda)' : '🚶‍♂️ Cama Fuera';
      const contratacionTexto = this.publicacion.modalidad_contratacion === 'casal' ? '👥 Acepta Casal (Pareja)' : '👤 Individual';
      const beneficios = [
        this.publicacion.ofrece_alojamiento ? '🏠 Vivienda' : '',
        this.publicacion.ofrece_comida ? '🍲 Comida' : ''
      ].filter(Boolean).join(' | ');

      this.textoGenerado = `👥 SE BUSCA PERSONAL DE COSTURA (${this.publicacion.zona_ubicacion}) 🚀\n` +
        `💼 Puesto: ${this.publicacion.puesto_trabajo}\n` +
        `🏠 Modalidad: ${alojamientoTexto} | ${contratacionTexto}\n` +
        `👕 Prenda: ${this.publicacion.titulo}\n` +
        `🧵 Máquinas: ${maquinas}\n` +
        `💰 Pago: R$ ${this.publicacion.pago_por_pieza}\n` +
        (beneficios ? `✨ Beneficios: ${beneficios}\n` : '') +
        `\n📲 Postúlate y revisa detalles aquí:\n${enlace}`;
    } else {
      let tipoTexto = this.publicacion.tipo_publicacion === 'busco_oficina' ? '🏪 TIENDA BUSCA TALLER' : '✂️ TALLER BUSCA CORTE';
      this.textoGenerado = `${tipoTexto} (${this.publicacion.zona_ubicacion}) 🚀\n` +
        `👕 Prenda: ${this.publicacion.titulo}\n` +
        `📦 Cantidad: ${this.publicacion.cantidad_piezas} piezas\n` +
        `🧵 Maquinaria: ${maquinas}\n` +
        `💰 Pago: R$ ${this.publicacion.pago_por_pieza} / pieza\n` +
        `🚚 Transporte: ${this.publicacion.logistica_entrega}\n\n` +
        `📲 Ver detalles aquí:\n${enlace}`;
    }
  }

  copiarAlPortapapeles() {
    navigator.clipboard.writeText(this.textoGenerado).then(() => {
      alert('¡Anuncio copiado para redes sociales!');
      const rutaPanel = this.rolUsuario === 'tienda' ? '/panel-tienda' : 
                        this.rolUsuario === 'oficina' ? '/panel-oficina' : '/panel-funcionario';
      this.router.navigate([rutaPanel]);
    });
  }
}