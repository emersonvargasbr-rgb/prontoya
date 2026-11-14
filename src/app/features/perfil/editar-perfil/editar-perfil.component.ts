import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MAQUINAS, ROL_ETIQUETA, ROL_PANEL, UI, ZONAS } from '../../../core/utils/helpers';
import {
  COLORES_PORTADA, ESPECIALIDADES, PATRONES_PORTADA, Rol,
  calcularGamificacion, cnpjValido, completitud, estiloPortada,
} from '../../../core/utils/gamificacion';
import { Aviso, ToastComponent } from '../../../shared/components/toast.component';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { IconComponent } from '../../../shared/components/icon.component';

const CAMPOS_COMUNES = [
  'nombre_completo', 'lema', 'bio_taller', 'especialidad_principal', 'zona_ubicacion',
  'color_portada', 'color_texto_portada', 'patron_portada', 'avatar_icono', 'avatar_color',
  'insignias_destacadas', 'maquinas_maneja', 'visibilidad_whatsapp', 'visibilidad_direccion',
];
const CAMPOS_POR_ROL: Record<Rol, string[]> = {
  oficina:      ['cantidad_maquinas', 'cantidad_operarios', 'cep', 'cnpj', 'visibilidad_cnpj'],
  tienda:       ['tipo_tienda', 'cep', 'cnpj', 'visibilidad_cnpj'],
  funcionario: ['tiene_vehiculo', 'trabaja_en_casal', 'busca_alojamiento', 'alojamiento_propio', 'modalidad_trabajo'],
};

@Component({
  selector: 'app-editar-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, AvatarComponent, ToastComponent],
  templateUrl: './editar-perfil.component.html',
})
export class EditarPerfilComponent implements OnInit {
  readonly ui = UI;
  readonly zonas = ZONAS;
  readonly maquinas = MAQUINAS;
  readonly colores = COLORES_PORTADA;
  readonly patrones = PATRONES_PORTADA;
  readonly roles = ROL_ETIQUETA;
  readonly estiloPortada = estiloPortada;

  // 👇 Lista completa de animales (Los primeros 6 son libres, del 7 en adelante piden verificación)
  readonly iconos = [
    { id: 'animal-burro-cara', nombre: 'Burro' },
    { id: 'animal-gato', nombre: 'Gato' },
    { id: 'animal-oso', nombre: 'Oso' },
    { id: 'animal-buho', nombre: 'Búho' },
    { id: 'animal-perro', nombre: 'Perro' },
    { id: 'animal-leon', nombre: 'León' },
    // A partir del índice 6 (7mo elemento) se requiere verificación
    { id: 'animal-hipopotamo', nombre: 'Hipopótamo' },
    { id: 'animal-caballo', nombre: 'Caballo' },
    { id: 'animal-burro', nombre: 'Burro silueta' },
    { id: 'animal-koala', nombre: 'Koala' },
    { id: 'animal-oveja', nombre: 'Oveja' },
    { id: 'animal-pantera', nombre: 'Pantera' },
    { id: 'animal-mono', nombre: 'Mono' },
    { id: 'animal-carnero', nombre: 'Carnero' },
    { id: 'animal-raton', nombre: 'Ratón' },
    { id: 'animal-pulpo', nombre: 'Pulpo' },
    { id: 'animal-loro', nombre: 'Loro' },
    { id: 'animal-cerdo', nombre: 'Cerdo' },
    { id: 'animal-conejo', nombre: 'Conejo' },
    { id: 'animal-tigre', nombre: 'Tigre' },
    { id: 'animal-gorila', nombre: 'Gorila' },
    { id: 'animal-cebra', nombre: 'Cebra' },
    { id: 'animal-vaca', nombre: 'Vaca' },
    { id: 'animal-toro', nombre: 'Toro' },
    { id: 'animal-cabra', nombre: 'Cabra' },
    { id: 'animal-ciervo', nombre: 'Ciervo' },
    { id: 'animal-jirafa', nombre: 'Jirafa' },
  ];

  // 👇 Definición local de paletas para evitar errores de compilación
  readonly paletas = [
    { id: 'teal', nombre: 'Teal', clase: 'bg-teal-100 text-teal-800' },
    { id: 'amber', nombre: 'Ámbar', clase: 'bg-amber-100 text-amber-800' },
    { id: 'sky', nombre: 'Cielo', clase: 'bg-sky-100 text-sky-800' },
    { id: 'rose', nombre: 'Rosa', clase: 'bg-rose-100 text-rose-800' },
    { id: 'violet', nombre: 'Violeta', clase: 'bg-violet-100 text-violet-800' },
    { id: 'lime', nombre: 'Lima', clase: 'bg-lime-100 text-lime-800' },
  ];

