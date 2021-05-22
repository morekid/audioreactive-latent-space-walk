class ImageGenerator {
    outputImage;
    isGenerating = false;
    count = 0;
    job = {
        running: false,
        current: 0,
        vectors: [],
        last: null
    }

    generateImage(job) {
        this.isGenerating = true;
        const path = "http://localhost:8002/query"; //the default path used by Runway / StyleGAN for receiving post requests
        const data = {
            z: ui.vector, 
            truncation: 1
        };
        if (job) {
            httpPost(path, 'json', data, this.stepDone.bind(this), this.stepError.bind(this));
        } else {
            httpPost(path, 'json', data, this.success.bind(this), this.error.bind(this));
        }
    }

    error(error) { //if the generate image post request fails
        console.error(error);
        globalAttemptGeneratingImage();
    }

    success(result) {
        let image = document.querySelector("#generated-image");
        image.src = result.image;
        this.imageCreated();
    }

    imageCreated() {
        this.count++;
        this.isGenerating = false;
        globalAttemptGeneratingImage();
    }

    startJob(vectors) {
        this.job.running = true;
        this.job.current = 0;
        this.job.vectors = vectors;
        this.stepJob();
        ui.updateJobDisplay();
    }

    stepJob() {
        ui.updateVector(this.job.vectors[this.job.current])
        this.generateImage(true);
        ui.updateJobDisplay();
    }

    stepDone(result) {
        let image = document.querySelector("#generated-image");
        image.src = result.image;
        ui.actions.downloadBoth();

        this.job.current += 1;
        if (this.job.current <= this.job.vectors.length) this.stepJob();
        else this.jobDone();
    }

    stepError(error) {
        console.error(error);
        this.jobDone("error");
    }

    jobDone(error) {
        let last = "Generated ";
        if (error) last = "Interrupted at ";
        last += (this.job.current + 1) + " images";
        this.job = {
            running: false,
            current: 0,
            vectors: [],
            last: last
        }
        ui.updateJobDisplay();
    }

}

class UI {
    canvas;
    ctx;
    vector = StartVectors.zero; // copies initial vector
    vectorSize = { x: 512, y: 512 }
    vectorChanged = true;
    lastMousePos = { x: 0, y: 0 }
    fpsDisplay = document.querySelector("#fps-display")
    FFTStateDisplay = document.querySelector("#fft-state-display")
    FFTJobDisplay = document.querySelector("#fft-job-display")

    constructor() {
        this.initVectorDrawingCanvas();
        this.trackInputs();
    }

    update() {
        this.fpsDisplay.textContent = frameRate();
    }

    updateAnalysisDisplay() {
        if (sm.song.isPlaying() && sm.shouldAnalyse) {
            this.FFTStateDisplay.textContent = "Analysing...";
        } else if (!sm.song.isPlaying() && sm.shouldAnalyse) {
            this.FFTStateDisplay.textContent = "-";
        } else if (!sm.song.isPlaying() && !sm.shouldAnalyse) {
            this.FFTStateDisplay.textContent = "Done";
        }
    }

    updateJobDisplay() {
        if (ig.job.running) {
            this.FFTJobDisplay.textContent = "Generating " + (ig.job.current + 1) + " of " + (ig.job.vectors.length) + " images";
        } else {
            if (ig.job.last) {
                this.FFTJobDisplay.textContent = ig.job.last;
            } else {
                this.FFTJobDisplay.textContent = "-";
            }
        }
    }

    initVectorDrawingCanvas() {
        this.canvas = document.querySelector('#matrix');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.fillStyle = '#fafafa';
        this.ctx.fillRect(0, 0, this.vectorSize.x, this.vectorSize.y);
    }

    trackInputs() {
        this.canvas.addEventListener('mousemove', e => {
            if (e.offsetX >= 0 && e.offsetX < 512 && e.offsetY >= 0 && e.offsetY < 512) {
                this.lastMousePos.x = e.offsetX;
                this.lastMousePos.y = e.offsetY;
                this.applyXY(this.lastMousePos.x, this.lastMousePos.y);
            }
        });
        
        document.addEventListener('keypress', e => {
            if (e.key == "l") this.makeLine();
            if (e.key == "1") this.actions.downloadVector();
            if (e.key == "2") this.actions.downloadImage();
            if (e.key == "3") this.actions.downloadBoth();
            if (e.key == "0") this.actions.resetFFTAnalysis();
        });
    }

