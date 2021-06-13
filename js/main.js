class Utils {
    static getFormattedTime() {
        let d = new Date();
        return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate() + "-" + d.getHours() + "-" + d.getMinutes() + "-" + d.getSeconds();
    }
    static formatMMSS(time) {
        var minutes = Math.floor(time / 60);
        var seconds = (time - minutes * 60).toFixed(2);
        if (minutes.toString().length < 2) minutes = "0" + minutes;
        if (seconds.toString().length < 5) seconds = "0" + seconds;
        return minutes + ":" + seconds;
    }
}

class ImageGenerator {
    testRun = true; // set to true for testing without RunwayML
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
            z: w.ui.vector, 
            truncation: 1
        };
        if (job) {
            if (!this.testRun) httpPost(path, 'json', data, this.stepDone.bind(this), this.stepError.bind(this));
            else this.stepDone();
        } else {
            if (!this.testRun) httpPost(path, 'json', data, this.success.bind(this), this.error.bind(this));
            else this.success();
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
        if (!this.testRun) this.createImage(result);
        globalAttemptGeneratingImage();
    }

    startJob(vectors) {
        this.job.running = true;
        this.job.current = 0;
        this.job.vectors = vectors;
        this.stepJob();
        w.ui.updateJobDisplay();
    }

    stepJob() {
        w.ui.updateVector(this.job.vectors[this.job.current])
        this.generateImage(true);
        w.ui.updateJobDisplay();
    }

    stepDone(result) {
        if (!this.testRun) {
            this.createImage(result);
            w.ui.actions.downloadBoth();
        }

        this.job.current += 1;
        if (this.job.current < this.job.vectors.length) {
            let _this = this;
            if (!this.testRun)  {
                setTimeout( function () {
                    _this.stepJob();
                }, 100);
            } else {
                setTimeout( function () {
                    _this.stepJob();
                }, 33.3);
                
            }
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
        w.ui.updateJobDisplay();
    }
}

class UI {
    vector = StartVectors.zero; // copies initial vector
    vectorSize = { x: 512, y: 512 }
    vectorChanged = true;
    fpsDisplay = document.querySelector("#fps-display")
    FFTStateDisplay = document.querySelector("#fft-state-display")
    FFTJobDisplay = document.querySelector("#fft-job-display")
    FFTPlaybackDisplay = document.querySelector("#fft-playback-display")
    vectorAreaOffset = this.vectorSize.y + 48;

    constructor() {
        this.trackInputs();
    }

    update() {
        this.fpsDisplay.textContent = frameRate().toFixed(2);
        this.trackMouse();
        this.drawVector();
        this.drawWaveforms();
        this.drawSongAmplitude();
        this.drawSongAmplitudeCircle();
        this.drawFFT();
        this.updatePlaybackDisplay()
    }

    trackMouse() {
        if (mouseIsPressed) {
            if (mouseX >= 0 && mouseX < this.vectorSize.x && mouseY >= 0 && mouseY < this.vectorSize.y) {
                this.applyXY(mouseX, mouseY);
            }
        }
    }

    trackInputs() {
        document.addEventListener('keypress', e => {
            if (e.key == "l") this.makeLineVector();
            if (e.key == "1") this.actions.downloadVector();
            if (e.key == "2") this.actions.downloadImage();
            if (e.key == "3") this.actions.downloadBoth();
            if (e.key == "0") this.actions.resetFFTAnalysis();
        });
    }

    makeLineVector() {
        let x = 0;
        while (x < this.vectorSize.y) {
            this.applyXY(x, mouseY);
            x++;
        }
    }

    applyXY(x, y) {
        let scaledInvertedY = map(y, 0, this.vectorSize.y, 1, -1);

        // modify latent space vector
        this.vector[x] = scaledInvertedY;
        this.vectorChanged = true;

        globalAttemptGeneratingImage();
    }

    updateVector(vector) {
        this.vector = vector;
        this.vectorChanged = true;
    }

    drawVector() {
        fill("#fafafa");
        noStroke();
        rect(0, 0, this.vectorSize.x, this.vectorSize.y);
        for (let i = 0; i < this.vector.length; i++) {
            let x = i;
            let scaledInvertedY = this.vector[i];
            let y = map(scaledInvertedY, 1, -1, 0, this.vectorSize.y);
            stroke("#222222");
            noFill();
            strokeWeight(1);
            push();
            translate(0, 0);
            point(x, y);
            pop();
        }
    }

    drawWaveforms() {
        let waveHeight = 50;
        stroke("#222222");
        noFill();
        for (let [i, wave] of w.sm.waves.entries()) {
            push();
            translate(0, this.vectorAreaOffset + waveHeight * i * 4);
            beginShape();
            for (let j = 0; j < wave.length; j++){
                let x = map(j, 0, wave.length, 0, width);
                var h = map(wave[j], -1, 1, -waveHeight/2, waveHeight/2);
                vertex(x, waveHeight/2-h);
            }
            endShape();
            pop();
        }
        noStroke();
        fill(250, 100, 250);
        for (let [i, track] of w.sm.tracks.entries()) {
            push();
            translate(0, this.vectorAreaOffset + (waveHeight * i * 4));
            rect(map(track.currentTime(), 0, track.duration(), 0, width), 0, 2, waveHeight);
            pop();
        }
    }

