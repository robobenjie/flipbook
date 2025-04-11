document.getElementById('videoInput').addEventListener('change', handleVideoUpload);
document.getElementById('sheetInput').addEventListener('change', handleSheetUpload);

function handleVideoUpload(event) {
    console.log('Video upload started');
    const file = event.target.files[0];
    const video = document.createElement('video');
    const frameGrid = document.getElementById('frameGrid');
    
    // Clear previous frames
    frameGrid.innerHTML = '';
    
    // Create canvas element for frame extraction
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // Add all event listeners before setting the source
    video.addEventListener('loadedmetadata', () => {
        console.log('Video metadata loaded');
        console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
        
        // Set both canvas and frame grid to match video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Determine if video is landscape
        const isLandscape = video.videoWidth > video.videoHeight;
        console.log('Is landscape:', isLandscape);
        const orientation = isLandscape ? 'landscape' : 'portrait';
        console.log('Setting orientation to:', orientation);
        
        // Calculate print dimensions for 3x3 grid
        const gridAspectRatio = (video.videoHeight * 3) / (video.videoWidth * 3);
        console.log('Grid aspect ratio:', gridAspectRatio);
        
        // Use appropriate page dimensions based on orientation
        let pageWidth, pageHeight;
        if (isLandscape) {
            pageWidth = 10.5;  // landscape letter width
            pageHeight = 8;    // landscape letter height
        } else {
            pageWidth = 8;     // portrait letter width
            pageHeight = 10.5; // portrait letter height
        }
        console.log('Page dimensions:', pageWidth, 'x', pageHeight);
        const pageAspectRatio = pageHeight / pageWidth;
        
        let printWidth;
        if (gridAspectRatio > pageAspectRatio) {
            // Height limited, calculate width
            printWidth = (pageHeight / gridAspectRatio) + 'in';
        } else {
            // Width limited
            printWidth = pageWidth + 'in';
        }
        console.log('Print width:', printWidth);
        
        // Set the grid container widths
        frameGrid.style.setProperty('--print-width', printWidth);
        frameGrid.style.setProperty('--print-orientation', orientation);
        document.body.style.setProperty('--print-orientation', orientation);
    });

    video.addEventListener('loadeddata', async () => {
        console.log('Video data loaded');
        const duration = video.duration;
        console.log('Video duration:', duration);
        
        const interval = duration / 8; // 8 intervals for 9 frames
        console.log('Frame interval:', interval);
        
        // Extract 9 frames sequentially
        for (let i = 0; i < 9; i++) {
            console.log('Extracting frame', i);
            await extractFrame(video, canvas, context, i * interval, frameGrid);
        }

        // Trigger print after all frames are loaded
        window.print();
    });

    video.addEventListener('error', (e) => {
        console.error('Video error:', e);
    });

    // Set source last
    video.src = URL.createObjectURL(file);
    console.log('Video source set:', video.src);
}

function extractFrame(video, canvas, context, timeOffset, frameGrid) {
    return new Promise((resolve) => {
        console.log('Setting video time to:', timeOffset);
        video.currentTime = timeOffset;
        
        video.addEventListener('seeked', () => {
            console.log('Video seeked to:', video.currentTime);
            // Draw current frame to canvas
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Create image from canvas
            const img = document.createElement('img');
            img.src = canvas.toDataURL();
            img.className = 'frame';
            
            // Add image to grid
            frameGrid.appendChild(img);
            console.log('Frame added to grid');
            resolve();
        }, { once: true });
    });
}

async function handleSheetUpload(event) {
    console.log('Sheet upload started');
    const file = event.target.files[0];
    const img = new Image();
    const gifContainer = document.getElementById('gifContainer');

    // First check if GIF.js is loaded
    if (typeof GIF === 'undefined') {
        console.error('GIF.js library not loaded');
        return;
    }
    
    // Convert the onload callback to a Promise
    await new Promise(resolve => {
        img.onload = () => {
            console.log('Image loaded:', img.width, 'x', img.height);
            resolve();
        };
        img.src = URL.createObjectURL(file);
    });

    // Create canvas to split image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match image
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    console.log('Drew image to canvas');
    
    // Calculate frame dimensions
    const frameWidth = Math.floor(img.width / 3);
    const frameHeight = Math.floor(img.height / 3);
    console.log('Frame dimensions:', frameWidth, 'x', frameHeight);
    
    // Extract frames
    const frames = [];
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = frameWidth;
            frameCanvas.height = frameHeight;
            const frameCtx = frameCanvas.getContext('2d');
            
            frameCtx.drawImage(img,
                x * frameWidth, y * frameHeight, // Source position
                frameWidth, frameHeight, // Source dimensions
                0, 0, // Destination position
                frameWidth, frameHeight // Destination dimensions
            );
            
            frames.push(frameCanvas);
            console.log(`Extracted frame ${frames.length} at position ${x},${y}`);
        }
    }
    
    console.log('Creating GIF with', frames.length, 'frames');
    // Create GIF with optimized settings
    const gif = new GIF({
        workers: 2,
        quality: 10,
        width: frameWidth,
        height: frameHeight,
        workerScript: 'gif.worker.js'  // Use local worker file
    });
    
    // Add frames to GIF
    frames.forEach((frame, index) => {
        const ctx = frame.getContext('2d', { willReadFrequently: true }); // Add optimization flag
        gif.addFrame(frame, {
            delay: 200,
            copy: true
        });
        console.log('Added frame', index + 1, 'to GIF');
    });
    
    // Convert gif.render() to Promise with error handling
    await new Promise((resolve, reject) => {
        gif.on('finished', blob => {
            console.log('GIF generated, size:', blob.size, 'bytes');
            try {
                // Clear previous content
                gifContainer.innerHTML = '';
                
                // Create and display GIF
                const gifImg = document.createElement('img');
                gifImg.onload = () => console.log('GIF loaded in img element');
                gifImg.onerror = (e) => console.error('Error loading GIF in img:', e);
                gifImg.src = URL.createObjectURL(blob);
                gifContainer.appendChild(gifImg);
                console.log('GIF added to container');
                resolve();
            } catch (error) {
                console.error('Error displaying GIF:', error);
                reject(error);
            }
        });

        gif.on('progress', progress => {
            console.log('GIF rendering progress:', Math.round(progress * 100) + '%');
        });

        gif.on('error', error => {
            console.error('Error generating GIF:', error);
            reject(error);
        });
        
        console.log('Starting GIF render');
        try {
            gif.render();
        } catch (error) {
            console.error('Error starting GIF render:', error);
            reject(error);
        }
    });
} 