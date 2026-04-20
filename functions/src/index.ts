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
