// ==========================
// ELEMENTS
// ==========================
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const captureBtn = document.getElementById("captureBtn");
const downloadBtn = document.getElementById("downloadBtn");
const switchBtn = document.getElementById("switchBtn");

const countdown = document.getElementById("countdown");
const loadingOverlay = document.getElementById("loadingOverlay");

// ==========================
// STATE
// ==========================
let stream = null;
let useFrontCamera = true;
let cameraStarted = false;

let backgroundImageData = null;
let peopleLayers = [];

let aiProcessing = false;
let captureRequested = false;

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
// UI HELPERS
// ==========================
function showPopup(message) {
  document.getElementById("popupMessage").innerText = message;
  document.getElementById("customPopup").classList.remove("hidden");
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

function showLoading() {
  loadingOverlay.classList.remove("hidden");
}

// ==========================
// CAMERA
// ==========================
async function startCamera() {

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: useFrontCamera ? "user" : "environment" }
  });

  video.srcObject = stream;
  await video.play();

  cameraStarted = true;
}

switchBtn.addEventListener("click", async () => {
  useFrontCamera = !useFrontCamera;
  await startCamera();
});

// ==========================
// CAPTURE BUTTON
// ==========================
captureBtn.addEventListener("click", async () => {

  if (!cameraStarted) {
    await startCamera();
    captureBtn.innerText = "Lock Background";
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // FIRST CLICK = LOCK BACKGROUND
  if (!backgroundImageData) {
    ctx.drawImage(video, 0, 0);
    backgroundImageData = canvas.toDataURL("image/png");
    renderPreview();
    captureBtn.innerText = "Add Person";
    showPopup("Background locked. Now add people.");
    return;
  }

  // ADD PERSON
  if (aiProcessing) return;

  aiProcessing = true;
  captureRequested = true;
  showLoading();

  // 🔥 SEND VIDEO DIRECTLY (MOST STABLE)
  await selfieSegmentation.send({ image: video });
});

// ==========================
// HANDLE RESULTS
// ==========================
function handleResults(results) {

  if (!captureRequested) return;

  captureRequested = false;

  if (!results.segmentationMask) {
    hideLoading();
    aiProcessing = false;
    showPopup("Segmentation failed.");
    return;
  }

  const personCanvas = document.createElement("canvas");
  personCanvas.width = canvas.width;
  personCanvas.height = canvas.height;
  const personCtx = personCanvas.getContext("2d");

  // Draw mask
  personCtx.drawImage(results.segmentationMask, 0, 0);

  // Smooth edges
  personCtx.filter = "blur(2px)";
  personCtx.drawImage(personCanvas, 0, 0);
  personCtx.filter = "none";

  // Keep only person
  personCtx.globalCompositeOperation = "source-in";
  personCtx.drawImage(results.image, 0, 0);

  peopleLayers.push(personCanvas.toDataURL("image/png"));

  renderPreview();

  hideLoading();
  aiProcessing = false;

  showPopup("Person added successfully!");
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
    showPopup("Nothing to download.");
    return;
  }

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "ScattoGo_Pro_Final.png";
  link.click();
});
