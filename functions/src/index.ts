import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const emailConfig = functions.config().email || {};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: emailConfig.user,
    pass: emailConfig.pass
  }
});

interface PushMessagePayload {
  title: string;
  body: string;
  data?: { [key: string]: any };
}

// Helper function to set CORS headers
function setCorsHeaders(res: any): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
}

// FCM data values must be strings.
// This converts objects/arrays/numbers/booleans into safe string values.
function normalizePushData(input?: { [key: string]: any }): { [key: string]: string } {
  const output: { [key: string]: string } = {};

  if (!input) {
    return output;
  }

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === 'string') {
      output[key] = value;
    } else {
      output[key] = JSON.stringify(value);
    }
  }

  return output;
}

/* =====================================================
   SEND EMERGENCY PUSH NOTIFICATION
   Called by Angular EmergencyNotificationService
   ===================================================== */
export const sendEmergencyPush = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({
        success: false,
        message: 'Method Not Allowed'
      });
      return;
    }

    try {
      const { targetUserId, message } = req.body as {
        targetUserId?: string;
        message?: PushMessagePayload;
      };

      if (!targetUserId || !message) {
        res.status(400).json({
          success: false,
          message: 'Missing targetUserId or message'
        });
        return;
      }

      const userDoc = await db.collection('users').doc(targetUserId).get();

      if (!userDoc.exists) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      const userData = userDoc.data() || {};

      const tokens = [
        userData.fcmToken,
        ...(Array.isArray(userData.pushTokens) ? userData.pushTokens : [])
      ].filter((token): token is string => {
        return typeof token === 'string' && token.trim().length > 0;
      });

      const uniqueTokens = Array.from(new Set(tokens));

      if (uniqueTokens.length === 0) {
        res.status(200).json({
          success: false,
          message: 'No FCM token found for user'
        });
        return;
      }

      const pushData = normalizePushData(message.data);

      const result = await admin.messaging().sendEachForMulticast({
        tokens: uniqueTokens,

        notification: {
          title: message.title || 'EMERGENCY ALERT',
          body: message.body || 'Emergency help needed'
        },

        data: pushData,

        android: {
          priority: 'high',
          notification: {
            channelId: 'emergency_alerts',
            sound: 'default',
            priority: 'high'
          }
        }
      });

      console.log('sendEmergencyPush result:', {
        targetUserId,
        tokenCount: uniqueTokens.length,
        successCount: result.successCount,
        failureCount: result.failureCount
      });

      res.status(200).json({
        success: result.successCount > 0,
        successCount: result.successCount,
        failureCount: result.failureCount
      });

    } catch (err: any) {
      console.error('sendEmergencyPush error:', err);

      res.status(500).json({
        success: false,
        message: err?.message || 'Error sending push'
      });
    }
  });

/* =====================================================
   SEND BUDDY INVITATION - CALLABLE FUNCTION
   ===================================================== */
export const sendBuddyInvitationFunction = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    try {
      const {
        currentUserUid,
        currentUserEmail,
        currentUserName,
        targetEmail,
        message
      } = data as {
        currentUserUid: string;
        currentUserEmail: string;
        currentUserName?: string;
        targetEmail: string;
        message: string;
      };

      if (!currentUserUid || !currentUserEmail) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Current user data is invalid'
        );
      }

      const normalizedTargetEmail = (targetEmail || '').trim().toLowerCase();

      if (!normalizedTargetEmail) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Target user email is required'
        );
      }

      if (!message) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Message is required'
        );
      }

      const targetSnapshot = await db
        .collection('users')
        .where('email', '==', normalizedTargetEmail)
        .limit(1)
        .get();

      if (targetSnapshot.empty) {
        throw new functions.https.HttpsError(
          'not-found',
          `No user found for ${normalizedTargetEmail}`
        );
      }

      const targetData = targetSnapshot.docs[0].data();
      const targetUserId = targetSnapshot.docs[0].id;

      const invitation = {
        fromUserId: currentUserUid,
        fromUserName: currentUserName || currentUserEmail,
        fromUserEmail: currentUserEmail,
        toUserId: targetUserId,
        toUserEmail: targetData.email || normalizedTargetEmail,
        toUserName:
          targetData.fullName ||
          `${targetData.firstName || ''} ${targetData.lastName || ''}`.trim() ||
          normalizedTargetEmail,
        message,
        status: 'pending',
        createdAt: admin.firestore.Timestamp.now()
      };

      await db.collection('buddy_invitations').add(invitation);

      return {
        success: true,
        message: 'Buddy invitation sent successfully'
      };

    } catch (error: any) {
      console.error('sendBuddyInvitationFunction error:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Error sending buddy invitation'
      );
    }
  });

/* =====================================================
   SEND BUDDY INVITATION - HTTP FUNCTION
   ===================================================== */
export const sendBuddyInvitationHttp = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({
        success: false,
        message: 'Method Not Allowed'
      });
      return;
    }

    try {
      const authHeader = req.headers.authorization || '';
      const idToken = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : '';

      if (!idToken) {
        res.status(401).json({
          success: false,
          message: 'Missing auth token'
        });
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
        res.status(400).json({
          success: false,
          message: 'Invalid request payload'
        });
        return;
      }

      const targetSnapshot = await db
        .collection('users')
        .where('email', '==', normalizedTargetEmail)
        .limit(1)
        .get();

      if (targetSnapshot.empty) {
        res.status(404).json({
          success: false,
          message: `No user found for ${normalizedTargetEmail}`
        });
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
        toUserName:
          targetData.fullName ||
          `${targetData.firstName || ''} ${targetData.lastName || ''}`.trim() ||
          normalizedTargetEmail,
        message,
        status: 'pending',
        createdAt: admin.firestore.Timestamp.now()
      };

      await db.collection('buddy_invitations').add(invitation);

      res.status(200).json({
        success: true,
        message: 'Buddy invitation sent successfully'
      });

    } catch (error: any) {
      console.error('sendBuddyInvitationHttp error:', error);

      res.status(500).json({
        success: false,
        message: error?.message || 'Error sending buddy invitation'
      });
    }
  });

/* =====================================================
   SEND DOCTOR WELCOME EMAIL
   ===================================================== */
export const sendDoctorWelcomeEmail = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { email, firstName } = data as {
      email: string;
      firstName?: string;
    };

    if (!email) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Email is required'
      );
    }

    try {
      await transporter.sendMail({
        from: `"AllerAid" <${emailConfig.user}>`,
        to: email,
        subject: 'Thank you for registering with AllerAid',
        html: `
          <h2>Welcome to AllerAid, Dr. ${firstName || ''}!</h2>
          <p>Thank you for registering as a doctor in AllerAid.</p>
          <p>Your medical license has been submitted for admin verification.</p>
          <p>You will be notified once your doctor account is approved.</p>
          <br>
          <p>Thank you,<br>AllerAid Team</p>
        `
      });

      return { success: true };

    } catch (error: any) {
      console.error('sendDoctorWelcomeEmail error:', error);

      throw new functions.https.HttpsError(
        'internal',
        error?.message || 'Failed to send welcome email'
      );
    }
  });