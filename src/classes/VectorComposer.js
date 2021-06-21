let w = window

class VectorComposer {
    static mergeMultipleSpectrums(analysis) {
        let mergedSpectrums = []
        for (let [i, spectrums] of analysis.entries()) {
            let weight = w.audioFiles[i].weight;
            let blend = w.audioFiles[i].blend;
            let flip = w.audioFiles[i].flip;
            let offset = w.audioFiles[i].offset;
            
            let prepped = []
            if (blend == "add") {
                prepped = this.prepForAdd(spectrums, weight)
            } else {
                prepped = this.prepForNormal(spectrums, weight)
            }

            if (flip == "h") {
                prepped = this.flipHorizontal(prepped)
            } else if (flip == "v") {
                prepped = this.flipVertical(prepped)
            } else if (flip == "hv") {
                prepped = this.flipHorizontal(prepped)
                prepped = this.flipVertical(prepped)
            }

            if (offset) {
                prepped = this.offset(prepped, offset)
            }

            let merged = this.merge(prepped, mergedSpectrums);
            mergedSpectrums = merged;
        }
        let limitedMerged = this.pacManLimit(mergedSpectrums);
        if (w.config.flipV) limitedMerged = this.flipMergedVertical(limitedMerged);
        return limitedMerged;
    }

    static prepForNormal(spectrums, weight) {
        return spectrums.map((spectrum) => {
            return spectrum.map((value) => {
                return value * weight;
            })
        })
    }

    static prepForAdd(spectrums, weight) {
        let cumulativeSpectrum = [];
        return spectrums.map((spectrum) => {
            cumulativeSpectrum = spectrum.map((value, i) => {
                return (value * weight + (cumulativeSpectrum[i] ?? 0));
            })
            return cumulativeSpectrum;
        })
    }

    static flipHorizontal(spectrums) {
        return spectrums.map((spectrum) => {
            return spectrum.reverse();
        })
    }

    static flipVertical(spectrums) {
        return spectrums.map((spectrum) => {
            return spectrum.map((value) => {
                return value *= -1
            })
        })
    }

    static offset(spectrums, offset) {
        return spectrums.map((spectrum) => {
            if (offset.x) {
                let splitPoint = parseInt(spectrum.length * (1 - offset.x));
                let end = spectrum.splice(0, splitPoint)
                spectrum = spectrum.concat(end)
            }
            if (offset.y) {
                spectrum = spectrum.map((value) => {
                    if (value != 0 || offset.zero) {
                        value = parseInt(value + (offset.y * 255))
                    } 
                    return value
                })
            }
            return spectrum
        })
    }

    static merge(spectrums, mergedSpectrums) {
        return spectrums.map((spectrum, i) => {
            return spectrum.map((value, j) => {
                return value + (mergedSpectrums[i] ? mergedSpectrums[i][j] ?? 0 : 0)
            })
        })
    }

    static pacManLimit(spectrums) {
        return spectrums.map((spectrum, i) => {
            return spectrum.map((value, j) => {
                value %= 255
                return value < 0 ? value + 255 : value
            })
        })
    }

    static flipMergedVertical(spectrums) {
        return spectrums.map((spectrum) => {
            return spectrum.map((value) => {
                return 255 - value
            })
        })
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

export default VectorComposer