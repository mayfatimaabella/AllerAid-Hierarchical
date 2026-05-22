import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerifyDoctorsPage } from './verify-doctors.page';

describe('VerifyDoctorsPage', () => {
  let component: VerifyDoctorsPage;
  let fixture: ComponentFixture<VerifyDoctorsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VerifyDoctorsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
