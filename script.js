// ==========================
// ELEMENTS
// ==========================
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const captureBtn = document.getElementById("captureBtn");
const downloadBtn = document.getElementById("downloadBtn");
const switchBtn = document.getElementById("switchBtn");

const loadingOverlay = document.getElementById("loadingOverlay");

// ==========================
// STATE
// ==========================
let backgroundImageData = null;
let peopleLayers = [];
let cameraInstance = null;
let useFrontCamera = true;
let captureNextFrame = false;

// ==========================
// MEDIAPIPE SETUP
// ==========================
const selfieSegmentation = new SelfieSegmentation({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
});

selfieSegmentation.setOptions({
  modelSelection: 1
});

selfieSegmentation.onResults(handleResults);

// ==========================
// START CAMERA USING MEDIAPIPE CAMERA CLASS
// ==========================
async function startCamera() {

  if (cameraInstance) {
    cameraInstance.stop();
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: useFrontCamera ? "user" : "environment" }
  });

  video.srcObject = stream;

  cameraInstance = new Camera(video, {
    onFrame: async () => {
      if (captureNextFrame) {
        captureNextFrame = false;
        await selfieSegmentation.send({ image: video });
      }
    },
    width: 640,
    height: 480
  });

  cameraInstance.start();
}

switchBtn.addEventListener("click", async () => {
  useFrontCamera = !useFrontCamera;
  await startCamera();
});

// ==========================
// CAPTURE BUTTON
// ==========================
captureBtn.addEventListener("click", async () => {

  if (!video.srcObject) {
    await startCamera();
    captureBtn.innerText = "Lock Background";
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // LOCK BACKGROUND
  if (!backgroundImageData) {
    ctx.drawImage(video, 0, 0);
    backgroundImageData = canvas.toDataURL("image/png");
    renderPreview();
    captureBtn.innerText = "Add Person";
    alert("Background locked. Now add people.");
    return;
  }

  // ADD PERSON
  loadingOverlay.classList.remove("hidden");
  captureNextFrame = true;
});

// ==========================
// HANDLE RESULTS
// ==========================
function handleResults(results) {

  loadingOverlay.classList.add("hidden");

  if (!results.segmentationMask) {
    alert("Segmentation failed.");
    return;
  }

  const personCanvas = document.createElement("canvas");
  personCanvas.width = canvas.width;
  personCanvas.height = canvas.height;
  const personCtx = personCanvas.getContext("2d");

  personCtx.drawImage(results.segmentationMask, 0, 0);

  personCtx.globalCompositeOperation = "source-in";
  personCtx.drawImage(results.image, 0, 0);

  peopleLayers.push(personCanvas.toDataURL("image/png"));

  renderPreview();
}

// ==========================
// RENDER PREVIEW
// ==========================
function renderPreview() {

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!backgroundImageData) return;

  const bg = new Image();
  bg.src = backgroundImageData;

  bg.onload = () => {
    ctx.drawImage(bg, 0, 0);

    peopleLayers.forEach(layer => {
      const img = new Image();
      img.src = layer;
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
    });
  };
}

// ==========================
// DOWNLOAD
// ==========================
downloadBtn.addEventListener("click", () => {

  if (!backgroundImageData) {
    alert("Nothing to download.");
    return;
  }

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "ScattoGo_Pro_Final.png";
  link.click();
});
