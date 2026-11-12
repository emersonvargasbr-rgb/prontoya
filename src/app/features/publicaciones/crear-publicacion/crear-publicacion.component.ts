import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MAQUINAS, ROL_PANEL, UI, ZONAS } from '../../../core/utils/helpers';
import { IconComponent } from '../../../shared/components/icon.component';

type Tipo = 'busco_oficina' | 'busco_corte' | 'busco_funcionario' | 'busco_trabajo';

interface Opcion { id: Tipo; titulo: string; ayuda: string; icono: string; }

/** Qué puede publicar cada perfil. */
const OPCIONES_POR_ROL: Record<string, Opcion[]> = {
  tienda: [
    { id: 'busco_oficina',     titulo: 'Publicar un lote',     ayuda: 'Un taller lo toma y lo confecciona.',    icono: 'bag' },
    { id: 'busco_funcionario', titulo: 'Contratar costureros', ayuda: 'Abre una vacante para tu equipo.',      icono: 'briefcase' },
  ],
  oficina: [
    { id: 'busco_corte',        titulo: 'Ofrecer mi taller',     ayuda: 'Las tiendas te envían propuestas.',     icono: 'scissors' },
    { id: 'busco_funcionario', titulo: 'Contratar costureros', ayuda: 'Abre una vacante para tu equipo.',      icono: 'briefcase' },
  ],
  funcionario: [
    { id: 'busco_trabajo',     titulo: 'Ofrecer mi disponibilidad', ayuda: 'Talleres y tiendas te encuentran.', icono: 'user' },
  ],
};

@Component({
  selector: 'app-crear-publicacion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  templateUrl: './crear-publicacion.component.html',
})
export class CrearPublicacionComponent implements OnInit {
  readonly ui = UI;
  readonly zonas = ZONAS;
  readonly maquinaria = MAQUINAS;

  usuarioId = '';

  // Signals encapsulados con getters y setters para máxima compatibilidad con HTML y reactividad
  private _rolUsuario = signal<string>('');
  get rolUsuario(): string { return this._rolUsuario(); }
  set rolUsuario(v: string) { this._rolUsuario.set(v); }

  private _opciones = signal<Opcion[]>([]);
  get opciones(): Opcion[] { return this._opciones(); }
  set opciones(v: Opcion[]) { this._opciones.set(v); }

  cargando = signal(false);
  mensajeError = signal('');
  copiado = signal(false);
  idCreado = '';
  textoGenerado = '';

  publicacion = this.nuevaPublicacion('busco_oficina');