  usuarioId = '';
  cargando = signal(true);
  guardando = signal(false);
  aviso = signal<Aviso | null>(null);

  base = signal<any>(null);
  form: any = {};
  private original = '';
  errores: Record<string, string> = {};

  rol = computed<Rol>(() => (this.base()?.rol ?? 'funcionario') as Rol);
  g = computed(() => (this.base() ? calcularGamificacion(this.base()) : null));
  nivel = computed(() => this.g()?.nivel ?? 1);
  ganadas = computed(() => (this.g()?.logros ?? []).filter(l => l.desbloqueada));
  especialidades = computed(() => {
    const lista = ESPECIALIDADES[this.rol()] ?? [];
    const actual = this.base()?.especialidad_principal;
    return actual && !lista.includes(actual) ? [actual, ...lista] : lista;
  });

  constructor(private supabaseService: SupabaseService, private router: Router) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.usuarioId = user.id;
    await this.cargar();
  }

  private async cargar() {
    const { data, error } = await this.db.from('perfiles').select('*').eq('id', this.usuarioId).single();
    if (error || !data) {
      this.notificar('No se pudo cargar tu perfil.', 'error');
      this.cargando.set(false);
      return;
    }
    this.base.set(data);
    this.form = this.extraer(data);
    this.original = JSON.stringify(this.form);
    this.cargando.set(false);
  }

  private extraer(src: any): any {
    const rol = (src.rol ?? 'funcionario') as Rol;
    const out: any = {};
    for (const k of [...CAMPOS_COMUNES, ...CAMPOS_POR_ROL[rol]]) out[k] = src[k] ?? null;
    out.lema = out.lema ?? '';
    out.bio_taller = out.bio_taller ?? '';
    out.color_portada = out.color_portada || '#134e4a';
    out.color_texto_portada = '#ffffff';
    out.patron_portada = out.patron_portada || 'liso';
    out.insignias_destacadas = [...(out.insignias_destacadas ?? [])];
    out.maquinas_maneja = [...(out.maquinas_maneja ?? [])];
    out.visibilidad_whatsapp = out.visibilidad_whatsapp || 'publico';
    out.visibilidad_direccion = out.visibilidad_direccion || 'conectados';
    if ('visibilidad_cnpj' in out) out.visibilidad_cnpj = out.visibilidad_cnpj || 'privado';
    if ('cantidad_maquinas' in out) out.cantidad_maquinas = Number(out.cantidad_maquinas) || 0;
    if ('cantidad_operarios' in out) out.cantidad_operarios = Number(out.cantidad_operarios) || 0;
    if ('cep' in out) out.cep = out.cep ?? '';
    if ('cnpj' in out) out.cnpj = out.cnpj ?? '';
    if ('modalidad_trabajo' in out) out.modalidad_trabajo = out.modalidad_trabajo || 'Individual';
    for (const k of ['tiene_vehiculo', 'trabaja_en_casal', 'busca_alojamiento', 'alojamiento_propio']) {
      if (k in out) out[k] = !!out[k];
    }
    return out;
  }

  get sucio(): boolean { return JSON.stringify(this.form) !== this.original; }

  private compCache: { key: string; val: ReturnType<typeof completitud> } = { key: '', val: { pct: 0, faltan: [] } };
  get comp() {
    const key = JSON.stringify(this.form);
    if (key !== this.compCache.key) {
      this.compCache = { key, val: completitud({ ...this.base(), ...this.form }) };
    }
    return this.compCache.val;
  }

  get esEmpresa(): boolean { return this.rol() === 'tienda' || this.rol() === 'oficina'; }
  get muestraMaquinas(): boolean { return this.rol() === 'oficina' || this.rol() === 'funcionario'; }

  bloqueado(nivelMin: number): boolean { return this.nivel() < nivelMin; }

  private avisarBloqueo(nivelMin: number) {
    this.notificar(`Se desbloquea en el nivel ${nivelMin}. Sigue sumando puntos.`, 'error');
  }

  elegirColor(c: { hex: string; nivelMin: number }) {
    if (this.bloqueado(c.nivelMin)) return this.avisarBloqueo(c.nivelMin);
    this.form.color_portada = c.hex;
  }

  elegirPatron(p: { id: string; nivelMin: number }) {
    if (this.bloqueado(p.nivelMin)) return this.avisarBloqueo(p.nivelMin);
    this.form.patron_portada = p.id;
  }
