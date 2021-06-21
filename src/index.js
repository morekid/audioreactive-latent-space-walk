import _ from 'lodash';
import './style.css';
import ImageGenerator from './classes/ImageGenerator.js';
import UI from './classes/UI.js';
import SoundManager from './classes/SoundManager.js';

let w = window;

/* usually set according to the frame rate of the final image sequenced movie */
w.fps = 30;

/* Multiple audio file options
    Attributes can be specified for each file
    that control how spectrums are merged into the vector.
    weight: scales the spectrum. Can be any value, 1 is the original amplitude 0 is like it's off.
    blend: how the current spectrum is merged with previous spectrum values.
        "normal" the default, will replace the spectrum each time, the most common approach, vector resembles the spectrum analysis.
        "add" will sum each time resulting in ever growing values (contained with pac man effect).
    flip: changes the orientation of the spectrum when applied to the vector.
        null no flip
        "h" flips horizontally
        "v" flips vertically
        "hv" flips both horizontally and vertically
    offset:adds an offset to the spectrum when applied to the vector.
        x: 0-1 range
        y: 0-1 range
        zero: true or false will also offset zero values
        Values are x,y coords in a 0-1 range, eg: {x: 0.2, y: 0.3}.

    All file spectrums will still be summed to each other so values can easily go past the vector bounds (-1, 1).
    Eg: To equally sum 4 files set their weight to 0.25.
*/
w.audioFiles = [
    { name: "Fires 14.1 - Drums.wav",     weight: 0.85,     blend: "normal",        flip: null,    offset: {x: 0, y: 0, zero: false} },
    { name: "Fires 14.1 - Whole.wav",     weight: 0.1,      blend: "normal",        flip: null,    offset: {x: 0.2, y: 0, zero: false} },
    { name: "Fires 14.1 - hi-lo.wav",     weight: 0.3,      blend: "normal",        flip: "h",     offset: {x: 0, y: 0, zero: false} },
    { name: "Fires 14.1 - Phrase.wav",    weight: 0.3,      blend: "normal",        flip: "h",     offset: {x: 0, y: 0, zero: false} }
]

w.config = {
    flipV: true,
    smoothing: 0.95
}

/* set to true for testing without RunwayML */
w.testRun = true;

/* Immediately draw the vector based on live analysis. Ignores "add" blend method for files */
w.vectorizeLiveAnalysis = true;

w.ig;
w.ui;
w.sm;

w.preload = () => {
    w.ig = new ImageGenerator();
    w.ui = new UI();
    w.sm = new SoundManager();
    w.sm.preload();
}

w.setup = () => {
    frameRate(w.fps);
    pixelDensity(1);
    angleMode(DEGREES);
    let p5js = createCanvas(512, 2048);
    p5js.parent("p5js");
    w.sm.setup();
}

w.draw = () => {
    clear();
    w.sm.update();
    w.ui.update();
}

w.globalAttemptGeneratingImage = () => {
    if (w.ui.vectorChanged && !w.ig.isGenerating) {
        w.ig.generateImage();
        w.ui.vectorChanged = false;
    }
}