    drawSongAmplitude() {
        let waveHeight = 50;
        let wdth = width - 100;
        stroke("#222222");
        noFill();
        for (let [i, amplitude] of w.sm.amplitudes.entries()) {
            let values;
            if (amplitude.length > wdth) values = amplitude.slice(-wdth)
            else values = amplitude.slice();
                
            push();
            translate(0, this.vectorAreaOffset + waveHeight + (waveHeight * i * 4));
            beginShape();
            for (var j = 0; j < values.length; j++) {
                var y = map(values[j], 0, 1, waveHeight, 0);
                vertex(j, y);
            }
            endShape();
            pop();
        }
    }

    drawSongAmplitudeCircle() {
        let waveHeight = 50;
        stroke("#222222");
        noFill();
        for (let [i, amplitude] of w.sm.amplitudes.entries()) {
            let values;
            if (amplitude.length > 360) values = amplitude.slice(-360)
            else values = amplitude.slice();
    
            push();
            translate(width - 50, this.vectorAreaOffset + (waveHeight * 1.5) + (waveHeight * i * 4));
            beginShape();
            for (var j = 0; j < values.length; j++) {
                let r = 50;
                let scaledR = 10 + r * values[j];
                let x = scaledR * cos(j);
                let y = scaledR * sin(j);
                vertex(x, y);
            }
            endShape();
            pop();
        }
    }

    drawFFT() {
        let waveHeight = 50;
        stroke("#222222");
        noFill();
        for (let [i, spectrums] of w.sm.analysis.entries()) {
            let lastSpectrum = spectrums[spectrums.length - 1];
            if (lastSpectrum) {
                push();
                translate(0, this.vectorAreaOffset + (waveHeight * 2) + (waveHeight * i * 4));
                beginShape();
                for (let j = 0; j < lastSpectrum.length; j++){
                    let x = map(j, 0, lastSpectrum.length, 0, width);
                    var h = map(lastSpectrum[j], 0, 255, 0, waveHeight);
                    vertex(x, waveHeight-h);
                }
                endShape();
                pop();
            }
        }
    }

    updateAnalysisDisplay() {
        let text = "";
        let tracksAmt = 0;
        if (w.sm.shouldAnalyse) {
            text += "Analysing "
            for (let track of w.sm.tracks) {
                if (track.isPlaying()) tracksAmt++;
            }
            text += tracksAmt + " of " + w.sm.tracks.length + " tracks"
        } else {
            let analysed = 0;
            for (let spectrums of w.sm.analysis) {
                if (spectrums.length > 0) {
                    analysed++;
                }
            }
            if (analysed) {
                text += "Analysed " + analysed + " of " + w.sm.analysis.length + " tracks"
            } else {
                text += "-"
            }
        }
        this.FFTStateDisplay.textContent = text;
    }

    updateJobDisplay() {
        if (w.ig.job.running) {
            this.FFTJobDisplay.textContent = "Generating " + (w.ig.job.current + 1) + " of " + (w.ig.job.vectors.length) + " images";
        } else {
            if (w.ig.job.last) {
                this.FFTJobDisplay.textContent = w.ig.job.last;
            } else {
                this.FFTJobDisplay.textContent = "-";
            }
        }
        if (w.ig.testRun) this.FFTJobDisplay.textContent = "(Test Run) " + this.FFTJobDisplay.textContent;
    }

    updatePlaybackDisplay() {
        let text = "";
        for (let track of w.sm.tracks) {
            if (track.isPlaying()) text += "Playing "
            else text += "Cued ";
            text += "\"" + track.file + "\"";
            text += '<br>';
            text += "Elapsed " + Utils.formatMMSS(track.currentTime()) + " of " + Utils.formatMMSS(track.duration())
            text += '<br>';
            text += '<br>';
        }
        this.FFTPlaybackDisplay.innerHTML = text;
    }

    actions = {
        parent: this,
        generatedImage: document.querySelector("#generated-image"),
        nameMeta() {
            return nf(w.ig.count, 4) + "--" + Utils.getFormattedTime();
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
            w.sm.resetFFTAnalysis();
        },
        toggleAudio() {
            w.sm.toggleAudio();
        },
        generateFFTWalk() {
            let mergedSpectrums = VectorComposer.mergeMultipleSpectrums(w.sm.analysis);
            let vectors = VectorComposer.mapFFTToLatentSpaceRange(mergedSpectrums);
            w.ig.startJob(vectors);
        }
    }
}

class SoundManager {
    files = w.audioFiles
    tracks = [];
    ffts = [];
    analysis = [];
    waves = [];
    amps = [];
    amplitudes = [];

    preload() {
        for (let [i, file] of this.files.entries()) {
            this.tracks.push(loadSound('assets/' + file.name));
            this.analysis[i] = [];
            this.waves[i] = [];
            this.amplitudes[i] = [];
        }
    }

