import { TestBed } from '@angular/core/testing';

import { AdminEmergency } from './admin-emergency';

describe('AdminEmergency', () => {
  let service: AdminEmergency;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdminEmergency);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