  constructor(private supabaseService: SupabaseService, private router: Router) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    this.cargando.set(true);
    try {
      // 🚀 OPTIMIZACIÓN CLAVE: Consultamos la sesión y la tabla perfiles EN PARALELO con Promise.all
      const [{ data: authData }, perfilRes] = await Promise.all([
        this.db.auth.getUser(),
        this.db.from('perfiles').select('id, rol, zona_ubicacion')
      ]);

      const user = authData?.user;
      if (!user) { 
        this.router.navigate(['/login']); 
        return; 
      }
      
      this.usuarioId = user.id;

      const perfiles = perfilRes.data ?? [];
      const miPerfil = perfiles.find((p: any) => p.id === user.id);

      if (!miPerfil) {
        this.mensajeError.set('No se pudo encontrar tu perfil.');
        return;
      }

      const rol = miPerfil.rol || 'oficina';
      this.rolUsuario = rol;
      
      // Asignar de inmediato las opciones correspondientes al rol evitando retrasos visuales
      this.opciones = OPCIONES_POR_ROL[rol] ?? OPCIONES_POR_ROL['oficina'];
      
      const tipoInicial = this.opciones[0]?.id ?? 'busco_oficina';
      this.publicacion = this.nuevaPublicacion(tipoInicial);
      
      if (miPerfil.zona_ubicacion && this.zonas.includes(miPerfil.zona_ubicacion)) {
        this.publicacion.zona_ubicacion = miPerfil.zona_ubicacion;
      }
    } catch (e) {
      console.error(e);
      this.mensajeError.set('Error al cargar los datos del usuario.');
    } finally {
      queueMicrotask(() => {
        this.cargando.set(false);
      });
    }
  }

  private nuevaPublicacion(tipo: Tipo) {
    return {
      tipo_publicacion: tipo,
      titulo: '',
      descripcion: '',
      cantidad_piezas: null as number | null,
      pago_por_pieza: null as number | null,
      maquinas_requeridas: [] as string[],
      zona_ubicacion: 'Brás',
      logistica_entrega: 'acuerdo_mutuo',

      // taller libre
      especialidad_taller: 'Costura y Confeccion Completa',
      tipo_tejido: 'Malla (Malharia)',
      modalidad_trabajo: 'Ambos',
      capacidad_produccion: '',

      // vacante / disponibilidad
      puesto_trabajo: 'Costurero(a) Overlock/Reta',
      modalidad_pago: 'por_pieza',
      modalidad_alojamiento: 'cama_fuera',
      modalidad_contratacion: 'individual',
      ofrece_alojamiento: false,
      ofrece_comida: false,
      ofrece_wifi: false,
      ofrece_banio_privado: false,
      cantidad_hijos_permitidos: 0,
    };
  }

  elegirTipo(id: Tipo) {
    // conserva zona y máquinas al cambiar de tipo
    const { zona_ubicacion, maquinas_requeridas } = this.publicacion;
    this.publicacion = { ...this.nuevaPublicacion(id), zona_ubicacion, maquinas_requeridas };
    this.mensajeError.set('');
  }

  get tipo(): Tipo { return this.publicacion.tipo_publicacion; }

  get etiquetaMaquinas(): string {
    return this.tipo === 'busco_trabajo' ? 'Máquinas que manejas' : 'Maquinaria requerida';
  }

  isMaquinaSelected(id: string) { return this.publicacion.maquinas_requeridas.includes(id); }

  toggleMaquina(id: string) {
    const lista = this.publicacion.maquinas_requeridas;
    this.publicacion.maquinas_requeridas = lista.includes(id) ? lista.filter(m => m !== id) : [...lista, id];
  }

  cancelarYVolver() { this.router.navigate([ROL_PANEL[this.rolUsuario] ?? '/feed']); }

  /** Devuelve un mensaje de error o null si todo está bien. */
  private validar(): string | null {
    const p = this.publicacion;
    if (!p.titulo.trim()) return 'Escribe un título.';
    if (p.maquinas_requeridas.length === 0) return 'Selecciona al menos una máquina.';
    if (p.tipo_publicacion === 'busco_oficina') {
      if (!(Number(p.cantidad_piezas) > 0)) return 'Indica la cantidad de piezas.';
      if (!(Number(p.pago_por_pieza) > 0)) return 'Indica el pago por pieza.';
    }
    if (p.tipo_publicacion === 'busco_funcionario' && !(Number(p.pago_por_pieza) > 0)) {
      return 'Indica el pago estimado.';
    }
    return null;
  }

  async onSubmit() {
    const error = this.validar();
    if (error) { this.mensajeError.set(error); return; }

    this.cargando.set(true);
    this.mensajeError.set('');
    const p = this.publicacion;

    const payload: any = {
      creador_id: this.usuarioId,
      tipo_publicacion: p.tipo_publicacion,
      titulo: p.titulo.trim(),
      descripcion: p.descripcion.trim(),
      cantidad_piezas: Number(p.cantidad_piezas) || 0,
      pago_por_pieza: Number(p.pago_por_pieza) || 0,
      maquinas_requeridas: p.maquinas_requeridas,
      zona_ubicacion: p.zona_ubicacion,
      logistica_entrega: p.logistica_entrega,
      estado: 'Activo',
    };

    if (p.tipo_publicacion === 'busco_corte') {
      Object.assign(payload, {
        especialidad_taller: p.especialidad_taller, tipo_tejido: p.tipo_tejido,
        modalidad_trabajo: p.modalidad_trabajo, capacidad_produccion: p.capacidad_produccion,
      });
    }
    if (p.tipo_publicacion === 'busco_funcionario' || p.tipo_publicacion === 'busco_trabajo') {
      Object.assign(payload, {
        puesto_trabajo: p.puesto_trabajo, modalidad_pago: p.modalidad_pago,
        modalidad_alojamiento: p.modalidad_alojamiento, modalidad_contratacion: p.modalidad_contratacion,
        cantidad_hijos_permitidos: Number(p.cantidad_hijos_permitidos) || 0,
      });
    }
    if (p.tipo_publicacion === 'busco_funcionario') {
      Object.assign(payload, {
        ofrece_alojamiento: p.ofrece_alojamiento, ofrece_comida: p.ofrece_comida,
        ofrece_wifi: p.ofrece_wifi, ofrece_banio_privado: p.ofrece_banio_privado,
      });
    }

    try {
      const { data, error: err } = await this.db.from('publicaciones').insert([payload]).select('id').single();
      if (err) throw err;
      this.idCreado = data.id;
      this.textoGenerado = this.generarTexto(data.id);
    } catch (e: any) {
      console.error(e);
      this.mensajeError.set(`No se pudo guardar: ${e?.message || 'intenta de nuevo.'}`);
    } finally {
      queueMicrotask(() => {
        this.cargando.set(false);
      });
    }
  }

  private generarTexto(id: string): string {
    const p = this.publicacion;
    const enlace = `${window.location.origin}/trabajo/${id}`;
    const maquinas = p.maquinas_requeridas.join(', ');
    const alojamiento = p.modalidad_alojamiento === 'cama_dentro' ? 'Cama dentro' : 'Cama fuera';

    switch (p.tipo_publicacion) {
      case 'busco_corte':
        return `TALLER DISPONIBLE (${p.zona_ubicacion})\nServicio: ${p.especialidad_taller}\nTejido: ${p.tipo_tejido}\nModalidad: ${p.modalidad_trabajo}\nCapacidad: ${p.capacidad_produccion || 'A consultar'}\nMáquinas: ${maquinas}\n\nDetalles en CosturaPronta:\n${enlace}`;
      case 'busco_funcionario':
        return `VACANTE DE COSTURA (${p.zona_ubicacion})\nPuesto: ${p.puesto_trabajo}\n${alojamiento}\nPago: R$ ${p.pago_por_pieza}\nMáquinas: ${maquinas}\n\nPostúlate aquí:\n${enlace}`;
      case 'busco_trabajo':
        return `OPERARIO DISPONIBLE (${p.zona_ubicacion})\n${p.titulo}\n${alojamiento}\nMáquinas: ${maquinas}\n\nVer perfil en CosturaPronta:\n${enlace}`;
      default:
        return `LOTE DE CORTE DISPONIBLE (${p.zona_ubicacion})\nPrenda: ${p.titulo}\nCantidad: ${p.cantidad_piezas} piezas\nPago: R$ ${p.pago_por_pieza} por pieza\n\nVer detalles:\n${enlace}`;
    }
  }

  async copiar() {
    try {
      await navigator.clipboard.writeText(this.textoGenerado);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2500);
    } catch {
      this.mensajeError.set('No se pudo copiar. Selecciona el texto y cópialo manualmente.');
    }
  }

  compartirWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(this.textoGenerado)}`, '_blank', 'noopener');
  }
}