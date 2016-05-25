class SignalingMessage extends AV.TypedMessage {
  constructor(data) {
    super();
    this.data = data;
    this.setTransient(true);
  }
}
AV.messageType(-100)(SignalingMessage);
AV.messageField('data')(SignalingMessage);
class Offer extends SignalingMessage {}
AV.messageType(-101)(Offer);
class Answer extends SignalingMessage {}
AV.messageType(-102)(Answer);
class Refusal extends SignalingMessage {}
AV.messageType(-103)(Refusal);
class ICECandidate extends SignalingMessage {}
AV.messageType(-104)(ICECandidate);

var configuration = {
  iceServers: [
    {urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302',
      'stun:stun.ekiga.net',
      'stun:stun.ideasip.com',
      'stun:stun.rixtelecom.se',
      'stun:stun.schlund.de',
      'stun:stun.stunprotocol.org:3478',
      'stun:stun.voiparound.com',
      'stun:stun.voipbuster.com',
      'stun:stun.voipstunt.com',
      'stun:stun.voxgratia.org',
    ]},
  ]
};
var APP_ID = 'nOmzEDu7NtMDBXUJJhIw9bNs-gzGzoHsz';
var realtime = new AV.Realtime({
  appId: APP_ID,
});
realtime.register([Offer, Answer, Refusal, ICECandidate]);

var mediaConstraints = {
  audio: true,
  video: true,
};

