import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tarjeta-trabajo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tarjeta-trabajo.component.html'
})
export class TarjetaTrabajoComponent {
  @Input() trabajo: any = {};
}