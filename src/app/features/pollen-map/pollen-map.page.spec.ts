import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PollenMapPage } from './pollen-map.page';

describe('PollenMapPage', () => {
  let component: PollenMapPage;
  let fixture: ComponentFixture<PollenMapPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PollenMapPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
