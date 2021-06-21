# Audio-reactive Latent Space Explorer
A StyleGAN latent space navigator using audio and 2d vector drawing. Builds latent space vectors from multiple audio files concurrently, with a number of options for shaping the audio into the vector space: amplitude, orientation, offsetting, etc.

Uses p5.js and Webpack, requests StyleGAN images from RunwayML models.

## To run
`npm install`

`npm run serve`

Set `w.testRun = false` to effectively pull images from the running RunwayML model.
