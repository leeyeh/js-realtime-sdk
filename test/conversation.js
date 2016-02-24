import Realtime from '../src/realtime';
// import { Promise } from 'rsvp';

import {
  APP_ID,
  APP_KEY,
  REGION,
  EXISTING_ROOM_ID,
  CLIENT_ID,
} from './configs';

describe('Conversation', () => {
  let client;
  let conversation;
  before(() =>
    new Realtime({
      appId: APP_ID,
      appKey: APP_KEY,
      region: REGION,
      pushUnread: false,
    })
      .createIMClient(CLIENT_ID)
      .then(c => {
        client = c;
        return client.getConversation(EXISTING_ROOM_ID);
      })
      .then(conv => (conversation = conv))
  );
  after(() => {
    console.log(conversation, client);
    client.close();
  });

  it('test', () => {
    (1).should.be.ok();
  });
});
