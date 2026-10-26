import * as firebaseAuth from 'firebase/auth';

import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should restore a persisted auth session when Firebase auth is still initializing', async () => {
    const authMock = {
      currentUser: null
    } as any;

    spyOn(firebaseAuth, 'onAuthStateChanged').and.callFake((_, callback: any) => {
      setTimeout(() => (callback as any)(null), 0);
      return () => undefined;
    });

    const service = new AuthService({
      getAuth: () => authMock
    } as FirebaseService);

    localStorage.setItem(
      'alleraid-auth-session',
      JSON.stringify({
        uid: 'abc123',
        email: 'admin@alleraid.com',
        displayName: 'Admin User'
      })
    );

    const user = await service.waitForAuthInit();

    expect(user).toBeTruthy();
    expect(user?.uid).toBe('abc123');
    expect(user?.email).toBe('admin@alleraid.com');
  });
});
