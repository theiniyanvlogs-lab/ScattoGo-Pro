const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const captureBtn = document.getElementById("captureBtn");
const switchBtn = document.getElementById("switchBtn");
const countdown = document.getElementById("countdown");
const ctx = canvas.getContext("2d");

let cameraStarted = false;
let firstImageData = null;
let stream = null;
let processing = false;
let useFrontCamera = true;
let aiProcessing = false;

// =========================
// Setup MediaPipe
// =========================
const selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
});

selfieSegmentation.setOptions({
    modelSelection: 1
});

selfieSegmentation.onResults(handleResults);

// =========================
// Countdown
// =========================
function startCountdown(seconds) {
    return new Promise(resolve => {
        countdown.style.display = "block";
        let counter = seconds;

        const interval = setInterval(() => {
            countdown.innerText = counter;
            counter--;

            if (counter < 0) {
                clearInterval(interval);
                countdown.style.display = "none";
                resolve();
            }
        }, 1000);
    });
}

// =========================
// Start Camera
// =========================
async function startCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    stream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: useFrontCamera ? "user" : "environment"
        }
    });

    video.srcObject = stream;
    cameraStarted = true;
}

// =========================
// Switch Camera
// =========================
if (switchBtn) {
    switchBtn.addEventListener("click", async () => {
        useFrontCamera = !useFrontCamera;
        await startCamera();
    });
}

// =========================
// Capture Logic
// =========================
captureBtn.addEventListener("click", async () => {

    if (processing || aiProcessing) return;

    if (!cameraStarted) {
        await startCamera();
        captureBtn.innerText = "Take First Photo";
        return;
    }

    processing = true;
    await startCountdown(3);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    // FIRST PHOTO = BACKGROUND LOCK
    if (!firstImageData) {
        firstImageData = canvas.toDataURL("image/png");
        captureBtn.innerText = "Take Second Photo";
        alert("Background locked. Join group and click again.");
        processing = false;
        return;
    }

    // SECOND PHOTO → AI CUTOUT
    aiProcessing = true;
    await selfieSegmentation.send({ image: video });
});

// =========================
// AI Merge Logic (PRO)
// =========================
function handleResults(results) {

    const backgroundImage = new Image();
    backgroundImage.src = firstImageData;

    backgroundImage.onload = () => {

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1️⃣ Draw Locked Background
        ctx.drawImage(backgroundImage, 0, 0);

        // 2️⃣ Create temporary canvas for person cutout
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext("2d");

        // Draw mask
        tempCtx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);

        // Keep only person area
        tempCtx.globalCompositeOperation = "source-in";
        tempCtx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 3️⃣ Draw only person over background
        ctx.drawImage(tempCanvas, 0, 0);

        const finalImage = canvas.toDataURL("image/png");

        const link = document.createElement("a");
        link.href = finalImage;
        link.download = "ScattoGo_Pro_Group.png";
        link.click();

        alert("Smart AI Group Photo Created!");

        resetApp();
    };
}

// =========================
// Reset
// =========================
function resetApp() {
    firstImageData = null;
    processing = false;
    aiProcessing = false;
    cameraStarted = false;
    captureBtn.innerText = "Start Camera";

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
}
