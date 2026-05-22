import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManageAllergiesPage } from './manage-allergies.page';

describe('ManageAllergiesPage', () => {
  let component: ManageAllergiesPage;
  let fixture: ComponentFixture<ManageAllergiesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageAllergiesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
