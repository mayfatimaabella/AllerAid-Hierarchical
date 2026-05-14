import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { DoctorProfilePage } from './doctor-profile.page';

describe('DoctorProfilePage', () => {
  let component: DoctorProfilePage;
  let fixture: ComponentFixture<DoctorProfilePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DoctorProfilePage],
      imports: [IonicModule.forRoot(), ReactiveFormsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(DoctorProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form on creation', () => {
    expect(component.doctorProfileForm).toBeDefined();
    expect(component.doctorProfileForm.get('firstName')).toBeDefined();
    expect(component.doctorProfileForm.get('email')).toBeDefined();
  });
});
