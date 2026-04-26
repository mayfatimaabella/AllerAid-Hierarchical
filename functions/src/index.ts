import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface PushMessagePayload {
  title: string;
  body: string;
  data?: { [key: string]: string };
}

export const sendEmergencyPush = functions.region('us-central1').https.onRequest(async (req, res) => {
  // Allow only POST
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { targetUserId, message } = req.body as {
      targetUserId?: string;
      message?: PushMessagePayload;
    };

    if (!targetUserId || !message) {
      res.status(400).send('Missing targetUserId or message');
      return;
    }

    const userDoc = await db.collection('users').doc(targetUserId).get();
    if (!userDoc.exists) {
      res.status(404).send('User not found');
      return;
    }

    const data = userDoc.data() || {};
    const tokens: string[] = Array.isArray(data.pushTokens) ? data.pushTokens : [];

    if (!tokens.length) {
      res.status(200).send('No push tokens for user');
      return;
    }

    const messagePayload: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: message.title,
        body: message.body
      },
      data: message.data as { [key: string]: string } | undefined
    };

    const response = await admin.messaging().sendEachForMulticast(messagePayload);

    console.log('sendEmergencyPush result', response);

    res.status(200).send('Push sent');
  } catch (err) {
    console.error('sendEmergencyPush error', err);
    res.status(500).send('Error sending push');
  }
});

export const sendBuddyInvitationFunction = functions.region('us-central1').https.onCall(async (data, context) => {
  // Verify the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const { currentUserUid, currentUserEmail, currentUserName, targetEmail, message } = data as {
      currentUserUid: string;
      currentUserEmail: string;
      currentUserName?: string;
      targetEmail: string;
      message: string;
    };

    if (!currentUserUid || !currentUserEmail) {
      throw new functions.https.HttpsError('invalid-argument', 'Current user data is invalid');
    }

    const normalizedTargetEmail = (targetEmail || '').trim().toLowerCase();
    if (!normalizedTargetEmail) {
      throw new functions.https.HttpsError('invalid-argument', 'Target user email is required');
    }

    if (!message) {
      throw new functions.https.HttpsError('invalid-argument', 'Message is required');
    }

    const targetSnapshot = await db.collection('users')
      .where('email', '==', normalizedTargetEmail)
      .limit(1)
      .get();

    if (targetSnapshot.empty) {
      throw new functions.https.HttpsError('not-found', `No user found for ${normalizedTargetEmail}`);
    }

    const targetData = targetSnapshot.docs[0].data();
    const targetUserId = targetSnapshot.docs[0].id;

    // Create the invitation record with admin privileges
    const invitation = {
      fromUserId: currentUserUid,
      fromUserName: currentUserName || currentUserEmail,
      fromUserEmail: currentUserEmail,
      toUserId: targetUserId,
      toUserEmail: targetData.email || normalizedTargetEmail,
      toUserName: targetData.fullName || `${targetData.firstName || ''} ${targetData.lastName || ''}`.trim() || normalizedTargetEmail,
      message: message,
      status: 'pending',
      createdAt: admin.firestore.Timestamp.now()
    };

    await db.collection('buddy_invitations').add(invitation);

    return { success: true, message: 'Buddy invitation sent successfully' };
  } catch (error: any) {
    console.error('sendBuddyInvitationFunction error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', error.message || 'Error sending buddy invitation');
  }
});

export const sendBuddyInvitationHttp = functions.region('us-central1').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method Not Allowed' });
    return;
  }

  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!idToken) {
      res.status(401).json({ success: false, message: 'Missing auth token' });
      return;
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const currentUserUid = decodedToken.uid;
    const currentUserEmail = decodedToken.email || '';

    const { currentUserName, targetEmail, message } = req.body as {
      currentUserName?: string;
      targetEmail: string;
      message: string;
    };

    const normalizedTargetEmail = (targetEmail || '').trim().toLowerCase();
    if (!currentUserUid || !currentUserEmail || !normalizedTargetEmail || !message) {
      res.status(400).json({ success: false, message: 'Invalid request payload' });
      return;
    }

    const targetSnapshot = await db.collection('users')
      .where('email', '==', normalizedTargetEmail)
      .limit(1)
      .get();

    if (targetSnapshot.empty) {
      res.status(404).json({ success: false, message: `No user found for ${normalizedTargetEmail}` });
      return;
    }

    const targetData = targetSnapshot.docs[0].data();
    const targetUserId = targetSnapshot.docs[0].id;

    const invitation = {
      fromUserId: currentUserUid,
      fromUserName: currentUserName || currentUserEmail,
      fromUserEmail: currentUserEmail,
      toUserId: targetUserId,
      toUserEmail: targetData.email || normalizedTargetEmail,
      toUserName: targetData.fullName || `${targetData.firstName || ''} ${targetData.lastName || ''}`.trim() || normalizedTargetEmail,
      message,
      status: 'pending',
      createdAt: admin.firestore.Timestamp.now()
    };

    await db.collection('buddy_invitations').add(invitation);

    res.status(200).json({ success: true, message: 'Buddy invitation sent successfully' });
  } catch (error: any) {
    console.error('sendBuddyInvitationHttp error:', error);
    res.status(500).json({ success: false, message: error?.message || 'Error sending buddy invitation' });
  }
});

// export const sendBuddyInvitationFunction = functions.region('us-central1').https.onCall(async (data, context) => {
//   // Verify the user is authenticated
//   if (!context.auth) {
//     throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
//   }

//   try {
//     const { currentUserUid, currentUserEmail, currentUserName, targetEmail, message } = data as {
//       currentUserUid: string;
//       currentUserEmail: string;
//       currentUserName?: string;
//       targetEmail: string;
//       message: string;
//     };

//     if (!currentUserUid || !currentUserEmail) {
//       throw new functions.https.HttpsError('invalid-argument', 'Current user data is invalid');
//     }

//     const normalizedTargetEmail = (targetEmail || '').trim().toLowerCase();
//     if (!normalizedTargetEmail) {
//       throw new functions.https.HttpsError('invalid-argument', 'Target user email is required');
//     }

//     if (!message) {
//       throw new functions.https.HttpsError('invalid-argument', 'Message is required');
//     }

//     const targetSnapshot = await db.collection('users')
//       .where('email', '==', normalizedTargetEmail)
//       .limit(1)
//       .get();

//     if (targetSnapshot.empty) {
//       throw new functions.https.HttpsError('not-found', `No user found for ${normalizedTargetEmail}`);
//     }

//     const targetData = targetSnapshot.docs[0].data();
//     const targetUserId = targetSnapshot.docs[0].id;

//     // Create the invitation record with admin privileges
//     const invitation = {
//       fromUserId: currentUserUid,
//       fromUserName: currentUserName || currentUserEmail,
//       fromUserEmail: currentUserEmail,
//       toUserId: targetUserId,
//       toUserEmail: targetData.email || normalizedTargetEmail,
//       toUserName: targetData.fullName || `${targetData.firstName || ''} ${targetData.lastName || ''}`.trim() || normalizedTargetEmail,
//       message: message,
//       status: 'pending',
//       createdAt: admin.firestore.Timestamp.now()
//     };

//     await db.collection('buddy_invitations').add(invitation);

//     return { success: true, message: 'Buddy invitation sent successfully' };
//   } catch (error: any) {
//     console.error('sendBuddyInvitationFunction error:', error);
//     if (error instanceof functions.https.HttpsError) {
//       throw error;
//     }
//     throw new functions.https.HttpsError('internal', error.message || 'Error sending buddy invitation');
//   }
// });
