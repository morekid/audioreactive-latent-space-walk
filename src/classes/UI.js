import StartVectors from "./StartVectors.js";
import Utils from './Utils';
import VectorComposer from './VectorComposer';

let w = window

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
        if (w.vectorizeLiveAnalysis && w.sm.shouldAnalyse) this.pullSMVectorUpdate();
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

        w.globalAttemptGeneratingImage();
    }

    pullSMVectorUpdate() {
        let hasData = false;
        let analysisSlice = w.sm.analysis.map((spectrums) => {
            let spectrum = spectrums[spectrums.length - 1 ?? 0];
            if (spectrum) {
                hasData = true;
                return [spectrums[spectrums.length - 1 ?? 0]];
            } else {
                hasData = false;
                return null;
            };
        })
        if (hasData) this.actions.generateVectorPreview(analysisSlice);
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
            if (w.ig.job.running) {
                fill(0, 200, 80);
                rect(map(w.ig.job.current, 0, track.duration() * w.fps, 0, width), 0, 2, waveHeight);
            }
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
        if (w.testRun) this.FFTJobDisplay.textContent = "(Test Run) " + this.FFTJobDisplay.textContent;
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
            downloadAnchorNode.setAttribute("download", "img-" + this.nameMeta() + ".jpg");
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
        toggleAudio() {
            w.sm.toggleAudio();
        },
        generateFFTWalk() {
            let mergedSpectrums = VectorComposer.mergeMultipleSpectrums(w.sm.analysis);
            let vectors = VectorComposer.mapFFTToLatentSpaceRange(mergedSpectrums);
            w.ig.startJob(vectors);
        },
        generateVectorPreview(analysisSlice) {
            let mergedSpectrums = VectorComposer.mergeMultipleSpectrums(analysisSlice);
            let vectors = VectorComposer.mapFFTToLatentSpaceRange(mergedSpectrums);
            this.parent.updateVector(vectors[0]);
        }
    }
}

export default UI