import { TestBed } from '@angular/core/testing';

import { AdminUser } from './admin-user';

describe('AdminUser', () => {
  let service: AdminUser;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdminUser);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
