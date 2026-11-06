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
    { id: 'RETA', nombre: 'Reta (Recta)' },
    { id: 'OVERLOCK', nombre: 'Overlock' },
    { id: 'GALONEIRA', nombre: 'Galoneira' },
    { id: 'BOTONEIRA', nombre: 'Botoneira' },
    { id: 'CASEADEIRA', nombre: 'Caseadeira' },
    { id: 'TRAVETE', nombre: 'Travete' }
  ];

  publicacion = {
    tipo_publicacion: 'busco_corte',
    titulo: '',
    descripcion: '',
    cantidad_piezas: null as number | null,
    pago_por_pieza: null as number | null,
    maquinas_requeridas: [] as string[],
    zona_ubicacion: 'Brás',
    logistica_entrega: 'oficina_retira',
    
    // Especialización de Taller
    especialidad_taller: 'Costura y Confeccion Completa',
    tipo_tejido: 'Malla (Malharia)',
    modalidad_trabajo: 'Ambos',
    capacidad_produccion: '',

    // Empleo y Funcionarios
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
      const { data } = await this.supabaseService.supabase
        .from('perfiles')
        .select('rol, zona_ubicacion')
        .eq('id', userId)
        .single();

      if (data) {
        this.rolUsuario = data.rol;
        if (data.zona_ubicacion) this.publicacion.zona_ubicacion = data.zona_ubicacion;

        if (this.rolUsuario === 'tienda') {
          this.publicacion.tipo_publicacion = 'busco_oficina';
        } else if (this.rolUsuario === 'oficina') {
          this.publicacion.tipo_publicacion = 'busco_corte';
        } else if (this.rolUsuario === 'funcionario') {
          this.publicacion.tipo_publicacion = 'busco_trabajo';
        }
      }
    } catch (e) {
      console.error('Error al obtener rol:', e);
    } finally {
      this.cdr.detectChanges();
    }
  }

  // Selección interactiva de chips de maquinaria
  isMaquinaSelected(id: string): boolean {
    return this.publicacion.maquinas_requeridas.includes(id);
  }

  toggleMaquina(id: string) {
    if (this.isMaquinaSelected(id)) {
      this.publicacion.maquinas_requeridas = this.publicacion.maquinas_requeridas.filter(m => m !== id);
    } else {
      this.publicacion.maquinas_requeridas.push(id);
    }
  }

  async onSubmit() {
    if (this.publicacion.maquinas_requeridas.length === 0) {
      this.mensajeError = 'Selecciona al menos una máquina utilizada o requerida.';
      this.cdr.detectChanges();
      return;
    }

    this.cargando = true;
    this.mensajeError = '';
    this.cdr.detectChanges();

    const payload: any = {
      creador_id: this.usuarioId,
      tipo_publicacion: this.publicacion.tipo_publicacion,
      titulo: this.publicacion.titulo,
      descripcion: this.publicacion.descripcion || '',
      cantidad_piezas: Number(this.publicacion.cantidad_piezas) || 0,
      pago_por_pieza: Number(this.publicacion.pago_por_pieza) || 0,
      maquinas_requeridas: this.publicacion.maquinas_requeridas,
      zona_ubicacion: this.publicacion.zona_ubicacion,
      logistica_entrega: this.publicacion.logistica_entrega,
      estado: 'Activo'
    };

    if (this.publicacion.tipo_publicacion === 'busco_corte') {
      payload.especialidad_taller = this.publicacion.especialidad_taller;
      payload.tipo_tejido = this.publicacion.tipo_tejido;
      payload.modalidad_trabajo = this.publicacion.modalidad_trabajo;
      payload.capacidad_produccion = this.publicacion.capacidad_produccion;
    } else if (this.publicacion.tipo_publicacion === 'busco_funcionario') {
      payload.puesto_trabajo = this.publicacion.puesto_trabajo;
      payload.modalidad_pago = this.publicacion.modalidad_pago;
      payload.modalidad_alojamiento = this.publicacion.modalidad_alojamiento;
      payload.modalidad_contratacion = this.publicacion.modalidad_contratacion;
      payload.ofrece_alojamiento = this.publicacion.ofrece_alojamiento;
      payload.ofrece_comida = this.publicacion.ofrece_comida;
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
      this.mensajeError = `Error al guardar: ${error?.message || 'Intente de nuevo.'}`;
      console.error(error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  generarTextoAnuncio(idPublicacion: string) {
    const enlace = `${window.location.origin}/trabajo/${idPublicacion}`;
    const maquinas = this.publicacion.maquinas_requeridas.join(', ');

    if (this.publicacion.tipo_publicacion === 'busco_corte') {
      this.textoGenerado = `✂️ TALLER DISPONIBLE BUSCA CORTE (${this.publicacion.zona_ubicacion}) 🚀\n` +
        `🛠️ Servicio: ${this.publicacion.especialidad_taller}\n` +
        `🧵 Tejido: ${this.publicacion.tipo_tejido}\n` +
        `📋 Modalidad: ${this.publicacion.modalidad_trabajo}\n` +
        `⚡ Capacidad: ${this.publicacion.capacidad_produccion || 'A consultar'}\n` +
        `🧵 Máquinas: ${maquinas}\n\n` +
        `📲 Revisa los detalles en CosturaPronta:\n${enlace}`;
    } else if (this.publicacion.tipo_publicacion === 'busco_funcionario') {
      this.textoGenerado = `👥 VACANTE DE COSTURA (${this.publicacion.zona_ubicacion}) 🚀\n` +
        `💼 Puesto: ${this.publicacion.puesto_trabajo}\n` +
        `🏠 Alojamiento: ${this.publicacion.modalidad_alojamiento === 'cama_dentro' ? 'Cama Dentro' : 'Cama Fuera'}\n` +
        `💰 Pago: R$ ${this.publicacion.pago_por_pieza}\n\n` +
        `📲 Postúlate aquí:\n${enlace}`;
    } else {
      this.textoGenerado = `🏪 LOTE DE CORTE DISPONIBLE (${this.publicacion.zona_ubicacion}) 🚀\n` +
        `👕 Prenda: ${this.publicacion.titulo}\n` +
        `📦 Cantidad: ${this.publicacion.cantidad_piezas} piezas\n` +
        `💰 Pago: R$ ${this.publicacion.pago_por_pieza} / pieza\n\n` +
        `📲 Ver detalles:\n${enlace}`;
    }
  }

  copiarAlPortapapeles() {
    navigator.clipboard.writeText(this.textoGenerado).then(() => {
      alert('¡Anuncio copiado!');
      const rutaPanel = this.rolUsuario === 'tienda' ? '/panel-tienda' : 
                        this.rolUsuario === 'oficina' ? '/panel-oficina' : '/panel-funcionario';
      this.router.navigate([rutaPanel]);
    });
  }
}