import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VerificarTelefono } from './verificar-telefono';

describe('VerificarTelefono', () => {
  let component: VerificarTelefono;
  let fixture: ComponentFixture<VerificarTelefono>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerificarTelefono]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VerificarTelefono);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
