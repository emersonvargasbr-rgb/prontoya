import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

import { ROL_PANEL, UI, abrirWhatsApp, claseEstado, moneda } from '../../../core/utils/helpers';
import { Aviso, ToastComponent } from '../../../shared/components/toast.component';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { LoteActivo, LotesService } from '../../../core/services/lotes.service';


@Component({
  selector: 'app-lotes-activos',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, AvatarComponent, ToastComponent],
  templateUrl: './lotes-activos.component.html',
})
export class LotesActivosComponent implements OnInit {
  readonly ui = UI;
  readonly claseEstado = claseEstado;
  readonly moneda = moneda;

  usuarioId = '';
  rol = signal('');

  cargando = signal(true);
  error = signal('');
  lotes = signal<LoteActivo[]>([]);
  procesando = signal<string | null>(null);   // id del lote con una acción en curso
  aviso = signal<Aviso | null>(null);

  totalPiezas = computed(() => this.lotes().reduce((t, l) => t + l.cantidad_piezas, 0));
  totalMonto = computed(() => this.lotes().reduce((t, l) => t + l.total, 0));
  esOperario = computed(() => this.rol() === 'funcionario');
  rutaPanel = computed(() => ROL_PANEL[this.rol()] ?? '/feed');

  constructor(
    private supabaseService: SupabaseService,
    private lotesService: LotesService,
    private router: Router,
  ) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.usuarioId = user.id;

    const { data } = await this.db.from('perfiles').select('rol').eq('id', user.id).maybeSingle();
    this.rol.set(data?.rol ?? '');

    if (this.esOperario()) { this.cargando.set(false); return; } // sus cortes viven en su panel
    await this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.lotes.set(await this.lotesService.activos(this.usuarioId));
    } catch (e) {
      console.error('Error al cargar los lotes:', e);
      this.error.set('No se pudieron cargar los lotes.');
    } finally {
      this.cargando.set(false);
    }
  }

  // Quién puede hacer qué: la oficina termina, la tienda confirma la recepción.
  puedeTerminar(l: LoteActivo) { return l.oficinaId === this.usuarioId && l.estado !== 'Terminado'; }
  puedeConfirmar(l: LoteActivo) { return l.tiendaId === this.usuarioId && l.estado === 'Terminado'; }

  etiquetaEstado(l: LoteActivo): string {
    return l.estado === 'Terminado' ? 'Listo para retirar' : 'En producción';
  }

  async terminar(l: LoteActivo) {
    if (!confirm('Marcar este lote como terminado? La tienda deberá confirmar la recepción.')) return;
    await this.ejecutar(l, () => this.lotesService.marcarTerminado(l.id), 'Lote marcado como terminado.');
  }

  async confirmar(l: LoteActivo) {
    if (!confirm('Confirmas que recibiste el lote conforme? Se archivará el comprobante.')) return;
    await this.ejecutar(l, () => this.lotesService.confirmarRecepcion(l), 'Comprobante archivado. Ya puedes calificar al taller.');
  }

  private async ejecutar(l: LoteActivo, accion: () => Promise<void>, ok: string) {
    if (this.procesando()) return; // evita doble clic
    this.procesando.set(l.id);
    try {
      await accion();
      this.notificar(ok);
      await this.cargar();
    } catch (e: any) {
      console.error(e);
      this.notificar(e?.message ?? 'No se pudo completar la acción.', 'error');
    } finally {
      this.procesando.set(null);
    }
  }

  whatsapp(l: LoteActivo) {
    if (!abrirWhatsApp(l.contraparte?.telefono, l.contraparte?.nombre_completo ?? '', l.descripcion_corte)) {
      this.notificar('Este usuario no tiene teléfono visible.', 'error');
    }
  }

  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 3500);
  }
}