    makeLine() {
        let x = this.lastMousePos.x
        let y = 0;
        while (y < 512) {
            this.applyXY(x, y);
            y++;
        }
    }

    applyXY(x, y) {
        let scaledX = (x / this.vectorSize.x * 2) - 1;

        // modify latent space vector
        this.vector[y] = scaledX;
        this.vectorChanged = true;

        this.drawVectorPoint(x, y);

        globalAttemptGeneratingImage();
    }

    updateVector(vector) {
        this.vector = vector;
        this.vectorChanged = true;

        for (let i = 0; i < vector.length; i++) {
            let y = i;
            let x = vector[i];
            x = map(x, -1, 1, 0, this.vectorSize.x);
            this.drawVectorPoint(x, y);
        }
    }

    drawVectorPoint(x, y) {
        // draw matrix
        for (let i = 0; i < this.vectorSize.x; i++) { // reset line color
            this.ctx.fillStyle = '#fafafa';
            // if (i < x) this.ctx.fillStyle = '#f0f0f0';
            this.ctx.fillRect(i, y, 1, 1);
        }
        this.ctx.fillStyle = '#222222';
        this.ctx.fillRect(x, y, 1, 1);
    }

    actions = {
        parent: this,
        generatedImage: document.querySelector("#generated-image"),
        downloadBoth() {
            this.downloadImage();
            this.downloadVector();
        },
        downloadImage: function () {
            // save(`img_${nf(ig.count, 4)}--${Utils.getFormattedTime()}`);
            // let saveImgFeedback = document.querySelector("#save-image");
            // saveImgFeedback.classList.add("is-showing");
            // setTimeout(function () {
            //     saveImgFeedback.classList.remove("is-showing")
            // }, 200);
            
            let dataStr = this.generatedImage.src;
            let downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `img_${nf(ig.count, 4)}--${Utils.getFormattedTime()}.png`);
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        },
        downloadVector() {
            let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.parent.vector));
            let downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "vectors-" + Utils.getFormattedTime() + ".json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        },
        saveVector: function () {
            let d = new Date();
            localStorage.setItem("img_" + nf(ig.count, 4) + "--" + Utils.getFormattedTime(), this.parent.vector);
            let saveVectorFeedback = document.querySelector("#save-vector");
            saveVectorFeedback.classList.add("is-showing");
            setTimeout(function () {
                saveVectorFeedback.classList.remove("is-showing")
            }, 200);
        },
        downloadVectors() {
            let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localStorage, null, 2));
            let downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "vectors-" + Utils.getFormattedTime() + ".json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        },
        resetFFTAnalysis() {
            sm.resetFFTAnalysis();
        },
        toggleAudio() {
            sm.toggleAudio();
        },
        generateFFTWalk() {
            let vectors = Utils.mapFFTToLatentSpaceRange(sm.spectrums);
            ui.startJob(vectors);
        }
    }
}

class SoundManager {
    song;
    amp;
    ampValues = [];
    wave = [];
    fft;
    spectrums = [];
    shouldAnalyse = true;

    preload() {
        this.song = loadSound('assets/04 No.mp3');
    }

    setup() {
        this.amp = new p5.Amplitude()
        this.getWave();
        this.fft = new p5.FFT(0.8, 512);
        this.song.onended(this.stopFFTAnalysis.bind(this));
    }

    update() {
        this.ampValues.push(this.amp.getLevel())
        // this.drawSoundLine();
        // this.drawSoundCircle();
        if (this.song.isPlaying() && this.shouldAnalyse) {
            this.getFFT();
        }
        // this.drawFFT();
        // this.drawWave();
    }

