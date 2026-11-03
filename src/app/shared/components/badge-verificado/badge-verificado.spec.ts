import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BadgeVerificado } from './badge-verificado';

describe('BadgeVerificado', () => {
  let component: BadgeVerificado;
  let fixture: ComponentFixture<BadgeVerificado>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeVerificado]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BadgeVerificado);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
