import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { PlanService } from '../../../core/services/plan.service';
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

  /** Anuncios VIP (destacados) usados este mes. El tope lo define el plan; el servidor lo hace cumplir. */
  vipUsados = signal(0);
  vipTope = computed<number | null>(() => {
    const t = this.plan.limites().anuncios_vip_mes;
    return t === null ? null : (t ?? 0); // null = ilimitados
  });
  vipDisponible = computed(() => this.vipTope() === null || this.vipUsados() < (this.vipTope() as number));
  /** Sólo tiendas y talleres destacan anuncios. */
  puedeDestacar = computed(() => this.rolUsuario === 'tienda' || this.rolUsuario === 'oficina');

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    readonly plan: PlanService
  ) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    this.cargando.set(true);
    try {
      const { data: { session } } = await this.db.auth.getSession();
      const user = session?.user;
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }
      this.usuarioId = user.id;

      const { data: miPerfil } = await this.db
        .from('perfiles')
        .select('id, rol, zona_ubicacion')
        .eq('id', user.id)
        .maybeSingle();

      if (!miPerfil) {
        this.mensajeError.set('No encontramos tu perfil. Intenta iniciar sesión nuevamente.');
        return;
      }

      const rol = miPerfil.rol || 'oficina';
      this.rolUsuario = rol;

      await this.plan.cargar();
      await this.cargarVip(user.id);

      this.opciones = OPCIONES_POR_ROL[rol] ?? OPCIONES_POR_ROL['oficina'];

      const tipoInicial = this.opciones[0]?.id ?? 'busco_oficina';
      this.publicacion = this.nuevaPublicacion(tipoInicial);

      if (miPerfil.zona_ubicacion && this.zonas.includes(miPerfil.zona_ubicacion)) {
        this.publicacion.zona_ubicacion = miPerfil.zona_ubicacion;
      }
    } catch (e) {
      console.error('Error cargando formulario de publicación:', e);
      this.mensajeError.set('No pudimos cargar los datos necesarios para publicar. Intenta de nuevo.');
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
      destacado: false,
    };
  }

  elegirTipo(id: Tipo) {
    const { zona_ubicacion, maquinas_requeridas } = this.publicacion;
    this.publicacion = { ...this.nuevaPublicacion(id), zona_ubicacion, maquinas_requeridas };
    this.mensajeError.set('');
  }

  private async cargarVip(id: string) {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const { count } = await this.db
      .from('publicaciones')
      .select('id', { count: 'exact', head: true })
      .eq('creador_id', id)
      .gte('destacado_en', inicioMes.toISOString());
    this.vipUsados.set(count ?? 0);
  }

  get tipo(): Tipo { return this.publicacion.tipo_publicacion; }

  get etiquetaMaquinas(): string {
    return this.tipo === 'busco_trabajo' ? 'Máquinas que manejas' : 'Maquinaria requerida';
  }

  isMaquinaSelected(id: string) { return this.publicacion.maquinas_requeridas.includes(id); }

  toggleMaquina(id: string) {
    const lista = this.publicacion.maquinas_requeridas;
    this.publicacion.maquinas_requeridas = lista.includes(id)
      ? lista.filter(m => m !== id)
      : [...lista, id];
  }

  cancelarYVolver() { this.router.navigate([ROL_PANEL[this.rolUsuario] ?? '/feed']); }

  // ============================================= REGLAS DE CALIDAD Y ANTI-SPAM
  private contieneEnlaceOTelefono(texto: string): boolean {
    const tieneUrl = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|com\.br|net|org|io|app|me|ly|gg|xyz|shop|store)(\/|\s|$))/i.test(texto);
    const digitos = texto.replace(/\D/g, '');
    const tieneTelefonoLargo = digitos.length >= 8;
    return tieneUrl || tieneTelefonoLargo;
  }

  private pareceSpamOTextoBasura(texto: string): boolean {
    const limpio = texto.trim();
    if (!limpio) return false;

    // 4 o más caracteres iguales seguidos (ej: "aaaa", "!!!!", "$$$$")
    if (/(.)\1{3,}/i.test(limpio)) return true;

    // Frases de relleno o promoción externa típica de spam
    if (/(gana dinero rápido|cripto|casino|apuestas|préstamo fácil|prestamo facil|sigueme|sígueme|whatsapp\.com|t\.me\/)/i.test(limpio)) {
      return true;
    }

    // Exceso de mayúsculas en textos de 12+ letras
    const letras = limpio.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    if (letras.length >= 12) {
      const mayusculas = letras.replace(/[^A-ZÀ-Ÿ]/g, '').length;
      if (mayusculas / letras.length > 0.75) return true;
    }

    return false;
  }

  private async excesoPublicacionesRecientes(): Promise<boolean> {
    const haceDosHoras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { count, error } = await this.db
      .from('publicaciones')
      .select('id', { count: 'exact', head: true })
      .eq('creador_id', this.usuarioId)
      .gte('created_at', haceDosHoras);

    if (error) return false;
    return (count ?? 0) >= 6;
  }

  /** Devuelve un mensaje claro para el usuario o null si todo está correcto. */
  private async validar(): Promise<string | null> {
    const p = this.publicacion;
    const titulo = p.titulo.trim();
    const descripcion = p.descripcion.trim();

    if (!titulo) return 'Escribe un título claro para tu anuncio.';
    if (titulo.length < 6) return 'El título es muy corto. Describe mejor el lote, taller o vacante (mínimo 6 caracteres).';
    if (titulo.length > 100) return 'El título es demasiado largo (máximo 100 caracteres).';
    if (descripcion.length > 1000) return 'La descripción es demasiado larga (máximo 1000 caracteres).';

    if (this.pareceSpamOTextoBasura(titulo) || this.pareceSpamOTextoBasura(descripcion)) {
      return 'Tu anuncio contiene texto repetitivo, todo en mayúsculas o frases no permitidas. Escríbelo de forma clara para el feed.';
    }

    if (this.contieneEnlaceOTelefono(titulo) || this.contieneEnlaceOTelefono(descripcion)) {
      return 'Por seguridad y orden en el feed, no incluyas enlaces externos ni números de teléfono en el título o descripción.';
    }

    if (p.maquinas_requeridas.length === 0) return 'Selecciona al menos una máquina.';

    if (p.tipo_publicacion === 'busco_oficina') {
      if (!(Number(p.cantidad_piezas) > 0)) return 'Indica la cantidad de piezas del lote.';
      if (!(Number(p.pago_por_pieza) > 0)) return 'Indica el pago por pieza.';
    }

    if (p.tipo_publicacion === 'busco_funcionario' || p.tipo_publicacion === 'busco_trabajo') {
      if (!(Number(p.pago_por_pieza) > 0)) return 'Indica el pago estimado.';

      if (p.modalidad_pago === 'por_pieza' && Number(p.pago_por_pieza) > 50) {
        return 'Para trabajo por pieza, el valor máximo permitido es R$ 50. Si es pago semanal o mensual, cambia la modalidad de pago.';
      }
    }

    if (await this.excesoPublicacionesRecientes()) {
      return 'Publicaste varios anuncios en poco tiempo. Espera un momento antes de crear otro para mantener el feed ordenado.';
    }

    return null;
  }

  private mensajeAmigable(err: any, defecto: string): string {
    const raw = String(err?.message ?? err?.details ?? err ?? '').toLowerCase();
    const code = String(err?.code ?? '');

    if (code === '42501' || raw.includes('permission denied') || raw.includes('row-level security')) {
      return 'No tienes permiso para publicar en este momento o alcanzaste el límite de tu plan.';
    }
    if (raw.includes('failed to fetch') || raw.includes('network')) {
      return 'Parece que hay un problema de conexión. Revisa tu internet e inténtalo de nuevo.';
    }
    return defecto;
  }

  async onSubmit() {
    this.cargando.set(true);
    this.mensajeError.set('');

    try {
      const errorValidacion = await this.validar();
      if (errorValidacion) {
        this.mensajeError.set(errorValidacion);
        return;
      }

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
        destacado: this.puedeDestacar() && !!p.destacado,
      };

      if (p.tipo_publicacion === 'busco_corte') {
        Object.assign(payload, {
          especialidad_taller: p.especialidad_taller,
          tipo_tejido: p.tipo_tejido,
          modalidad_trabajo: p.modalidad_trabajo,
          capacidad_produccion: p.capacidad_produccion,
        });
      }
      if (p.tipo_publicacion === 'busco_funcionario' || p.tipo_publicacion === 'busco_trabajo') {
        Object.assign(payload, {
          puesto_trabajo: p.puesto_trabajo,
          modalidad_pago: p.modalidad_pago,
          modalidad_alojamiento: p.modalidad_alojamiento,
          modalidad_contratacion: p.modalidad_contratacion,
          cantidad_hijos_permitidos: Number(p.cantidad_hijos_permitidos) || 0,
        });
      }
      if (p.tipo_publicacion === 'busco_funcionario') {
        Object.assign(payload, {
          ofrece_alojamiento: p.ofrece_alojamiento,
          ofrece_comida: p.ofrece_comida,
          ofrece_wifi: p.ofrece_wifi,
          ofrece_banio_privado: p.ofrece_banio_privado,
        });
      }

      const { data, error: err } = await this.db
        .from('publicaciones')
        .insert([payload])
        .select('id')
        .single();
      if (err) throw err;

      this.idCreado = data.id;
      this.textoGenerado = this.generarTexto(data.id);
    } catch (e: any) {
      console.error('Error al crear publicación:', e);
      this.mensajeError.set(
        this.mensajeAmigable(e, 'No pudimos publicar tu anuncio en este momento. Revisa los datos e intenta de nuevo.')
      );
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
      this.mensajeError.set('No se pudo copiar el texto automáticamente. Puedes seleccionarlo y copiarlo a mano.');
    }
  }

  compartirWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(this.textoGenerado)}`, '_blank', 'noopener');
  }
}