elegirIcono(i: { id: string }, idx: number) {
    // Si el icono está en el índice 6 o superior (7mo en adelante) y el usuario no está verificado
    if (idx >= 6 && !this.base()?.verificado) {
      this.notificar('Icono solo para perfiles verificados', 'error');
      return;
    }
    this.form.avatar_icono = i.id;
  }
  elegirAvatarColor(id: string | null) { this.form.avatar_color = id; }

  toggleDestacada(id: string) {
    const lista: string[] = this.form.insignias_destacadas;
    if (lista.includes(id)) { this.form.insignias_destacadas = lista.filter(x => x !== id); return; }
    if (lista.length >= 3) return this.notificar('Puedes destacar hasta 3 insignias.', 'error');
    this.form.insignias_destacadas = [...lista, id];
  }

  toggleMaquina(id: string) {
    const lista: string[] = this.form.maquinas_maneja;
    this.form.maquinas_maneja = lista.includes(id) ? lista.filter(m => m !== id) : [...lista, id];
  }

  opcion(sel: boolean, bloq = false): string {
    const base = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 ';
    if (bloq) return base + 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400';
    return base + (sel ? 'border-teal-700 bg-teal-700 text-white' : 'border-stone-300 bg-white text-slate-700 hover:bg-stone-50 active:scale-95');
  }

  private validar(): boolean {
    const f = this.form, e: Record<string, string> = {};
    if ((f.nombre_completo ?? '').trim().length < 3) e['nombre_completo'] = 'Escribe al menos 3 caracteres.';
    if ((f.lema ?? '').length > 80) e['lema'] = 'Máximo 80 caracteres.';
    if ((f.bio_taller ?? '').length > 280) e['bio_taller'] = 'Máximo 280 caracteres.';
    if ('cep' in f && f.cep && f.cep.replace(/\D/g, '').length !== 8) e['cep'] = 'El CEP tiene 8 dígitos.';
    if ('cnpj' in f && f.cnpj && !cnpjValido(f.cnpj)) e['cnpj'] = 'El CNPJ no es válido.';
    if ('cantidad_maquinas' in f && f.cantidad_maquinas < 0) e['cantidad_maquinas'] = 'No puede ser negativo.';
    if ('cantidad_operarios' in f && f.cantidad_operarios < 0) e['cantidad_operarios'] = 'No puede ser negativo.';
    this.errores = e;
    return Object.keys(e).length === 0;
  }

  async guardar() {
    if (!this.validar()) {
      this.notificar('Revisa los campos marcados.', 'error');
      return;
    }
    this.guardando.set(true);
    try {
      const payload: any = { ...this.form };
      payload.nombre_completo = payload.nombre_completo.trim();
      payload.lema = (payload.lema ?? '').trim() || null;
      payload.bio_taller = (payload.bio_taller ?? '').trim() || null;
      if ('cep' in payload) payload.cep = payload.cep ? payload.cep.replace(/\D/g, '') : null;
      if ('cnpj' in payload) payload.cnpj = payload.cnpj ? payload.cnpj.replace(/\D/g, '') : null;
      const ganadas = new Set(this.ganadas().map(l => l.id));
      payload.insignias_destacadas = payload.insignias_destacadas.filter((id: string) => ganadas.has(id));

      const { error } = await this.db.from('perfiles').update(payload).eq('id', this.usuarioId);
      if (error) throw error;

      this.base.update(b => ({ ...b, ...payload }));
      this.form = this.extraer(this.base());
      this.original = JSON.stringify(this.form);
      this.notificar('Perfil actualizado.');
      setTimeout(() => this.router.navigate([ROL_PANEL[this.rol()] ?? '/feed']), 900);
    } catch (e: any) {
      console.error(e);
      this.notificar(e?.message ?? 'No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar() {
    if (this.sucio && !confirm('Tienes cambios sin guardar. Salir de todos modos?')) return;
    this.router.navigate([ROL_PANEL[this.rol()] ?? '/feed']);
  }

  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 3500);
  }
  
}