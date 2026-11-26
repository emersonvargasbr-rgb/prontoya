import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { mensajeAmigable } from '../../core/utils/helpers';

export interface VoladoraItem {
  id: string;
  creador_id: string;
  titulo: string;
  rubro: string;
  descripcion: string;
  dias_disponibles: string[];
  horario: string;
  pago_monto: number;
  modalidad_pago: string;
  pago_en_el_acto: boolean;
  incluye_transporte: boolean;
  tipo_lugar: string;
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  numero: string;
  punto_referencia: string;
  estado: string;
  vence_en: string;
  created_at: string;
}

@Component({
  selector: 'app-voladoras',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voladoras.component.html',
})
export class VoladorasComponent implements OnInit {
  voladoras = signal<VoladoraItem[]>([]);
  cargando = signal(false);
  mostrarFormulario = signal(false);
  guardando = signal(false);
  buscandoCep = signal(false);
  errorCep = signal('');
  mensajeError = signal('');
  mensajeExito = signal('');

  postulacionesRealizadas = signal(0);
  esPlanPago = signal(false);
  postulandoId = signal<string | null>(null);
  eliminandoId = signal<string | null>(null);
  idsPostulados = signal<Set<string>>(new Set());

  filtroDia: 'todos' | 'sabado_tarde' | 'domingo' = 'todos';

  sabadoTarde = true;
  domingoDia = true;
  usuarioId = '';

  readonly rubrosDisponibles = [
    'Acabados y limpieza',
    'Corte temporal',
    'Armado y empaque',
    'Apoyo de costura',
    'Mesero / mozo',
    'Carga y descarga',
    'Cocina / apoyo',
    'Limpieza general',
  ];

  voladora = {
    titulo: '',
    rubro: 'Acabados y limpieza',
    descripcion: '',
    horario: 'Sáb 13h–19h / Dom 08h–17h',
    pago_monto: null as number | null,
    modalidad_pago: 'por_dia',
    pago_en_el_acto: true,
    incluye_transporte: false,
    tipo_lugar: 'local_comercial',
    cep: '',
    logradouro: '',
    bairro: '',
    cidade: 'São Paulo',
    uf: 'SP',
    numero: '',
    punto_referencia: '',
  };

  puedePostularFree = computed(
    () => this.esPlanPago() || this.postulacionesRealizadas() < 3
  );

  voladorasFiltradas = computed(() => {
    const lista = this.voladoras();
    if (this.filtroDia === 'todos') return lista;
    return lista.filter((v) => v.dias_disponibles?.includes(this.filtroDia));
  });

  constructor(private supabaseService: SupabaseService) {}

  private get db() {
    return this.supabaseService.supabase;
  }

  async ngOnInit() {
    const {
      data: { session },
    } = await this.db.auth.getSession();
    this.usuarioId = session?.user?.id ?? '';

    await Promise.all([
      this.cargarVoladoras(),
      this.cargarEstadoPostulaciones(),
    ]);
  }

  async cargarEstadoPostulaciones() {
    if (!this.usuarioId) return;

    const { data: perfil } = await this.db
      .from('perfiles')
      .select('plan, plan_vigente_hasta')
      .eq('id', this.usuarioId)
      .maybeSingle();

    const { data: sub } = await this.db
      .from('suscripciones')
      .select('id, estado, expira_el')
      .eq('perfil_id', this.usuarioId)
      .ilike('estado', 'activa')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const subVigente =
      !!sub &&
      (!sub.expira_el || new Date(sub.expira_el).getTime() > Date.now());

    const planPerfilVigente =
      !!perfil?.plan &&
      !['free', 'gratis', ''].includes(String(perfil.plan).toLowerCase().trim()) &&
      (!perfil.plan_vigente_hasta ||
        new Date(perfil.plan_vigente_hasta).getTime() > Date.now());

    this.esPlanPago.set(subVigente || planPerfilVigente);

    const { count } = await this.db
      .from('postulaciones_lotes')
      .select('id', { count: 'exact', head: true })
      .eq('taller_id', this.usuarioId);

    this.postulacionesRealizadas.set(count ?? 0);
  }

