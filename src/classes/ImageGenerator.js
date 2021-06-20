let w = window

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
            z: w.ui.vector, 
            truncation: 1
        };
        if (job) {
            if (!w.testRun) httpPost(path, 'json', data, this.stepDone.bind(this), this.stepError.bind(this));
            else this.stepDone();
        } else {
            if (!w.testRun) httpPost(path, 'json', data, this.success.bind(this), this.error.bind(this));
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
        w.globalAttemptGeneratingImage();
    }

    success(result) {
        if (!w.testRun) this.createImage(result);
        w.globalAttemptGeneratingImage();
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
        if (!w.testRun) {
            this.createImage(result);
            w.ui.actions.downloadBoth();
        }

        this.job.current += 1;
        if (this.job.current < this.job.vectors.length) {
            let _this = this;
            if (!w.testRun)  {
                setTimeout( function () {
                    _this.stepJob();
                }, 10);
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

export default ImageGenerator