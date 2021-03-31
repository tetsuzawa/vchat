const Peer = window.Peer;

(async function main() {
  console.log("running main");
  const localVideo = document.getElementById("js-local-stream");
  const joinTrigger = document.getElementById("js-join-trigger");
  const leaveTrigger = document.getElementById("js-leave-trigger");
  const remoteVideos = document.getElementById("js-remote-streams");
  const roomId = document.getElementById("js-room-id");
  const roomMode = document.getElementById("js-room-mode");
  const localText = document.getElementById("js-local-text");
  const sendTrigger = document.getElementById("js-send-trigger");
  const messages = document.getElementById("js-messages");
  const meta = document.getElementById("js-meta");
  const sdkSrc = document.querySelector("script[src*=skyway]");


  meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : "unknown"}
  `.trim();

  const getRoomModeByHash = () => (location.hash === "#sfu" ? "sfu" : "mesh");

  roomMode.textContent = getRoomModeByHash();
  window.addEventListener(
    "hashchange",
    () => (roomMode.textContent = getRoomModeByHash()),
  );

  const localStream = await navigator.mediaDevices
    .getUserMedia({
      audio: {
        echoCancellation: true,
        echoCancellationType: "system",
        noiseSuppression: true,
      },
      video: true,
    })
    .catch(console.error);

  // Render local stream
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);

  // eslint-disable-next-line require-atomic-updates
  const peer = (window.peer = new Peer({
    key: window.__SKYWAY_KEY__,
    debug: 3,
  }));

  // Register join handler
  joinTrigger.addEventListener("click", () => {
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }

    const room = peer.joinRoom(roomId.value, {
      mode: getRoomModeByHash(),
      stream: localStream,
    });

    room.once("open", () => {
      messages.textContent += "=== You joined ===\n";
    });
    room.on("peerJoin", peerId => {
      messages.textContent += `=== ${peerId} joined ===\n`;
    });

    // Render remote stream for new peer join in the room
    room.on("stream", async stream => {


      const newVideo = document.createElement("video");
      newVideo.srcObject = stream;
      newVideo.playsInline = true;
      // newVideo.muted = true;

      // mark peerId to find it later at peerLeave event
      newVideo.setAttribute("data-peer-id", stream.peerId);
      remoteVideos.append(newVideo);

      // ------------------------------------------------------------------------------
      const audioctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = new MediaStreamAudioSourceNode(audioctx, {mediaStream: stream});

      const splitter = audioctx.createChannelSplitter(2);
      const panner = audioctx.createPanner();
      panner.panningModel = "HRTF";
      console.log("splitter", splitter);
      source.connect(splitter);
      splitter.connect(panner);
      panner.connect(audioctx.destination);
      window.audioCtxs.set(stream.peerId, audioctx);
      window.panners.set(stream.peerId, panner);

      const newRadioButtonLabel = document.createElement("label");
      newRadioButtonLabel.id = "label-" + stream.peerId;
      newRadioButtonLabel.innerText = stream.peerId;
      newRadioButtonLabel.htmlFor = "radio-button-" + stream.peerId;

      const newRadioButton = document.createElement("input");
      newRadioButton.id = "radio-button-" + stream.peerId;
      newRadioButton.name = "pannerTarget";
      newRadioButton.value = stream.peerId;
      newRadioButton.type = "radio";
      newRadioButton.checked = true;
      newRadioButtonLabel.appendChild(newRadioButton);


      const pannerTargetList = document.getElementById("panner-target-list");
      pannerTargetList.appendChild(newRadioButtonLabel);
      pannerTargetList.appendChild(document.createElement("br"));
      // ------------------------------------------------------------------------------

      await newVideo.play().catch(console.error);
    });

    room.on("data", ({data, src}) => {
      // Show a message sent to the room and who sent
      messages.textContent += `${src}: ${data}\n`;
    });

    // for closing room members
    room.on("peerLeave", peerId => {
      const remoteVideo = remoteVideos.querySelector(
        `[data-peer-id="${peerId}"]`,
      );
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();

      window.audioCtxs.get(peerId).close();
      window.panners.get(peerId).close();
      const label = document.getElementById("label-" + peerId);
      label.innerHTML="";
      label.remove();

      messages.textContent += `=== ${peerId} left ===\n`;
    });

    // for closing myself
    room.once("close", () => {
      sendTrigger.removeEventListener("click", onClickSend);
      messages.textContent += "== You left ===\n";
      Array.from(remoteVideos.children).forEach(remoteVideo => {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
      });
    });

    sendTrigger.addEventListener("click", onClickSend);
    leaveTrigger.addEventListener("click", () => room.close(), {once: true});

    function onClickSend() {
      // Send message to all of the peers in the room via websocket
      room.send(localText.value);

      messages.textContent += `${peer.id}: ${localText.value}\n`;
      localText.value = "";
    }
  });

  // ------------------------------------------------------

  // window.addEventListener('load', async () => {

  window.audioCtxs = new Map();
  window.panners = new Map();

  let px, py, pz;
  px = py = pz = 0;

  const cv = document.getElementById("cv");
  const canvasctx = cv.getContext("2d");
  cv.addEventListener("mousemove", Mouse);
  cv.addEventListener("mousedown", Mouse);

  function Draw() {
    console.log("Draw");
    canvasctx.fillStyle = "#444";
    canvasctx.fillRect(0, 0, 200, 200);
    canvasctx.fillRect(210, 0, 20, 200);
    canvasctx.fillStyle = "#080";
    canvasctx.fillRect(219, 0, 2, 200);
    canvasctx.fillStyle = "#f00";
    canvasctx.fillRect(0, 99, 200, 3);
    canvasctx.fillStyle = "#08f";
    canvasctx.fillRect(99, 0, 3, 200);
    canvasctx.fillStyle = "#fff";
    canvasctx.strokeStyle = "#fff";
    canvasctx.beginPath();
    canvasctx.arc(100 + px * 10, 100 + pz * 10, 5, 0, 360, false);
    canvasctx.arc(220, 100 - py * 10, 5, 0, 360, false);
    canvasctx.fill();
  }

  Draw();

  function Mouse(e) {
    let b;
    if (!e) e = window.event;
    if (typeof (e.buttons) === "undefined")
      b = e.which;
    else
      b = e.buttons;
    if (b) {
      const rc = e.target.getBoundingClientRect();
      const x = (e.clientX - rc.left) | 0;
      const y = (e.clientY - rc.top) | 0;
      if (x < 200) {
        document.getElementById("posx").value = (x - 100) * 0.1;
        document.getElementById("posz").value = (y - 100) * 0.1;
        SetupPos();
      }
      if (x >= 210) {
        document.getElementById("posy").value = (100 - y) * 0.1;
        SetupPos();
      }
    }
  }

  // document.getElementById('panmodel').addEventListener('change', SetupModel);
  document.getElementById("posx").addEventListener("input", SetupPos);
  document.getElementById("posy").addEventListener("input", SetupPos);
  document.getElementById("posz").addEventListener("input", SetupPos);

  function SetupPos() {
    const peerId = GetCurrentPannerTargetPeerId();
    console.log("SetupPos peerId: ", peerId);
    if (peerId === null || peerId === undefined || peerId === "") {
      console.log("SetupPos no peerId found");
      return;
    }
    const panner = window.panners.get(peerId);
    console.log("panner: ", panner);
    px = panner.positionX.value = parseFloat(document.getElementById("posxval").innerHTML
      = document.getElementById("posx").value);
    py = panner.positionY.value = parseFloat(document.getElementById("posyval").innerHTML
      = document.getElementById("posy").value);
    pz = panner.positionZ.value = parseFloat(document.getElementById("poszval").innerHTML
      = document.getElementById("posz").value);
    console.log(panner.positionX.value, panner.positionY.value, panner.positionZ.value);
    Draw();
  }

  function GetCurrentPannerTargetPeerId() {
    console.log("GetCurrentPannerTargetPeerId called");
    const pannerTargetList = document.getElementById("panner-target-list");
    const pannerTargetListRadios = pannerTargetList.pannerTarget;
    window.pannerTargetListRadios = pannerTargetListRadios;
    return pannerTargetListRadios.value;
  }

  // });


  peer.on("error", console.error);
})();