  async cargarVoladoras() {
    this.cargando.set(true);
    this.mensajeError.set('');

    try {
      const { data, error } = await this.db
        .from('voladoras')
        .select('*')
        .eq('estado', 'Activo')
        .gt('vence_en', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.voladoras.set((data ?? []) as VoladoraItem[]);
    } catch (e: any) {
      this.mensajeError.set(
        mensajeAmigable(e, 'No se pudieron cargar las voladoras.')
      );
    } finally {
      this.cargando.set(false);
    }
  }

  onCepInput(valor: string) {
    const limpio = (valor || '').replace(/\D/g, '').slice(0, 8);
    this.voladora.cep = limpio;
    if (limpio.length === 8) {
      this.buscarPorCep(limpio);
    } else {
      this.errorCep.set('');
    }
  }

  async buscarPorCep(cepRaw: string) {
    const cepLimpio = (cepRaw || '').replace(/\D/g, '');
    this.voladora.cep = cepLimpio;
    this.errorCep.set('');

    if (cepLimpio.length !== 8) {
      if (cepLimpio.length > 0) {
        this.errorCep.set('CEP de 8 dígitos');
      }
      return;
    }

    this.buscandoCep.set(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpio}/json/`);
      const data = await res.json();

      if (data?.erro) {
        this.errorCep.set('CEP no encontrado');
        return;
      }

      this.voladora.logradouro = data.logradouro || '';
      this.voladora.bairro = data.bairro || '';
      this.voladora.cidade = data.localidade || 'São Paulo';
      this.voladora.uf = data.uf || 'SP';
    } catch {
      this.errorCep.set('Error al consultar CEP');
    } finally {
      this.buscandoCep.set(false);
    }
  }

  async crearVoladora() {
    if (!this.usuarioId) {
      this.mensajeError.set('Inicia sesión para publicar.');
      return;
    }

    const dias: string[] = [];
    if (this.sabadoTarde) dias.push('sabado_tarde');
    if (this.domingoDia) dias.push('domingo');

    if (dias.length === 0) {
      this.mensajeError.set('Elige sábado tarde o domingo.');
      return;
    }

    const cepLimpio = this.voladora.cep.replace(/\D/g, '');
    if (cepLimpio.length !== 8) {
      this.mensajeError.set('CEP inválido (8 dígitos).');
      return;
    }

    if (
      !this.voladora.titulo.trim() ||
      !this.voladora.pago_monto ||
      Number(this.voladora.pago_monto) <= 0
    ) {
      this.mensajeError.set('Completa título y monto.');
      return;
    }

    this.guardando.set(true);
    this.mensajeError.set('');
    this.mensajeExito.set('');

    try {
      const { error } = await this.db.from('voladoras').insert([
        {
          creador_id: this.usuarioId,
          titulo: this.voladora.titulo.trim(),
          rubro: this.voladora.rubro,
          descripcion: this.voladora.descripcion.trim(),
          dias_disponibles: dias,
          horario: this.voladora.horario.trim(),
          pago_monto: Number(this.voladora.pago_monto),
          modalidad_pago: this.voladora.modalidad_pago,
          pago_en_el_acto: this.voladora.pago_en_el_acto,
          incluye_transporte: this.voladora.incluye_transporte,
          tipo_lugar: this.voladora.tipo_lugar,
          cep: cepLimpio,
          logradouro: this.voladora.logradouro.trim(),
          bairro: this.voladora.bairro.trim(),
          cidade: this.voladora.cidade.trim() || 'São Paulo',
          uf: this.voladora.uf.trim() || 'SP',
          numero: this.voladora.numero.trim(),
          punto_referencia: this.voladora.punto_referencia.trim(),
          estado: 'Activo',
        },
      ]);

      if (error) throw error;

      this.mensajeExito.set('Voladora publicada.');
      this.mostrarFormulario.set(false);
      this.resetFormulario();
      await this.cargarVoladoras();
    } catch (e: any) {
      this.mensajeError.set(mensajeAmigable(e, 'No se pudo publicar.'));
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminarVoladora(item: VoladoraItem) {
    if (!this.usuarioId || item.creador_id !== this.usuarioId) return;
    if (!confirm(`¿Eliminar "${item.titulo}"?`)) return;

    this.eliminandoId.set(item.id);
    this.mensajeError.set('');
    this.mensajeExito.set('');

    try {
      const { error } = await this.db
        .from('voladoras')
        .delete()
        .eq('id', item.id)
        .eq('creador_id', this.usuarioId);

      if (error) throw error;

      this.voladoras.update((lista) => lista.filter((v) => v.id !== item.id));
      this.mensajeExito.set('Voladora eliminada.');
    } catch (e: any) {
      this.mensajeError.set(
        mensajeAmigable(e, 'No se pudo eliminar la voladora.')
      );
    } finally {
      this.eliminandoId.set(null);
    }
  }

  async postularVoladora(item: VoladoraItem) {
    if (!this.usuarioId || item.creador_id === this.usuarioId) return;
    this.mensajeError.set('');
    this.mensajeExito.set('');

    if (!this.puedePostularFree()) {
      this.mensajeError.set('Plan Gratis: límite de 3 postulaciones alcanzado.');
      return;
    }

    this.postulandoId.set(item.id);
    try {
      const { error } = await this.db.from('voladora_postulaciones').insert([
        {
          voladora_id: item.id,
          postulante_id: this.usuarioId,
          estado: 'Pendiente',
        },
      ]);

      if (error) throw error;

      this.postulacionesRealizadas.update((n) => n + 1);
      this.idsPostulados.update((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
      this.mensajeExito.set('Postulación enviada.');
    } catch (e: any) {
      this.mensajeError.set(mensajeAmigable(e, 'No se pudo postular.'));
    } finally {
      this.postulandoId.set(null);
    }
  }

  compartirTurnoWhatsApp(item: VoladoraItem) {
    const dias = item.dias_disponibles
      .map((d) => (d === 'sabado_tarde' ? 'Sáb tarde' : 'Domingo'))
      .join(' y ');
    const texto = [
      `Voladora: ${item.titulo} (${item.rubro})`,
      `Días: ${dias} · ${item.horario || ''}`,
      `Zona: ${item.bairro || item.cidade} · CEP ${this.formatearCep(item.cep)}`,
      item.punto_referencia ? `Ref: ${item.punto_referencia}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  }

  formatearCep(cep: string): string {
    const limpio = (cep || '').replace(/\D/g, '');
    return limpio.length === 8 ? `${limpio.slice(0, 5)}-${limpio.slice(5)}` : cep;
  }

  private resetFormulario() {
    this.voladora = {
      titulo: '',
      rubro: 'Acabados y limpieza',
      descripcion: '',
      horario: 'Sáb 13h–19h / Dom 08h–17h',
      pago_monto: null,
      modalidad_pago: 'por_dia',
      pago_en_el_acto: true,
      incluye_transporte: false,
      tipo_lugar: 'local_comercial',
      cep: '',
      logradouro: '',
      bairro: '',
      cidade: 'São Paulo',
      uf: 'SP',
      numero: '',
      punto_referencia: '',
    };
    this.sabadoTarde = true;
    this.domingoDia = true;
    this.errorCep.set('');
  }
}