let w = window

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

            let fft = new p5.FFT(w.config.smoothing, 512);
            fft.setInput(track);
            this.ffts.push(fft);

            // first track ending will stop all analysis
            track.onended(this.stopAnalysis.bind(this));
        }
    }

    getWaves() {
        for (let [i, track] of this.tracks.entries()) {
            let frames = w.fps * track.duration();
            this.waves[i] = track.getPeaks(frames);
        }
    }

    update() {
        this.getAmplitudes();
        this.getFFTs();
    }

    initCollectingAmplitudes() {
        for (let i = 0; i < this.amplitudes.length; i++) {
            this.amplitudes[i] = []
        }
    }

    getAmplitudes() {
        if (this.shouldAnalyse) {
            for (let [i, amp] of this.amps.entries()) {
                this.amplitudes[i].push(amp.getLevel());
            }
        }
    }

    initFFTAnalysis() {
        for (let i = 0; i < this.analysis.length; i++) {
            this.analysis[i] = []
        }
        w.ui.updateAnalysisDisplay();
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

    stopAnalysis() {
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
        if (playing) {
            if (!this.shouldAnalyse) {
                this.initCollectingAmplitudes();
                this.initFFTAnalysis();
                this.shouldAnalyse = true;
            }
        }
    }
}

export default SoundManager