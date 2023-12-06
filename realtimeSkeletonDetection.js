const video = document.getElementById('webcam');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

const constraints = {
    video : {
        width: { ideal: 1280 },
        height: { ideal: 720 }
    }
};

navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.onloadedmetadata = () => {
        video.width = video.videoWidth;
        video.height = video.videoHeight;
        canvas.width = video.width;
        canvas.height = video.height;

        detect();
    };
}).catch((err) => {
    console.log("Error starting webcam:", err);
});

// Creating canvas in the document
document.body.appendChild(canvas);

// Load PoseNet model 
function loadPoseNetModel() {
    return new Promise((resolve, reject) => {
        posenet.load().then((model) => {
            resolve(model);
        }).catch((error) => {
            reject(error);
        });
    });
}

let net;
loadPoseNetModel().then((model) => {
    net = model;
}).catch((error) => {
    console.error("Error loading PoseNet model:", error);
});

// Function to detect people, draw, and estimate height
async function detect() {

    const poses = await net.estimateMultiplePoses(video, {
        flipHorizontal: false,
        maxDetections: 5, // More people the slower 

    });
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    for (const pose of poses) {
        drawBoundingBox(pose.keypoints, 0.5);
        drawSkeletalRepresentation(pose.keypoints, 0.5);
        highlightChest(pose.keypoints, 0.5);

        const height = Math.round(estimateHeight(pose.keypoints));
        displayHeight(height);
    }
    requestAnimationFrame(detect);
}

// Function to draw bounding box 
function drawBoundingBox(keypoints, confidence) {
    const minX = Math.min(...keypoints.filter(point => point.score >= confidence).map(point => point.position.x));
    const minY = Math.min(...keypoints.filter(point => point.score >= confidence).map(point => point.position.y));
    const maxX = Math.max(...keypoints.filter(point => point.score >= confidence).map(point => point.position.x));
    const maxY = Math.max(...keypoints.filter(point => point.score >= confidence).map(point => point.position.y));

    const boxWidth = maxX - minX;
    const boxHeight = maxY - minY;

    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(minX, minY, boxWidth, boxHeight);
}

// Function to draw skeletal representation
function drawSkeletalRepresentation(keypoints, confidence) {
    const skeletalPairs = [
        ['nose', 'leftEye'],
        ['leftEye', 'leftEar'],
        ['nose', 'rightEye'],
        ['rightEye', 'rightEar'],
        ['nose', 'neck'],
        ['rightShoulder', 'leftShoulder'],
        ['neck', 'leftShoulder'],
        ['leftShoulder', 'leftElbow'],
        ['leftElbow', 'leftWrist'],
        ['neck', 'rightShoulder'],
        ['rightShoulder', 'rightElbow'],
        ['rightElbow', 'rightWrist'],
        ['leftShoulder', 'leftHip'],
        ['leftHip', 'rightHip'],
        ['leftHip', 'leftKnee'],
        ['leftKnee', 'leftAnkle'],
        ['rightShoulder', 'rightHip'],
        ['rightHip', 'rightKnee'],
        ['rightKnee', 'rightAnkle'],
    ];

    keypoints.forEach((point) => {
        if (point.score >= confidence) {
            const { x, y } = point.position;
            ctx.beginPath();
            ctx.arc();
            ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx.fill();
            ctx.closePath();
        }
    });

    skeletalPairs.forEach(pair => {
        const [part1, part2] = pair;
        const point1 = keypoints.find(point => point.part === part1);
        const point2 = keypoints.find(point => point.part === part2);

        if (point1 && point2 && point1.score >= confidence && point2.score >= confidence) {
            ctx.beginPath();
            ctx.moveTo(point1.position.x, point1.position.y);
            ctx.lineTo(point2.position.x, point2.position.y);
            ctx.stroke();
            ctx.closePath;
        }
    });
}

// Function to estimate height 
function estimateHeight(keypoints) {
    const ankle = keypoints.find(point => point.part === 'leftAnkle');
    const head = keypoints.find(point => point.part === 'nose');
    const distance = Math.sqrt(Math.pow(ankle.position.x - head.position.x, 2) + Math.pow(ankle.position.y - head.position.y, 2));

    return distance;
}

// Function to highlight chest
function highlightChest(keypoints, minConfidence) {
    const leftShoulder = keypoints.find(point => point.part === 'leftShoulder' && point.score >= minConfidence);
    const rightShoulder = keypoints.find(point => point.part === 'rightShoulder' && point.score >= minConfidence);
    const leftHip = keypoints.find(point => point.part === 'leftHip' && point.score >= minConfidence);
    const rightHip = keypoints.find(point => point.part === 'rightHip' && point.score >= minConfidence);

    if (leftShoulder && leftHip && rightShoulder && rightHip) {
        const chestLeft = calculateMidpoint(leftShoulder, leftHip);
        const chestRight = calculateMidpoint(rightShoulder, rightHip);

        // Calculate the vertical position and height adjustments
        const verticalOffset = (leftHip.position.y - leftShoulder.position.y) / 2.25;
        const adjustedChestTop = chestLeft.y - verticalOffset;
        const adjustedChestHeight = (leftHip.position.y - leftShoulder.position.y) / 4;

        // Calculate the width based on the chest width
        const chestWidth = chestRight.x - chestLeft.x;

        // Draw the adjusted rectangle
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; // White with 50% opacity
        ctx.fillRect(chestLeft.x, adjustedChestTop, chestWidth, adjustedChestHeight);
    }
}

// Function to calculate midpoint between two keypoints
function calculateMidpoint(keypoint1, keypoint2) {
    return { x: (keypoint1.position.x + keypoint2.position.x) / 2, y: (keypoint1.position.y + keypoint2.position.y) / 2 };
}

// Function to display estimate height 
function displayHeight(height, confidence) {
    const head = keypoints.find(point => point.part === 'nose' && point.score >= confidence);
    if (head) {
        const { x, y } = head.position;
        ctx.font = '12px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.textAlign = 'center';
        ctx.fillText(`Estimated height: ${Math.round(height)} pixels`, x, y);
    }
}