    setup() {
        this.getWaves();
        for (let track of this.tracks) {
            let amp = new p5.Amplitude()
            amp.setInput(track);
            this.amps.push(amp)

            let fft = new p5.FFT(0.9, 512);
            fft.setInput(track);
            this.ffts.push(fft);

            // first track ending will stop all analysis
            track.onended(this.stopFFTAnalysis.bind(this));
        }
    }

    getWaves() {
        for (let [i, track] of this.tracks.entries()) {
            let frames = w.fps * track.duration();
            this.waves[i] = track.getPeaks(frames);
        }
    }

    update() {
        for (let [i, amp] of this.amps.entries()) {
            this.amplitudes[i].push(amp.getLevel());
        }
        this.getFFTs();
    }

    startFFTAnalysis() {
        if (!this.shouldAnalyse) {
            for (let i = 0; i < this.analysis.length; i++) {
                this.analysis[i] = []
            }
            this.shouldAnalyse = true;
            w.ui.updateAnalysisDisplay();
        }
    }

    getFFTs() {
        if (this.shouldAnalyse) {
            for (let [i, track] of this.tracks.entries()) {
                if (track.isPlaying()) {
                    let spectrum = this.ffts[i].analyze();
                    this.analysis[i].push(spectrum);
                }
            }
        }
    }

    resetFFTAnalysis() {
        for (let track of this.tracks) {
            track.stop();
        }
        for (let i = 0; i < this.analysis.length; i++) {
            this.analysis[i] = []
        }
        w.ui.updateAnalysisDisplay();
    }

    stopFFTAnalysis() {
        if (this.shouldAnalyse) {
            this.shouldAnalyse = false;
            w.ui.updateAnalysisDisplay();
        }
    }

    toggleAudio() {
        let playing = false;
        for (let track of this.tracks) {
            if (track.isPlaying()) {
                track.stop();
            } else {
                track.play();
                playing = true;
            }
        }
        if (playing) this.startFFTAnalysis();
    }
}

class VectorComposer {
    static mergeMultipleSpectrums(analysis) {
        let mergedSpectrums = []
        for (let [i, spectrums] of analysis.entries()) {
            let weight = w.audioFiles[i].weight;
            let blend = w.audioFiles[i].blend;
            let prevSpectrum = [];
            for (let [j, spectrum] of spectrums.entries()) {
                if (!mergedSpectrums[j]) mergedSpectrums[j] = []
                for (let [k, value] of spectrum.entries()) {
                    value *= weight
                    if (blend == "add") {
                        // sum previous value to current
                        if (!prevSpectrum[k]) prevSpectrum[k] = 0;
                        prevSpectrum[k] += value;
                        if (prevSpectrum[k] > 255) prevSpectrum[k] -= 255; // check bounds after summing
                        value = prevSpectrum[k];
                    }
                    if (!mergedSpectrums[j][k]) mergedSpectrums[j][k] = 0
                    mergedSpectrums[j][k] += value;
                    if (mergedSpectrums[j][k] > 255) mergedSpectrums[j][k] -= 255; // check bounds after summing
                }
            }
        }
        return mergedSpectrums;
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

let w = window;

/* usually set according to the frame rate of the final image sequenced movie */
w.fps = 30;

/* Multiple audio file options
    Attributes can be specified for each file
    that control how spectrums are merged into the vector.
    weight: scales the spectrum. Can be any value, 1 is the original amplitude 0 is like it's off.
    blend: how the current spectrum is merged with previous spectrum values.
        "normal" will replace each time, the most common approach, vector resembles the spectrum analysis.
        "add" will sum each time resulting in ever growing values (contained with pac man effect).
    
    All file spectrums will still be summed to each other so values can easily go past the vector bounds (-1, 1).
    E.g.: To equally sum 4 files set their weight to 0.25.
*/
w.audioFiles = [
    // { name: "11 Girl.mp3", weight: 1, method: "absolute" },
    { name: "Fires 14.1 - 45s - Drums.wav", weight: 0.5, blend: "normal" },
    { name: "Fires 14.1 - 45s - Whole.wav", weight: 0.01, blend: "add" },
    { name: "Fires 14.1 - 45s - hi-lo.wav", weight: 0, blend: "normal" },
    { name: "Fires 14.1 - 45s - Phrase.wav", weight: 0, blend: "normal" }
]

w.ig;
w.ui;
w.sm;

function preload() {
    w.ig = new ImageGenerator()
    w.ui = new UI()
    w.sm = new SoundManager()
    w.sm.preload();
}

function setup() {
    frameRate(w.fps);
    pixelDensity(1);
    angleMode(DEGREES);
    let p5js = createCanvas(512, 2048);
    p5js.parent("p5js");
    w.sm.setup();
}

function draw() {
    clear();
    w.sm.update();
    w.ui.update();
}

function globalAttemptGeneratingImage() {
    if (w.ui.vectorChanged && !w.ig.isGenerating) {
        w.ig.generateImage();
        w.ui.vectorChanged = false;
    }
}