import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SmartwatchPage } from './smartwatch.page';

describe('SmartwatchPage', () => {
  let component: SmartwatchPage;
  let fixture: ComponentFixture<SmartwatchPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SmartwatchPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