var vm = new Vue({
  el: '#app',
  data: {
    client: null,
    conversation: null,
    peerConnection: null,
    state: 0,
    id: '',
    targetId: '',
    offer: null,
  },
  methods: {
    createPeerConnection: function () {
      var connection = new RTCPeerConnection(configuration);
      connection.onicecandidate = this.handleICECandidateEvent;
      connection.onaddstream = this.handleAddStreamEvent;
      connection.onnremovestream = this.handleRemoveStreamEvent;
      connection.oniceconnectionstatechange = this.handleICEConnectionStateChangeEvent;
      connection.onsignalingstatechange = this.handleSignalingStateChangeEvent;
      return connection;
    },
    destoryPeerConnection: function (connection) {
      connection.onaddstream = null;
      connection.onremovestream = null;
      connection.onnicecandidate = null;
      connection.oniceconnectionstatechange = null;
      connection.onsignalingstatechange = null;
      connection.onicegatheringstatechange = null;
      connection.onnegotiationneeded = null;
    },
    login: function login() {
      // specific the client tag to ensure there is only one client online.
      return realtime.createIMClient(this.id, {}, 'webtrc').then((client) => {
        this.client = client;
        client.on('message', (message) => {
          if (!(message instanceof SignalingMessage)) {
            return;
          }
          if (message instanceof Offer) {
            return this.handleOffer(message);
          }
          if (message instanceof Answer) {
            return this.handleAnswer(message);
          }
          if (message instanceof Refusal) {
            return this.handleRefusal(message);
          }
          if (message instanceof ICECandidate) {
            return this.handleICECandidate(message);
          }
        });
        this.state = 'ready';
      }).catch(console.error.bind(console));
    },
    getLocalStream: function () {
      if (!this.localStream) {
        this.localStream = navigator.mediaDevices.getUserMedia(mediaConstraints);
        this.localStream.then((localStream) => {
          document.getElementById('local_video').srcObject = localStream;
        });
      }
      return this.localStream;
    },
    call: function call() {
      return this.getLocalStream()
        .then((localStream) => {
          if (this.targetId === '') {
            return alert('target id required');
          }
          if (!this.client) {
            return alert('not logged in');
          }
          return this.client.ping([this.targetId])
            .then((onlineClients) => {
              if (!onlineClients.length) {
                alert(this.targetId + ' is not online');
                return Promise.reject(new Error(this.targetId + ' is not online'));
              }
              this.peerConnection = this.createPeerConnection();
              var promise = new Promise((resolve) => {
                this.peerConnection.onnegotiationneeded = resolve;
              });
              this.peerConnection.addStream(localStream);
              return promise;
            })
            .then(() =>
              Promise.all([
                this.client.createConversation({
                  members: [this.targetId],
                  unique: true,
                }),
                this.peerConnection.createOffer().then((localDescription) => {
                  this.peerConnection.setLocalDescription(localDescription);
                }),
              ])
            )
            .then((results) => {
              this.conversation = results[0];
              this.conversation.send(new Offer(this.peerConnection.localDescription));
            });
        }).catch(console.error.bind(console));
    },
    handleOffer: function handleOffer(offer) {
      this.offer = offer;
      this.peerConnection = this.createPeerConnection();
      var desc = new RTCSessionDescription(offer.data);
      this.handleOfferPromise = this.peerConnection.setRemoteDescription(desc);
    },
    accept: function accept() {
      this.destoryPeerConnection(this.peerConnection);
      return this.getLocalStream().then((localStream) => {
        var offer = this.offer;
        this.offer = null;
        this.targetId = offer.from;
        this.state = 'connected';
        return this.handleOfferPromise
          .then(() => this.peerConnection.addStream(localStream))
          .then(() => this.peerConnection.createAnswer())
          .then((answer) => this.peerConnection.setLocalDescription(answer))
          .then(() => this.client.getConversation(offer.cid))
          .then((conversation) => {
            this.conversation = conversation;
            return conversation.send(new Answer(this.peerConnection.localDescription));
          });
      }).catch(console.error.bind(console));
    },
    decline: function decline() {
      this.destoryPeerConnection(this.peerConnection);
      delete this.handleOfferPromise;
      delete this.peerConnection;
      return this.client.getConversation(this.offer.cid).then((conversation) => {
        return conversation.send(new Refusal());
      }).then(() => {
        this.offer = null;
      }).catch(console.error.bind(console));
    },
    handleAnswer: function handleAnswer(answer) {
      var desc = new RTCSessionDescription(answer.data);
      this.peerConnection.setRemoteDescription(desc);
      this.state = 'connected';
    },
    handleRefusal: function handleRefusal() {
      alert(this.targetId + ' refused the call');
    },
    handleICECandidateEvent: function handleICECandidateEvent(event) {
      if (event.candidate && this.conversation) {
        return this.conversation.send(new ICECandidate(event.candidate))
          .catch(console.error.bind(console));
      }
    },
    handleICECandidate: function handleICECandidate(candidateMessage) {
      var candidate = new RTCIceCandidate(candidateMessage.data);
      if (this.peerConnection) {
        this.peerConnection.addIceCandidate(candidate)
          .catch(console.error.bind(console));
      }
    },
    handleAddStreamEvent: function handleAddStreamEvent(event) {
      document.getElementById('remote_video').srcObject = event.stream;
    },
    handleRemoveStreamEvent: function () {
      this.hangup();
    },
    hangup: function hungup() {
      this.destoryPeerConnection(this.peerConnection);
      this.peerConnection.close();
      delete this.peerConnection;
      delete this.localStream;
      this.state = 'ready';

      var remoteVideo = document.getElementById('remote_video');
      var localVideo = document.getElementById('local_video');
      if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      }
      if (localVideo.srcObject) {
        localVideo.srcObject.getTracks().forEach(track => track.stop());
      }
      remoteVideo.src = '';
      localVideo.src = '';
    },
    handleICEConnectionStateChangeEvent: function (event) {
      switch (this.peerConnection.iceConnectionState) {
        case 'closed':
        case 'failed':
        case 'disconnected':
          this.hangup();
          break;
      }
    },
    handleSignalingStateChangeEvent: function (event) {
      switch (this.peerConnection.signalingState) {
        case 'closed':
          this.hangup();
          break;
      }
    },
  },
});
