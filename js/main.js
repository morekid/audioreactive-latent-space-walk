class ImageGenerator {
    outputImage;
    isGenerating = false;
    count = 0;
    image = document.querySelector("#generated-image");
    job = {
        running: false,
        current: 0,
        vectors: [],
        last: null
    }

    generateImage(job) {
        this.isGenerating = true;
        const path = "http://localhost:8000/query"; //the default path used by Runway / StyleGAN for receiving post requests
        const data = {
            z: ui.vector, 
            truncation: 1
        };
        if (job) {
            httpPost(path, 'json', data, this.stepDone.bind(this), this.stepError.bind(this));
            // this.stepDone({ image: "" }) // comment previous and uncomment this for testing
        } else {
            httpPost(path, 'json', data, this.success.bind(this), this.error.bind(this));
        }
    }

    createImage(result) {
        this.image.src = result.image;
        this.count++;
        this.isGenerating = false;
    }

    error(error) {
        console.error(error);
        globalAttemptGeneratingImage();
    }

    success(result) {
        this.createImage(result);
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
        this.createImage(result);
        ui.actions.downloadBoth();

        this.job.current += 1;
        if (this.job.current < this.job.vectors.length) {
            let _this = this;
            setTimeout( function () {
                _this.stepJob();
            }, 100);
        }
        else this.jobDone();
    }

    stepError(error) {
        console.error(error);
        this.jobDone("error");
    }

    jobDone(error) {
        let last = "Generated ";
        if (error) last = "Interrupted at ";
        last += this.job.current + " images";
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
    isClicking = false;
    canvas;
    ctx;
    vector = StartVectors.zero; // copies initial vector
    vectorSize = { x: 512, y: 512 }
    vectorChanged = true;
    lastMousePos = { x: 0, y: 0 }
    fpsDisplay = document.querySelector("#fps-display")
    FFTStateDisplay = document.querySelector("#fft-state-display")
    FFTJobDisplay = document.querySelector("#fft-job-display")
    songTimingDisplay = document.querySelector("#song-timing-display")
    songDurationDisplay = document.querySelector("#song-duration-display")

    constructor() {
        this.initVectorDrawingCanvas();
        this.trackInputs();
    }

    initVectorDrawingCanvas() {
        this.canvas = document.querySelector('#matrix');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.fillStyle = '#fafafa';
        this.ctx.fillRect(0, 0, this.vectorSize.x, this.vectorSize.y);
    }

    update() {
        this.fpsDisplay.textContent = frameRate();
        this.drawSongWaveform();
        this.drawSongAmplitude();
        this.drawSongAmplitudeCircle();
        this.drawFFT();

        this.songTimingDisplay.textContent = Utils.formatMMSS(sm.song.currentTime());
        this.songDurationDisplay.textContent = Utils.formatMMSS(sm.song.duration());
    }

    trackInputs() {
        this.canvas.addEventListener('mousedown', e => {
            this.isClicking = true
        });
        this.canvas.addEventListener('mouseup', e => {
            this.isClicking = false
        });
        this.canvas.addEventListener('mousemove', e => {
            if (this.isClicking && e.offsetX >= 0 && e.offsetX < 512 && e.offsetY >= 0 && e.offsetY < 512) {
                this.lastMousePos.x = e.offsetX;
                this.lastMousePos.y = e.offsetY;
                this.applyXY(this.lastMousePos.x, this.lastMousePos.y);
            }
        });
        
        document.addEventListener('keypress', e => {
            if (e.key == "l") this.makeLineVector();
            if (e.key == "1") this.actions.downloadVector();
            if (e.key == "2") this.actions.downloadImage();
            if (e.key == "3") this.actions.downloadBoth();
            if (e.key == "0") this.actions.resetFFTAnalysis();
        });
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

    makeLineVector() {
        let y = this.lastMousePos.y
        let x = 0;
        while (x < 512) {
            this.applyXY(x, y);
            x++;
        }
    }

    applyXY(x, y) {
        let invertedY = this.vectorSize.y - y;
        let scaledInvertedY = map(invertedY, 0, this.vectorSize.y, -1, 1);

        // modify latent space vector
        this.vector[x] = scaledInvertedY;
        this.vectorChanged = true;

        this.drawVectorPoint(x, invertedY);

        globalAttemptGeneratingImage();
    }

    updateVector(vector) {
        this.vector = vector;
        this.vectorChanged = true;

        for (let i = 0; i < vector.length; i++) {
            let x = i;
            let y = vector[i];
            y = map(y, -1, 1, 0, this.vectorSize.y);
            this.drawVectorPoint(x, y);
        }
    }

    drawVectorPoint(x, y) {
        // draw matrix
        for (let i = 0; i < this.vectorSize.y; i++) { // reset line color
            this.ctx.fillStyle = '#fafafa';
            this.ctx.fillRect(x, i, 1, 1);
        }
        this.ctx.fillStyle = '#222222';
        this.ctx.fillRect(x, this.vectorSize.y-y, 1, 1);
    }

    drawSongWaveform() {
        let waveHeight = 100;

        stroke("#222222");
        noFill();
        push();
        beginShape();
        for (let i = 0; i < sm.wave.length; i++){
            let x = map(i, 0, sm.wave.length, 0, width);
            var h = map(sm.wave[i], -1, 1, -waveHeight/2, waveHeight/2);
            vertex(x, waveHeight/2-h);
        }
        endShape();
        pop();

        noStroke();
        fill(250, 100, 250);
        rect(map(sm.song.currentTime(), 0, sm.song.duration(), 0, width), 0, 2, waveHeight);

    }

    drawSongAmplitude() {
        let values;
        let w = width - 100;
        if (sm.ampValues.length > w) values = sm.ampValues.slice(-w)
        else values = sm.ampValues.slice();
            
        stroke("#222222");
        noFill();
        push();
        beginShape();
        for (var i = 0; i < values.length; i++) {
            var y = map(values[i], 0, 1, 200, 100);
            vertex(i, y);
        }
        endShape();
        pop();
    }

    drawFFT() {
        stroke("#222222");
        noFill();
        let lastSpectrum = sm.spectrums[sm.spectrums.length - 1];
        if (lastSpectrum) {
            push();
            beginShape();
            for (let i = 0; i < lastSpectrum.length; i++){
                let x = map(i, 0, lastSpectrum.length, 0, width);
                var h = map(lastSpectrum[i], 0, 255, 0, 100);
                vertex(x, 350-h);
            }
            endShape();
            pop();
        }
    }

    drawSongAmplitudeCircle() {
        let values;
        if (sm.ampValues.length > 360) values = sm.ampValues.slice(-360)
        else values = sm.ampValues.slice();

        stroke("#222222");
        noFill();
        push();
        translate(width -50, 150);
        beginShape();
        for (var i = 0; i < values.length; i++) {
            let r = 100;
            let scaledR = 10 + r * values[i];
            let x = scaledR * cos(i);
            let y = scaledR * sin(i);
            vertex(x, y);
        }
        endShape();
        pop();
    }

    actions = {
        parent: this,
        generatedImage: document.querySelector("#generated-image"),
        nameMeta() {
            return nf(ig.count, 4) + "--" + Utils.getFormattedTime();
        },
        downloadBoth() {
            this.downloadImage();
            this.downloadVector();
        },
        downloadImage() {
            let dataStr = this.generatedImage.src;
            let downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "img-" + this.nameMeta() + ".png");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();

            let getImgFeedback = document.querySelector("#get-image");
            getImgFeedback.classList.add("is-showing");
            setTimeout(function () {
                getImgFeedback.classList.remove("is-showing")
            }, 200);
        },
        downloadVector() {
            let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.parent.vector));
            let downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download",  "vec-" + this.nameMeta() + ".json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();

            let getVectorFeedback = document.querySelector("#get-vector");
            getVectorFeedback.classList.add("is-showing");
            setTimeout(function () {
                getVectorFeedback.classList.remove("is-showing")
            }, 200);
        },
        resetFFTAnalysis() {
            sm.resetFFTAnalysis();
        },
        toggleAudio() {
            sm.toggleAudio();
        },
        generateFFTWalk() {
            let vectors = Utils.mapFFTToLatentSpaceRange(sm.spectrums);
            ig.startJob(vectors);
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

        if (this.song.isPlaying() && this.shouldAnalyse) {
            this.getFFT();
        }
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
    static formatMMSS(time) {
        var minutes = Math.floor(time / 60);
        var seconds = (time - minutes * 60).toFixed(2);
        if (minutes.toString().length < 2) minutes = "0" + minutes;
        if (seconds.toString().length < 5) seconds = "0" + seconds;
        return minutes + ":" + seconds;
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
}

function globalAttemptGeneratingImage() {
    if (ui.vectorChanged && !ig.isGenerating) {
        ig.generateImage();
        ui.vectorChanged = false;
    }
}