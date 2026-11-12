import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

import { UI, moneda } from '../../../core/utils/helpers';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { FilaHistorial, LotesService } from '../../../core/services/lotes.service';


@Component({
  selector: 'app-historial-lotes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, AvatarComponent],
  templateUrl: './historial-lotes.component.html',
})
export class HistorialLotesComponent implements OnInit {
  readonly ui = UI;
  readonly moneda = moneda;

  usuarioId = '';
  rol = signal('');
  cargando = signal(true);
  error = signal('');
  filas = signal<FilaHistorial[]>([]);
  anio = signal<number>(0); // 0 = todos

  esOperario = computed(() => this.rol() === 'funcionario');

  anios = computed(() =>
    [...new Set(this.filas().map(f => new Date(f.fecha).getFullYear()).filter(a => !isNaN(a)))].sort((a, b) => b - a));

  visibles = computed(() => {
    const a = this.anio();
    return a ? this.filas().filter(f => new Date(f.fecha).getFullYear() === a) : this.filas();
  });

  totales = computed(() => ({
    trabajos: this.visibles().length,
    piezas: this.visibles().reduce((t, f) => t + f.piezas, 0),
    monto: this.visibles().reduce((t, f) => t + f.monto, 0),
  }));

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
    await this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.filas.set(this.esOperario()
        ? await this.lotesService.historialOperario(this.usuarioId)
        : await this.lotesService.historialEmpresa(this.usuarioId));
    } catch (e) {
      console.error('Error al cargar el historial:', e);
      this.error.set('No se pudo cargar el historial.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** Descarga lo que se ve en pantalla como CSV (abre bien en Excel). */
  exportarCsv() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = this.visibles();
    const lineas = [
      ['Fecha', 'Trabajo', this.esOperario() ? 'Empleador' : 'Contraparte', 'Piezas', 'Monto (R$)'].map(esc).join(';'),
      ...filas.map(f => [
        new Date(f.fecha).toLocaleDateString('pt-BR'), f.titulo, f.contraparte?.nombre_completo ?? '', f.piezas, f.monto.toFixed(2).replace('.', ','),
      ].map(esc).join(';')),
    ];
    const blob = new Blob(['\ufeff' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial-${this.anio() || 'completo'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}