    toggleAudio() {
        if (this.song.isPlaying()) {
            this.song.stop();
        } else {
            this.song.play();
            this.startFFTAnalysis();
        }
    }

    getWave() {
        let frames = fps * this.song.duration()
        this.wave = this.song.getPeaks(frames);
    }

    drawWave() {
        stroke(250);
        noFill();
        for (let i = 0; i < this.wave.length; i++){
            let x = map(i, 0, this.wave.length, 0, width);
            var h = map(this.wave[i], -1, 1, -100, 100);
            line(x, height/2, x, height/2-h);
        }

        noStroke();
        fill(0,255,0);
        rect(map(this.song.currentTime(), 0, this.song.duration(), 0, width), 0, 5, height);
    }

    startFFTAnalysis() {
        this.spectrums = [];
        this.shouldAnalyse = true;
        ui.updateAnalysisDisplay();
    }

    resetFFTAnalysis() {
        this.song.stop();
        this.spectrums = [];
        this.shouldAnalyse = true;
        ui.updateAnalysisDisplay();
    }

    stopFFTAnalysis() {
        this.shouldAnalyse = false;
        setTimeout(function () {
            ui.updateAnalysisDisplay();
        }, 100)
    }

    getFFT() {
        let spectrum = this.fft.analyze();
        this.spectrums.push(spectrum);
    }

    drawFFT() {
        let lastSpectrum = this.spectrums[this.spectrums.length - 1];
        if (lastSpectrum) {
            for (let i = 0; i < lastSpectrum.length; i++){
                let x = map(i, 0, lastSpectrum.length, 0, width);
                var h = map(lastSpectrum[i], 0, 255, 0, 100);
                line(x, height/2, x, height/2-h);
            
            }
        }
    }

    drawSoundCircle() {
        let values;
        if (this.ampValues.length > 360) values = this.ampValues.slice(-360)
        else values = this.ampValues.slice();

        stroke(250);
        noFill();
        push();
        translate(width / 2, height / 2);
        beginShape();
        for (var i = 0; i < values.length; i++) {
            let r = 3000;
            let scaledR = 100 + r * values[i];
            let x = scaledR * cos(i);
            let y = scaledR * sin(i);
            vertex(x, y);
        }
        endShape();
        pop();
    }

    drawSoundLine() {
        let values;
        if (this.ampValues.length > width) values = this.ampValues.slice(-width)
        else values = this.ampValues.slice();
            
        stroke(250);
        noFill();
        push();
        beginShape();
        for (var i = 0; i < values.length; i++) {
            var y = map(values[i], 0, 1, height, 0);
            vertex(i, y);
        }
        endShape();
        pop();
    }
}

class Utils {
    static getFormattedTime() {
        let d = new Date();
        return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate() + "-" + d.getHours() + "-" + d.getMinutes() + "-" + d.getSeconds();
    }
    static mapFFTToLatentSpaceRange(spectrums) {
        let vectors = [];
        for (let i = 0; i < spectrums.length; i++) {
            let vector = [];
            let spectrum = spectrums[i];
            for (let j = 0; j < spectrum.length; j++) {
                let mapped = map(spectrum[j], 0, 255, -1, 1);
                vector.push(mapped);
            }
            vectors.push(vector);
        }
        return vectors;
    }
}

let ig;
let ui;
let sm;
let fps = 30;

function preload() {
    ig = new ImageGenerator()
    ui = new UI()
    sm = new SoundManager()
    sm.preload();
}

function setup() {
    frameRate(fps);
    pixelDensity(1);
    angleMode(DEGREES);
    let p5js = createCanvas(1024, 1024);
    p5js.parent("p5js");
    sm.setup();
}

function draw() {
    clear();
    sm.update();
    ui.update();

    // setInterval(function () {
    //     if(ui.vectorChanged && !ig.isGenerating) {
    //         ig.generateImage();
    //         ui.vectorChanged = false;
    //     }
    // }, 40);
}

function globalAttemptGeneratingImage() {
    if (ui.vectorChanged && !ig.isGenerating) {
        ig.generateImage();
        ui.vectorChanged = false;
    }
}